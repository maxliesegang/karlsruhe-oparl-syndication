import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadFromDisk: vi.fn(),
  clear: vi.fn(),
  saveToDisk: vi.fn(),
  waitForPendingExtractions: vi.fn(),
  synchronizeOrganizations: vi.fn(),
  synchronizeMeetings: vi.fn(),
  synchronizePapers: vi.fn(),
  buildAgendaFeed: vi.fn().mockReturnValue({ items: [] }),
  buildAgendaItemRecords: vi.fn().mockReturnValue([]),
  writeFullFeed: vi.fn(),
  writeRecentFeed: vi.fn(),
  writeFilteredFeeds: vi.fn().mockResolvedValue([]),
  writeLandingPage: vi.fn(),
  updatePaperDistrictIndex: vi.fn().mockResolvedValue({ version: 2, districts: [], papers: {} }),
  updatePaperSummaries: vi.fn().mockResolvedValue(new Map()),
  createPaperDistrictResolver: vi.fn().mockReturnValue(() => []),
  buildPaperSubmitterIndex: vi.fn().mockReturnValue({ version: 1, papers: {} }),
  writePaperSubmitterIndex: vi.fn(),
  createPaperSubmitterResolver: vi.fn().mockReturnValue(() => []),
  resolveMissingConsultationPapers: vi.fn(),
  writeJsonToDocs: vi.fn(),
  readJsonFromDocs: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/store/index.js', () => ({
  stores: {
    loadFromDisk: mocks.loadFromDisk,
    clear: mocks.clear,
    saveToDisk: mocks.saveToDisk,
    meetings: {
      getIncrementalSyncStart: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
    },
    papers: { getIncrementalSyncStart: vi.fn() },
    fileContents: { waitForPendingExtractions: mocks.waitForPendingExtractions },
  },
}));

vi.mock('../src/api/index.js', () => ({
  synchronizeOrganizations: mocks.synchronizeOrganizations,
  synchronizeMeetings: mocks.synchronizeMeetings,
  synchronizePapers: mocks.synchronizePapers,
}));

vi.mock('../src/feed.js', () => ({
  buildAgendaFeed: mocks.buildAgendaFeed,
  writeFullFeed: mocks.writeFullFeed,
  writeRecentFeed: mocks.writeRecentFeed,
}));

vi.mock('../src/filtered-feeds.js', () => ({
  writeFilteredFeeds: mocks.writeFilteredFeeds,
}));

vi.mock('../src/landing-page.js', () => ({
  LANDING_PAGE_FILE_NAME: 'index.html',
  writeLandingPage: mocks.writeLandingPage,
}));

vi.mock('../src/services/paper-district-index-service.js', () => ({
  PAPER_DISTRICT_INDEX_FILE_NAME: 'paper-stadtteile.json',
  updatePaperDistrictIndex: mocks.updatePaperDistrictIndex,
  createPaperDistrictResolver: mocks.createPaperDistrictResolver,
}));

vi.mock('../src/services/paper-submitter-index-service.js', () => ({
  PAPER_SUBMITTER_INDEX_FILE_NAME: 'paper-submitters.json',
  buildPaperSubmitterIndex: mocks.buildPaperSubmitterIndex,
  writePaperSubmitterIndex: mocks.writePaperSubmitterIndex,
  createPaperSubmitterResolver: mocks.createPaperSubmitterResolver,
}));

vi.mock('../src/services/agenda-item-record-service.js', () => ({
  buildAgendaItemRecords: mocks.buildAgendaItemRecords,
}));

vi.mock('../src/services/paper-summary-service.js', () => ({
  updatePaperSummaries: mocks.updatePaperSummaries,
}));

vi.mock('../src/docs-files.js', () => ({
  writeJsonToDocs: mocks.writeJsonToDocs,
  readJsonFromDocs: mocks.readJsonFromDocs,
}));

vi.mock('../src/services/consultation-resolution-service.js', () => ({
  resolveMissingConsultationPapers: mocks.resolveMissingConsultationPapers,
}));

import { runFeedGeneration } from '../src/services/feed-generation-service.js';
import { config } from '../src/config.js';

