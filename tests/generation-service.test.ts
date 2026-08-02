import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadFromDisk: vi.fn(),
  clear: vi.fn(),
  saveToDisk: vi.fn(),
  waitForPendingExtractions: vi.fn(),
  synchronizeOrganizations: vi.fn(),
  synchronizeMeetings: vi.fn(),
  synchronizePapers: vi.fn(),
  buildAgendaFeedFromRecords: vi.fn().mockReturnValue({}),
  buildAgendaItemRecords: vi.fn().mockReturnValue([]),
  writeFullFeed: vi.fn(),
  writeRecentFeed: vi.fn(),
  writeFilteredFeeds: vi.fn(),
  updatePaperDistrictIndex: vi.fn(),
  updatePaperSummaries: vi.fn().mockResolvedValue(new Map()),
  readPaperDistrictIndex: vi.fn().mockResolvedValue({}),
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

vi.mock('../src/services/district-index-service.js', () => ({
  updatePaperDistrictIndex: mocks.updatePaperDistrictIndex,
  readPaperDistrictIndex: mocks.readPaperDistrictIndex,
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
