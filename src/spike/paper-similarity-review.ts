import { recordBasename } from '../docs-files.js';
import { tokenizeForSimilarity } from '../paper-similarity.js';
import {
  findTemplateAbstract,
  stripTemplateBoilerplate,
} from '../services/paper-document-template.js';
import { isMeetingRecordAttachment } from '../services/paper-summary-source.js';
import { OParlFile, Paper } from '../types/index.js';

export type ReviewLabel = 's' | 't' | 'n';
export interface SimilarityReviewEntry {
  queryId: string;
  candidateId: string;
  label: ReviewLabel | '?' | ' ';
  score: number;
  rank: number;
  reviewer: 'human' | 'assistant';
  confidence?: 'high' | 'medium' | 'low';
}

/** Unannotated labels are the original human review; machine labels must say so. */
export function parseSimilarityReview(markdown: string): SimilarityReviewEntry[] {
  const entries: SimilarityReviewEntry[] = [];
  const pairs = new Set<string>();
  let rank = 0;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('### ')) rank = 0;
    if (!line.startsWith('- [')) continue;
    const match =
      /^- \[([stn? ])\] `([\d.]+)` .*?<!-- ([A-Za-z0-9._-]+) ([A-Za-z0-9._-]+) -->(.*)$/.exec(line);
    if (!match) throw new Error(`Malformed similarity review row: ${line}`);
    const [, label, score, queryId, candidateId, annotation] = match;
    const provenance = annotation.trim()
      ? /^<!-- reviewer: (human|assistant); confidence: (high|medium|low) -->$/.exec(
          annotation.trim(),
        )
      : undefined;
    if (annotation.trim() && !provenance) throw new Error(`Malformed reviewer annotation: ${line}`);
    const pair = `${queryId} ${candidateId}`;
    if (pairs.has(pair)) throw new Error(`Duplicate similarity review pair: ${pair}`);
    pairs.add(pair);
    entries.push({
      queryId,
      candidateId,
      label: label as SimilarityReviewEntry['label'],
      score: Number(score),
      rank: ++rank,
      reviewer: (provenance?.[1] as SimilarityReviewEntry['reviewer']) ?? 'human',
      confidence: provenance?.[2] as SimilarityReviewEntry['confidence'],
    });
  }
  return entries;
}

/** Follow-up review can resolve uncertainty or add pairs, never silently replace
 * a resolved original judgment (especially a human's decision). */
export function mergeReviewJudgments(
  original: readonly SimilarityReviewEntry[],
  followUp: readonly SimilarityReviewEntry[],
): SimilarityReviewEntry[] {
  const merged = new Map(original.map((entry) => [`${entry.queryId} ${entry.candidateId}`, entry]));
  for (const entry of followUp) {
    const key = `${entry.queryId} ${entry.candidateId}`;
    const prior = merged.get(key);
    if (prior && prior.label !== ' ' && prior.label !== '?') {
      if (entry.label !== ' ' && entry.label !== '?' && entry.label !== prior.label)
        throw new Error(
          `Conflicting resolved review judgments for ${key}; update the original explicitly`,
        );
      continue;
    }
    if (!prior || entry.label !== ' ') merged.set(key, entry);
  }
  return [...merged.values()];
}

const LOW_SIGNAL_TERMS = new Set(
  (
    'antrag anfrage vorlage beschlussvorlage informationsvorlage beschluss gemeinderat karlsruher ' +
    'satzung änderung verfahren beschlussfassung aufstellung bekanntgabe ergänzung fortführung'
  ).split(' '),
);

