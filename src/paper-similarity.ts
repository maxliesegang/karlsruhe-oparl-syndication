import {
  similarityAttachmentPriority,
  stripSimilarityBoilerplate,
} from './services/paper-similarity-source.js';
import { isMeetingRecordAttachment } from './services/paper-summary-source.js';
import { OParlFile, Paper } from './types/index.js';

/**
 * Lexical "ähnlich" — papers on a similar subject, as opposed to the explicit
 * same-matter links of `paper-relations.ts`. TF-IDF cosine over the title plus the
 * start of the paper's own text. Substantive documents precede annexes and budget
 * forms are removed; `npm run compare:similarity` measures against the v1 baseline.
 * It finds topic, and also genre —
 * annual reports resemble annual reports — so it must never be presented as history.
 */

/** Characters of own attachment text after the title. Enough for the opening that
 *  states the subject, short enough that annex tables don't dominate. */
export const SIMILARITY_BODY_CHARACTER_LIMIT = 3000;
/** Reserve some coverage for annex-only details without letting tables replace the proposal. */
const SIMILARITY_SUPPORTING_CHARACTER_LIMIT = 750;

/** Terms in more than this share of documents carry almost no signal and dominate
 *  the cost of the inverted index, so they are dropped. */
const MAXIMUM_DOCUMENT_FREQUENCY_SHARE = 0.1;

const STOPWORDS = new Set(
  (
    'der die das den dem des und oder für von vom mit im in ins zu zur zum auf aus an am ' +
    'bei nach über unter als auch sowie ist sind wird werden wurde wurden sich nicht ein ' +
    'eine einer eines einem einen durch bis wie dass daß hat haben kann können soll sollen ' +
    'diese dieser dieses es sie er wir ihr so noch nur bzw ggf gegen ohne um vor ' +
    'karlsruhe stadt'
  ).split(' '),
);

/**
 * Lowercased words of three or more letters, stopwords removed. Digits are dropped:
 * amounts, dates and reference numbers would otherwise match papers that share
 * nothing but a year — and the audit's silver standard is partly defined by
 * reference numbers, which must not leak into the score.
 */
