/**
 * SPIKE — not part of the published pipeline. Run with `npm run spike:digests`.
 *
 * Builds meeting-preview and monthly-Stadtteil digests from artifacts already in
 * `docs/`. Reads no network data and writes nothing into `docs/`; output goes to
 * `spike-output/` so the result can be judged without touching published files.
 *
 * Flags:
 *   --dry-run            select targets and report coverage, make no model calls
 *   --now=<ISO date>     simulate the run date (meeting digests are date-driven)
 *   --kind=meetings|districts|both
 *   --month=YYYY-MM      month for district digests (default: previous month)
 *   --district=<name>    restrict district digests to one Stadtteil
 *   --limit=<n>          cap model calls (default 6)
 *   --out=<dir>          output directory (default spike-output)
 *   --model=<id>         override DIGEST_MODEL for this run
 *   --no-citywide        omit the shared stadtweit section; district digests then
 *                        carry only papers attributed to that Stadtteil
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { slugifyFeedSegment } from '../filtered-feed-contract.js';
import { canonicalStringify, docsPath, recordBasename } from '../docs-files.js';
import { logger } from '../logger.js';
import {
  PAPER_DISTRICT_INDEX_FILE_NAME,
  PaperDistrictIndex,
} from '../services/paper-district-index-service.js';
import { stores } from '../store/index.js';
import { Paper, PaperSummary } from '../types/index.js';
import { findUngroundedNumericLiterals } from '../services/llm/summary-grounding.js';
import {
  digestSourceHash,
  selectCityWideDigestCandidate,
  selectDistrictDigestCandidates,
  selectMeetingDigestCandidates,
} from './digest-sources.js';
import {
  DIGEST_PROMPT_VERSION,
  DigestRequest,
  OpenCodeDigestSummarizer,
} from './digest-summarizer.js';
import {
  CityWideDigest,
  Digest,
  DigestRecordBase,
  DigestTarget,
  DistrictDigest,
  MeetingDigest,
} from './digest-types.js';

interface Options {
  dryRun: boolean;
  now: Date;
  kind: 'meetings' | 'districts' | 'both';
  month: string;
  district?: string;
  limit: number;
  outputDirectory: string;
  model: string;
  cityWide: boolean;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  logger.info(
    `Spike digests — now=${options.now.toISOString().slice(0, 10)} kind=${options.kind} ` +
      `month=${options.month} limit=${options.limit}${options.dryRun ? ' (dry run)' : ''}`,
  );

  // Deliberately not stores.loadFromDisk(): hydrating the file-content store
  // schedules PDF extraction and hits the network. Digests compose already-written
  // summaries, so these three stores are the whole input.
  await stores.meetings.loadFromDisk();
  await stores.papers.loadFromDisk();
  await stores.paperSummaries.loadFromDisk();
  const resolveSummary = createSummaryResolver();

  const planned: Array<{ target: DigestTarget; request: DigestRequest; toRecord: ToRecord }> = [];

  if (options.kind !== 'districts') {
    for (const candidate of selectMeetingDigestCandidates(
      stores.meetings.getAll(),
      options.now,
      resolveSummary,
    )) {
      planned.push({
        target: candidate.target,
        request: {
          kind: 'meeting',
          heading: candidate.target.heading,
          sourceText: candidate.target.sourceText,
        },
        toRecord: (base) =>
          ({
            ...base,
            kind: 'meeting',
            meetingId: candidate.meeting.id,
            meetingName: candidate.meeting.name,
            meetingStart: candidate.meeting.start,
            lead: candidate.lead,
          }) satisfies MeetingDigest,
      });
    }
  }

  if (options.kind !== 'meetings') {
    const index = await readDistrictIndex();

    // The stadtweit section is generated first and once: every district digest
    // embeds the same body, so its cost does not scale with the district count.
    const cityWideTarget = selectCityWideDigestCandidate(
      index,
      options.month,
      stores.papers.getAll(),
      resolveSummary,
    );
    if (cityWideTarget && options.cityWide) {
      planned.push({
        target: cityWideTarget,
        request: {
          kind: 'citywide',
          heading: cityWideTarget.heading,
          sourceText: cityWideTarget.sourceText,
        },
        toRecord: (base) =>
          ({
            ...base,
            kind: 'citywide',
            month: options.month,
            candidateCount: cityWideTarget.coveredCount + cityWideTarget.uncoveredCount,
          }) satisfies CityWideDigest,
      });
    }

    for (const candidate of selectDistrictDigestCandidates(
      index,
      options.month,
      resolveSummary,
      options.district ? (name) => name === options.district : undefined,
    )) {
      planned.push({
        target: candidate.target,
        request: {
          kind: 'district',
          heading: candidate.target.heading,
          sourceText: candidate.target.sourceText,
        },
        toRecord: (base) =>
          ({
            ...base,
            kind: 'district',
            district: candidate.district,
            month: candidate.month,
          }) satisfies DistrictDigest,
      });
    }
  }

  reportPlan(planned.map((entry) => entry.target));
  if (planned.length === 0) {
    logger.warn('No digest targets. Try a different --now or --month.');
    return;
  }
  if (options.dryRun) {
    logger.info('Dry run: no model calls made.');
    return;
  }

  const apiKey = config.llmApiKey;
  if (!apiKey) {
    logger.error('LLM_API_KEY is missing; cannot generate digests.');
    process.exitCode = 1;
    return;
  }

  const summarizer = new OpenCodeDigestSummarizer({
    apiKey,
    baseUrl: config.llmBaseUrl,
    model: options.model,
    timeoutMs: config.digestRequestTimeoutMs,
  });
  logger.info(`Using model ${options.model}.`);

  const selected = planned.slice(0, options.limit);
  if (selected.length < planned.length) {
    logger.info(`Capped at ${selected.length} of ${planned.length} target(s) by --limit.`);
  }

  const results: Digest[] = [];
  for (const entry of selected) {
    try {
      const body = await writeWithGrounding(summarizer, entry.request);
      results.push(
        entry.toRecord({
          ...body,
          sourceHash: digestSourceHash(entry.target, DIGEST_PROMPT_VERSION),
          promptVersion: DIGEST_PROMPT_VERSION,
          provider: summarizer.providerName,
          model: summarizer.model,
          generatedAt: new Date().toISOString(),
          sourcePapers: entry.target.sourcePapers,
          uncoveredCount: entry.target.uncoveredCount,
        }),
      );
      logger.info(`Generated digest ${entry.target.key} (${body.highlights.length} highlight(s))`);
      // Under-selection is the failure mode for a large pool: the model answers
      // with one point for thirty papers and the overview promises more.
      if (entry.request.kind === 'citywide' && body.highlights.length < 4) {
        logger.warn(
          `Stadtweit digest selected only ${body.highlights.length} highlight(s) from ` +
            `${entry.target.coveredCount} paper(s).`,
        );
      }
    } catch (error) {
      logger.warn(`Failed digest ${entry.target.key}: ${(error as Error).message}`);
    }
  }

  // Compose rather than blend: the stadtweit body is attached verbatim, so no
  // model call ever sees a city topic and a district in the same context and can
  // re-attribute one to the other.
  const cityWide = results.find((digest) => digest.kind === 'citywide');
  if (cityWide) {
    const body = { overview: cityWide.overview, highlights: cityWide.highlights };
    const covered = new Set<string>();
    for (const digest of results) {
      if (digest.kind !== 'district') continue;
      digest.cityWide = body;
      covered.add(digest.district);
    }

    // A Stadtteil with nothing local this month still gets the shared section
    // rather than no digest at all. This costs no model call: the record is the
    // stadtweit body plus an empty local half, which the renderer states plainly.
    if (options.kind !== 'meetings' && !options.district) {
      const index = await readDistrictIndex();
      for (const district of index.districts) {
        if (covered.has(district)) continue;
        results.push({
          ...emptyRecordBase(cityWide),
          kind: 'district',
          district,
          month: options.month,
          cityWide: body,
        });
      }
    }
  }

  await writeOutput(
    options.outputDirectory,
    results,
    planned.map((entry) => entry.target),
  );
  logger.info(`Wrote ${results.length} digest(s) to ${options.outputDirectory}/`);
}

type ToRecord = (base: DigestRecordBase) => Digest;

/**
 * Same two-attempt numeric grounding the per-paper summaries use. It matters more
 * here, not less: the input is already condensed, so an invented figure has no
 * surrounding context left to contradict it.
 */
