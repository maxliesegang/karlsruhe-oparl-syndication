/**
 * SPIKE — not part of the published pipeline.
 *
 * Composes digest input from artifacts that already exist in `docs/`: per-paper
 * summaries, meeting agendas and the Stadtteil index. Nothing here reads a PDF or
 * calls the OParl API, so a digest costs one model call over a few kilobytes of
 * text that the expensive per-paper step already paid for.
 */

import { createHash } from 'node:crypto';
import { slugifyFeedSegment } from '../filtered-feed-contract.js';
import { canonicalStringify, recordBasename } from '../docs-files.js';
import { PaperDistrictIndex } from '../services/paper-district-index-service.js';
import { stores } from '../store/index.js';
import { Meeting, Paper, PaperSummary } from '../types/index.js';
import { DigestTarget, MeetingDigestLead } from './digest-types.js';

const INPUT_FORMAT_VERSION = 1;

/** Lead times, in whole days before the sitting, at which a meeting digest is due. */
export const MEETING_DIGEST_LEADS: Record<MeetingDigestLead, number> = { week: 7, day: 1 };

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MeetingDigestCandidate {
  meeting: Meeting;
  lead: MeetingDigestLead;
  target: DigestTarget;
}

export interface DistrictDigestCandidate {
  district: string;
  month: string;
  target: DigestTarget;
}

/**
 * A digest is due when the sitting falls on the calendar day `lead` days out.
 * Calendar days rather than a rolling window: the scheduled workflow runs daily,
 * and a sitting must produce exactly one week-ahead and one day-before digest
 * regardless of the hour the run happens to start.
 */
export function selectMeetingDigestCandidates(
  meetings: Meeting[],
  now: Date,
  resolveSummary: (paper: Paper) => PaperSummary | undefined,
): MeetingDigestCandidate[] {
  const candidates: MeetingDigestCandidate[] = [];
  for (const [lead, days] of Object.entries(MEETING_DIGEST_LEADS) as [
    MeetingDigestLead,
    number,
  ][]) {
    const dueDay = dayNumber(new Date(now.getTime() + days * DAY_MS));
    for (const meeting of meetings) {
      const start = new Date(meeting.start);
      if (Number.isNaN(start.getTime()) || dayNumber(start) !== dueDay) continue;
      const target = buildMeetingDigestTarget(meeting, lead, resolveSummary);
      if (target) candidates.push({ meeting, lead, target });
    }
  }
  return candidates.sort((a, b) => a.target.key.localeCompare(b.target.key));
}

