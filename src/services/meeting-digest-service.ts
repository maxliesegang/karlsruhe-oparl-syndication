import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { canonicalStringify, recordBasename } from '../docs-files.js';
import { logger } from '../logger.js';
import { stores } from '../store/index.js';
import { KarlsruheDistrict } from '../karlsruhe-districts.js';
import { FactionId, getFactionName } from '../paper-submitters.js';
import {
  AgendaItem,
  Consultation,
  Meeting,
  MeetingDigest,
  MeetingDigestLead,
  Paper,
  PaperSummary,
} from '../types/index.js';
import { MeetingDigestWriter } from './llm/meeting-digest-writer.js';
import { OpenCodeMeetingDigestWriter } from './llm/opencode-meeting-digest-writer.js';
import { findUngroundedNumericLiterals } from './llm/summary-grounding.js';

/** Lead times, in whole days before the sitting, at which a preview is due. */
export const MEETING_DIGEST_LEADS: Record<MeetingDigestLead, number> = { week: 7, day: 1 };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bumped on any prompt or composed-input change; an older record is regenerated. */
const INPUT_FORMAT_VERSION = 2;

export interface MeetingDigestUpdateOptions {
  enabled?: boolean;
  apiKey?: string;
  promptVersion?: string;
  maximumItems?: number;
  writer?: MeetingDigestWriter;
  /** Regenerate selected sittings even when their content-addressed cache is current. */
  regenerate?: boolean;
  now?: () => Date;
  /** Primary Stadtteile per paper — the same resolver the feeds use. */
  resolvePaperDistricts?: (paper: Paper) => KarlsruheDistrict[];
  /** Submitting factions per paper — the same resolver the feeds use. */
  resolvePaperSubmitters?: (paper: Paper) => FactionId[];
}

/** Paper-level context rendered next to each summary; see `renderAgendaItemBlock`. */
interface PaperContextResolvers {
  resolvePaperDistricts: (paper: Paper) => KarlsruheDistrict[];
  resolvePaperSubmitters: (paper: Paper) => FactionId[];
}

interface MeetingDigestTarget {
  id: string;
  meeting: Meeting;
  lead: MeetingDigestLead;
  heading: string;
  sourceText: string;
  sourceHash: string;
  sourcePapers: string[];
  coveredCount: number;
  uncoveredCount: number;
}

/**
 * Refresh previews for sittings that are due at one of the lead times and return
 * every current record, cached or freshly generated. Individual provider failures
 * are fail-open: the feed run continues and retries them next time, exactly like
 * the per-paper summaries this composes.
 */
