import fs from 'fs/promises';

import { stores } from '../store/index.js';
import { Paper } from '../types/index.js';
import {
  classifyPaperDistricts,
  DistrictClassification,
  findDistrictsForAuthority,
  KarlsruheDistrict,
  listKarlsruheDistricts,
} from '../karlsruhe-districts.js';
import { atomicWriteFile, canonicalStringify, docsPath, readJsonFromFile } from '../file-utils.js';
import { indexRecordFileNames, recordBasename } from '../store/record-files.js';
import { logger } from '../logger.js';

export const PAPER_DISTRICT_INDEX_FILE_NAME = 'paper-stadtteile.json';

/**
 * Version 1 was an unversioned `{ "<reference>": ["<district>"] }` map. Bump on any
 * shape change so a viewer can detect an index it does not understand; a version
 * this build does not recognise triggers a full rebuild rather than a merge.
 */
export const PAPER_DISTRICT_INDEX_VERSION = 2 as const;

/**
 * Districts detected for one paper, split by how strong the evidence is.
 * Both keys are omitted when empty, and a paper with neither is left out of the
 * index entirely.
 */
export interface PaperDistrictEntry {
  /** The paper is about these; drives the district feeds and Atom categories. */
  primary?: KarlsruheDistrict[];
  /** Named in passing only. Published so a viewer can offer a wider search. */
  mentioned?: KarlsruheDistrict[];
}

/**
 * Published as `docs/paper-stadtteile.json`.
 *
 * Keyed by the paper's record basename — the same `<recordId>` as
 * `docs/papers/<recordId>.json` — so a viewer looks a paper up by the filename it
 * already reads. Version 1 keyed on `paper.reference`, which is **not unique**
 * (`2019/1012` belongs to both `papers/ag/394` and `papers/vo/38195`), so one of
 * every colliding pair silently overwrote the other. Reference keying also needed a
 * second `paper-stadtteile-meta.json` file to track which reference a paper last
 * had; a basename never changes, so that file is gone.
 */
export interface PaperDistrictIndex {
  version: typeof PAPER_DISTRICT_INDEX_VERSION;
  /**
   * The full district registry, not just the ones seen this run, so a viewer's
   * filter list stays stable when a district has no current papers.
   */
  districts: KarlsruheDistrict[];
  papers: Record<string, PaperDistrictEntry>;
}

/** Superseded by basename keying; removed on the first run after the cutover. */
const LEGACY_REFERENCE_INDEX_FILE_NAME = 'paper-stadtteile-meta.json';

/**
 * Updates Stadtteil matches for papers whose record or attachment text changed,
 * and rebuilds in full when the stored index predates the current shape.
 */
export async function updatePaperDistrictIndex(): Promise<PaperDistrictIndex> {
  logger.info('Analyzing papers for Stadtteil mentions...');

  const { papers, requiresFullRebuild } = await loadIndexState();
  const archivedPapers = stores.papers.getAll();
  // Rejects two papers whose ids sanitize to one filename before either can
  // overwrite the other's districts, matching the per-record stores' guarantee.
  indexRecordFileNames(
    'paper district index',
    archivedPapers.map((paper) => paper.id),
  );

  const papersToAnalyze = requiresFullRebuild
    ? archivedPapers
    : resolveAffectedPapers(collectAffectedPaperIds());
  // A basename is derived from the paper's id and never changes, so anything keyed
  // to a paper the archive no longer holds is stale by definition.
  let changed = removeStaleEntries(papers, archivedPapers);

  let primaryCount = 0;
  for (const paper of papersToAnalyze) {
    const classification = classifyPaper(paper);
    if (classification.primary.length > 0) primaryCount++;
    if (applyClassification(papers, paper, classification)) changed = true;
  }

  const index: PaperDistrictIndex = {
    version: PAPER_DISTRICT_INDEX_VERSION,
    districts: listKarlsruheDistricts(),
    papers,
  };

  if (papersToAnalyze.length === 0 && !changed && !requiresFullRebuild) {
    logger.info('No affected papers found. Keeping existing Stadtteil index.');
    return index;
  }

  logger.info(
    `Analyzed ${papersToAnalyze.length} paper(s) for Stadtteile; ` +
      `${primaryCount} with a primary district. Index holds ${Object.keys(papers).length} paper(s).`,
  );
  await writePaperDistrictIndex(index);
  return index;
}