export function tokenizeForSimilarity(text: string): string[] {
  return text
    .toLocaleLowerCase('de-DE')
    .split(/[^a-zäöüß]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

/** Title + bounded original text, with stable document selection. Labelled own
 * documents come first, reserving up to 2250 chars of the 3000-char budget. Unused
 * room is available to annexes; without a usable own document all files remain
 * eligible. Minutes and glyph-only failed extractions contribute nothing. */
export function buildPaperSimilarityText(
  paper: Paper,
  getExtractedText: (file: OParlFile) => string | undefined,
): string {
  const sources = (paper.auxiliaryFile ?? [])
    .filter((file) => !isMeetingRecordAttachment(file.name))
    .sort(
      (a, b) =>
        similarityAttachmentPriority(a) - similarityAttachmentPriority(b) ||
        a.id.localeCompare(b.id),
    )
    .map((file) => ({ file, text: stripSimilarityBoilerplate(getExtractedText(file) ?? '') }))
    .filter(({ text }) => /[a-zäöüß]{3}/i.test(text));
  const own = sources.filter(({ file }) => similarityAttachmentPriority(file) === 0);
  let body: string;
  if (own.length > 0) {
    const primary = own
      .map(({ text }) => text)
      .join('\n')
      .slice(0, SIMILARITY_BODY_CHARACTER_LIMIT - SIMILARITY_SUPPORTING_CHARACTER_LIMIT);
    const supporting = sources
      .filter(({ file }) => similarityAttachmentPriority(file) !== 0)
      .map(({ text }) => text)
      .join('\n');
    // A paper with no supporting text can use the entire budget for its own files.
    body = supporting
      ? `${primary}\n${supporting}`.slice(0, SIMILARITY_BODY_CHARACTER_LIMIT)
      : own
          .map(({ text }) => text)
          .join('\n')
          .slice(0, SIMILARITY_BODY_CHARACTER_LIMIT);
  } else {
    body = sources
      .map(({ text }) => text)
      .join('\n')
      .slice(0, SIMILARITY_BODY_CHARACTER_LIMIT);
  }
  return `${paper.name ?? ''}\n${body}`;
}

export type SparseVector = Map<number, number>;

/** Sublinear tf, smoothed idf, L2-normalised. */
export function buildTfIdfVectors(documents: readonly string[][]): SparseVector[] {
  const vocabulary = new Map<string, number>();
  const documentFrequency: number[] = [];
  for (const tokens of documents) {
    for (const token of new Set(tokens)) {
      let id = vocabulary.get(token);
      if (id === undefined) vocabulary.set(token, (id = documentFrequency.push(0) - 1));
      documentFrequency[id] += 1;
    }
  }

  const maximumFrequency = documents.length * MAXIMUM_DOCUMENT_FREQUENCY_SHARE;
  return documents.map((tokens) => {
    const counts = new Map<number, number>();
    for (const token of tokens) {
      const id = vocabulary.get(token)!;
      if (documentFrequency[id] > maximumFrequency) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const vector: SparseVector = new Map();
    let norm = 0;
    for (const [id, count] of counts) {
      const weight =
        (1 + Math.log(count)) * Math.log((1 + documents.length) / (1 + documentFrequency[id]));
      vector.set(id, weight);
      norm += weight * weight;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [id, weight] of vector) vector.set(id, weight / norm);
    return vector;
  });
}

/** Cosine scores of one document against all others, through an inverted index.
 *  The query's own slot is set to -1 so it never ranks as its own neighbour. */
export function createCosineScorer(
  vectors: readonly SparseVector[],
): (index: number) => Float64Array {
  const postings = new Map<number, Array<[number, number]>>();
  vectors.forEach((vector, documentIndex) => {
    for (const [id, weight] of vector) {
      let list = postings.get(id);
      if (!list) postings.set(id, (list = []));
      list.push([documentIndex, weight]);
    }
  });

  return (queryIndex) => {
    const scores = new Float64Array(vectors.length);
    for (const [id, weight] of vectors[queryIndex]) {
      for (const [documentIndex, otherWeight] of postings.get(id)!) {
        scores[documentIndex] += weight * otherWeight;
      }
    }
    scores[queryIndex] = -1;
    return scores;
  };
}

export interface SimilarityDocument {
  id: string;
  text: string;
}

export interface SimilarPaper {
  id: string;
  score: number;
}

export interface FindSimilarPapersOptions {
  maximumNeighborCount: number;
  minimumScore: number;
  /** Pairs to leave out, e.g. papers already explicitly related. */
  isExcluded?: (id: string, otherId: string) => boolean;
  /** At most one recommendation per narrowly defined title/reference family. */
  familyOf?: (id: string) => string;
}

/**
 * The nearest neighbours of every document, best first. Ties break on id, so the
 * result depends only on the input set, not on its order.
 */
export function findSimilarPapers(
  documents: readonly SimilarityDocument[],
  options: FindSimilarPapersOptions,
): Map<string, SimilarPaper[]> {
  const ordered = [...documents].sort((a, b) => a.id.localeCompare(b.id));
  const score = createCosineScorer(
    buildTfIdfVectors(ordered.map((document) => tokenizeForSimilarity(document.text))),
  );

  const neighbors = new Map<string, SimilarPaper[]>();
  ordered.forEach((document, queryIndex) => {
    const scores = score(queryIndex);
    const best: SimilarPaper[] = [];
    for (let index = 0; index < scores.length; index += 1) {
      const value = scores[index];
      if (value <= 0 || value < options.minimumScore) continue;
      if (best.length === options.maximumNeighborCount && value <= best[best.length - 1].score) {
        continue;
      }
      const otherId = ordered[index].id;
      if (options.isExcluded?.(document.id, otherId)) continue;
      const family = options.familyOf?.(otherId);
      const sibling =
        family === undefined ? -1 : best.findIndex((item) => options.familyOf!(item.id) === family);
      if (sibling >= 0) {
        if (best[sibling].score >= value) continue;
        best.splice(sibling, 1);
      }
      best.push({ id: otherId, score: value });
      // Ids ascend with index, so a stable sort keeps the lower id first on a tie.
      best.sort((a, b) => b.score - a.score);
      if (best.length > options.maximumNeighborCount) best.pop();
    }
    if (best.length > 0) neighbors.set(document.id, best);
  });
  return neighbors;
}
