import { atomicWriteFile, canonicalStringify, docsPath, recordBasename } from '../docs-files.js';
import { logger } from '../logger.js';
import {
  createMemoizedPaperSubmitterResolver,
  FactionId,
  listFactions,
  PaperSubmitterResolver,
} from '../paper-submitters.js';
import { buildRecordFileNameIndex } from '../store/record-files.js';
import { stores } from '../store/index.js';
import { Paper } from '../types/index.js';

export const PAPER_SUBMITTER_INDEX_FILE_NAME = 'paper-submitters.json';

/**
 * Bump when the shape changes so a consuming viewer can detect an index it does
 * not understand instead of silently reading missing fields.
 */
export const PAPER_SUBMITTER_INDEX_VERSION = 3 as const;

/**
 * Published as `docs/paper-submitters.json`.
 *
 * Keyed by the paper's record basename — the same `<recordId>` used for
 * `docs/papers/<recordId>.json` — so a viewer that already reads those files can
 * look a paper up directly by filename. The key is guaranteed to exist and to be
 * unique (`recordBasename` rejects collisions).
 *
 * The value is the bare faction-id array. Version 2 also carried the paper's `id`
 * URL and `reference` for consumers joining on those, which was dropped: both are
 * already in `docs/papers/<recordId>.json`, which a viewer must read anyway for the
 * title and date, so duplicating them here only created a second copy that can go
 * stale (a paper's `reference` does change — `paper-district-index-service` handles it).
 * It also cut the published file from ~810 KB to ~185 KB.
 *
 * Do not key this on `paper.reference` the way `paper-stadtteile.json` does:
 * references are **not unique**. In the current archive `2019/1012` belongs to both
 * `papers/ag/394` and `papers/vo/38195`, so a reference-keyed entry silently
 * overwrites the other paper's attribution.
 *
 * Papers with no detected submitter are omitted rather than stored as an empty
 * array: absent and "none found" are the same statement here, and omitting them
 * keeps the file to the ~4.3k papers that carry an attribution.
 */
export interface PaperSubmitterIndex {
  version: typeof PAPER_SUBMITTER_INDEX_VERSION;
  /**
   * Faction id to display name. The API models no faction entity, so these ids are
   * ours; publishing the registry lets a viewer join on the stable id and render
   * the name from one place instead of hard-coding either.
   */
  factions: Record<FactionId, string>;
  papers: Record<string, FactionId[]>;
}

/**
 * Rebuilt in full every run rather than incrementally like the Stadtteil index.
 * Parsing only touches the letterhead of already in-memory text, so a full rebuild
 * of the whole archive costs well under a second — cheaper than maintaining the
 * staleness bookkeeping an incremental index would need.
 */
export function buildPaperSubmitterIndex(): PaperSubmitterIndex {
  const papers: Record<string, FactionId[]> = {};
  const archivedPapers = stores.papers.getAll();
  buildRecordFileNameIndex(
    'paper submitter index',
    archivedPapers.map((paper) => paper.id),
  );
  const resolveSubmitters = createMemoizedPaperSubmitterResolver(
    (fileId) => stores.fileContents.getById(fileId)?.extractedText,
  );

  for (const paper of archivedPapers) {
    const submitters = resolveSubmitters(paper);
    if (submitters.length === 0) continue;

    papers[recordBasename(paper.id)] = submitters;
  }

  // The full registry is published, not just the factions seen this run, so a
  // viewer's filter list stays stable even when a faction files nothing.
  const factions = Object.fromEntries(
    listFactions().map((faction) => [faction.id, faction.name]),
  ) as Record<FactionId, string>;

  return { version: PAPER_SUBMITTER_INDEX_VERSION, factions, papers };
}

/**
 * Written with `canonicalStringify` so an unchanged archive produces byte-identical
 * output and git dedupes the blob instead of committing a diff every run.
 */
export async function writePaperSubmitterIndex(index: PaperSubmitterIndex): Promise<void> {
  await atomicWriteFile(docsPath(PAPER_SUBMITTER_INDEX_FILE_NAME), canonicalStringify(index));
  logger.info(
    `Published submitter index for ${Object.keys(index.papers).length} paper(s) ` +
      `to ${PAPER_SUBMITTER_INDEX_FILE_NAME}`,
  );
}

/** Feed-side lookup, so the published index and the feed cannot disagree. */
export function createPaperSubmitterResolver(
  index: PaperSubmitterIndex,
): PaperSubmitterResolver<Pick<Paper, 'id'>> {
  return (paper) => index.papers[recordBasename(paper.id)] ?? [];
}
