/** Offline evaluation of lexical paper similarity (TF-IDF cosine) against the explicit
 * relations in `paper-relations.ts`, which serve as a silver standard: two papers one
 * cites the other are related, so a useful similarity measure should rank the partner
 * high. No network calls or writes. Run: `npm run audit:similarity`. */
import fs from 'node:fs';
import { buildPaperRelations, PaperRelationKind } from '../paper-relations.js';
import {
  buildPaperSimilarityText,
  buildTfIdfVectors,
  createCosineScorer,
  tokenizeForSimilarity,
} from '../paper-similarity.js';
import { findTemplateAbstract } from '../services/paper-document-template.js';
import { isMeetingRecordAttachment } from '../services/paper-summary-source.js';
import { Paper } from '../types/index.js';

/** Citing papers with more links than this are status reports enumerating Vorlagen
 *  (Haushaltssicherung: 98). They would contribute hundreds of pairs that all test
 *  the same thing, so they are left out of the gold set. */
const HUB_DEGREE = 20;
const RECALL_CUTOFFS = [1, 5, 10, 50] as const;

type Representation = 'title' | 'title+abstract' | 'title+body' | 'title+abstract (char 5-grams)';

/** Within-word character n-grams, so German compounds ("Radverkehrskonzept",
 *  "Radverkehr") share features that whole-word tokens cannot. */
function characterGrams(text: string, size = 5): string[] {
  const grams: string[] = [];
  for (const word of tokenizeForSimilarity(text)) {
    const padded = `_${word}_`;
    if (padded.length <= size) grams.push(padded);
    for (let index = 0; index + size <= padded.length; index += 1) {
      grams.push(padded.slice(index, index + size));
    }
  }
  return grams;
}

/** 1-based rank of `target`; ties are counted against it, so a score of 0 ranks last. */
function rankOf(scores: Float64Array, target: number): number {
  const targetScore = scores[target];
  if (targetScore <= 0) return scores.length;
  let rank = 1;
  for (let index = 0; index < scores.length; index += 1) {
    if (index !== target && scores[index] >= targetScore) rank += 1;
  }
  return rank;
}

function readJson<T>(path: string): T {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as T;
}

const papers = fs
  .readdirSync('docs/papers')
  .filter((fileName) => fileName.endsWith('.json'))
  .sort()
  .map((fileName) => readJson<Paper>(`docs/papers/${fileName}`));
const indexById = new Map(papers.map((paper, index) => [paper.id, index]));

const attachmentTexts = new Map<string, string>();
for (const paper of papers) {
  for (const file of paper.auxiliaryFile ?? []) {
    const path = `docs/file-contents/${file.id.split('/').at(-1)}.txt`;
    if (fs.existsSync(path)) attachmentTexts.set(file.id, fs.readFileSync(path, 'utf8'));
  }
}

const relations = buildPaperRelations(papers, (file) => attachmentTexts.get(file.id));

function ownTexts(paper: Paper): string[] {
  return (paper.auxiliaryFile ?? [])
    .filter((file) => !isMeetingRecordAttachment(file.name))
    .map((file) => attachmentTexts.get(file.id))
    .filter((text): text is string => !!text);
}

const titles = papers.map((paper) => paper.name ?? '');
const abstracts = papers.map((paper) =>
  ownTexts(paper).map(findTemplateAbstract).filter(Boolean).join('\n'),
);
// Same cosine input as production. This audit measures retrieval before the
// title-evidence/family publication policy; compare:similarity evaluates that too.
const titleAndBodies = papers.map((paper) =>
  buildPaperSimilarityText(paper, (file) => attachmentTexts.get(file.id)),
);

const representations: Record<Representation, () => string[][]> = {
  title: () => titles.map(tokenizeForSimilarity),
  'title+abstract': () =>
    titles.map((title, index) => tokenizeForSimilarity(`${title}\n${abstracts[index]}`)),
  'title+body': () => titleAndBodies.map(tokenizeForSimilarity),
  'title+abstract (char 5-grams)': () =>
    titles.map((title, index) => characterGrams(`${title}\n${abstracts[index]}`)),
};

/**
 * Gold groups. `cites` is the honest test: those pairs carry no shared title or
 * reference family, so nothing but content can find them. The amendment and title
 * groups are near-duplicates by construction and only show the method is not broken.
 */
type GoldGroup = 'cites only' | 'amendment (oparl/reference-family)' | 'same-title only';

