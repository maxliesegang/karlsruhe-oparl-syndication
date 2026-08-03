import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadFromDisk: vi.fn(),
  clear: vi.fn(),
  saveToDisk: vi.fn(),
  waitForPendingExtractions: vi.fn(),
  synchronizeOrganizations: vi.fn(),
  synchronizeMeetings: vi.fn(),
  synchronizePapers: vi.fn(),
  buildAgendaFeedFromRecords: vi.fn().mockReturnValue({ items: [] }),
  buildAgendaItemRecords: vi.fn().mockReturnValue([]),
  writeFullFeed: vi.fn(),
  writeRecentFeed: vi.fn(),
  writeFilteredFeeds: vi.fn().mockResolvedValue([]),
  writeLandingPage: vi.fn(),
  updatePaperDistrictIndex: vi.fn(),
  updatePaperSummaries: vi.fn().mockResolvedValue(new Map()),
  readPaperDistrictIndex: vi.fn().mockResolvedValue({}),
  buildPaperSubmitterIndex: vi.fn().mockReturnValue({ version: 1, papers: {} }),
  writePaperSubmitterIndex: vi.fn(),
  createSubmitterResolver: vi.fn().mockReturnValue(() => []),
  resolveMissingConsultationPapers: vi.fn(),
  writeJsonToFile: vi.fn(),
  readJsonFromFile: vi.fn().mockResolvedValue(null),
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
  buildAgendaFeedFromRecords: mocks.buildAgendaFeedFromRecords,
  writeFullFeed: mocks.writeFullFeed,
  writeRecentFeed: mocks.writeRecentFeed,
}));

vi.mock('../src/filtered-feeds.js', () => ({
  writeFilteredFeeds: mocks.writeFilteredFeeds,
}));

vi.mock('../src/landing-page.js', () => ({
  LANDING_PAGE_FILENAME: 'index.html',
  writeLandingPage: mocks.writeLandingPage,
}));

vi.mock('../src/services/district-index-service.js', () => ({
  updatePaperDistrictIndex: mocks.updatePaperDistrictIndex,
  readPaperDistrictIndex: mocks.readPaperDistrictIndex,
}));

vi.mock('../src/services/paper-submitter-index-service.js', () => ({
  PAPER_SUBMITTER_INDEX_FILE_NAME: 'paper-submitters.json',
  buildPaperSubmitterIndex: mocks.buildPaperSubmitterIndex,
  writePaperSubmitterIndex: mocks.writePaperSubmitterIndex,
  createSubmitterResolver: mocks.createSubmitterResolver,
}));

vi.mock('../src/services/agenda-item-record-service.js', () => ({
  buildAgendaItemRecords: mocks.buildAgendaItemRecords,
}));

vi.mock('../src/services/paper-summary-service.js', () => ({
  updatePaperSummaries: mocks.updatePaperSummaries,
}));

vi.mock('../src/file-utils.js', () => ({
  writeJsonToFile: mocks.writeJsonToFile,
  readJsonFromFile: mocks.readJsonFromFile,
}));

vi.mock('../src/services/consultation-resolution-service.js', () => ({
  resolveMissingConsultationPapers: mocks.resolveMissingConsultationPapers,
}));

import { runFeedGeneration } from '../src/services/generation-service.js';
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
    const districtReadOrder = mocks.readPaperDistrictIndex.mock.invocationCallOrder[0];
    const recordBuildOrder = mocks.buildAgendaItemRecords.mock.invocationCallOrder[0];

    expect(extractionOrder).toBeLessThan(districtUpdateOrder);
    expect(districtUpdateOrder).toBeLessThan(summaryUpdateOrder);
    expect(summaryUpdateOrder).toBeLessThan(recordBuildOrder);
    expect(districtUpdateOrder).toBeLessThan(districtReadOrder);
    expect(districtReadOrder).toBeLessThan(recordBuildOrder);

    // The submitter index must be built after extraction (so newly extracted
    // letterheads are seen) and reused for the records, so the published artifact
    // and the feed categories cannot disagree.
    const submitterBuildOrder = mocks.buildPaperSubmitterIndex.mock.invocationCallOrder[0];
    expect(extractionOrder).toBeLessThan(submitterBuildOrder);
    expect(submitterBuildOrder).toBeLessThan(recordBuildOrder);
    expect(mocks.writePaperSubmitterIndex).toHaveBeenCalledWith({ version: 1, papers: {} });
    expect(mocks.createSubmitterResolver).toHaveBeenCalledWith({ version: 1, papers: {} });
  });

  it('caps the main feed while passing the complete record set to filtered feeds', async () => {
    const records = Array.from({ length: config.feedMaxItemCount + 1 }, (_, id) => ({ id }));
    mocks.buildAgendaItemRecords.mockReturnValueOnce(records);

    await runFeedGeneration();

    expect(mocks.buildAgendaFeedFromRecords).toHaveBeenCalledWith(
      records.slice(0, config.feedMaxItemCount),
    );
    expect(mocks.writeFilteredFeeds).toHaveBeenCalledWith(records);
  });

  it('generates the landing page from the feeds this run actually wrote', async () => {
    const descriptors = [
      { type: 'committee', id: 'gr/1', title: 'A', path: 'gremien/1.xml', url: 'u', entryCount: 3 },
    ];
    mocks.writeFilteredFeeds.mockResolvedValueOnce(descriptors);
    mocks.buildAgendaFeedFromRecords.mockReturnValueOnce({ items: [{}, {}] });

    await runFeedGeneration();

    // Passing through writeFilteredFeeds' return value is what keeps the page from
    // drifting: a feed that was written is necessarily a feed that gets linked.
    expect(mocks.writeLandingPage).toHaveBeenCalledWith({
      filteredFeeds: descriptors,
      fullFeedEntryCount: 2,
    });
    const manifest = mocks.writeJsonToFile.mock.calls[0]?.[0] as { artifacts: string[] };
    expect(manifest.artifacts).toContain('index.html');
  });

  it('still builds and persists when a fetch step fails', async () => {
    mocks.synchronizeMeetings.mockRejectedValueOnce(new Error('boom'));

    await expect(runFeedGeneration()).resolves.toBeUndefined();

    // Remaining steps and persistence still run rather than the whole run aborting.
    expect(mocks.synchronizePapers).toHaveBeenCalledOnce();
    expect(mocks.buildAgendaFeedFromRecords).toHaveBeenCalledOnce();
    expect(mocks.saveToDisk).toHaveBeenCalledOnce();
  });

  it('does not mark reconciliation complete when a forced reconciliation had failures', async () => {
    mocks.synchronizePapers.mockRejectedValueOnce(new Error('boom'));

    await runFeedGeneration({ clearCache: true }); // clearCache forces full reconciliation

    const manifest = mocks.writeJsonToFile.mock.calls[0]?.[0] as {
      fullReconciliationAt?: string;
    };
    // A failed full reconciliation must not advance the checkpoint, so the next run retries.
    expect(manifest.fullReconciliationAt).toBeUndefined();
  });
});
