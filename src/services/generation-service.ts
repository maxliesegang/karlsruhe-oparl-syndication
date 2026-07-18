import { stores } from '../store/index.js';
import { buildAgendaFeed, writeFullFeed, writeRecentFeed } from '../feed.js';
import { synchronizeMeetings, synchronizeOrganizations, synchronizePapers } from '../api/index.js';
import { config } from '../config.js';
import { updatePaperDistrictIndex } from './district-index-service.js';
import { logger } from '../logger.js';
import { resolveMissingConsultationPapers } from './consultation-resolution-service.js';
import { readJsonFromFile, writeJsonToFile } from '../file-utils.js';

interface GenerationManifest {
  version: number;
  completedAt: string;
  fullReconciliationAt: string;
  artifacts: string[];
}

async function refreshOParlData(forceFullReconciliation: boolean): Promise<void> {
  logger.info('Fetching data from OParl API...');
  await synchronizeOrganizations();
  await synchronizeMeetings(
    forceFullReconciliation ? undefined : stores.meetings.getIncrementalSyncStart(),
  );
  await synchronizePapers(
    forceFullReconciliation ? undefined : stores.papers.getIncrementalSyncStart(),
  );
  await resolveMissingConsultationPapers(stores.meetings.getAll());
  logger.info('Finished fetching data.');
}

async function buildAndWriteFeeds(): Promise<void> {
  logger.info('Generating feed...');
  const meetings = stores.meetings.getAll();
  const feed = await buildAgendaFeed(meetings, new Date());
  await writeFullFeed(feed);
  await writeRecentFeed(feed);
  logger.info(`Feed saved as ${config.feedFileName} and ${config.recentFeedFileName}`);
}

/**
 * Orchestrates the full feed generation pipeline:
 * 1. Load cached data from disk
 * 2. Fetch updates from the API
 * 3. Generate and save the feed
 * 4. Persist updated data to disk
 */
export async function runFeedGeneration(options: { clearCache?: boolean } = {}): Promise<void> {
  const previousManifest = await readJsonFromFile<GenerationManifest>('generation-manifest.json');
  const reconciliationIntervalMs = config.fullReconciliationIntervalDays * 24 * 60 * 60 * 1000;
  const lastFullReconciliation = previousManifest?.fullReconciliationAt
    ? new Date(previousManifest.fullReconciliationAt).getTime()
    : Number.NaN;
  const reconciliationDue =
    !Number.isFinite(lastFullReconciliation) ||
    Date.now() - lastFullReconciliation >= reconciliationIntervalMs;
  const forceFullReconciliation = options.clearCache === true || reconciliationDue;

  if (options.clearCache) {
    stores.clear();
    logger.info('Cache loading skipped; performing a full refresh');
  } else {
    await stores.loadFromDisk();
    logger.info('Loaded store data from disk');
  }
  if (forceFullReconciliation) {
    logger.info('Performing authoritative meeting and paper reconciliation');
  }
  await refreshOParlData(forceFullReconciliation);
  await buildAndWriteFeeds();
  await stores.saveToDisk();
  logger.info('Saved store data to disk');
  await updatePaperDistrictIndex();
  await writeJsonToFile(
    {
      version: 1,
      completedAt: new Date().toISOString(),
      fullReconciliationAt: forceFullReconciliation
        ? new Date().toISOString()
        : previousManifest!.fullReconciliationAt,
      artifacts: [
        config.feedFileName,
        config.recentFeedFileName,
        'meetings/',
        'papers/',
        'consultations.json',
        'consultation-resolution-failures.json',
        'organizations.json',
        'file-contents/',
        'paper-stadtteile.json',
        'paper-stadtteile-meta.json',
      ],
    },
    'generation-manifest.json',
  );
  logger.info('Published generation manifest');
}