function goldGroup(kinds: PaperRelationKind[]): GoldGroup | undefined {
  const set = new Set(kinds);
  if (set.has('subordinated') || set.has('superordinated') || set.has('reference-family'))
    return 'amendment (oparl/reference-family)';
  if (set.has('same-title')) return set.size === 1 ? 'same-title only' : undefined;
  return 'cites only';
}

const goldPairs = new Map<GoldGroup, Array<[number, number]>>();
for (const [paperId, related] of relations) {
  if (related.size > HUB_DEGREE) continue;
  for (const [relatedId, kinds] of related) {
    if ((relations.get(relatedId)?.size ?? 0) > HUB_DEGREE) continue;
    const group = goldGroup(kinds);
    if (!group) continue;
    const pairs = goldPairs.get(group) ?? [];
    pairs.push([indexById.get(paperId)!, indexById.get(relatedId)!]);
    goldPairs.set(group, pairs);
  }
}

console.log(
  `${papers.length} papers, ${abstracts.filter(Boolean).length} with a Kurzfassung, ` +
    `${papers.filter((paper) => ownTexts(paper).length > 0).length} with own attachment text; ` +
    `gold pairs (directed, hubs > ${HUB_DEGREE} excluded): ` +
    [...goldPairs].map(([group, pairs]) => `${group} ${pairs.length}`).join(', '),
);

const showExamples = process.argv.includes('--examples');

for (const [name, tokenize] of Object.entries(representations) as Array<
  [Representation, () => string[][]]
>) {
  const started = performance.now();
  const score = createCosineScorer(buildTfIdfVectors(tokenize()));
  const scoreCache = new Map<number, Float64Array>();
  const scoresFor = (index: number) => {
    let scores = scoreCache.get(index);
    if (!scores) {
      scores = score(index);
      if (scoreCache.size > 2000) scoreCache.clear();
      scoreCache.set(index, scores);
    }
    return scores;
  };

  console.log(`\n== ${name}`);
  for (const [group, pairs] of goldPairs) {
    const ranks = pairs.map(([from, to]) => rankOf(scoresFor(from), to));
    const recall = RECALL_CUTOFFS.map(
      (cutoff) =>
        `R@${cutoff} ${((100 * ranks.filter((rank) => rank <= cutoff).length) / ranks.length).toFixed(0)}%`,
    );
    const reciprocalRank = ranks.reduce((sum, rank) => sum + 1 / rank, 0) / ranks.length;
    console.log(`  ${group.padEnd(36)} ${recall.join('  ')}  MRR ${reciprocalRank.toFixed(2)}`);
  }

  // How often is the nearest neighbour an explicit relation? A lower bound on
  // precision only: the relation graph covers ~26% of papers, so an unlinked
  // neighbour may still be right.
  let linkedQueries = 0;
  let topIsRelated = 0;
  for (const [paperId, related] of relations) {
    const index = indexById.get(paperId)!;
    const scores = scoresFor(index);
    let best = -1;
    for (let other = 0; other < scores.length; other += 1)
      if (best < 0 || scores[other] > scores[best]) best = other;
    if (scores[best] <= 0) continue;
    linkedQueries += 1;
    if (related.has(papers[best].id)) topIsRelated += 1;
  }
  console.log(
    `  nearest neighbour is an explicit relation for ${topIsRelated}/${linkedQueries} ` +
      `linked papers (${((100 * topIsRelated) / linkedQueries).toFixed(0)}%) — ` +
      `${((performance.now() - started) / 1000).toFixed(1)} s`,
  );

  if (showExamples) {
    // Fixed stride over the cites-only pairs, so the sample is reproducible.
    const pairs = goldPairs.get('cites only') ?? [];
    for (let sample = 0; sample < 8; sample += 1) {
      const [from, to] = pairs[Math.floor((sample * pairs.length) / 8)];
      const scores = scoresFor(from);
      const top = [...scores.keys()].sort((a, b) => scores[b] - scores[a]).slice(0, 3);
      console.log(
        `    ${papers[from].reference} ${titles[from].slice(0, 70)}\n` +
          `      cited (rank ${rankOf(scores, to)}): ${titles[to].slice(0, 70)}\n` +
          top
            .map(
              (index) =>
                `      ${scores[index].toFixed(2)} ${papers[index].reference} ${titles[index].slice(0, 70)}`,
            )
            .join('\n'),
      );
    }
  }
}
