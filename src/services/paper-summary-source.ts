import { createHash } from 'node:crypto';
import { canonicalStringify } from '../docs-files.js';
import { FileContent } from '../types/file-content.js';
import { Paper } from '../types/index.js';
import { replaceInvalidXmlCharacters } from '../xml-text.js';
import { findTemplateAbstract, stripTemplateBoilerplate } from './paper-document-template.js';

const INPUT_FORMAT_VERSION = 4;

/**
 * The public consultation facts a summary may depend on. Deliberately narrow: a
 * summary describes what a paper contains, never what a body decided, so results,
 * meeting dates and agenda-item numbering are collected for scheduling purposes
 * but never reach `contextText` or the source hash. Every field here is either
 * rendered into the model input or used by the caller to date the source.
 */
export interface PaperSummaryConsultationContext {
  consultationRole: string;
  consultationModified: string;
  meetingId: string;
  meetingName: string;
  meetingStart: string;
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
 * version for which it was downloaded. Each attachment's text is run through
 * `stripTemplateBoilerplate`, and the administration's own `Kurzfassung` is hoisted
 * into `contextText`.
 */
export function buildPaperSummarySource(
  paper: Paper,
  resolveFileContent: (fileId: string) => FileContent | undefined,
  consultationContexts: PaperSummaryConsultationContext[] = [],
): PaperSummarySource {
  const attachments = (paper.auxiliaryFile ?? [])
    .map((file) => {
      const content = resolveFileContent(file.id);
      const extractedTextIsCurrent =
        !!content?.extractedText &&
        !!content.lastModifiedExtractedDate &&
        content.lastModifiedExtractedDate === content.fileModified;

      const normalized = extractedTextIsCurrent ? normalizeSourceText(content!.extractedText!) : '';

      return {
        id: file.id,
        name: file.name,
        abstract: normalized ? findTemplateAbstract(normalized) : '',
        extractedText: stripTemplateBoilerplate(normalized).trim(),
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
  // The abstract goes into `contextText`, not into `text`: `contextText` accompanies
  // every chunk request and every reduction level, so a paper large enough to be
  // chunked keeps its highest-signal passage in view throughout instead of only in
  // the first chunk.
  const abstract = attachments.find((attachment) => attachment.abstract)?.abstract ?? '';
  const contextText = renderContextText(paper, consultationContexts, abstract);
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

/**
 * Render the model's structured context: paper metadata, the distinct bodies that
 * consult it as scope information only, and the administration's own `Kurzfassung`.
 *
 * Consultations are deduplicated to `Gremium | Rolle` and sorted, so scheduling
 * churn — a second sitting of the same body, a moved date, a renumbered agenda
 * item, an arriving result — leaves both this text and the source hash untouched.
 * The feed states each meeting's own `result` deterministically; a summary that
 * repeated it would be a later meeting's status shown on an earlier entry.
 */
function renderContextText(
  paper: Paper,
  consultationContexts: PaperSummaryConsultationContext[],
  abstract: string,
): string {
  const bodies = [
    ...new Set(
      consultationContexts.map(
        (context) =>
          `- ${context.meetingName || context.meetingId} | Rolle: ${context.consultationRole || 'nicht angegeben'}`,
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, 'de'));

  return [
    'VORLAGENMETADATEN',
    `Typ: ${paper.paperType || 'nicht angegeben'}`,
    `Nummer: ${paper.reference || 'nicht angegeben'}`,
    `Datum: ${paper.date || 'nicht angegeben'}`,
    `Titel: ${paper.name || 'nicht angegeben'}`,
    '',
    'BETEILIGTE GREMIEN (nur Kontext zur Einordnung, kein Verfahrensstand)',
    ...(bodies.length > 0 ? bodies : ['Keine öffentlichen Beratungsdaten vorhanden.']),
    ...(abstract
      ? ['', 'KURZFASSUNG DER VERWALTUNG (Originalwortlaut, oft in Beschlussform)', abstract]
      : []),
  ].join('\n');
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