export async function updateMeetingDigests(
  meetings: Meeting[],
  paperSummaries: Map<string, PaperSummary>,
  options: MeetingDigestUpdateOptions = {},
): Promise<MeetingDigest[]> {
  const promptVersion = options.promptVersion ?? config.meetingDigestPromptVersion;
  const maximumItems = options.maximumItems ?? config.meetingDigestMaxItemsPerRun;
  const enabled = options.enabled ?? config.generateMeetingDigests;
  const apiKey = options.apiKey ?? config.llmApiKey;
  const now = options.now?.() ?? new Date();

  const targets = selectMeetingDigestTargets(meetings, now, paperSummaries, promptVersion, {
    resolvePaperDistricts: options.resolvePaperDistricts ?? (() => []),
    resolvePaperSubmitters: options.resolvePaperSubmitters ?? (() => []),
  });
  // Every stored preview reaches the feed, not only the ones due this run: a
  // sitting is due at a lead time for one day, while its preview stays useful
  // until the sitting happens.
  const published = new Map(
    stores.meetingDigests
      .getAll()
      .filter((digest) => digest.promptVersion === promptVersion)
      .map((digest) => [digest.id, digest]),
  );

  const stale = targets.filter((target) => {
    if (options.regenerate) return true;
    const cached = published.get(target.id);
    return !cached || cached.sourceHash !== target.sourceHash;
  });

  if (!enabled) {
    logger.info(`Meeting digests disabled; publishing ${published.size} cached preview(s).`);
    return [...published.values()];
  }
  if (!apiKey && !options.writer) {
    logger.warn('Meeting digests enabled but LLM_API_KEY is missing; skipping digest updates.');
    return [...published.values()];
  }
  if (stale.length === 0) {
    logger.info(`No meeting digest needs updating; ${published.size} preview(s) current.`);
    return [...published.values()];
  }

  const writer =
    options.writer ??
    new OpenCodeMeetingDigestWriter({
      apiKey,
      baseUrl: config.llmBaseUrl,
      // LLM_MODEL, not DIGEST_MODEL: a meeting preview reads only per-paper summaries
      // that the expensive step already grounded, so it is a rewrite of clean short
      // text rather than the month-wide selection job DIGEST_MODEL was chosen for.
      // The monthly rollup spike keeps DIGEST_MODEL. The digest cache is keyed on
      // promptVersion + digestSourceHash and not on the model, exactly like the paper
      // summaries, so switching here leaves existing previews in place; each record
      // names the model that wrote it.
      model: config.llmModel,
      timeoutMs: config.digestRequestTimeoutMs,
    });

  // Nearest sitting first: if a run is capped, the day-before preview of an
  // imminent sitting matters more than a week-ahead one further out.
  const candidates = stale
    .sort(
      (a, b) =>
        new Date(a.meeting.start).getTime() - new Date(b.meeting.start).getTime() ||
        a.id.localeCompare(b.id),
    )
    .slice(0, maximumItems);
  if (candidates.length < stale.length) {
    logger.info(`Capped at ${candidates.length} of ${stale.length} due meeting digest(s).`);
  }

  logger.info(`Generating up to ${candidates.length} meeting digest(s)...`);
  let succeeded = 0;
  let failed = 0;
  for (const target of candidates) {
    try {
      const body = await writeWithGrounding(writer, target);
      const digest: MeetingDigest = {
        ...body,
        id: target.id,
        meetingId: target.meeting.id,
        meetingName: target.meeting.name,
        meetingStart: target.meeting.start,
        lead: target.lead,
        sourceHash: target.sourceHash,
        promptVersion,
        provider: writer.providerName,
        model: writer.model,
        generatedAt: now.toISOString(),
        sourcePapers: target.sourcePapers,
        uncoveredCount: target.uncoveredCount,
      };
      stores.meetingDigests.add(digest);
      published.set(digest.id, digest);
      succeeded++;
    } catch (error) {
      failed++;
      logger.warn(`Could not generate meeting digest ${target.id}; retrying next run.`, error);
    }
  }

  if (succeeded === 0 && failed > 0) {
    // Fail-open like the summary step, so a provider contract change would
    // otherwise surface only as per-digest warnings while the feed keeps publishing.
    logger.error(
      `All ${failed} meeting digest attempt(s) failed this run. ` +
        `Check the provider configuration (${writer.providerName}, ${writer.model}).`,
    );
  }
  logger.info(
    `Meeting digests: ${succeeded} generated, ${failed} failed, ${published.size} published.`,
  );
  return [...published.values()];
}

/**
 * Sittings due at a lead time, with their composed input. A preview is due when
 * the sitting falls on the calendar day `lead` days out; the scheduled workflow
 * runs daily, so a sitting produces exactly one week-ahead and one day-before
 * preview regardless of the hour a run starts.
 */
export function selectMeetingDigestTargets(
  meetings: Meeting[],
  now: Date,
  paperSummaries: Map<string, PaperSummary>,
  promptVersion: string,
  resolvers: PaperContextResolvers = {
    resolvePaperDistricts: () => [],
    resolvePaperSubmitters: () => [],
  },
): MeetingDigestTarget[] {
  const targets: MeetingDigestTarget[] = [];
  for (const [lead, days] of Object.entries(MEETING_DIGEST_LEADS) as [
    MeetingDigestLead,
    number,
  ][]) {
    const dueDay = dayNumber(new Date(now.getTime() + days * DAY_MS));
    for (const meeting of meetings) {
      const start = new Date(meeting.start);
      if (Number.isNaN(start.getTime()) || dayNumber(start) !== dueDay) continue;
      const target = buildMeetingDigestTarget(
        meeting,
        lead,
        paperSummaries,
        promptVersion,
        resolvers,
      );
      if (target) targets.push(target);
    }
  }
  return targets.sort((a, b) => a.id.localeCompare(b.id));
}