export function buildMeetingDigestTarget(
  meeting: Meeting,
  lead: MeetingDigestLead,
  resolveSummary: (paper: Paper) => PaperSummary | undefined,
): DigestTarget | undefined {
  const blocks: string[] = [];
  const sourcePapers: string[] = [];
  let uncoveredCount = 0;

  for (const agendaItem of [...(meeting.agendaItem ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  )) {
    if (agendaItem.public !== true || !agendaItem.number) continue;
    const paper = agendaItem.consultation
      ? stores.papers.getPaperByConsultationId(agendaItem.consultation)
      : undefined;
    const summary = paper ? resolveSummary(paper) : undefined;
    if (!summary) {
      uncoveredCount++;
      continue;
    }
    sourcePapers.push(recordBasename(paper!.id));
    blocks.push(renderPaperBlock(agendaItem.number, agendaItem.name, paper!, summary));
  }

  if (blocks.length === 0) return undefined;

  return {
    // Lead is part of the key, not just the filename: the week-ahead and the
    // day-before digest are different documents about the same sitting.
    key: `${recordBasename(meeting.id)}-${lead}`,
    heading: `${committeeName(meeting.name)} am ${formatGermanDate(meeting.start)}`,
    sourceText: blocks.join('\n\n'),
    sourcePapers,
    coveredCount: blocks.length,
    uncoveredCount,
  };
}

/**
 * A paper whose `primary` evidence names this many Stadtteile is not a local
 * matter; it is a city-wide one enumerated per location. The archive's
 * distribution has a clear knee here — 113 papers name one district, 23 name two,
 * 11 name three, 9 name four, and beyond that the counts thin out into a tail
 * reaching 24 districts. Below the threshold a paper stays local; at or above it
 * moves to the stadtweit section instead of headlining a dozen district digests.
 */
export const CITY_WIDE_DISTRICT_THRESHOLD = 5;

function primaryDistrictsOf(index: PaperDistrictIndex, recordId: string): string[] {
  return index.papers[recordId]?.primary ?? [];
}

/**
 * Monthly Stadtteil digest. Only `primary` district evidence is used — the same
 * rule the district feeds follow, so a digest never claims a paper the feed for
 * that Stadtteil does not carry — minus the city-wide papers above.
 */
export function selectDistrictDigestCandidates(
  index: PaperDistrictIndex,
  month: string,
  resolveSummary: (paper: Paper) => PaperSummary | undefined,
  districtFilter?: (district: string) => boolean,
): DistrictDigestCandidate[] {
  const papersByDistrict = new Map<string, Paper[]>();

  for (const [recordId, entry] of Object.entries(index.papers)) {
    const primary = entry.primary ?? [];
    if (primary.length >= CITY_WIDE_DISTRICT_THRESHOLD) continue;
    for (const district of primary) {
      if (districtFilter && !districtFilter(district)) continue;
      const paper = findPaperByRecordBasename(recordId);
      if (!paper || monthOf(paper.date) !== month) continue;
      const list = papersByDistrict.get(district);
      if (list) list.push(paper);
      else papersByDistrict.set(district, [paper]);
    }
  }

  const candidates: DistrictDigestCandidate[] = [];
  for (const [district, papers] of papersByDistrict) {
    const blocks: string[] = [];
    const sourcePapers: string[] = [];
    let uncoveredCount = 0;
    for (const paper of papers.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
      const summary = resolveSummary(paper);
      if (!summary) {
        uncoveredCount++;
        continue;
      }
      sourcePapers.push(recordBasename(paper.id));
      blocks.push(renderPaperBlock(undefined, undefined, paper, summary));
    }
    if (blocks.length === 0) continue;
    candidates.push({
      district,
      month,
      target: {
        key: `${slugifyFeedSegment(district)}-${month}`,
        heading: `Stadtteil ${district} – kommunalpolitische Vorlagen im Monat ${month}`,
        sourceText: blocks.join('\n\n'),
        sourcePapers,
        coveredCount: blocks.length,
        uncoveredCount,
      },
    });
  }
  return candidates.sort((a, b) => a.target.key.localeCompare(b.target.key));
}

/**
 * The stadtweit pool for a month: papers the district index attributes to no
 * Stadtteil at all, plus the ones it attributes to so many that they are city-wide
 * in substance. Both halves come free from the existing index — the model's job is
 * selection and framing, not classification.
 *
 * Generated once per month and shared by every district digest, so the marginal
 * cost of the section is one call regardless of how many Stadtteile are published.
 */
export function selectCityWideDigestCandidate(
  index: PaperDistrictIndex,
  month: string,
  papers: Paper[],
  resolveSummary: (paper: Paper) => PaperSummary | undefined,
): DigestTarget | undefined {
  const blocks: string[] = [];
  const sourcePapers: string[] = [];
  let uncoveredCount = 0;

  for (const paper of papers
    .filter((paper) => monthOf(paper.date) === month)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
    const primaryCount = primaryDistrictsOf(index, recordBasename(paper.id)).length;
    const isCityWide = primaryCount === 0 || primaryCount >= CITY_WIDE_DISTRICT_THRESHOLD;
    if (!isCityWide) continue;
    const summary = resolveSummary(paper);
    if (!summary) {
      uncoveredCount++;
      continue;
    }
    sourcePapers.push(recordBasename(paper.id));
    blocks.push(renderPaperBlock(undefined, undefined, paper, summary, true));
  }

  if (blocks.length === 0) return undefined;
  return {
    key: `stadtweit-${month}`,
    heading: `Karlsruhe gesamtstädtisch – kommunalpolitische Vorlagen im Monat ${month}`,
    sourceText: blocks.join('\n\n'),
    sourcePapers,
    coveredCount: blocks.length,
    uncoveredCount,
  };
}

/**
 * Content address over the composed input. Identical to the per-paper approach:
 * an unchanged agenda with unchanged summaries never calls the model twice. The
 * lead/month is folded in because it changes the requested output, not the input.
 */
export function digestSourceHash(target: DigestTarget, promptVersion: string): string {
  const payload = canonicalStringify({
    version: INPUT_FORMAT_VERSION,
    promptVersion,
    key: target.key,
    heading: target.heading,
    sourceText: target.sourceText,
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

/**
 * `compact` omits the per-paper key points and keeps only the one-paragraph
 * summary. The stadtweit call is a selection task over a whole month, so its pool
 * is by far the largest input in the spike; at full detail it reached 36 KiB and
 * a stronger model timed out on it repeatedly. The key points add per-paper depth
 * that selection does not use — the chosen items are already described by their
 * summary — so dropping them roughly halves the input at no cost to the task.
 */
function renderPaperBlock(
  agendaNumber: string | undefined,
  agendaName: string | undefined,
  paper: Paper,
  summary: PaperSummary,
  compact = false,
): string {
  const title = [
    agendaNumber ? `TOP ${agendaNumber}` : undefined,
    paper.paperType,
    paper.reference,
    agendaName || paper.name,
  ]
    .filter(Boolean)
    .join(' – ');
  return [
    `--- ${title} ---`,
    summary.summary,
    ...(compact ? [] : summary.keyPoints.map((point) => `- ${point}`)),
  ].join('\n');
}

/** `docs/papers/` is keyed by record basename; the store is keyed by id URL. */
let paperBasenameIndex: Map<string, Paper> | undefined;

function findPaperByRecordBasename(recordId: string): Paper | undefined {
  if (!paperBasenameIndex) {
    paperBasenameIndex = new Map();
    for (const paper of stores.papers.getAll()) {
      paperBasenameIndex.set(recordBasename(paper.id), paper);
    }
  }
  return paperBasenameIndex.get(recordId);
}

/**
 * OParl meeting names carry a session-visibility suffix — "Gemeinderat
 * (öffentlich/nicht öffentlich)". It describes the sitting's record, not the
 * committee, and reads as noise in a public preview. Stripped here rather than
 * asked of the prompt, since it is a fixed, mechanical suffix.
 */
export function committeeName(name: string): string {
  return name
    .replace(/\s*\((?:öffentlich|nicht öffentlich)(?:\/(?:nicht )?öffentlich)?\)\s*$/i, '')
    .trim();
}

function monthOf(date: string | undefined): string {
  return (date ?? '').slice(0, 7);
}

function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

function formatGermanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}
