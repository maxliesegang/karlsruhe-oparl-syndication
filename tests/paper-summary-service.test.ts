import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';
import { PaperSummarizer } from '../src/services/llm/paper-summarizer.js';
import { updatePaperSummaries } from '../src/services/paper-summary-service.js';
import { stores } from '../src/store/index.js';
import { Meeting, OParlFile, Paper } from '../src/types/index.js';

const originalExtractPdfText = config.extractPdfText;

const file: OParlFile = {
  id: 'https://example.test/files/summary-1',
  type: 'File',
  name: 'Beschlussvorlage.pdf',
  fileName: 'beschlussvorlage.pdf',
  mimeType: 'application/pdf',
  date: '2026-07-01',
  accessUrl: 'https://example.test/files/summary-1',
  downloadUrl: 'https://example.test/files/summary-1/download',
  created: '2026-07-01T00:00:00Z',
  modified: '2026-07-02T00:00:00Z',
};

const consultationId = 'https://example.test/consultations/summary-1';
const paper: Paper = {
  id: 'https://example.test/papers/summary-1',
  type: 'Paper',
  body: 'https://example.test/bodies/1',
  name: 'Umbau des Marktplatzes',
  reference: '2026/42',
  date: '2026-07-01',
  paperType: 'Beschlussvorlage',
  auxiliaryFile: [file],
  underDirectionOf: [],
  consultation: [
    {
      id: consultationId,
      type: 'Consultation',
      agendaItem: 'https://example.test/agendaItems/summary-1',
      meeting: 'https://example.test/meetings/summary-1',
      organization: [],
      role: 'beratend',
      created: '2026-07-01T00:00:00Z',
      modified: '2026-07-01T00:00:00Z',
    },
  ],
  created: '2026-07-01T00:00:00Z',
  modified: '2026-07-02T00:00:00Z',
};

const meeting: Meeting = {
  id: 'https://example.test/meetings/summary-1',
  type: 'Meeting',
  name: 'Gemeinderat',
  start: '2026-08-01T10:00:00Z',
  end: '2026-08-01T12:00:00Z',
  location: {} as Meeting['location'],
  organization: [],
  created: '2026-07-01T00:00:00Z',
  modified: '2026-07-02T00:00:00Z',
  agendaItem: [
    {
      id: 'https://example.test/agendaItems/summary-1',
      type: 'AgendaItem',
      meeting: 'https://example.test/meetings/summary-1',
      number: '1',
      order: 1,
      name: 'Umbau des Marktplatzes',
      public: true,
      consultation: consultationId,
      created: '2026-07-01T00:00:00Z',
      modified: '2026-07-02T00:00:00Z',
    },
  ],
};

function addCurrentText(text: string): void {
  stores.fileContents.add({
    id: file.id,
    downloadUrl: file.downloadUrl,
    fileModified: file.modified,
    lastModifiedExtractedDate: file.modified,
    extractedText: text,
  });
}