function buildMeetingDigestTarget(
  meeting: Meeting,
  lead: MeetingDigestLead,
  paperSummaries: Map<string, PaperSummary>,
  promptVersion: string,
  resolvers: PaperContextResolvers,
): MeetingDigestTarget | undefined {
  const blocks: string[] = [];
  const sourcePapers: string[] = [];
  let coveredCount = 0;
  let uncoveredCount = 0;

  for (const agendaItem of [...(meeting.agendaItem ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  )) {
    if (agendaItem.public !== true || !agendaItem.number) continue;
    if (!agendaItem.consultation && isStandingAgendaItem(agendaItem.name)) continue;
    const paper = agendaItem.consultation
      ? stores.papers.getPaperByConsultationId(agendaItem.consultation)
      : undefined;
    // Only a summary the summary step certified as current this run: a stale one
    // is ineligible for publication, and composing it here would reintroduce
    // through the digest exactly the text the feed suppresses.
    const summary = paper ? paperSummaries.get(paper.id) : undefined;
    if (summary) {
      coveredCount++;
      sourcePapers.push(recordBasename(paper!.id));
    } else {
      // Counted, not skipped silently: this statistic is how a reader of the
      // record judges how much of the sitting the preview could see.
      uncoveredCount++;
    }
    // An item without a summary still goes in by title and procedure. Leaving it
    // out made half of some agendas invisible — the HFA preview of 2026-09-22 saw
    // two of six items and nothing told the reader so.
    blocks.push(renderAgendaItemBlock(agendaItem, meeting, paper, summary, resolvers));
  }

  // Titles alone give the model nothing to weigh; such a sitting gets no preview.
  if (coveredCount === 0) return undefined;

  const heading = `${committeeName(meeting.name)} am ${formatGermanDate(meeting.start)}`;
  const sourceText = blocks.join('\n\n');
  return {
    id: `${meeting.id}-${lead}`,
    meeting,
    lead,
    heading,
    sourceText,
    sourceHash: digestSourceHash(heading, sourceText, lead, promptVersion),
    sourcePapers,
    coveredCount,
    uncoveredCount,
  };
}

/**
 * Content address over the composed input, the same contract as `PaperSummary`:
 * an unchanged agenda with unchanged summaries never calls the model twice. The
 * lead is folded in because it changes the requested document, not the input.
 */
export function digestSourceHash(
  heading: string,
  sourceText: string,
  lead: MeetingDigestLead,
  promptVersion: string,
): string {
  const payload = canonicalStringify({
    version: INPUT_FORMAT_VERSION,
    promptVersion,
    lead,
    heading,
    sourceText,
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

/**
 * The same two-attempt numeric grounding the per-paper summaries use. It matters
 * more here, not less: the input is already condensed, so an invented figure has
 * no surrounding context left to contradict it.
 */
async function writeWithGrounding(writer: MeetingDigestWriter, target: MeetingDigestTarget) {
  const request = {
    heading: target.heading,
    sourceText: target.sourceText,
    sessionId: sessionIdFor(target.id),
  };
  const source = `${target.heading}\n${target.sourceText}`;
  const first = await writer.write(request);
  const ungrounded = findUngroundedNumericLiterals(
    { summary: first.overview, keyPoints: first.highlights },
    source,
  );
  if (ungrounded.length === 0) return first;

  logger.debug(`Retrying ${target.id} after ungrounded literal(s): ${ungrounded.join(', ')}`);
  const corrected = await writer.write({ ...request, numericLiteralsToCorrect: ungrounded });
  const still = findUngroundedNumericLiterals(
    { summary: corrected.overview, keyPoints: corrected.highlights },
    source,
  );
  if (still.length > 0) {
    throw new Error(`Digest contains ungrounded numeric literal(s): ${still.join(', ')}`);
  }
  return corrected;
}

/**
 * One agenda item as the model sees it. The summary alone describes the paper,
 * which the agenda feed already shows; what only a sitting-level preview can add
 * is where this sitting stands in the paper's procedure. Version 1 omitted that,
 * so the model inferred the role from “Die Beschlussvorlage schlägt vor …” and
 * announced the Parkraumkonzept as “zur Entscheidung” in Ortschaftsräte that
 * only took note of it — the Gemeinderat decides.
 */
function renderAgendaItemBlock(
  agendaItem: AgendaItem,
  meeting: Meeting,
  paper: Paper | undefined,
  summary: PaperSummary | undefined,
  resolvers: PaperContextResolvers,
): string {
  const title = [
    `TOP ${agendaItem.number}`,
    paper?.paperType,
    paper?.reference,
    agendaItem.name || paper?.name,
  ]
    .filter(Boolean)
    .join(' – ');
  const lines = [`--- ${title} ---`];
  if (paper) {
    const consultations = paper.consultation ?? [];
    const ownRole = consultations.find(
      (consultation) =>
        consultation.agendaItem === agendaItem.id || consultation.id === agendaItem.consultation,
    )?.role;
    if (ownRole) lines.push(`Rolle dieses Gremiums: ${ownRole}`);
    const path = describeConsultationPath(consultations, meeting.id);
    if (path) lines.push(`Beratungsfolge: ${path}`);
    const districts = resolvers.resolvePaperDistricts(paper);
    if (districts.length > 0) lines.push(`Stadtteile: ${districts.join(', ')}`);
    const submitters = resolvers.resolvePaperSubmitters(paper);
    if (submitters.length > 0) {
      lines.push(`Antragstellende Fraktion(en): ${submitters.map(getFactionName).join(', ')}`);
    }
  }
  if (summary) {
    lines.push(
      `Kurzfassung: ${summary.summary}`,
      ...summary.keyPoints.map((point) => `- ${point}`),
    );
  } else {
    lines.push('Keine Kurzfassung verfügbar.');
  }
  return lines.join('\n');
}

/**
 * The paper's whole path through the committees, in sitting order, with the
 * recorded OParl result of every sitting that has one. The result is the literal
 * string, never a paraphrase — the same value the agenda feed renders as the
 * Beratungsstand — so a split vote elsewhere reaches the model as a fact rather
 * than as something it would have to infer from PDF prose.
 */
function describeConsultationPath(consultations: Consultation[], currentMeetingId: string) {
  const steps = consultations.map((consultation) => {
    const meeting = consultation.meeting
      ? stores.meetings.getById(consultation.meeting)
      : undefined;
    const start = meeting ? new Date(meeting.start) : undefined;
    const body =
      consultation.organization.map((id) => stores.organizations.getById(id)?.name).find(Boolean) ??
      (meeting ? committeeName(meeting.name) : 'Gremium unbekannt');
    const result = meeting?.agendaItem?.find((item) => item.id === consultation.agendaItem)?.result;
    const details = [
      consultation.role,
      consultation.meeting === currentMeetingId ? 'diese Sitzung' : undefined,
      result ? `Ergebnis: ${result}` : undefined,
    ].filter(Boolean);
    const date =
      start && !Number.isNaN(start.getTime()) ? formatNumericDate(start) : 'Termin offen';
    return {
      time: start && !Number.isNaN(start.getTime()) ? start.getTime() : Number.POSITIVE_INFINITY,
      text: `${body} ${date} (${details.join(', ')})`,
    };
  });
  return steps
    .sort((a, b) => a.time - b.time || a.text.localeCompare(b.text))
    .map((step) => step.text)
    .join('; ');
}

/**
 * Paperless agenda slots that recur at every sitting and carry nothing to preview:
 * announcements, “Verschiedenes”, the council's own question round, withdrawn
 * items and section headings (“ANTRÄGE”, “Anträge, die im Ausschuss behandelt
 * werden:”). Counted as uncovered they made the feed claim that three of six
 * Hohenwettersbach items lacked a summary when all three real ones had one. The
 * residents' question time is deliberately *not* matched: that a resident can
 * speak is worth announcing even without content.
 */
export function isStandingAgendaItem(name: string | undefined): boolean {
  const title = (name ?? '').trim();
  if (!title) return true;
  if (title.endsWith(':') || title === title.toLocaleUpperCase('de-DE')) return true;
  return /^(?:mitteilungen\b|bekanntgaben?\b|verschiedenes$|sonstiges$|(?:mündliche\s+)?anfragen\b(?!.*einwohner)|mündliche fragen$|anregungen aus\b|-\s*a\s*b\s*g\s*e\s*s\s*e\s*t\s*z\s*t\s*-$)/i.test(
    title,
  );
}

/** Stable per-sitting conversation id, matching `karlsruhe-paper-<basename>`. */
function sessionIdFor(digestId: string): string {
  return `karlsruhe-meeting-${recordBasename(digestId)}`;
}

/**
 * OParl meeting names carry a session-visibility suffix — "Gemeinderat
 * (öffentlich/nicht öffentlich)". It describes the sitting's record, not the
 * committee, and reads as noise in a public preview.
 */
export function committeeName(name: string): string {
  return name
    .replace(/\s*\((?:öffentlich|nicht öffentlich)(?:\/(?:nicht )?öffentlich)?\)\s*$/i, '')
    .trim();
}

function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

function formatNumericDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
}

function formatGermanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}
