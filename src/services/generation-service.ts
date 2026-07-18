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
  fullReconciliationAt?: string;
  artifacts: string[];
}

/**
 * Runs the fetch steps best-effort: a failure in one (an exhausted-retry 5xx, a
 * 401 on the collection) is logged and the pipeline continues so the remaining
 * steps still run and the archive still persists what was gathered. Returns
 * whether any step failed so the caller can decide not to mark a full
 * reconciliation as complete.
 */
async function refreshOParlData(
  forceFullReconciliation: boolean,
): Promise<{ hadFailures: boolean }> {
  logger.info('Fetching data from OParl API...');

  const steps: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: 'organizations', run: () => synchronizeOrganizations() },
    {
      name: 'meetings',
      run: () =>
        synchronizeMeetings(
          forceFullReconciliation ? undefined : stores.meetings.getIncrementalSyncStart(),
        ),
    },
    {
      name: 'papers',
      run: () =>
        synchronizePapers(
          forceFullReconciliation ? undefined : stores.papers.getIncrementalSyncStart(),
        ),
    },
    {
      name: 'consultations',
      run: () => resolveMissingConsultationPapers(stores.meetings.getAll()),
    },
  ];

  const failed: string[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      failed.push(step.name);
      logger.error(
        `Failed to synchronize ${step.name}: ${(error as Error).message}. ` +
          'Continuing with the data gathered so far.',
      );
    }
  }

  if (failed.length > 0) {
    logger.warn(
      `OParl sync completed with failures in: ${failed.join(', ')}. Persisting partial ` +
        'progress; the feed reflects previously archived data plus what was fetched this run.',
    );
  }
  logger.info('Finished fetching data.');
  return { hadFailures: failed.length > 0 };
}

async function buildAndWriteFeeds(): Promise<void> {
  logger.info('Generating feed...');
  const meetings = stores.meetings.getAll();
  // No run-clock argument: buildAgendaFeed uses a deterministic fallback so an unchanged
  // dataset produces a byte-identical feed (minimal git churn, working conditional GETs).
  const feed = await buildAgendaFeed(meetings);
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

  // A full reconciliation must still merge into the persisted add-only archive.
  // Skipping the load made records that were temporarily restricted or omitted by
  // the API look like orphans during persistence, contradicting the archive contract.
  await stores.loadFromDisk();
  logger.info('Loaded store data from disk');
  if (options.clearCache) {
    logger.info('Incremental cursors ignored; performing a full reconciliation');
  }
  if (forceFullReconciliation) {
    logger.info('Performing authoritative meeting and paper reconciliation');
  }
  const { hadFailures } = await refreshOParlData(forceFullReconciliation);
  await buildAndWriteFeeds();
  await stores.saveToDisk();
  logger.info('Saved store data to disk');
  await updatePaperDistrictIndex();

  // Only advance the reconciliation checkpoint when a full reconciliation actually
  // completed cleanly. A failed full run carries the previous timestamp forward (or
  // leaves it unset), so the next run treats reconciliation as still due and retries
  // instead of skipping it for the whole interval. This also avoids the previous
  // non-null-assertion crash when no prior manifest existed.
  const reconciliationCompleted = forceFullReconciliation && !hadFailures;
  const fullReconciliationAt = reconciliationCompleted
    ? new Date().toISOString()
    : previousManifest?.fullReconciliationAt;

  await writeJsonToFile(
    {
      version: 1,
      completedAt: new Date().toISOString(),
      fullReconciliationAt,
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
