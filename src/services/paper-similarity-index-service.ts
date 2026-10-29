import { atomicWriteFile, canonicalStringify, docsPath, recordBasename } from '../docs-files.js';
import { logger } from '../logger.js';
import { buildPaperSimilarityText, findSimilarPapers, SimilarPaper } from '../paper-similarity.js';
import { stores } from '../store/index.js';
import { buildRecordFileNameIndex } from '../store/record-files.js';
import { createPaperSimilarityPolicy } from '../paper-similarity-policy.js';
import { PaperRelationIndex } from './paper-relation-index-service.js';

export const PAPER_SIMILARITY_INDEX_FILE_NAME = 'paper-similar.json';

/** Bump on any shape **or scoring** change, so a viewer can detect an index it does not understand. */
export const PAPER_SIMILARITY_INDEX_VERSION = 3 as const;

export const PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT = 3;

/**
 * Conservative floor, combined with title evidence, routine-paper exclusions
 * and family diversity. A high cosine alone is not a relevance decision.
 */
export const PAPER_SIMILARITY_MINIMUM_SCORE = 0.1;

/**
 * Published as `docs/paper-similar.json`.
 *
 * Shape: `{ version, papers: { "<recordId>": ["<similarRecordId>", …] } }`, best first,
 * keyed by record basename like the other indexes. Papers explicitly related in
 * `paper-relations.json` are left out of each other's list: that index already
 * names them, with a reason, and "ähnlich" must not repeat a stronger statement.
 * Lists are directed, may contain fewer than three ids, and omit papers with no
 * eligible recommendation. Version 3 adds precision guards and family diversity.
 *
 * Scores are deliberately not published. Every new paper shifts the idf of every
 * term, so a score would change in the fourth decimal on every run and the whole
 * file would churn in git even when no neighbour moved.
 */
export interface PaperSimilarityIndex {
  version: typeof PAPER_SIMILARITY_INDEX_VERSION;
  papers: Record<string, string[]>;
}

/**
 * Nearest neighbours of every archived paper, with scores, keyed by record basename.
 * Exported for the review script, which needs the scores the index drops.
 */
export function findSimilarArchivedPapers(
  relationIndex: PaperRelationIndex,
  minimumScore = PAPER_SIMILARITY_MINIMUM_SCORE,
): Map<string, SimilarPaper[]> {
  const archived = stores.papers.getAll();
  buildRecordFileNameIndex(
    'paper similarity index',
    archived.map((paper) => paper.id),
  );
  const resolveText = (file: { id: string }) => stores.fileContents.getById(file.id)?.extractedText;
  const policy = createPaperSimilarityPolicy(archived, resolveText, relationIndex.papers);
  const documents = archived.map((paper) => ({
    id: recordBasename(paper.id),
    text: buildPaperSimilarityText(
      paper,
      (file) => stores.fileContents.getById(file.id)?.extractedText,
    ),
  }));

  return findSimilarPapers(documents, {
    maximumNeighborCount: PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT,
    minimumScore,
    isExcluded: policy.isExcluded,
    familyOf: policy.familyOf,
  });
}

/**
 * Rebuilt in full every run. Any new paper changes the idf of the terms it contains
 * and can enter an older paper's list, so there is no sound incremental build.
 */
export function buildPaperSimilarityIndex(relationIndex: PaperRelationIndex): PaperSimilarityIndex {
  const papers: PaperSimilarityIndex['papers'] = {};
  for (const [id, similar] of findSimilarArchivedPapers(relationIndex)) {
    papers[id] = similar.map((paper) => paper.id);
  }
  return { version: PAPER_SIMILARITY_INDEX_VERSION, papers };
}

/** Canonical, so an unchanged archive produces byte-identical output. */
export async function writePaperSimilarityIndex(index: PaperSimilarityIndex): Promise<void> {
  await atomicWriteFile(docsPath(PAPER_SIMILARITY_INDEX_FILE_NAME), canonicalStringify(index));
  logger.info(
    `Published similar papers for ${Object.keys(index.papers).length} paper(s) ` +
      `to ${PAPER_SIMILARITY_INDEX_FILE_NAME}`,
  );
}
