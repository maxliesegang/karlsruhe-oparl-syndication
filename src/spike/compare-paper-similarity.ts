/** Offline before/after comparison on the frozen review queries. --baseline must
 * run before a scoring change. Normal runs never overwrite the labelled sample. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { canonicalStringify, recordBasename } from '../docs-files.js';
import {
  buildPaperSimilarityText,
  buildTfIdfVectors,
  createCosineScorer,
  SimilarityDocument,
  SimilarPaper,
  tokenizeForSimilarity,
} from '../paper-similarity.js';
import {
  buildPaperRelationIndex,
  PaperRelationIndex,
} from '../services/paper-relation-index-service.js';
import {
  PAPER_SIMILARITY_INDEX_VERSION,
  PAPER_SIMILARITY_MINIMUM_SCORE,
  PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT,
} from '../services/paper-similarity-index-service.js';
import { stores } from '../store/index.js';
import { createPaperSimilarityPolicy, PaperSimilarityPolicy } from '../paper-similarity-policy.js';
import { Paper } from '../types/index.js';
import {
  parseSimilarityReview,
  mergeReviewJudgments,
  reviewEvidence,
  SimilarityReviewEntry,
} from './paper-similarity-review.js';

const ROOT = 'src/spike/fixtures';
const REVIEW_FILE = `${ROOT}/similarity-review.md`;
const BASELINE_FILE = `${ROOT}/similarity-review-baseline.json`;
const REPORT_FILE = `${ROOT}/similarity-comparison.md`;
const FOLLOW_UP_FILES = [
  `${ROOT}/similarity-pending-review.md`,
  `${ROOT}/similarity-publication-review.md`,
];

interface QueryScores {
  neighbors: SimilarPaper[];
  reviewed: Record<string, { score: number; rank: number | null }>;
}
interface Snapshot {
  version: 1;
  scoringVersion: number;
  corpusHash: string;
  paperCount: number;
  queries: Record<string, QueryScores>;
}

/** Rank only the reviewed queries, against the complete corpus. This uses the
 * same vectors, exclusions, positive-score rule and id tie-break as production. */
export function scoreReviewQueries(
  documents: readonly SimilarityDocument[],
  entries: readonly SimilarityReviewEntry[],
  relations: PaperRelationIndex,
  policy?: PaperSimilarityPolicy,
): Record<string, QueryScores> {
  const ordered = [...documents].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(ordered.map((document, index) => [document.id, index]));
  const score = createCosineScorer(
    buildTfIdfVectors(ordered.map((document) => tokenizeForSimilarity(document.text))),
  );
  const queries: Record<string, QueryScores> = {};
  for (const queryId of new Set(entries.map((entry) => entry.queryId))) {
    const index = byId.get(queryId);
    if (index === undefined) throw new Error(`Missing review query ${queryId}`);
    const scores = score(index);
    const seenFamilies = new Set<string>();
    const ranked = ordered
      .map((document, i) => ({ id: document.id, score: scores[i] }))
      .filter((other) => other.score > 0 && relations.papers[queryId]?.[other.id] === undefined)
      .filter((other) => !policy?.isExcluded(queryId, other.id))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .filter((other) => {
        const family = policy?.familyOf(other.id) ?? other.id;
        if (seenFamilies.has(family)) return false;
        seenFamilies.add(family);
        return true;
      });
    const ranks = new Map(ranked.map((other, i) => [other.id, i + 1]));
    const reviewed: QueryScores['reviewed'] = {};
    for (const entry of entries.filter((item) => item.queryId === queryId)) {
      const candidateIndex = byId.get(entry.candidateId);
      if (candidateIndex === undefined)
        throw new Error(`Missing reviewed candidate ${entry.candidateId}`);
      reviewed[entry.candidateId] = {
        score: scores[candidateIndex],
        rank: ranks.get(entry.candidateId) ?? null,
      };
    }
    queries[queryId] = {
      neighbors: ranked.slice(0, PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT),
      reviewed,
    };
  }
  return queries;
}

export function summarizeRecommendations(
  queries: Record<string, QueryScores>,
  entries: readonly SimilarityReviewEntry[],
  minimumScore: number,
  maximumCount = PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT,
): { slots: number; useful: number; unhelpful: number; unresolved: number; usefulQueries: number } {
  const labels = new Map(
    entries.map((entry) => [`${entry.queryId} ${entry.candidateId}`, entry.label]),
  );
  let slots = 0,
    useful = 0,
    unhelpful = 0,
    unresolved = 0,
    usefulQueries = 0;
  for (const [queryId, query] of Object.entries(queries)) {
    let hasUseful = false;
    for (const neighbor of query.neighbors
      .slice(0, maximumCount)
      .filter((item) => item.score >= minimumScore)) {
      slots++;
      const label = labels.get(`${queryId} ${neighbor.id}`);
      if (label === 's' || label === 't') {
        useful++;
        hasUseful = true;
      } else if (label === 'n') unhelpful++;
      else unresolved++;
    }
    if (hasUseful) usefulQueries++;
  }
  return { slots, useful, unhelpful, unresolved, usefulQueries };
}