describe('generation service cache handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the archive and ignores incremental cursors for a requested full reconciliation', async () => {
    await runFeedGeneration({ clearCache: true });

    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.loadFromDisk).toHaveBeenCalledOnce();
    expect(mocks.synchronizeOrganizations).toHaveBeenCalledOnce();
    expect(mocks.synchronizeMeetings).toHaveBeenCalledWith(undefined);
    expect(mocks.synchronizePapers).toHaveBeenCalledWith(undefined);
    expect(mocks.saveToDisk).toHaveBeenCalledOnce();
  });

  it('loads the persisted cache during a normal incremental run', async () => {
    await runFeedGeneration();

    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.loadFromDisk).toHaveBeenCalledOnce();
  });

  it('waits for extraction and refreshes enrichments before building filtered records', async () => {
    await runFeedGeneration();

    const extractionOrder = mocks.waitForPendingExtractions.mock.invocationCallOrder[0];
    const districtUpdateOrder = mocks.updatePaperDistrictIndex.mock.invocationCallOrder[0];
    const summaryUpdateOrder = mocks.updatePaperSummaries.mock.invocationCallOrder[0];
    const recordBuildOrder = mocks.buildAgendaItemRecords.mock.invocationCallOrder[0];

    expect(extractionOrder).toBeLessThan(districtUpdateOrder);
    expect(districtUpdateOrder).toBeLessThan(summaryUpdateOrder);
    expect(summaryUpdateOrder).toBeLessThan(recordBuildOrder);

    // The feed resolver is built from the very index update just returned, not from a
    // re-read of the published file, so the artifact and the feed cannot disagree.
    expect(mocks.createPaperDistrictResolver).toHaveBeenCalledWith(
      await mocks.updatePaperDistrictIndex.mock.results[0].value,
    );

    // The submitter index must be built after extraction (so newly extracted
    // letterheads are seen) and reused for the records, so the published artifact
    // and the feed categories cannot disagree.
    const submitterBuildOrder = mocks.buildPaperSubmitterIndex.mock.invocationCallOrder[0];
    expect(extractionOrder).toBeLessThan(submitterBuildOrder);
    expect(submitterBuildOrder).toBeLessThan(recordBuildOrder);
    expect(mocks.writePaperSubmitterIndex).toHaveBeenCalledWith({ version: 1, papers: {} });
    expect(mocks.createPaperSubmitterResolver).toHaveBeenCalledWith({ version: 1, papers: {} });
  });

  it('caps the main feed while passing the complete record set to filtered feeds', async () => {
    const records = Array.from({ length: config.feedMaxItemCount + 1 }, (_, id) => ({ id }));
    mocks.buildAgendaItemRecords.mockReturnValueOnce(records);

    await runFeedGeneration();

    expect(mocks.buildAgendaFeed).toHaveBeenCalledWith(
      records.slice(0, config.feedMaxItemCount),
    );
    expect(mocks.writeFilteredFeeds).toHaveBeenCalledWith(records);
  });

  it('generates the landing page from the feeds this run actually wrote', async () => {
    const descriptors = [
      { type: 'committee', id: 'gr/1', title: 'A', path: 'gremien/1.xml', url: 'u', entryCount: 3 },
    ];
    mocks.writeFilteredFeeds.mockResolvedValueOnce(descriptors);
    mocks.buildAgendaFeed.mockReturnValueOnce({ items: [{}, {}] });

    await runFeedGeneration();

    // Passing through writeFilteredFeeds' return value is what keeps the page from
    // drifting: a feed that was written is necessarily a feed that gets linked.
    expect(mocks.writeLandingPage).toHaveBeenCalledWith({
      filteredFeeds: descriptors,
      fullFeedEntryCount: 2,
    });
    const manifest = mocks.writeJsonToDocs.mock.calls[0]?.[0] as { artifacts: string[] };
    expect(manifest.artifacts).toContain('index.html');
  });

  it('skips every provider call when summaries are disabled for the run', async () => {
    // `npm run generate:no-summaries` must not bill the LLM provider while an agent
    // regenerates docs/ to check an unrelated artifact.
    await runFeedGeneration({ generateSummaries: false });

    expect(mocks.updatePaperSummaries).toHaveBeenCalledWith([], { enabled: false });
  });

  it('leaves the configured summary setting alone when the run does not override it', async () => {
    await runFeedGeneration();

    expect(mocks.updatePaperSummaries).toHaveBeenCalledWith([], { enabled: undefined });
  });

  it('still builds and persists when a fetch step fails', async () => {
    mocks.synchronizeMeetings.mockRejectedValueOnce(new Error('boom'));

    await expect(runFeedGeneration()).resolves.toBeUndefined();

    // Remaining steps and persistence still run rather than the whole run aborting.
    expect(mocks.synchronizePapers).toHaveBeenCalledOnce();
    expect(mocks.buildAgendaFeed).toHaveBeenCalledOnce();
    expect(mocks.saveToDisk).toHaveBeenCalledOnce();
  });

  it('does not mark reconciliation complete when a forced reconciliation had failures', async () => {
    mocks.synchronizePapers.mockRejectedValueOnce(new Error('boom'));

    await runFeedGeneration({ clearCache: true }); // clearCache forces full reconciliation

    const manifest = mocks.writeJsonToDocs.mock.calls[0]?.[0] as {
      fullReconciliationAt?: string;
    };
    // A failed full reconciliation must not advance the checkpoint, so the next run retries.
    expect(manifest.fullReconciliationAt).toBeUndefined();
  });
});