function escapeMarkdown(text: string): string {
  return text
    .replace(/[\\`*_[\]<>|]/g, '\\$&')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourcePriority(file: OParlFile): number {
  const name = file.name ?? '';
  if (/anlage|lageplan|zeichnung|synopse|umweltbericht|festsetzungen/i.test(name)) return 2;
  return /vorlage|antrag|anfrage|stellungnahme|beschluss|kurzfassung/i.test(name) ? 0 : 1;
}

/** Selects a readable source passage, never an unverified cached LLM summary. */
export function reviewEvidence(
  paper: Paper,
  counterpart: Paper | undefined,
  getExtractedText: (file: OParlFile) => string | undefined,
): string {
  const files = (paper.auxiliaryFile ?? [])
    .filter((file) => !isMeetingRecordAttachment(file.name))
    .sort((a, b) => sourcePriority(a) - sourcePriority(b) || a.id.localeCompare(b.id));
  const sources = files
    .map((file) => ({ file, text: getExtractedText(file) }))
    .filter((source): source is { file: OParlFile; text: string } => !!source.text?.trim());
  const primary = sources.find((source) => (source.text.match(/[a-zäöüß]/gi)?.length ?? 0) >= 40);
  const lines = [
    `[Paper record](../../../docs/papers/${recordBasename(paper.id)}.json)`,
    ...files.map((file) => {
      const links = [file.accessUrl || file.downloadUrl]
        .filter(Boolean)
        .map((url) => `[PDF](<${url}>)`);
      if (sources.some((source) => source.file.id === file.id)) {
        links.push(`[extracted text](../../../docs/file-contents/${recordBasename(file.id)}.txt)`);
      }
      return `- ${escapeMarkdown(file.name || file.id)}: ${links.join(' · ') || 'no source URL'}`;
    }),
  ];
  if (!primary) {
    lines.push('\n**No usable original text. Judge from the linked PDF, or use `?`.**');
    return lines.join('\n');
  }

  const cleaned = stripTemplateBoilerplate(primary.text).replace(/\s+/g, ' ').trim();
  const rawAbstract = findTemplateAbstract(primary.text).replace(/\s+/g, ' ').trim();
  const abstract = (rawAbstract.match(/[a-zäöüß]/gi)?.length ?? 0) >= 10 ? rawAbstract : '';
  const titleAt = paper.name ? cleaned.indexOf(paper.name) : -1;
  const lead =
    titleAt >= 0 && titleAt < 800 ? cleaned.slice(titleAt + paper.name.length).trim() : cleaned;
  // Older templates and budget forms can fill the entire opening with furniture.
  // An explicit content heading gives a better starting point without paraphrasing.
  const contentStart =
    /(?:^|\n)[ \t\uF075]*(?:Beschlussantrag(?: \(Kurzfassung\))?|Antrag an den [^\n]+|Begründung(?:\s*[/|][^\n:]*)?|Sachverhalt(?:\s*[/|][^\n:]*)?|Antrag|Anfrage|Ergänzende Erläuterungen|Erläuterungen)\s*:?\s*(?:\n|$)/.exec(
      primary.text,
    );
  const section = contentStart
    ? stripTemplateBoilerplate(primary.text.slice(contentStart.index + contentStart[0].length))
        .replace(/\s+/g, ' ')
        .trim()
    : '';
  const excerpt = abstract || section || lead;
  lines.push(
    `\nOriginal ${abstract ? 'Kurzfassung' : section ? 'content section' : 'opening'} — ${escapeMarkdown(primary.file.name)}:`,
  );
  lines.push(`> ${escapeMarkdown(excerpt.slice(0, 1000))}${excerpt.length > 1000 ? '…' : ''}`);

  // A counterpart's distinctive title words can expose a relevant passage buried
  // beyond the opening. Show it as evidence to inspect, not a relevance verdict.
  const terms = [...new Set(tokenizeForSimilarity(counterpart?.name ?? ''))].filter(
    (term) => term.length >= 6 && !LOW_SIGNAL_TERMS.has(term),
  );
  let best: { file: OParlFile; passage: string; matches: number } | undefined;
  for (const source of sources) {
    const flat = stripTemplateBoilerplate(source.text).replace(/\s+/g, ' ').trim();
    const lower = flat.toLocaleLowerCase('de-DE');
    for (const term of terms) {
      const at = lower.indexOf(term);
      if (at < 0) continue;
      const start = Math.max(0, at - 180);
      const passage = flat.slice(start, start + 700);
      const passageLower = passage.toLocaleLowerCase('de-DE');
      const matches = terms.filter((word) => passageLower.includes(word)).length;
      if (!best || matches > best.matches) best = { file: source.file, passage, matches };
    }
  }
  if (best && !excerpt.includes(best.passage)) {
    lines.push(`\nPassage sharing title words (context only) — ${escapeMarkdown(best.file.name)}:`);
    lines.push(`> ${escapeMarkdown(best.passage)}…`);
  }
  return lines.join('\n');
}

/** Enriches the existing sample without recomputing pairs or touching its labels. */
export function buildReviewContext(
  entries: readonly SimilarityReviewEntry[],
  papersById: ReadonlyMap<string, Paper>,
  getExtractedText: (file: OParlFile) => string | undefined,
): string {
  const paper = (id: string): Paper => {
    const found = papersById.get(id);
    if (!found) throw new Error(`Reviewed paper ${id} is absent from the archive`);
    return found;
  };
  const groups = new Map<string, SimilarityReviewEntry[]>();
  for (const entry of entries)
    groups.set(entry.queryId, [...(groups.get(entry.queryId) ?? []), entry]);
  const sections = [...groups].map(([queryId, candidates], index) => {
    const query = paper(queryId);
    return [
      `## ${index + 1}. ${escapeMarkdown(query.name)} (${queryId})`,
      reviewEvidence(query, undefined, getExtractedText),
      ...candidates.map((entry) => {
        const candidate = paper(entry.candidateId);
        return [
          `<a id="pair-${queryId}-${entry.candidateId}"></a>`,
          `### ${queryId} → ${entry.candidateId}: ${escapeMarkdown(candidate.name)}`,
          `${candidate.reference} · ${candidate.date} · ${candidate.paperType}`,
          reviewEvidence(candidate, query, getExtractedText),
        ].join('\n\n');
      }),
    ].join('\n\n');
  });
  return (
    `# Original-source context for similarity review\n\n` +
    `Companion to [the labelled sample](similarity-review.md). Scores and proposed labels are omitted ` +
    `so you can judge the sources first. Excerpts are mechanical selections, not summaries or proof ` +
    `of a relationship. Follow the PDF/text links where the excerpt is insufficient.\n\n` +
    sections.join('\n\n') +
    '\n'
  );
}