/**
 * Written with `canonicalStringify` so an unchanged archive produces byte-identical
 * output. The previous plain `JSON.stringify` preserved insertion order, which made
 * the file's key order depend on the order papers happened to be analyzed in.
 */
export async function writePaperDistrictIndex(index: PaperDistrictIndex): Promise<void> {
  await atomicWriteFile(docsPath(PAPER_DISTRICT_INDEX_FILE_NAME), canonicalStringify(index));
  await removeLegacyReferenceIndex();
}

/** Feed-side lookup, so the published index and the feed cannot disagree. */
export function createDistrictResolver(
  index: PaperDistrictIndex,
): (paper: Pick<Paper, 'id'>) => KarlsruheDistrict[] {
  return (paper) => index.papers[recordBasename(paper.id)]?.primary ?? [];
}

async function loadIndexState(): Promise<{
  papers: Record<string, PaperDistrictEntry>;
  requiresFullRebuild: boolean;
}> {
  const stored = await readJsonFromFile<Partial<PaperDistrictIndex>>(
    PAPER_DISTRICT_INDEX_FILE_NAME,
  );

  if (!stored || stored.version !== PAPER_DISTRICT_INDEX_VERSION || !stored.papers) {
    logger.info('Stadtteil index missing or outdated. Rebuilding all paper matches.');
    return { papers: {}, requiresFullRebuild: true };
  }

  return { papers: stored.papers, requiresFullRebuild: false };
}

/**
 * Everything searchable about a paper: its title, the extracted text of each
 * attachment kept separate so a match's offset stays meaningful, and the districts
 * its consulting committees speak for.
 *
 * Only `auxiliaryFile` is traversed — this endpoint never populates `mainFile`.
 * Text comes from what `FileContentStore` already hydrated in memory; nothing here
 * downloads or re-extracts a PDF.
 */
function classifyPaper(paper: Paper): DistrictClassification {
  const bodies: string[] = [];
  for (const file of paper.auxiliaryFile ?? []) {
    const extractedText = stores.fileContents.getById(file.id)?.extractedText;
    if (extractedText) bodies.push(extractedText);
  }

  return classifyPaperDistricts({
    title: paper.name,
    bodies,
    structural: findConsultingDistricts(paper),
  });
}

/**
 * Districts asserted by the record itself: `Ortschaftsrat Durlach` consulting a
 * paper is direct evidence, and it covers 3.1k of the archive's papers without
 * reading a single character of PDF text. The consultation list is already on the
 * paper record, so this needs no extra traversal.
 */
function findConsultingDistricts(paper: Paper): KarlsruheDistrict[] {
  const districts = new Set<KarlsruheDistrict>();
  for (const consultation of paper.consultation ?? []) {
    for (const organizationId of consultation.organization ?? []) {
      const organization = stores.organizations.getById(organizationId);
      if (!organization?.name) continue;
      for (const district of findDistrictsForAuthority(organization.name)) districts.add(district);
    }
  }
  return [...districts];
}

function applyClassification(
  papers: Record<string, PaperDistrictEntry>,
  paper: Paper,
  classification: DistrictClassification,
): boolean {
  const key = recordBasename(paper.id);
  const entry: PaperDistrictEntry = {};
  if (classification.primary.length > 0) entry.primary = classification.primary;
  if (classification.mentioned.length > 0) entry.mentioned = classification.mentioned;

  const previous = papers[key];
  if (Object.keys(entry).length === 0) {
    if (!previous) return false;
    delete papers[key];
    return true;
  }

  papers[key] = entry;
  return !previous || canonicalStringify(previous) !== canonicalStringify(entry);
}

function resolveAffectedPapers(affectedPaperIds: Set<string>): Paper[] {
  const papers: Paper[] = [];
  for (const paperId of affectedPaperIds) {
    const paper = stores.papers.getById(paperId);
    if (paper) papers.push(paper);
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

function removeStaleEntries(
  papers: Record<string, PaperDistrictEntry>,
  archivedPapers: readonly Paper[],
): boolean {
  const current = new Set(archivedPapers.map((paper) => recordBasename(paper.id)));
  let removedAny = false;
  for (const key of Object.keys(papers)) {
    if (current.has(key)) continue;
    delete papers[key];
    removedAny = true;
  }
  return removedAny;
}

async function removeLegacyReferenceIndex(): Promise<void> {
  try {
    await fs.unlink(docsPath(LEGACY_REFERENCE_INDEX_FILE_NAME));
    logger.info(`Removed superseded ${LEGACY_REFERENCE_INDEX_FILE_NAME}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
