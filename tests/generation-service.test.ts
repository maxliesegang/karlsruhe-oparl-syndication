import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadFromDisk: vi.fn(),
  clear: vi.fn(),
  saveToDisk: vi.fn(),
  synchronizeOrganizations: vi.fn(),
  synchronizeMeetings: vi.fn(),
  synchronizePapers: vi.fn(),
  buildAgendaFeed: vi.fn().mockResolvedValue({}),
  writeFullFeed: vi.fn(),
  writeRecentFeed: vi.fn(),
  updatePaperDistrictIndex: vi.fn(),
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

vi.mock('../src/services/district-index-service.js', () => ({
  updatePaperDistrictIndex: mocks.updatePaperDistrictIndex,
}));

vi.mock('../src/file-utils.js', () => ({
  writeJsonToFile: mocks.writeJsonToFile,
  readJsonFromFile: mocks.readJsonFromFile,
}));

vi.mock('../src/services/consultation-resolution-service.js', () => ({
  resolveMissingConsultationPapers: mocks.resolveMissingConsultationPapers,
}));

import { runFeedGeneration } from '../src/services/generation-service.js';

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

    const manifest = mocks.writeJsonToFile.mock.calls[0]?.[0] as {
      fullReconciliationAt?: string;
    };
    // A failed full reconciliation must not advance the checkpoint, so the next run retries.
    expect(manifest.fullReconciliationAt).toBeUndefined();
  });
});
