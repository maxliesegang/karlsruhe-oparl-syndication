import { describe, expect, it } from 'vitest';
import {
  buildPaperSummarySource,
  PaperSummaryConsultationContext,
  splitPaperSummarySource,
} from '../src/services/paper-summary-source.js';
import { FileContent } from '../src/types/file-content.js';
import { OParlFile, Paper } from '../src/types/index.js';

const file: OParlFile = {
  id: 'https://example.test/files/1',
  type: 'File',
  name: 'Vorlage.pdf',
  fileName: 'vorlage.pdf',
  mimeType: 'application/pdf',
  date: '2026-01-01',
  accessUrl: 'https://example.test/files/1',
  downloadUrl: 'https://example.test/files/1/download',
  created: '2026-01-01T00:00:00Z',
  modified: '2026-01-02T00:00:00Z',
};

const paper: Paper = {
  id: 'https://example.test/papers/1',
  type: 'Paper',
  body: 'https://example.test/bodies/1',
  name: 'Neue Straßenbahn',
  reference: '2026/1',
  date: '2026-01-01',
  paperType: 'Beschlussvorlage',
  auxiliaryFile: [file],
  underDirectionOf: [],
  consultation: [],
  created: '2026-01-01T00:00:00Z',
  modified: '2026-01-02T00:00:00Z',
};

function content(text: string, extractedFor = file.modified): FileContent {
  return {
    id: file.id,
    downloadUrl: file.downloadUrl,
    fileModified: file.modified,
    lastModifiedExtractedDate: extractedFor,
    extractedText: text,
  };
}

const consultationContext: PaperSummaryConsultationContext = {
  consultationId: 'https://example.test/consultations/1',
  consultationRole: 'Entscheidung',
  consultationAuthoritative: true,
  consultationModified: '2026-02-02T00:00:00Z',
  meetingId: 'https://example.test/meetings/1',
  meetingName: 'Gemeinderat',
  meetingStart: '2026-02-01T15:30:00Z',
  agendaItemId: 'https://example.test/agendaItems/1',
  agendaItemNumber: '1',
  agendaItemName: 'Neue Straßenbahn',
  agendaItemResult: 'einstimmig beschlossen',
  agendaItemModified: '2026-02-02T00:00:00Z',
};

describe('paper summary input', () => {
  it('is deterministic and changes its hash when current text changes', () => {
    const first = buildPaperSummarySource(paper, () => content('Inhalt A'));
    const again = buildPaperSummarySource(paper, () => content('Inhalt A'));
    const changed = buildPaperSummarySource(paper, () => content('Inhalt B'));

    expect(first).toEqual(again);
    expect(first.sourceHash).not.toBe(changed.sourceHash);
    expect(first.text).toContain('Inhalt A');
  });

  it('does not send stale extraction text to the model', () => {
    const source = buildPaperSummarySource(paper, () =>
      content('Veralteter Inhalt', '2025-01-01T00:00:00Z'),
    );

    expect(source.hasExtractedText).toBe(false);
    expect(source.text).not.toContain('Veralteter Inhalt');
  });

  it('invalidates for a changed result but not timestamp-only metadata changes', () => {
    const first = buildPaperSummarySource(paper, () => content('Inhalt'), [consultationContext]);
    const timestampOnly = buildPaperSummarySource(paper, () => content('Inhalt'), [
      {
        ...consultationContext,
        consultationModified: '2026-02-03T00:00:00Z',
        agendaItemModified: '2026-02-03T00:00:00Z',
      },
    ]);
    const changedResult = buildPaperSummarySource(paper, () => content('Inhalt'), [
      { ...consultationContext, agendaItemResult: 'mehrheitlich abgelehnt' },
    ]);

    expect(first.contextText).toContain('Ergebnis: einstimmig beschlossen');
    expect(timestampOnly.sourceHash).toBe(first.sourceHash);
    expect(changedResult.sourceHash).not.toBe(first.sourceHash);
  });

  it('ignores order-only changes in consultations and attachments', () => {
    const secondFile: OParlFile = {
      ...file,
      id: 'https://example.test/files/2',
      name: 'Anlage.pdf',
      downloadUrl: 'https://example.test/files/2/download',
    };
    const laterContext: PaperSummaryConsultationContext = {
      ...consultationContext,
      consultationId: 'https://example.test/consultations/2',
      meetingId: 'https://example.test/meetings/2',
      meetingStart: '2026-03-01T15:30:00Z',
      agendaItemId: 'https://example.test/agendaItems/2',
      agendaItemResult: 'Kenntnisnahme',
    };
    const resolveContent = (id: string): FileContent => {
      const resolvedFile = id === file.id ? file : secondFile;
      return {
        id,
        downloadUrl: resolvedFile.downloadUrl,
        fileModified: resolvedFile.modified,
        lastModifiedExtractedDate: resolvedFile.modified,
        extractedText: id === file.id ? 'Inhalt A' : 'Inhalt B',
      };
    };
    const ordered = buildPaperSummarySource(
      { ...paper, auxiliaryFile: [file, secondFile] },
      resolveContent,
      [consultationContext, laterContext],
    );
    const reordered = buildPaperSummarySource(
      { ...paper, auxiliaryFile: [secondFile, file] },
      resolveContent,
      [laterContext, consultationContext],
    );

    expect(reordered.sourceHash).toBe(ordered.sourceHash);
    expect(reordered.contextText).toBe(ordered.contextText);
    expect(reordered.text).toBe(ordered.text);
  });

  it('splits long text without exceeding the requested size', () => {
    const chunks = splitPaperSummarySource('eins\n\nzwei\n\n' + 'x'.repeat(15), 10);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
  });
});