async function writeWithGrounding(summarizer: OpenCodeDigestSummarizer, request: DigestRequest) {
  const source = `${request.heading}\n${request.sourceText}`;
  const first = await summarizer.write(request);
  const ungrounded = findUngroundedNumericLiterals(
    { summary: first.overview, keyPoints: first.highlights },
    source,
  );
  if (ungrounded.length === 0) return first;

  logger.debug(`Retrying digest after ungrounded literal(s): ${ungrounded.join(', ')}`);
  const corrected = await summarizer.write({ ...request, numericLiteralsToCorrect: ungrounded });
  const still = findUngroundedNumericLiterals(
    { summary: corrected.overview, keyPoints: corrected.highlights },
    source,
  );
  if (still.length > 0) {
    throw new Error(`Digest contains ungrounded numeric literal(s): ${still.join(', ')}`);
  }
  return corrected;
}

/** Provenance for a district digest that has no local content of its own. */
function emptyRecordBase(cityWide: CityWideDigest): DigestRecordBase {
  return {
    overview: '',
    highlights: [],
    sourceHash: cityWide.sourceHash,
    promptVersion: cityWide.promptVersion,
    provider: cityWide.provider,
    model: cityWide.model,
    generatedAt: cityWide.generatedAt,
    sourcePapers: [],
    uncoveredCount: 0,
  };
}

function createSummaryResolver(): (paper: Paper) => PaperSummary | undefined {
  // The spike trusts the cached summary as-is. Production would re-check
  // sourceHash against the paper's current attachments, as the feed path does.
  return (paper) => stores.paperSummaries.getById(paper.id);
}

