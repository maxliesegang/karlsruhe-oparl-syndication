import { stores } from '../store/index.js';
import { buildAgendaFeed, writeFullFeed, writeRecentFeed } from '../feed.js';
import { writeFilteredFeeds } from '../filtered-feeds.js';
import { LANDING_PAGE_FILE_NAME, writeLandingPage } from '../landing-page.js';
import { synchronizeMeetings, synchronizeOrganizations, synchronizePapers } from '../api/index.js';
import { config } from '../config.js';
import {
  createPaperDistrictResolver,
  PAPER_DISTRICT_INDEX_FILE_NAME,
  PaperDistrictIndex,
  updatePaperDistrictIndex,
} from './paper-district-index-service.js';
import { logger } from '../logger.js';
import { resolveMissingConsultationPapers } from './consultation-resolution-service.js';
import { readJsonFromDocs, writeJsonToDocs } from '../docs-files.js';
import { buildAgendaItemRecords } from './agenda-item-record-service.js';
import {
  buildPaperSubmitterIndex,
  createPaperSubmitterResolver,
  PAPER_SUBMITTER_INDEX_FILE_NAME,
  writePaperSubmitterIndex,
} from './paper-submitter-index-service.js';
import { updatePaperSummaries } from './paper-summary-service.js';
import { PaperSummary } from '../types/index.js';

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

async function buildAndWriteFeeds(
  paperSummaries: Map<string, PaperSummary>,
  districtIndex: PaperDistrictIndex,
): Promise<void> {
  logger.info('Generating feed...');
  const meetings = stores.meetings.getAll();
  // Built once and used for both the published artifact and the feeds, so a viewer
  // reading docs/paper-submitters.json can never disagree with the feed categories.
  const submitterIndex = buildPaperSubmitterIndex();
  await writePaperSubmitterIndex(submitterIndex);
  const records = buildAgendaItemRecords(meetings, {
    // The same in-memory index that was just published, rather than a re-read of the
    // file, so the artifact and the feed categories cannot drift apart.
    resolvePaperDistricts: createPaperDistrictResolver(districtIndex),
    resolvePaperSummary: (paper) => paperSummaries.get(paper.id),
    resolvePaperSubmitters: createPaperSubmitterResolver(submitterIndex),
  });
  // No run-clock argument: feed construction uses a deterministic fallback so an unchanged
  // dataset produces a byte-identical feed (minimal git churn, working conditional GETs).
  const feed = buildAgendaFeed(records.slice(0, config.feedMaxItemCount));
  await writeFullFeed(feed);
  await writeRecentFeed(feed);
  const filteredFeeds = await writeFilteredFeeds(records);
  // The landing page is generated from what this run actually wrote, so a newly
  // published feed or artifact can never go unlinked the way it did while the page
  // was hand-maintained.
  await writeLandingPage({ filteredFeeds, fullFeedEntryCount: feed.items.length });
  logger.info(`Main feeds saved as ${config.feedFileName} and ${config.recentFeedFileName}`);
}

/**
 * Orchestrates the full feed generation pipeline:
 * 1. Load cached data from disk
 * 2. Fetch updates from the API
 * 3. Generate and save the feed
 * 4. Persist updated data to disk
 */
export interface FeedGenerationOptions {
  clearCache?: boolean;
  /**
   * Overrides `GENERATE_LLM_SUMMARIES` for this run. `false` skips every provider
   * call — and the billing that comes with it — while the rest of the pipeline runs
   * normally and already-cached summaries still reach the feed. Left undefined, the
   * configured value applies.
   */
  generateSummaries?: boolean;
}

export async function runFeedGeneration(options: FeedGenerationOptions = {}): Promise<void> {
  const previousManifest = await readJsonFromDocs<GenerationManifest>('generation-manifest.json');
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
  // Refresh the enrichment before building feeds so changed papers and newly extracted
  // text are reflected in Stadtteil categories during the same generation run.
  await stores.fileContents.waitForPendingExtractions();
  const districtIndex = await updatePaperDistrictIndex();
  let paperSummaries = new Map<string, PaperSummary>();
  try {
    paperSummaries = await updatePaperSummaries(stores.meetings.getAll(), {
      enabled: options.generateSummaries,
    });
  } catch (error) {
    logger.warn('Paper summary refresh failed; continuing without LLM summaries.', error);
  }
  await buildAndWriteFeeds(paperSummaries, districtIndex);
  await stores.saveToDisk();
  logger.info('Saved store data to disk');

  // Only advance the reconciliation checkpoint when a full reconciliation actually
  // completed cleanly. A failed full run carries the previous timestamp forward (or
  // leaves it unset), so the next run treats reconciliation as still due and retries
  // instead of skipping it for the whole interval. This also avoids the previous
  // non-null-assertion crash when no prior manifest existed.
  const reconciliationCompleted = forceFullReconciliation && !hadFailures;
  const fullReconciliationAt = reconciliationCompleted
    ? new Date().toISOString()
    : previousManifest?.fullReconciliationAt;

  await writeJsonToDocs(
    {
      version: 2,
      completedAt: new Date().toISOString(),
      fullReconciliationAt,
      artifacts: [
        LANDING_PAGE_FILE_NAME,
        config.feedFileName,
        config.recentFeedFileName,
        'feed-index.json',
        'gremien/',
        'stadtteile/',
        'meetings/',
        'papers/',
        'consultations.json',
        'consultation-resolution-failures.json',
        'organizations.json',
        'file-contents/',
        PAPER_DISTRICT_INDEX_FILE_NAME,
        PAPER_SUBMITTER_INDEX_FILE_NAME,
        'summaries/',
      ],
    },
    'generation-manifest.json',
  );
  logger.info('Published generation manifest');
}