function renderComparison(
  baseline: Snapshot,
  current: Snapshot,
  entries: SimilarityReviewEntry[],
  papers: Map<string, Paper>,
  followUp: SimilarityReviewEntry[] = [],
): string {
  const evaluated = mergeReviewJudgments(entries, followUp);
  const latest = new Map(
    evaluated.map((entry) => [`${entry.queryId} ${entry.candidateId}`, entry]),
  );
  const escape = (value: string) => value.replace(/[\\`*_[\]<>|]/g, '\\$&').replace(/\s+/g, ' ');
  const name = (id: string) => `${id}: ${escape(papers.get(id)?.name ?? id)}`;
  const summaryRows: string[] = [];
  for (const [label, snapshot] of [
    ['Before', baseline],
    ['After', current],
  ] as const) {
    for (const count of [1, PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT]) {
      const stats = summarizeRecommendations(
        snapshot.queries,
        evaluated,
        PAPER_SIMILARITY_MINIMUM_SCORE,
        count,
      );
      const known = stats.useful + stats.unhelpful;
      const precision = known
        ? `${((100 * stats.useful) / known).toFixed(0)}% (${stats.useful}/${known})`
        : 'unmeasured';
      summaryRows.push(
        `| ${label}, top ${count} | ${stats.slots} | ${stats.useful} | ${stats.unhelpful} | ${stats.unresolved} | ${precision} | ${stats.usefulQueries}/${Object.keys(snapshot.queries).length} |`,
      );
    }
  }
  const retained = (snapshot: Snapshot, useful: boolean) =>
    entries.filter((entry) => {
      const label = latest.get(`${entry.queryId} ${entry.candidateId}`)?.label;
      return (
        (useful ? label === 's' || label === 't' : label === 'n') &&
        (snapshot.queries[entry.queryId].reviewed[entry.candidateId].rank ?? Infinity) <=
          PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT &&
        snapshot.queries[entry.queryId].reviewed[entry.candidateId].score >=
          PAPER_SIMILARITY_MINIMUM_SCORE
      );
    }).length;
  const lines = [
    '# Similarity input comparison',
    `Scoring version ${baseline.scoringVersion} → ${current.scoringVersion}; same ${current.paperCount} papers, ${Object.keys(current.queries).length} query papers and ${entries.length} reviewed pairs. Corpus SHA-256: \`${current.corpusHash}\`.`,
    'The [original review](similarity-review.md), labels, reviewer provenance and ordering are unchanged. Scores/ranks below are recomputed against the full corpus. New pairs have **no inherited judgment**. Existing assistant labels remain provisional; this is a development sample, not a held-out quality estimate.',
    `Summary metrics incorporate ${followUp.length} separately recorded [v2 follow-up judgments](similarity-pending-review.md) and [publication judgments](similarity-publication-review.md), adding ${evaluated.length - entries.length} pairs and resolving only blank/uncertain originals. Original resolved labels always take precedence; conflicting resolved judgments cause an error. The frozen-pair table below preserves the original labels for audit.`,
    `Threshold held at ${PAPER_SIMILARITY_MINIMUM_SCORE}; the same numeric threshold is not necessarily calibrated across representations. Precision below includes **judged pairs only**. Unresolved/new results are counted separately and must be reviewed before claiming overall precision.`,
    [
      '| Results | Slots | Known useful | Known unhelpful | Unresolved/new | Precision among judged | Queries with known useful |',
      '|---|---:|---:|---:|---:|---|---|',
      ...summaryRows,
    ].join('\n'),
    `Original useful pairs still in top ${PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT} above threshold: ${retained(baseline, true)} → ${retained(current, true)}. Original unhelpful pairs still in top ${PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT} above threshold: ${retained(baseline, false)} → ${retained(current, false)}. These are retention counts within the old sample, not recall over all relevant papers.`,
    '## Re-scoring the frozen pairs',
  ];
  const pairRows = [
    '| Query → candidate | Judgment / reviewer | Old score | New score | Old rank | New rank |',
    '|---|---|---:|---:|---:|---:|',
  ];
  for (const entry of entries) {
    const old = baseline.queries[entry.queryId].reviewed[entry.candidateId];
    const next = current.queries[entry.queryId].reviewed[entry.candidateId];
    pairRows.push(
      `| ${entry.queryId} → ${entry.candidateId} | ${entry.label.trim() || 'blank'} / ${entry.reviewer} | ${old.score.toFixed(6)} | ${next.score.toFixed(6)} | ${old.rank ?? '—'} | ${next.rank ?? '—'} |`,
    );
  }
  lines.push(pairRows.join('\n'));
  lines.push(
    '## Current candidates by query',
    'Scores are shown for diagnosis; judge the original sources before assigning new labels. Previously reviewed candidates refer to the frozen review. New candidates include original-source evidence below. Nothing here updates the published indexes.',
  );
  const labels = latest;
  const originalPairs = new Set(entries.map((entry) => `${entry.queryId} ${entry.candidateId}`));
  const followUpPairs = new Set(followUp.map((entry) => `${entry.queryId} ${entry.candidateId}`));
  const resolveText = (file: { id: string }) => stores.fileContents.getById(file.id)?.extractedText;
  for (const [queryId, query] of Object.entries(current.queries)) {
    lines.push(`### ${name(queryId)}`);
    const queryPaper = papers.get(queryId)!;
    lines.push(
      '<details><summary>Original query sources</summary>\n',
      reviewEvidence(queryPaper, undefined, resolveText),
      '\n</details>',
    );
    for (const other of query.neighbors) {
      const entry = labels.get(`${queryId} ${other.id}`);
      const status = entry
        ? `${entry.label.trim() || 'blank'} (${entry.reviewer}${followUpPairs.has(`${queryId} ${other.id}`) ? ', follow-up review' : ''})`
        : '**new, unreviewed**';
      lines.push(
        `- ${other.score.toFixed(6)} · ${status} · ${name(other.id)}${other.score < PAPER_SIMILARITY_MINIMUM_SCORE ? ' · below threshold' : ''}`,
      );
      if (!originalPairs.has(`${queryId} ${other.id}`))
        lines.push(
          '<details><summary>Original candidate sources</summary>\n',
          reviewEvidence(papers.get(other.id)!, queryPaper, resolveText),
          '\n</details>',
        );
    }
  }
  return lines.join('\n\n') + '\n';
}

async function main(): Promise<void> {
  const savingBaseline = process.argv.includes('--baseline');
  if (savingBaseline && fs.existsSync(BASELINE_FILE))
    throw new Error(
      `Refusing to replace ${BASELINE_FILE}; keep the original baseline for comparison.`,
    );
  config.extractPdfText = false;
  await stores.loadFromDisk();
  const papers = stores.papers.getAll().sort((a, b) => a.id.localeCompare(b.id));
  const relations = buildPaperRelationIndex();
  const entries = parseSimilarityReview(fs.readFileSync(REVIEW_FILE, 'utf8'));
  const corpus = createHash('sha256').update(canonicalStringify(relations));
  for (const paper of papers) {
    corpus.update(canonicalStringify(paper));
    for (const file of paper.auxiliaryFile ?? [])
      corpus.update(
        canonicalStringify([file.id, stores.fileContents.getById(file.id)?.extractedText ?? null]),
      );
  }
  const corpusHash = corpus.digest('hex');
  const baseline = savingBaseline
    ? undefined
    : (JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Snapshot);
  if (baseline && (baseline.version !== 1 || baseline.corpusHash !== corpusHash))
    throw new Error(
      'Baseline corpus differs from current archive; compare on the same corpus before attributing changes to scoring.',
    );
  const documents = papers.map((paper) => ({
    id: recordBasename(paper.id),
    text: buildPaperSimilarityText(
      paper,
      (file) => stores.fileContents.getById(file.id)?.extractedText,
    ),
  }));
  const snapshot: Snapshot = {
    version: 1,
    scoringVersion: PAPER_SIMILARITY_INDEX_VERSION,
    corpusHash,
    paperCount: papers.length,
    queries: scoreReviewQueries(
      documents,
      entries,
      relations,
      createPaperSimilarityPolicy(
        papers,
        (file) => stores.fileContents.getById(file.id)?.extractedText,
        relations.papers,
      ),
    ),
  };
  if (savingBaseline) {
    fs.writeFileSync(BASELINE_FILE, canonicalStringify(snapshot), { flag: 'wx' });
    console.log(
      `Saved scoring-v${snapshot.scoringVersion} baseline for ${entries.length} frozen pairs.`,
    );
  } else {
    // Pair membership must match too: adding/deleting labels is fine; replacing
    // the sampled pairs would no longer be a before/after comparison.
    const baselinePairs = Object.entries(baseline!.queries)
      .flatMap(([id, query]) => Object.keys(query.reviewed).map((other) => `${id} ${other}`))
      .sort();
    const currentPairs = entries.map((entry) => `${entry.queryId} ${entry.candidateId}`).sort();
    if (JSON.stringify(baselinePairs) !== JSON.stringify(currentPairs))
      throw new Error('Reviewed pair set changed since baseline');
    const followUp = FOLLOW_UP_FILES.flatMap((file) =>
      fs.existsSync(file) ? parseSimilarityReview(fs.readFileSync(file, 'utf8')) : [],
    );
    const report = renderComparison(
      baseline!,
      snapshot,
      entries,
      new Map(papers.map((paper) => [recordBasename(paper.id), paper])),
      followUp,
    );
    fs.writeFileSync(REPORT_FILE, report);
    console.log(`Wrote ${REPORT_FILE}; review labels and baseline preserved.`);
    const evaluated = mergeReviewJudgments(entries, followUp);
    console.log(
      'Before',
      summarizeRecommendations(baseline!.queries, evaluated, PAPER_SIMILARITY_MINIMUM_SCORE),
    );
    console.log(
      'After ',
      summarizeRecommendations(snapshot.queries, evaluated, PAPER_SIMILARITY_MINIMUM_SCORE),
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
