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

  it('skips disk cache loading and clears memory for a requested full refresh', async () => {
    await runFeedGeneration({ clearCache: true });

    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.loadFromDisk).not.toHaveBeenCalled();
    expect(mocks.synchronizeOrganizations).toHaveBeenCalledOnce();
    expect(mocks.saveToDisk).toHaveBeenCalledOnce();
  });

  it('loads the persisted cache during a normal incremental run', async () => {
    await runFeedGeneration();

    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.loadFromDisk).toHaveBeenCalledOnce();
  });
});
