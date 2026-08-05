import { createHash } from 'node:crypto';
import { canonicalStringify } from '../docs-files.js';
import { FileContent } from '../types/file-content.js';
import { Paper } from '../types/index.js';
import { replaceInvalidXmlCharacters } from '../xml-text.js';

const INPUT_FORMAT_VERSION = 2;

export interface PaperSummaryConsultationContext {
  consultationId: string;
  consultationRole: string;
  consultationAuthoritative?: boolean;
  consultationModified: string;
  meetingId: string;
  meetingName: string;
  meetingStart: string;
  agendaItemId: string;
  agendaItemNumber: string;
  agendaItemName: string;
  agendaItemResult?: string;
  agendaItemModified: string;
}

export interface PaperSummarySource {
  sourceHash: string;
  heading: string;
  contextText: string;
  text: string;
  hasExtractedText: boolean;
}

/**
 * Produces the exact, deterministic source used for cache invalidation and LLM input.
 * Stale extraction text is excluded: its extraction timestamp must match the file
 * version for which it was downloaded.
 */
export function buildPaperSummarySource(
  paper: Paper,
  resolveFileContent: (fileId: string) => FileContent | undefined,
  consultationContexts: PaperSummaryConsultationContext[] = [],
): PaperSummarySource {
  const consultationHistory = [...consultationContexts].sort(
    (a, b) =>
      a.meetingStart.localeCompare(b.meetingStart) ||
      a.agendaItemNumber.localeCompare(b.agendaItemNumber, 'de', { numeric: true }) ||
      a.agendaItemName.localeCompare(b.agendaItemName, 'de') ||
      a.consultationRole.localeCompare(b.consultationRole, 'de') ||
      (a.agendaItemResult ?? '').localeCompare(b.agendaItemResult ?? '', 'de') ||
      a.agendaItemId.localeCompare(b.agendaItemId),
  );
  const attachments = (paper.auxiliaryFile ?? [])
    .map((file) => {
      const content = resolveFileContent(file.id);
      const extractedTextIsCurrent =
        !!content?.extractedText &&
        !!content.lastModifiedExtractedDate &&
        content.lastModifiedExtractedDate === content.fileModified;

      return {
        id: file.id,
        name: file.name,
        extractedText: extractedTextIsCurrent ? normalizeSourceText(content.extractedText!) : '',
      };
    })
    // OParl array order has no meaning. Stable ordering prevents a reorder-only
    // API update from changing either the model input or its content hash.
    .sort((a, b) => a.id.localeCompare(b.id));

  const text = attachments
    .filter((attachment) => attachment.extractedText)
    .map(
      (attachment) =>
        `--- Anlage: ${attachment.name || attachment.id} ---\n${attachment.extractedText}`,
    )
    .join('\n\n');
  const contextText = renderContextText(paper, consultationHistory);
  const heading = [paper.paperType, paper.reference, paper.name].filter(Boolean).join(' – ');
  // Hash the semantic input actually sent to the model. OParl `modified` values
  // can change without any user-visible content changing, and a successful
  // re-extraction can produce byte-identical text for a newly timestamped PDF.
  // Neither case should spend another model call.
  const hashInput = { version: INPUT_FORMAT_VERSION, heading, contextText, text };
  const sourceHash = `sha256:${createHash('sha256').update(canonicalStringify(hashInput)).digest('hex')}`;

  return {
    sourceHash,
    heading,
    contextText,
    text,
    hasExtractedText: text.length > 0,
  };
}

function renderContextText(
  paper: Paper,
  consultationHistory: PaperSummaryConsultationContext[],
): string {
  const lines = [
    'VORLAGENMETADATEN',
    `Typ: ${paper.paperType || 'nicht angegeben'}`,
    `Nummer: ${paper.reference || 'nicht angegeben'}`,
    `Datum: ${paper.date || 'nicht angegeben'}`,
    `Titel: ${paper.name || 'nicht angegeben'}`,
    '',
    'ÖFFENTLICHER BERATUNGSVERLAUF (chronologisch)',
  ];

  if (consultationHistory.length === 0) {
    lines.push('Keine öffentlichen Beratungsdaten vorhanden.');
    return lines.join('\n');
  }

  for (const context of consultationHistory) {
    lines.push(
      [
        `- Sitzung: ${context.meetingStart || 'Datum nicht angegeben'} | ${context.meetingName || context.meetingId}`,
        `TOP ${context.agendaItemNumber || '?'}: ${context.agendaItemName || context.agendaItemId}`,
        `Rolle: ${context.consultationRole || 'nicht angegeben'}`,
        `Ergebnis: ${context.agendaItemResult || 'noch kein Ergebnis veröffentlicht'}`,
      ].join('\n  '),
    );
  }
  return lines.join('\n');
}

function normalizeSourceText(value: string): string {
  return replaceInvalidXmlCharacters(value.replace(/\r\n?/g, '\n')).trim();
}

/** Split large sources on paragraph boundaries, with a hard limit for giant paragraphs. */
export function splitPaperSummarySource(text: string, maximumCharacters: number): string[] {
  if (text.length <= maximumCharacters) return text ? [text] : [];

  const chunks: string[] = [];
  let current = '';
  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length > maximumCharacters) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let offset = 0; offset < paragraph.length; offset += maximumCharacters) {
        chunks.push(paragraph.slice(offset, offset + maximumCharacters));
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maximumCharacters) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
