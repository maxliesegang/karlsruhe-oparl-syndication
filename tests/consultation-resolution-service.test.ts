import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const consultations = new Map<string, { id: string; paper?: string }>();
  return {
    consultations,
    fetchAndStoreConsultation: vi.fn(),
    fetchAndStorePaper: vi.fn(),
    readJsonFromDocs: vi.fn(),
    writeJsonToDocs: vi.fn(),
  };
});

vi.mock('../src/api/index.js', () => ({
  fetchAndStoreConsultation: mocks.fetchAndStoreConsultation,
  fetchAndStorePaper: mocks.fetchAndStorePaper,
}));

vi.mock('../src/docs-files.js', () => ({
  readJsonFromDocs: mocks.readJsonFromDocs,
  writeJsonToDocs: mocks.writeJsonToDocs,
}));

vi.mock('../src/store/index.js', () => ({
  stores: {
    consultations: { getById: (id: string) => mocks.consultations.get(id) },
    papers: { getPaperByConsultationId: vi.fn() },
  },
}));

import { resolveMissingConsultationPapers } from '../src/services/consultation-resolution-service.js';
import { Meeting } from '../src/types/index.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');
const consultationId = 'https://example.test/consultations/1';
const paperId = 'https://example.test/papers/1';
const meeting = {
  agendaItem: [{ consultation: consultationId }],
} as Meeting;

describe('consultation paper retry policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consultations.clear();
    mocks.readJsonFromDocs.mockResolvedValue(null);
    mocks.fetchAndStoreConsultation.mockImplementation(async (id: string) => {
      const consultation = { id, paper: paperId };
      mocks.consultations.set(id, consultation);
      return consultation;
    });
  });

  it('backs off unauthorized papers for seven days and skips repeated requests', async () => {
    mocks.fetchAndStorePaper.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    const first = await resolveMissingConsultationPapers([meeting], { now: NOW });
    const ledger = mocks.writeJsonToDocs.mock.calls[0]?.[0];

    expect(first.failedPapers).toBe(1);
    expect(ledger[paperId]).toMatchObject({ attempts: 1, status: 401, reason: 'unauthorized' });
    expect(ledger[paperId].nextRetryAt).toBe('2026-07-25T12:00:00.000Z');

    mocks.readJsonFromDocs.mockResolvedValue(ledger);
    const second = await resolveMissingConsultationPapers([meeting], {
      now: new Date('2026-07-19T12:00:00.000Z'),
    });

    expect(mocks.fetchAndStorePaper).toHaveBeenCalledTimes(1);
    expect(second.deferredPapers).toBe(1);
    expect(second.deferredConsultations).toBe(1);
  });

  it('bootstraps cached unresolved papers without immediately retrying them', async () => {
    mocks.consultations.set(consultationId, { id: consultationId, paper: paperId });

    const result = await resolveMissingConsultationPapers([meeting], { now: NOW });
    const ledger = mocks.writeJsonToDocs.mock.calls[0]?.[0];

    expect(mocks.fetchAndStorePaper).not.toHaveBeenCalled();
    expect(result.deferredPapers).toBe(1);
    expect(ledger[paperId]).toMatchObject({ attempts: 0, reason: 'bootstrap' });
    expect(ledger[paperId].nextRetryAt).toBe('2026-07-25T12:00:00.000Z');
  });
});
