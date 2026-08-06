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
  consultationRole: 'Entscheidung',
  consultationModified: '2026-02-02T00:00:00Z',
  meetingId: 'https://example.test/meetings/1',
  meetingName: 'Gemeinderat',
  meetingStart: '2026-02-01T15:30:00Z',
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

  it('renders consulting bodies as scope only, never a procedural status', () => {
    const source = buildPaperSummarySource(paper, () => content('Inhalt'), [consultationContext]);

    expect(source.contextText).toContain('BETEILIGTE GREMIEN');
    expect(source.contextText).toContain('- Gemeinderat | Rolle: Entscheidung');
    expect(source.contextText).not.toMatch(/Ergebnis|beschlossen|Sitzung:|TOP/);
  });

  it('is stable under scheduling churn so a result never spends a model call', () => {
    const first = buildPaperSummarySource(paper, () => content('Inhalt'), [consultationContext]);
    // A published result, a moved sitting and a second sitting of the same body all
    // reach the feed through `agendaItem.result`; none of them changes the substance.
    const churned = buildPaperSummarySource(paper, () => content('Inhalt'), [
      {
        ...consultationContext,
        consultationModified: '2026-02-03T00:00:00Z',
        agendaItemModified: '2026-02-03T00:00:00Z',
        meetingStart: '2026-03-09T15:30:00Z',
      },
      {
        ...consultationContext,
        meetingId: 'https://example.test/meetings/2',
        meetingStart: '2026-04-01T15:30:00Z',
      },
    ]);

    expect(churned.sourceHash).toBe(first.sourceHash);
  });

  it('invalidates when a newly involved body widens the scope', () => {
    const first = buildPaperSummarySource(paper, () => content('Inhalt'), [consultationContext]);
    const widened = buildPaperSummarySource(paper, () => content('Inhalt'), [
      consultationContext,
      { ...consultationContext, meetingName: 'Ortschaftsrat Durlach', consultationRole: 'Anhörung' },
    ]);

    expect(widened.sourceHash).not.toBe(first.sourceHash);
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
      consultationRole: 'Anhörung',
      meetingId: 'https://example.test/meetings/2',
      meetingName: 'Ortschaftsrat Durlach',
      meetingStart: '2026-03-01T15:30:00Z',
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

  it('strips the template scheduling table and checkbox form from the model input', () => {
    const source = buildPaperSummarySource(paper, () =>
      content(
        [
          'Gremien Termin TOP Ö / N Zuständigkeit',
          'Gemeinderat 28.07.2026 33 Ö Entscheidung',
          'Erläuterungen',
          'Finanzielle Auswirkungen Ja ☐ Nein ☒',
          'Die Strecke wird ausgebaut.',
        ].join('\n'),
      ),
    );

    expect(source.text).toContain('Die Strecke wird ausgebaut.');
    expect(source.text).not.toContain('Gemeinderat 28.07.2026');
    expect(source.text).not.toMatch(/[☐☒☑]/);
  });

  it('hoists the administration abstract into the context sent with every chunk', () => {
    const source = buildPaperSummarySource(
      paper,
      () => content('Kurzfassung\nDer Gemeinderat beschließt den Ausbau.\nErläuterungen\nDetails.'),
      [consultationContext],
    );

    expect(source.contextText).toContain('KURZFASSUNG DER VERWALTUNG');
    expect(source.contextText).toContain('Der Gemeinderat beschließt den Ausbau.');
  });

  it('omits the abstract section when no document carries one', () => {
    const source = buildPaperSummarySource(paper, () => content('Nur Fließtext.'));

    expect(source.contextText).not.toContain('KURZFASSUNG');
  });

  it('splits long text without exceeding the requested size', () => {
    const chunks = splitPaperSummarySource('eins\n\nzwei\n\n' + 'x'.repeat(15), 10);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
  });
});
