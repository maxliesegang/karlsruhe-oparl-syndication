import { store } from '../store';
import { Paper } from '../types';
import { findStadtteile, Stadtteil } from '../stadtteile';
import { readJsonFromFile, writeJsonToFile } from '../file-utils';
import { logger } from '../logger';

const OUTPUT_FILE = 'paper-stadtteile.json';
const META_FILE = 'paper-stadtteile-meta.json';

export type PaperStadtteile = Record<string, Stadtteil[]>;
type PaperReferenceIndex = Record<string, string>;

/** Updates Stadtteil matches incrementally for changed papers and extracted files. */
export async function analyzeStadtteile(): Promise<void> {
  logger.info('Analyzing papers for Stadtteil mentions...');

  const { result, referenceIndex, requiresFullRebuild } = await loadState();
  const affectedPaperIds = collectAffectedPaperIds();
  const papersToAnalyze = requiresFullRebuild
    ? store.papers.getAllItems()
    : getPapersToAnalyze(affectedPaperIds);
  const cleanedRemovedPapers = cleanupRemovedPapers(result, referenceIndex);

  if (papersToAnalyze.length === 0) {
    if (cleanedRemovedPapers || requiresFullRebuild) {
      await persistState(result, referenceIndex);
      logger.info('Stadtteil index synchronized without paper updates.');
      return;
    }

    logger.info('No affected papers found. Keeping existing Stadtteil index.');
    return;
  }

  let matchCount = 0;
  for (const paper of papersToAnalyze) {
    if (updatePaperResult(paper, result, referenceIndex)) {
      matchCount++;
    }
  }

  logger.info(
    `Updated Stadtteil mentions for ${papersToAnalyze.length} paper(s). Matches: ${matchCount}`,
  );
  await persistState(result, referenceIndex);
}

/** Collects all searchable text for a paper: its name + all extracted file contents. */
function gatherPaperText(paper: Paper): string {
  const parts: string[] = [paper.name];

  if (paper.auxiliaryFile) {
    for (const file of paper.auxiliaryFile) {
      const content = store.fileContentStore.getById(file.id);
      if (content?.extractedText) {
        parts.push(content.extractedText);
      }
    }
  }

  return parts.join(' ');
}

async function loadState(): Promise<{
  result: PaperStadtteile;
  referenceIndex: PaperReferenceIndex;
  requiresFullRebuild: boolean;
}> {
  const storedResult = await readJsonFromFile<PaperStadtteile>(OUTPUT_FILE);
  const storedReferenceIndex = await readJsonFromFile<PaperReferenceIndex>(META_FILE);
  const requiresFullRebuild = !storedResult || !storedReferenceIndex;

  if (requiresFullRebuild) {
    logger.info('Stadtteil snapshot incomplete. Rebuilding all paper matches.');
  }

  return {
    result: requiresFullRebuild ? {} : storedResult,
    referenceIndex: requiresFullRebuild ? {} : storedReferenceIndex,
    requiresFullRebuild,
  };
}

function getPapersToAnalyze(affectedPaperIds: Set<string>): Paper[] {
  const papers: Paper[] = [];

  for (const paperId of affectedPaperIds) {
    const paper = store.papers.getById(paperId);
    if (!paper) continue;
    papers.push(paper);
  }

  return papers;
}

function collectAffectedPaperIds(): Set<string> {
  const affectedPaperIds = new Set(store.papers.consumeUpdatedPaperIds());
  const changedFileIds = store.fileContentStore.consumeChangedFileIds();

  for (const paperId of store.papers.getPaperIdsByFileIds(changedFileIds)) {
    affectedPaperIds.add(paperId);
  }

  return affectedPaperIds;
}

function updatePaperResult(
  paper: Paper,
  result: PaperStadtteile,
  referenceIndex: PaperReferenceIndex,
): boolean {
  const previousReference = referenceIndex[paper.id];
  if (previousReference && previousReference !== paper.reference) {
    delete result[previousReference];
  }

  if (!paper.reference) {
    if (previousReference) {
      delete result[previousReference];
    }
    delete referenceIndex[paper.id];
    return false;
  }

  const stadtteile = findStadtteile(gatherPaperText(paper));
  if (stadtteile.length > 0) {
    result[paper.reference] = stadtteile;
  } else {
    delete result[paper.reference];
  }

  referenceIndex[paper.id] = paper.reference;
  return stadtteile.length > 0;
}

function cleanupRemovedPapers(
  result: PaperStadtteile,
  referenceIndex: PaperReferenceIndex,
): boolean {
  let removedAny = false;
  for (const [paperId, reference] of Object.entries(referenceIndex)) {
    if (store.papers.getById(paperId)) continue;
    delete result[reference];
    delete referenceIndex[paperId];
    removedAny = true;
  }

  return removedAny;
}

async function persistState(
  result: PaperStadtteile,
  referenceIndex: PaperReferenceIndex,
): Promise<void> {
  await writeJsonToFile(result, OUTPUT_FILE);
  await writeJsonToFile(referenceIndex, META_FILE);
}
