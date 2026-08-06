import { config } from '../config.js';
import { logger } from '../logger.js';
import { stores } from '../store/index.js';
import { GeneratedPaperSummary, Meeting, Paper, PaperSummary } from '../types/index.js';
import { latestValidDate } from '../dates.js';
import { OpenCodePaperSummarizer } from './llm/opencode-paper-summarizer.js';
import { PaperSummarizer } from './llm/paper-summarizer.js';
import { findUngroundedNumericLiterals } from './llm/summary-grounding.js';
import {
  buildPaperSummarySource,
  PaperSummaryConsultationContext,
  PaperSummarySource,
  splitPaperSummarySource,
} from './paper-summary-source.js';

const SUMMARY_BACKFILL_START = Date.UTC(2026, 0, 1);

export interface PaperSummaryUpdateOptions {
  enabled?: boolean;
  apiKey?: string;
  promptVersion?: string;
  maximumItems?: number;
  maximumInputCharacters?: number;
  concurrency?: number;
  summarizer?: PaperSummarizer;
  /** Restrict generation to these exact OParl paper ids, bypassing the archive backfill cutoff. */
  paperIds?: ReadonlySet<string>;
  /** Regenerate selected papers even when their content-addressed cache is current. */
  regenerate?: boolean;
  /** Propagate a provider failure to a targeted CLI instead of failing open. */
  throwOnFailure?: boolean;
  now?: () => Date;
}

interface PublicPaperSummarySource {
  paper: Paper;
  source: PaperSummarySource;
  sourceTimestamp: number;
}

/**
 * Refresh summaries for papers used by public agenda items and return only cache
 * entries that match current source content. Individual provider failures are
 * fail-open: the normal feed run continues and retries them next time.
 */
export async function updatePaperSummaries(
  meetings: Meeting[],
  options: PaperSummaryUpdateOptions = {},
): Promise<Map<string, PaperSummary>> {
  const promptVersion = options.promptVersion ?? config.summaryPromptVersion;
  const maximumItems = options.maximumItems ?? config.summaryMaxItemsPerRun;
  const maximumInputCharacters = options.maximumInputCharacters ?? config.summaryMaxInputCharacters;
  const concurrency = options.concurrency ?? config.summaryConcurrency;
  const enabled = options.enabled ?? config.generateLlmSummaries;
  const apiKey = options.apiKey ?? config.llmApiKey;
  const paperSources = collectPublicPaperSources(meetings).filter(
    ({ paper }) => !options.paperIds || options.paperIds.has(paper.id),
  );
  const current = collectCurrentSummaries(paperSources, promptVersion);

  if (!enabled) {
    logger.info(`LLM summaries disabled; using ${current.size} current cached summary(s).`);
    return current;
  }
  if (!apiKey && !options.summarizer) {
    logger.warn('LLM summaries enabled but LLM_API_KEY is missing; skipping summary updates.');
    return current;
  }
  if (maximumItems === 0) {
    logger.info('SUMMARY_MAX_ITEMS_PER_RUN is 0; skipping summary updates.');
    return current;
  }

  const summarizer =
    options.summarizer ??
    new OpenCodePaperSummarizer({
      apiKey,
      baseUrl: config.llmBaseUrl,
      model: config.llmModel,
      timeoutMs: config.summaryRequestTimeoutMs,
    });
  const candidates = paperSources
    .filter(({ paper }) => options.regenerate || !current.has(paper.id))
    .filter(({ paper }) => options.paperIds?.has(paper.id) || isEligibleForSummaryBackfill(paper))
    .filter(({ source }) => source.hasExtractedText)
    .map((candidate) => ({
      ...candidate,
      refreshesCachedSummary: !!stores.paperSummaries.getById(candidate.paper.id),
    }))
    .sort(
      (a, b) =>
        Number(b.refreshesCachedSummary) - Number(a.refreshesCachedSummary) ||
        b.sourceTimestamp - a.sourceTimestamp,
    )
    .slice(0, maximumItems);

  if (candidates.length === 0) {
    logger.info('No paper summaries need updating.');
    return current;
  }

  logger.info(`Generating up to ${candidates.length} paper summary(s)...`);
  let succeeded = 0;
  let failed = 0;
  for (let offset = 0; offset < candidates.length; offset += concurrency) {
    const batch = candidates.slice(offset, offset + concurrency);
    await Promise.all(
      batch.map(async ({ paper, source }) => {
        try {
          const generated = await summarizeSource(
            summarizer,
            source.heading,
            source.contextText,
            source.text,
            maximumInputCharacters,
          );
          const summary: PaperSummary = {
            id: paper.id,
            sourceHash: source.sourceHash,
            promptVersion,
            provider: summarizer.providerName,
            model: summarizer.model,
            summary: generated.summary,
            keyPoints: generated.keyPoints,
            generatedAt: (options.now?.() ?? new Date()).toISOString(),
          };
          stores.paperSummaries.add(summary);
          current.set(paper.id, summary);
          succeeded++;
        } catch (error) {
          if (options.throwOnFailure) throw error;
          failed++;
          logger.warn(`Could not summarize paper ${paper.id}; retrying next run.`, error);
        }
      }),
    );
  }

  logger.info(
    `Paper summaries: ${succeeded} generated, ${failed} failed, ${current.size} current.`,
  );
  return current;
}

