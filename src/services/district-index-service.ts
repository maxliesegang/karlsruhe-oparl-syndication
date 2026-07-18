import { stores } from '../store/index.js';
import { Paper } from '../types/index.js';
import { findKarlsruheDistricts, KarlsruheDistrict } from '../karlsruhe-districts.js';
import { readJsonFromFile, writeJsonToFile } from '../file-utils.js';
import { logger } from '../logger.js';

const DISTRICT_INDEX_FILE_NAME = 'paper-stadtteile.json';
const PAPER_REFERENCE_INDEX_FILE_NAME = 'paper-stadtteile-meta.json';

export type PaperDistrictIndex = Record<string, KarlsruheDistrict[]>;
type PaperReferenceIndex = Record<string, string>;

/** Updates Stadtteil matches incrementally for changed papers and extracted files. */
export async function updatePaperDistrictIndex(): Promise<void> {
  logger.info('Analyzing papers for Stadtteil mentions...');

  const { districtIndex, referenceIndex, requiresFullRebuild } = await loadIndexState();
  const affectedPaperIds = collectAffectedPaperIds();
  const papersToAnalyze = requiresFullRebuild
    ? stores.papers.getAll()
    : getPapersToAnalyze(affectedPaperIds);
  const removedStaleEntries = removeStalePaperEntries(districtIndex, referenceIndex);

  if (papersToAnalyze.length === 0) {
    if (removedStaleEntries || requiresFullRebuild) {
      await writeIndexState(districtIndex, referenceIndex);
      logger.info('Stadtteil index synchronized without paper updates.');
      return;
    }

    logger.info('No affected papers found. Keeping existing Stadtteil index.');
    return;
  }

  let matchCount = 0;
  for (const paper of papersToAnalyze) {
    if (updatePaperDistricts(paper, districtIndex, referenceIndex)) {
      matchCount++;
    }
  }

  logger.info(
    `Updated Stadtteil mentions for ${papersToAnalyze.length} paper(s). Matches: ${matchCount}`,
  );
  await writeIndexState(districtIndex, referenceIndex);
}

/** Collects all searchable text for a paper: its name + all extracted file contents. */
function collectSearchablePaperText(paper: Paper): string {
  const parts: string[] = [paper.name];

  if (paper.auxiliaryFile) {
    for (const file of paper.auxiliaryFile) {
      const content = stores.fileContents.getById(file.id);
      if (content?.extractedText) {
        parts.push(content.extractedText);
      }
    }
  }

  return parts.join(' ');
}

async function loadIndexState(): Promise<{
  districtIndex: PaperDistrictIndex;
  referenceIndex: PaperReferenceIndex;
  requiresFullRebuild: boolean;
}> {
  const storedDistrictIndex = await readJsonFromFile<PaperDistrictIndex>(DISTRICT_INDEX_FILE_NAME);
  const storedReferenceIndex = await readJsonFromFile<PaperReferenceIndex>(
    PAPER_REFERENCE_INDEX_FILE_NAME,
  );
  const requiresFullRebuild = !storedDistrictIndex || !storedReferenceIndex;

  if (requiresFullRebuild) {
    logger.info('Stadtteil snapshot incomplete. Rebuilding all paper matches.');
  }

  return {
    districtIndex: requiresFullRebuild ? {} : storedDistrictIndex,
    referenceIndex: requiresFullRebuild ? {} : storedReferenceIndex,
    requiresFullRebuild,
  };
}

function getPapersToAnalyze(affectedPaperIds: Set<string>): Paper[] {
  const papers: Paper[] = [];

  for (const paperId of affectedPaperIds) {
    const paper = stores.papers.getById(paperId);
    if (!paper) continue;
    papers.push(paper);
  }

  return papers;
}

function collectAffectedPaperIds(): Set<string> {
  const affectedPaperIds = new Set(stores.papers.drainUpdatedPaperIds());
  const changedFileIds = stores.fileContents.drainChangedFileIds();

  for (const paperId of stores.papers.getPaperIdsByFileIds(changedFileIds)) {
    affectedPaperIds.add(paperId);
  }

  return affectedPaperIds;
}

function updatePaperDistricts(
  paper: Paper,
  districtIndex: PaperDistrictIndex,
  referenceIndex: PaperReferenceIndex,
): boolean {
  const previousReference = referenceIndex[paper.id];
  if (previousReference && previousReference !== paper.reference) {
    delete districtIndex[previousReference];
  }

  if (!paper.reference) {
    if (previousReference) {
      delete districtIndex[previousReference];
    }
    delete referenceIndex[paper.id];
    return false;
  }

  const districts = findKarlsruheDistricts(collectSearchablePaperText(paper));
  if (districts.length > 0) {
    districtIndex[paper.reference] = districts;
  } else {
    delete districtIndex[paper.reference];
  }

  referenceIndex[paper.id] = paper.reference;
  return districts.length > 0;
}

function removeStalePaperEntries(
  districtIndex: PaperDistrictIndex,
  referenceIndex: PaperReferenceIndex,
): boolean {
  let removedAny = false;
  for (const [paperId, reference] of Object.entries(referenceIndex)) {
    if (stores.papers.getById(paperId)) continue;
    delete districtIndex[reference];
    delete referenceIndex[paperId];
    removedAny = true;
  }

  return removedAny;
}

async function writeIndexState(
  districtIndex: PaperDistrictIndex,
  referenceIndex: PaperReferenceIndex,
): Promise<void> {
  await writeJsonToFile(districtIndex, DISTRICT_INDEX_FILE_NAME);
  await writeJsonToFile(referenceIndex, PAPER_REFERENCE_INDEX_FILE_NAME);
}
