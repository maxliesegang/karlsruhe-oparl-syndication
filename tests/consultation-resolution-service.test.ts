import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const consultations = new Map<string, { id: string; paper?: string }>();
  return {
    consultations,
    fetchConsultation: vi.fn(),
    fetchPaper: vi.fn(),
    readJsonFromFile: vi.fn(),
    writeJsonToFile: vi.fn(),
  };
});

vi.mock('../src/api/index.js', () => ({
  fetchConsultation: mocks.fetchConsultation,
  fetchPaper: mocks.fetchPaper,
}));

vi.mock('../src/file-utils.js', () => ({
  readJsonFromFile: mocks.readJsonFromFile,
  writeJsonToFile: mocks.writeJsonToFile,
}));

vi.mock('../src/store/index.js', () => ({
  store: {
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
    mocks.readJsonFromFile.mockResolvedValue(null);
    mocks.fetchConsultation.mockImplementation(async (id: string) => {
      const consultation = { id, paper: paperId };
      mocks.consultations.set(id, consultation);
      return consultation;
    });
  });

  it('backs off unauthorized papers for seven days and skips repeated requests', async () => {
    mocks.fetchPaper.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });

    const first = await resolveMissingConsultationPapers([meeting], { now: NOW });
    const ledger = mocks.writeJsonToFile.mock.calls[0]?.[0];

    expect(first.failedPapers).toBe(1);
    expect(ledger[paperId]).toMatchObject({ attempts: 1, status: 401, reason: 'unauthorized' });
    expect(ledger[paperId].nextRetryAt).toBe('2026-07-25T12:00:00.000Z');

    mocks.readJsonFromFile.mockResolvedValue(ledger);
    const second = await resolveMissingConsultationPapers([meeting], {
      now: new Date('2026-07-19T12:00:00.000Z'),
    });

    expect(mocks.fetchPaper).toHaveBeenCalledTimes(1);
    expect(second.deferredPapers).toBe(1);
    expect(second.deferredConsultations).toBe(1);
  });

  it('bootstraps cached unresolved papers without immediately retrying them', async () => {
    mocks.consultations.set(consultationId, { id: consultationId, paper: paperId });

    const result = await resolveMissingConsultationPapers([meeting], { now: NOW });
    const ledger = mocks.writeJsonToFile.mock.calls[0]?.[0];

    expect(mocks.fetchPaper).not.toHaveBeenCalled();
    expect(result.deferredPapers).toBe(1);
    expect(ledger[paperId]).toMatchObject({ attempts: 0, reason: 'bootstrap' });
    expect(ledger[paperId].nextRetryAt).toBe('2026-07-25T12:00:00.000Z');
  });
});
