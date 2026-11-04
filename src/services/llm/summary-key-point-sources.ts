import { attachmentDocumentPriority } from '../../paper-attachment-priority.js';
import { PaperSummaryKeyPointSource } from '../../types/index.js';

/**
 * Locate the attachment passage a summary key point rests on.
 *
 * The model returns a verbatim quote per key point; this module finds that quote
 * in the paper's attachments and derives file and page itself. The model is never
 * asked which file or page — it would invent those as readily as the numbers
 * `summary-grounding.ts` rejects. A quote that cannot be found yields no source,
 * so a link can only ever point at text that is really there.
 *
 * Measured 2026-11-04 on 20 papers (80 key points, `mimo-v2.6-pro`): every quote
 * was found, but only 11 byte for byte — the rest differ from the extracted text
 * only by PDF line breaks and hyphenation, which `normalizeForMatching` folds. Two
 * were near-verbatim (85%/86% of their words in one run: a wrapped compound,
 * `m2` for `m²`), which `findLongestRun` accepts.
 */

/** One attachment's extracted text, page markers included, as the summary source holds it. */
export interface KeyPointSourceDocument {
  /** OParl `File` id. */
  file: string;
  /** The attachment's label, used to prefer the paper's own document. */
  name?: string;
  text: string;
}

/** pdf-parse appends `-- N of M --` on its own line after each page's text. */
const PAGE_MARKER = /^-- (\d+) of (\d+) --$/gm;

/** Shorter quotes match too much by accident ("die Verwaltung empfiehlt"). */
const MINIMUM_QUOTE_WORDS = 5;
const MINIMUM_QUOTE_CHARACTERS = 20;

/**
 * A quote that is not found whole may still be found in one long verbatim run:
 * the model rewrapped a compound or wrote `m2` for `m²`. The run must carry most
 * of the quote, so a paraphrase sharing a stock phrase is not taken for one.
 */
const MINIMUM_RUN_SHARE = 0.75;
const MINIMUM_RUN_WORDS = 6;

/** The stored passage is for display next to a key point, not a copy of the paper. */
const MAXIMUM_STORED_QUOTE_CHARACTERS = 500;

interface NormalizedText {
  /** Case- and punctuation-folded, for comparison only. */
  comparable: string;
  /** Offset in the original text of each `comparable` character. */
  offsets: number[];
}

export function findKeyPointSource(
  quote: string,
  documents: readonly KeyPointSourceDocument[],
): PaperSummaryKeyPointSource | undefined {
  const needle = normalizeForMatching(trimQuoteMarks(quote)).comparable.trim();
  const words = needle.split(' ').filter(Boolean);
  if (words.length < MINIMUM_QUOTE_WORDS || needle.length < MINIMUM_QUOTE_CHARACTERS) {
    return undefined;
  }

  const indexed = orderByDocumentPriority(documents).map((document) => ({
    document,
    normalized: normalizeForMatching(document.text),
  }));

  for (const { document, normalized } of indexed) {
    const start = normalized.comparable.indexOf(needle);
    if (start >= 0) return toSource(document, normalized, start, needle.length);
  }

  const run = findLongestRun(words, indexed);
  return run ? toSource(run.document, run.normalized, run.start, run.length) : undefined;
}

/**
 * The paper's own document first, annexes last; label order breaks ties so the
 * choice does not depend on OParl array order. A passage repeated in a
 * Beschlussvorlage and its Anlage therefore links to the Vorlage.
 */
function orderByDocumentPriority(
  documents: readonly KeyPointSourceDocument[],
): KeyPointSourceDocument[] {
  return documents
    .map((document, index) => ({ document, index }))
    .sort(
      (a, b) =>
        attachmentDocumentPriority(a.document) - attachmentDocumentPriority(b.document) ||
        a.index - b.index,
    )
    .map(({ document }) => document);
}

/**
 * Longest run of consecutive quote words found verbatim in one document, if it
 * is long enough to identify the passage. Only windows at or above the minimum
 * are tried, longest first, so the search is short even for a 40-word quote.
 */
function findLongestRun(
  words: string[],
  indexed: { document: KeyPointSourceDocument; normalized: NormalizedText }[],
):
  | { document: KeyPointSourceDocument; normalized: NormalizedText; start: number; length: number }
  | undefined {
  const minimumLength = Math.max(MINIMUM_RUN_WORDS, Math.ceil(words.length * MINIMUM_RUN_SHARE));
  for (let length = words.length - 1; length >= minimumLength; length--) {
    for (let first = 0; first + length <= words.length; first++) {
      const fragment = words.slice(first, first + length).join(' ');
      for (const { document, normalized } of indexed) {
        const start = normalized.comparable.indexOf(fragment);
        if (start >= 0) return { document, normalized, start, length: fragment.length };
      }
    }
  }
  return undefined;
}