async function readDistrictIndex(): Promise<PaperDistrictIndex> {
  const raw = await fs.readFile(docsPath(PAPER_DISTRICT_INDEX_FILE_NAME), 'utf8');
  return JSON.parse(raw) as PaperDistrictIndex;
}

function reportPlan(targets: DigestTarget[]): void {
  logger.info(`${targets.length} digest target(s):`);
  for (const target of targets) {
    const coverage = target.coveredCount + target.uncoveredCount;
    logger.info(
      `  ${target.key.padEnd(34)} ${String(target.coveredCount).padStart(3)}/${coverage} covered  ` +
        `${String(Math.round(target.sourceText.length / 1024)).padStart(3)} KiB input`,
    );
  }
}

async function writeOutput(
  outputDirectory: string,
  digests: Digest[],
  targets: DigestTarget[],
): Promise<void> {
  await fs.mkdir(path.join(outputDirectory, 'digests'), { recursive: true });
  for (const digest of digests) {
    await fs.writeFile(
      path.join(outputDirectory, 'digests', `${basename(digest)}.json`),
      `${canonicalStringify(digest)}\n`,
      'utf8',
    );
  }
  await fs.writeFile(
    path.join(outputDirectory, 'report.md'),
    renderReport(digests, targets),
    'utf8',
  );
}

function basename(digest: Digest): string {
  switch (digest.kind) {
    case 'meeting':
      return `meeting-${recordBasename(digest.meetingId)}-${digest.lead}`;
    case 'citywide':
      return `stadtweit-${digest.month}`;
    case 'district':
      return `district-${slugifyFeedSegment(digest.district)}-${digest.month}`;
  }
}

/** Human-readable side-by-side of every digest for judging output quality. */
function renderReport(digests: Digest[], targets: DigestTarget[]): string {
  const lines = ['# Spike: composed digests', ''];
  lines.push(`Prompt version: \`${DIGEST_PROMPT_VERSION}\``, '');
  lines.push('## Coverage', '', '| target | summarized / total | input |', '| --- | --- | --- |');
  for (const target of targets) {
    lines.push(
      `| \`${target.key}\` | ${target.coveredCount} / ${target.coveredCount + target.uncoveredCount} | ${Math.round(target.sourceText.length / 1024)} KiB |`,
    );
  }
  lines.push('');

  for (const digest of digests) {
    lines.push(`## ${digestTitle(digest)}`, '');
    if (digest.kind === 'district' && digest.cityWide) {
      lines.push('**Stadtweit**', '', digest.cityWide.overview, '');
      for (const highlight of digest.cityWide.highlights) lines.push(`- ${highlight}`);
      lines.push('', `**In ${digest.district}**`, '');
    }
    lines.push(
      digest.overview ||
        `_Für diesen Zeitraum liegen keine Vorlagen mit unmittelbarem Bezug zu diesem Stadtteil vor._`,
      '',
    );
    for (const highlight of digest.highlights) lines.push(`- ${highlight}`);
    lines.push(
      '',
      `_${digest.sourcePapers.length} Vorlage(n) als Quelle, ${digest.uncoveredCount} ohne Zusammenfassung._`,
      '',
    );
  }
  return lines.join('\n');
}

function digestTitle(digest: Digest): string {
  switch (digest.kind) {
    case 'meeting':
      return `${digest.meetingName} — ${digest.meetingStart.slice(0, 10)} (${digest.lead === 'week' ? 'eine Woche vorher' : 'Tag davor'})`;
    case 'citywide':
      // sourcePapers is the pool offered to the model, not what it chose — the
      // provider returns prose, so the selection is not recoverable per paper.
      return `Stadtweit — ${digest.month} (${digest.highlights.length} Punkte aus einem Pool von ${digest.candidateCount} Vorlagen)`;
    case 'district':
      return `${digest.district} — ${digest.month}`;
  }
}

function parseOptions(argv: string[]): Options {
  const flag = (name: string): string | undefined =>
    argv
      .find((entry) => entry.startsWith(`--${name}=`))
      ?.split('=')
      .slice(1)
      .join('=');

  const now = flag('now') ? new Date(flag('now')!) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid --now: ${flag('now')}`);

  const kind = (flag('kind') ?? 'both') as Options['kind'];
  if (!['meetings', 'districts', 'both'].includes(kind)) throw new Error(`Invalid --kind: ${kind}`);

  return {
    dryRun: argv.includes('--dry-run'),
    now,
    kind,
    month: flag('month') ?? previousMonth(now),
    district: flag('district'),
    limit: Number(flag('limit') ?? 6),
    outputDirectory: flag('out') ?? 'spike-output',
    model: flag('model') ?? config.digestModel,
    // Fallback shape: Stadtteil papers only, no shared stadtweit section.
    cityWide: !argv.includes('--no-citywide'),
  };
}

function previousMonth(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return date.toISOString().slice(0, 7);
}

main().catch((error) => {
  logger.error('Spike failed', error);
  process.exitCode = 1;
});
