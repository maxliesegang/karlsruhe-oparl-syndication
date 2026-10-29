import { atomicWriteFile, canonicalStringify, docsPath, recordBasename } from '../docs-files.js';
import { logger } from '../logger.js';
import { buildPaperRelations, PaperRelationKind } from '../paper-relations.js';
import { buildRecordFileNameIndex } from '../store/record-files.js';
import { stores } from '../store/index.js';

export const PAPER_RELATION_INDEX_FILE_NAME = 'paper-relations.json';

/** Bump on any shape **or rule** change, so a viewer can detect an index it does not understand. */
export const PAPER_RELATION_INDEX_VERSION = 1 as const;

/**
 * Published as `docs/paper-relations.json`.
 *
 * Shape: `{ version, papers: { "<recordId>": { "<relatedRecordId>": ["<kind>"] } } }`,
 * keyed on both levels by the record basename used for `docs/papers/<recordId>.json`,
 * like `paper-submitters.json`. Every relation is stored from both sides with its
 * inverse kind (`cites` ↔ `cited-by`), so a viewer looking at one paper needs no
 * reverse scan. Papers without any relation are omitted.
 */
export interface PaperRelationIndex {
  version: typeof PAPER_RELATION_INDEX_VERSION;
  papers: Record<string, Record<string, PaperRelationKind[]>>;
}

/**
 * Rebuilt in full every run, like the submitter index: the citation scan runs over
 * text the file-content store already holds in memory and costs about a second on
 * the whole archive, cheaper than invalidation bookkeeping for an incremental build.
 */
export function buildPaperRelationIndex(): PaperRelationIndex {
  const archivedPapers = stores.papers.getAll();
  buildRecordFileNameIndex(
    'paper relation index',
    archivedPapers.map((paper) => paper.id),
  );
  const relations = buildPaperRelations(
    archivedPapers,
    (file) => stores.fileContents.getById(file.id)?.extractedText,
  );

  const papers: PaperRelationIndex['papers'] = {};
  for (const [paperId, related] of relations) {
    papers[recordBasename(paperId)] = Object.fromEntries(
      [...related].map(([relatedId, kinds]) => [recordBasename(relatedId), kinds]),
    );
  }

  return { version: PAPER_RELATION_INDEX_VERSION, papers };
}

/** Canonical, so an unchanged archive produces byte-identical output. */
export async function writePaperRelationIndex(index: PaperRelationIndex): Promise<void> {
  await atomicWriteFile(docsPath(PAPER_RELATION_INDEX_FILE_NAME), canonicalStringify(index));
  logger.info(
    `Published relations for ${Object.keys(index.papers).length} paper(s) ` +
      `to ${PAPER_RELATION_INDEX_FILE_NAME}`,
  );
}
