import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadAllFromDisk: vi.fn(),
  clearAllFromCache: vi.fn(),
  saveAllToDisk: vi.fn(),
  fetchAllOrganizations: vi.fn(),
  fetchAllMeetings: vi.fn(),
  fetchAllPapers: vi.fn(),
  createFeed: vi.fn().mockResolvedValue({}),
  writeFeedToFile: vi.fn(),
  writeTrimmedFeedToFile: vi.fn(),
  analyzeStadtteile: vi.fn(),
  resolveMissingConsultationPapers: vi.fn(),
  writeJsonToFile: vi.fn(),
  readJsonFromFile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/store/index.js', () => ({
  store: {
    loadAllFromDisk: mocks.loadAllFromDisk,
    clearAllFromCache: mocks.clearAllFromCache,
    saveAllToDisk: mocks.saveAllToDisk,
    meetings: {
      getLastModifiedWithSafetyMargin: vi.fn(),
      getAllItems: vi.fn().mockReturnValue([]),
    },
    papers: { getLastModifiedWithSafetyMargin: vi.fn() },
  },
}));

vi.mock('../src/api/index.js', () => ({
  fetchAllOrganizations: mocks.fetchAllOrganizations,
  fetchAllMeetings: mocks.fetchAllMeetings,
  fetchAllPapers: mocks.fetchAllPapers,
}));

vi.mock('../src/feed.js', () => ({
  createFeed: mocks.createFeed,
  writeFeedToFile: mocks.writeFeedToFile,
  writeTrimmedFeedToFile: mocks.writeTrimmedFeedToFile,
}));

vi.mock('../src/services/stadtteil-service.js', () => ({
  analyzeStadtteile: mocks.analyzeStadtteile,
}));

vi.mock('../src/file-utils.js', () => ({
  writeJsonToFile: mocks.writeJsonToFile,
  readJsonFromFile: mocks.readJsonFromFile,
}));

vi.mock('../src/services/consultation-resolution-service.js', () => ({
  resolveMissingConsultationPapers: mocks.resolveMissingConsultationPapers,
}));

import { fetchDataAndGenerateFeed } from '../src/services/feed-service.js';

describe('feed service cache handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips disk cache loading and clears memory for a requested full refresh', async () => {
    await fetchDataAndGenerateFeed({ clearCache: true });

    expect(mocks.clearAllFromCache).toHaveBeenCalledOnce();
    expect(mocks.loadAllFromDisk).not.toHaveBeenCalled();
    expect(mocks.fetchAllOrganizations).toHaveBeenCalledOnce();
    expect(mocks.saveAllToDisk).toHaveBeenCalledOnce();
  });

  it('loads the persisted cache during a normal incremental run', async () => {
    await fetchDataAndGenerateFeed();

    expect(mocks.clearAllFromCache).not.toHaveBeenCalled();
    expect(mocks.loadAllFromDisk).toHaveBeenCalledOnce();
  });
});