function toSource(
  document: KeyPointSourceDocument,
  normalized: NormalizedText,
  start: number,
  length: number,
): PaperSummaryKeyPointSource {
  const from = normalized.offsets[start];
  const to = normalized.offsets[Math.min(start + length, normalized.offsets.length) - 1];
  const page = findPage(document.text, from);
  const passage = displayPassage(document.text, from, to);
  return {
    file: document.file,
    ...(page !== undefined ? { page } : {}),
    quote:
      passage.length > MAXIMUM_STORED_QUOTE_CHARACTERS
        ? `${passage.slice(0, MAXIMUM_STORED_QUOTE_CHARACTERS).replace(/\s+\S*$/, '')} …`
        : passage,
  };
}

/**
 * The page holding `offset`. pdf-parse closes each page with its own marker, so
 * the first marker after the offset names the page; text after the last marker
 * is on the last page. Reading the number rather than counting markers keeps a
 * text with a missing marker from shifting every later page.
 */
function findPage(text: string, offset: number): number | undefined {
  let lastPage: number | undefined;
  for (const marker of text.matchAll(PAGE_MARKER)) {
    if (marker.index! >= offset) return Number(marker[1]);
    lastPage = Number(marker[2]);
  }
  return lastPage;
}

/**
 * Strip what the model wraps around a quote: enclosing quotation marks (only
 * when both ends carry one, so a quote that ends on the source's own closing
 * mark keeps it), an ellipsis, and the final full stop.
 */
function trimQuoteMarks(quote: string): string {
  let trimmed = quote.trim().replace(/^…\s*|\s*…$/g, '');
  const wrapped = /^["'„“”‚‘’«»]/.test(trimmed) && /["'„“”‚‘’«»]$/.test(trimmed);
  if (wrapped) trimmed = trimmed.slice(1, -1).trim();
  return trimmed.replace(/\.$/, '');
}

/**
 * Fold what PDF extraction and model copying vary, keeping for each kept
 * character its offset in the original so a hit maps back to a page: page
 * markers dropped (a quote may span a page break), soft hyphens dropped,
 * whitespace collapsed, case, typographic quotes, dashes and superscript digits
 * folded.
 *
 * A hyphen after a letter is dropped together with any whitespace after it, in
 * the quote and the source alike. Line-break hyphenation cannot be told apart
 * from a real compound split at a line end by looking: `Straßen-\nzügen` is one
 * word, `Bismarck-\nund Moltkestraße` is two, and the model writes either form.
 * Dropping the hyphen on both sides makes all of `Straßenzügen`, `Straßen-zügen`
 * and `Bismarck- und` compare equal to their source; a spaced dash (`Tivoli -
 * Kaiserplatz`) and a numeric range (`150-200`) are untouched.
 */
export function normalizeForMatching(text: string): NormalizedText {
  const source = text.replace(PAGE_MARKER, (marker) => ' '.repeat(marker.length));
  let comparable = '';
  const offsets: number[] = [];
  let lastWasSpace = true;

  for (let index = 0; index < source.length; index++) {
    const character = foldCharacter(source[index]);
    if (character === '\u00ad') continue;
    if (character === '-' && /\p{L}/u.test(source[index - 1] ?? '')) {
      while (/\s/.test(source[index + 1] ?? '')) index++;
      continue;
    }
    if (/\s/.test(character)) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
      comparable += ' ';
      offsets.push(index);
      continue;
    }
    lastWasSpace = false;
    comparable += character;
    offsets.push(index);
  }
  return { comparable, offsets };
}

/**
 * The located passage as a reader should see it: the original text between the
 * first and last matched character, page markers removed, line-break
 * hyphenation joined where a lowercase letter continues the word, whitespace
 * collapsed. Display only — matching never depends on it.
 */
function displayPassage(text: string, from: number, to: number): string {
  return (
    text
      .slice(from, to + 1)
      .replace(PAGE_MARKER, ' ')
      .replace(/\u00ad/g, '')
      .replace(/(\p{L})-\n\s*(?=\p{Ll})/gu, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      // A quote cut mid-sentence ends on the source's comma; it reads as a typo.
      .replace(/\s*[,;:]$/, '')
  );
}

const FOLDED_CHARACTERS: Record<string, string> = {
  '\u2010': '-',
  '„': '"',
  '“': '"',
  '”': '"',
  '‚': "'",
  '‘': "'",
  '’': "'",
  '«': '"',
  '»': '"',
  '–': '-',
  '—': '-',
  '‑': '-',
  '²': '2',
  '³': '3',
};

function foldCharacter(character: string): string {
  const folded = FOLDED_CHARACTERS[character];
  if (folded) return folded;
  const lower = character.toLowerCase();
  // One character in, one out: `offsets` maps each comparable character back.
  return lower.length === 1 ? lower : character;
}
