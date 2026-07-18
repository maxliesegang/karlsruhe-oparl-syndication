import { store } from '../store/index.js';
import { createFeed, writeFeedToFile, writeTrimmedFeedToFile } from '../feed.js';
import { fetchAllMeetings, fetchAllOrganizations, fetchAllPapers } from '../api/index.js';
import { config } from '../config.js';
import { analyzeStadtteile } from './stadtteil-service.js';
import { logger } from '../logger.js';
import { resolveMissingConsultationPapers } from './consultation-resolution-service.js';
import { readJsonFromFile, writeJsonToFile } from '../file-utils.js';

interface GenerationManifest {
  version: number;
  completedAt: string;
  fullReconciliationAt: string;
  artifacts: string[];
}

async function fetchAllData(forceFullReconciliation: boolean): Promise<void> {
  logger.info('Fetching data from OParl API...');
  await fetchAllOrganizations();
  await fetchAllMeetings(
    forceFullReconciliation ? undefined : store.meetings.getLastModifiedWithSafetyMargin(),
  );
  await fetchAllPapers(
    forceFullReconciliation ? undefined : store.papers.getLastModifiedWithSafetyMargin(),
  );
  await resolveMissingConsultationPapers(store.meetings.getAllItems());
  logger.info('Finished fetching data.');
}

async function generateFeed(): Promise<void> {
  logger.info('Generating feed...');
  const meetings = store.meetings.getAllItems();
  const feed = await createFeed(meetings, new Date());
  await writeFeedToFile(feed);
  await writeTrimmedFeedToFile(feed);
  logger.info(`Feed saved as ${config.feedFilename} and ${config.feedFilenameRecent}`);
}

/**
 * Orchestrates the full feed generation pipeline:
 * 1. Load cached data from disk
 * 2. Fetch updates from the API
 * 3. Generate and save the feed
 * 4. Persist updated data to disk
 */
export async function fetchDataAndGenerateFeed(
  options: { clearCache?: boolean } = {},
): Promise<void> {
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
    store.clearAllFromCache();
    logger.info('Cache loading skipped; performing a full refresh');
  } else {
    await store.loadAllFromDisk();
    logger.info('Loaded store data from disk');
  }
  if (forceFullReconciliation) {
    logger.info('Performing authoritative meeting and paper reconciliation');
  }
  await fetchAllData(forceFullReconciliation);
  await generateFeed();
  await store.saveAllToDisk();
  logger.info('Saved store data to disk');
  await analyzeStadtteile();
  await writeJsonToFile(
    {
      version: 1,
      completedAt: new Date().toISOString(),
      fullReconciliationAt: forceFullReconciliation
        ? new Date().toISOString()
        : previousManifest!.fullReconciliationAt,
      artifacts: [
        config.feedFilename,
        config.feedFilenameRecent,
        'meetings/',
        'papers/',
        'consultations.json',
        'consultation-resolution-failures.json',
        'organizations.json',
        'file-contents.json',
        'paper-stadtteile.json',
        'paper-stadtteile-meta.json',
      ],
    },
    'generation-manifest.json',
  );
  logger.info('Published generation manifest');
}