describe('paper summary service', () => {
  beforeEach(() => {
    stores.clear();
    config.extractPdfText = false;
    stores.papers.add(structuredClone(paper));
    addCurrentText('Die Verwaltung schlägt einen Umbau für 2 Millionen Euro vor.');
  });

  afterEach(() => {
    stores.clear();
    config.extractPdfText = originalExtractPdfText;
  });

  it('generates once and reuses a content-addressed summary', async () => {
    const summarize = vi.fn().mockResolvedValue({
      summary: 'Die Verwaltung schlägt den Umbau des Marktplatzes vor.',
      keyPoints: ['Kosten: 2 Millionen Euro'],
    });
    const summarizer: PaperSummarizer = {
      providerName: 'test-provider',
      model: 'test-model',
      summarize,
    };
    const options = {
      enabled: true,
      summarizer,
      promptVersion: 'test-v1',
      maximumItems: 10,
      maximumInputCharacters: 100_000,
      concurrency: 1,
      now: () => new Date('2026-08-02T00:00:00Z'),
    };

    const generated = await updatePaperSummaries([meeting], options);
    const reused = await updatePaperSummaries([meeting], options);

    expect(summarize).toHaveBeenCalledOnce();
    expect(generated.get(paper.id)).toMatchObject({
      provider: 'test-provider',
      model: 'test-model',
      promptVersion: 'test-v1',
    });
    expect(reused.get(paper.id)).toEqual(generated.get(paper.id));
    expect(summarize.mock.calls[0]?.[0].contextText).toContain('ÖFFENTLICHER BERATUNGSVERLAUF');
  });

  it('regenerates the whole summary when a public consultation result arrives', async () => {
    const resultMeeting = structuredClone(meeting);
    const summarize = vi
      .fn()
      .mockResolvedValueOnce({ summary: 'Der Gemeinderat soll entscheiden.', keyPoints: [] })
      .mockResolvedValueOnce({
        summary: 'Der Gemeinderat hat den Umbau einstimmig beschlossen.',
        keyPoints: [],
      });
    const options = {
      enabled: true,
      summarizer: { providerName: 'test-provider', model: 'test-model', summarize },
      promptVersion: 'test-v1',
      maximumItems: 10,
      maximumInputCharacters: 100_000,
      concurrency: 1,
    };

    await updatePaperSummaries([resultMeeting], options);
    resultMeeting.agendaItem[0].result = 'einstimmig beschlossen';
    resultMeeting.agendaItem[0].modified = '2026-08-02T00:00:00Z';
    const refreshed = await updatePaperSummaries([resultMeeting], options);

    expect(summarize).toHaveBeenCalledTimes(2);
    expect(summarize.mock.calls[1]?.[0].contextText).toContain('Ergebnis: einstimmig beschlossen');
    expect(refreshed.get(paper.id)?.summary).toContain('hat den Umbau einstimmig beschlossen');
  });

  it('only backfills summaries for papers dated 2026 or later', async () => {
    stores.papers.add({
      ...structuredClone(paper),
      date: '2025-12-31',
      created: '2026-01-02T00:00:00Z',
      modified: '2026-07-02T00:00:00Z',
    });
    const summarize = vi.fn().mockResolvedValue({ summary: 'Zusammenfassung.', keyPoints: [] });

    const current = await updatePaperSummaries([meeting], {
      enabled: true,
      summarizer: {
        providerName: 'test-provider',
        model: 'test-model',
        summarize,
      },
      promptVersion: 'test-v1',
      maximumItems: 10,
      maximumInputCharacters: 100_000,
      concurrency: 1,
    });

    expect(summarize).not.toHaveBeenCalled();
    expect(current.has(paper.id)).toBe(false);
  });

  it('regenerates an explicitly selected older paper', async () => {
    stores.papers.add({ ...structuredClone(paper), date: '2023-08-10' });
    const summarize = vi
      .fn()
      .mockResolvedValue({ summary: 'Gezielte Zusammenfassung.', keyPoints: [] });
    const summarizer: PaperSummarizer = {
      providerName: 'test-provider',
      model: 'selected-model',
      summarize,
    };
    const options = {
      enabled: true,
      summarizer,
      promptVersion: 'test-v1',
      maximumItems: 1,
      maximumInputCharacters: 100_000,
      concurrency: 1,
      paperIds: new Set([paper.id]),
      regenerate: true,
    };

    await updatePaperSummaries([meeting], options);
    await updatePaperSummaries([meeting], options);

    expect(summarize).toHaveBeenCalledTimes(2);
    expect(stores.paperSummaries.getById(paper.id)?.model).toBe('selected-model');
  });

  it('does not publish a stale cache entry when regeneration fails', async () => {
    const successful: PaperSummarizer = {
      providerName: 'test-provider',
      model: 'test-model',
      summarize: vi.fn().mockResolvedValue({ summary: 'Alte Zusammenfassung.', keyPoints: [] }),
    };
    const options = {
      enabled: true,
      promptVersion: 'test-v1',
      maximumItems: 10,
      maximumInputCharacters: 100_000,
      concurrency: 1,
    };
    await updatePaperSummaries([meeting], { ...options, summarizer: successful });
    const cached = stores.paperSummaries.getById(paper.id);

    addCurrentText('Der Inhalt wurde grundlegend geändert.');
    const failing: PaperSummarizer = {
      providerName: 'test-provider',
      model: 'test-model',
      summarize: vi.fn().mockRejectedValue(new Error('temporarily unavailable')),
    };
    const current = await updatePaperSummaries([meeting], { ...options, summarizer: failing });

    expect(current.has(paper.id)).toBe(false);
    expect(stores.paperSummaries.getById(paper.id)).toEqual(cached);
  });

  it('retries once when a generated number is absent from the source', async () => {
    const summarize = vi
      .fn()
      .mockResolvedValueOnce({
        summary: 'Der Umbau kostet insgesamt 7.889 Euro.',
        keyPoints: [],
      })
      .mockResolvedValueOnce({
        summary: 'Die Verwaltung schlägt einen Umbau vor.',
        keyPoints: ['Genannt werden 2 Millionen Euro.'],
      });
    const summarizer: PaperSummarizer = {
      providerName: 'test-provider',
      model: 'test-model',
      summarize,
    };

    const current = await updatePaperSummaries([meeting], {
      enabled: true,
      summarizer,
      promptVersion: 'test-v2',
      maximumItems: 10,
      maximumInputCharacters: 100_000,
      concurrency: 1,
    });

    expect(summarize).toHaveBeenCalledTimes(2);
    expect(summarize.mock.calls[1]?.[0]).toMatchObject({
      numericLiteralsToCorrect: ['7.889'],
    });
    expect(current.get(paper.id)?.summary).toBe('Die Verwaltung schlägt einen Umbau vor.');
  });

  it('does not cache a summary when its corrective retry remains ungrounded', async () => {
    const summarize = vi
      .fn()
      .mockResolvedValueOnce({ summary: 'Es entstehen Kosten von 7.889 Euro.', keyPoints: [] })
      .mockResolvedValueOnce({ summary: 'Es entstehen Kosten von 8.000 Euro.', keyPoints: [] });
    const summarizer: PaperSummarizer = {
      providerName: 'test-provider',
      model: 'test-model',
      summarize,
    };

    const current = await updatePaperSummaries([meeting], {
      enabled: true,
      summarizer,
      promptVersion: 'test-v2',
      maximumItems: 10,
      maximumInputCharacters: 100_000,
      concurrency: 1,
    });

    expect(summarize).toHaveBeenCalledTimes(2);
    expect(current.has(paper.id)).toBe(false);
    expect(stores.paperSummaries.getById(paper.id)).toBeUndefined();
  });
});
