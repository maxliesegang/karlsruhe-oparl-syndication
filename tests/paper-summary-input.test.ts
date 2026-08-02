import { describe, expect, it } from 'vitest';
import { buildPaperSummarySource, splitSummarySource } from '../src/services/paper-summary-input.js';
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

  it('splits long text without exceeding the requested size', () => {
    const chunks = splitSummarySource('eins\n\nzwei\n\n' + 'x'.repeat(15), 10);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
  });
});