function collectPublicPaperSources(meetings: Meeting[]): PublicPaperSummarySource[] {
  const papers = new Map<
    string,
    { paper: Paper; contextsByAgendaItemId: Map<string, PaperSummaryConsultationContext> }
  >();
  for (const meeting of meetings) {
    for (const agendaItem of meeting.agendaItem ?? []) {
      if (agendaItem.public !== true || !agendaItem.number || !agendaItem.consultation) continue;
      const paper = stores.papers.getPaperByConsultationId(agendaItem.consultation);
      if (!paper) continue;
      let entry = papers.get(paper.id);
      if (!entry) {
        entry = { paper, contextsByAgendaItemId: new Map() };
        papers.set(paper.id, entry);
      }
      const consultation = (paper.consultation ?? []).find(
        (candidate) => candidate.id === agendaItem.consultation,
      );
      entry.contextsByAgendaItemId.set(agendaItem.id, {
        consultationRole: consultation?.role ?? '',
        consultationModified: consultation?.modified ?? '',
        meetingId: meeting.id,
        meetingName: meeting.name,
        meetingStart: meeting.start,
        agendaItemModified: agendaItem.modified,
      });
    }
  }
  return [...papers.values()].map(({ paper, contextsByAgendaItemId }) => {
    const contexts = [...contextsByAgendaItemId.values()];
    return {
      paper,
      source: sourceFor(paper, contexts),
      sourceTimestamp:
        latestValidDate(
          paper.modified,
          paper.created,
          paper.date,
          ...contexts.flatMap((context) => [
            context.agendaItemModified,
            context.consultationModified,
            context.meetingStart,
          ]),
        )?.getTime() ?? 0,
    };
  });
}

function collectCurrentSummaries(
  paperSources: PublicPaperSummarySource[],
  promptVersion: string,
): Map<string, PaperSummary> {
  const current = new Map<string, PaperSummary>();
  for (const { paper, source } of paperSources) {
    const cached = stores.paperSummaries.getById(paper.id);
    if (!cached || cached.promptVersion !== promptVersion) continue;
    if (cached.sourceHash === source.sourceHash) current.set(paper.id, cached);
  }
  return current;
}

function sourceFor(paper: Paper, contexts: PaperSummaryConsultationContext[]) {
  return buildPaperSummarySource(paper, (fileId) => stores.fileContents.getById(fileId), contexts);
}

function isEligibleForSummaryBackfill(paper: Paper): boolean {
  const paperDate = new Date(paper.date);
  return !Number.isNaN(paperDate.getTime()) && paperDate.getTime() >= SUMMARY_BACKFILL_START;
}

async function summarizeSource(
  summarizer: PaperSummarizer,
  heading: string,
  contextText: string,
  sourceText: string,
  maximumInputCharacters: number,
): Promise<GeneratedPaperSummary> {
  const chunks = splitPaperSummarySource(sourceText, maximumInputCharacters);
  const partials: GeneratedPaperSummary[] = [];
  for (const chunk of chunks) {
    partials.push(
      await summarizeWithNumericGrounding(summarizer, {
        heading,
        contextText,
        sourceText: chunk,
        partial: false,
      }),
    );
  }
  if (partials.length === 1) return partials[0];

  // Reduce as many levels as necessary. This prevents the final synthesis of a
  // very large paper from exceeding the same request limit used for raw chunks.
  let level = partials;
  while (level.length > 1) {
    const combined = level
      .map(
        (partial, index) =>
          `Teil ${index + 1}:\n${partial.summary}\nKernpunkte: ${partial.keyPoints.join('; ')}`,
      )
      .join('\n\n');
    const groups = splitPaperSummarySource(combined, maximumInputCharacters);
    const nextLevel: GeneratedPaperSummary[] = [];
    for (const group of groups) {
      nextLevel.push(
        await summarizeWithNumericGrounding(summarizer, {
          heading,
          contextText,
          sourceText: group,
          partial: true,
        }),
      );
    }
    level = nextLevel;
  }
  return level[0];
}

async function summarizeWithNumericGrounding(
  summarizer: PaperSummarizer,
  request: Parameters<PaperSummarizer['summarize']>[0],
): Promise<GeneratedPaperSummary> {
  const source = `${request.heading}\n${request.contextText}\n${request.sourceText}`;
  const firstAttempt = await summarizer.summarize(request);
  const ungrounded = findUngroundedNumericLiterals(firstAttempt, source);
  if (ungrounded.length === 0) return firstAttempt;

  logger.debug(
    `Retrying summary after rejecting ungrounded numeric literal(s): ${ungrounded.join(', ')}`,
  );
  const corrected = await summarizer.summarize({
    ...request,
    numericLiteralsToCorrect: ungrounded,
  });
  const stillUngrounded = findUngroundedNumericLiterals(corrected, source);
  if (stillUngrounded.length > 0) {
    throw new Error(
      `Summary contains numeric literal(s) absent from its source: ${stillUngrounded.join(', ')}`,
    );
  }
  return corrected;
}
