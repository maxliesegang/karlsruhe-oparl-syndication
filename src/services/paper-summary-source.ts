import { createHash } from 'node:crypto';
import { canonicalStringify } from '../docs-files.js';
import { FileContent } from '../types/file-content.js';
import { Paper } from '../types/index.js';
import { replaceInvalidXmlCharacters } from '../xml-text.js';

const INPUT_FORMAT_VERSION = 1;

export interface PaperSummarySource {
  sourceHash: string;
  heading: string;
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
): PaperSummarySource {
  const attachments = (paper.auxiliaryFile ?? []).map((file) => {
    const content = resolveFileContent(file.id);
    const extractedTextIsCurrent =
      !!content?.extractedText &&
      !!content.lastModifiedExtractedDate &&
      content.lastModifiedExtractedDate === content.fileModified;

    return {
      id: file.id,
      name: file.name,
      modified: file.modified,
      extractedText: extractedTextIsCurrent ? normalizeSourceText(content.extractedText!) : '',
    };
  });

  const hashInput = {
    version: INPUT_FORMAT_VERSION,
    paper: {
      id: paper.id,
      name: paper.name,
      reference: paper.reference,
      paperType: paper.paperType,
      date: paper.date,
    },
    attachments,
  };
  const sourceHash = `sha256:${createHash('sha256').update(canonicalStringify(hashInput)).digest('hex')}`;
  const text = attachments
    .filter((attachment) => attachment.extractedText)
    .map(
      (attachment) =>
        `--- Anlage: ${attachment.name || attachment.id} ---\n${attachment.extractedText}`,
    )
    .join('\n\n');

  return {
    sourceHash,
    heading: [paper.paperType, paper.reference, paper.name].filter(Boolean).join(' – '),
    text,
    hasExtractedText: text.length > 0,
  };
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
