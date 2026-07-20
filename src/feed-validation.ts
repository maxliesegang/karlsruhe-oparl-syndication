import { XMLParser, XMLValidator } from 'fast-xml-parser';

/** Percentage of the previous entry count a regenerated feed must still reach. */
export const ENTRY_COUNT_FLOOR_PERCENT = 90;

export class FeedValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedValidationError';
  }
}

/**
 * XML 1.0 permits only tab, newline, carriage return and the printable ranges.
 * The `feed` library escapes markup characters but passes control characters
 * through verbatim, so text extracted from a PDF can smuggle e.g. a form feed
 * into an entry and produce a file no XML parser will accept. Matching by code
 * point (the `u` flag) keeps astral characters legal while still rejecting the
 * lone surrogates that XML also forbids.
 */
const INVALID_XML_CHARACTER =
  // eslint-disable-next-line no-control-regex -- the control characters listed here are the *allowed* ones
  /[^\u{9}\u{A}\u{D}\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/u;

export interface InvalidCharacterLocation {
  codePoint: number;
  line: number;
  column: number;
}

/**
 * Locates the first character XML 1.0 forbids, or null when the text is clean.
 * Reported separately from parser errors because most parsers — including
 * fast-xml-parser — silently accept these characters.
 */
export function findInvalidXmlCharacter(xml: string): InvalidCharacterLocation | null {
  const match = INVALID_XML_CHARACTER.exec(xml);
  if (!match) return null;

  const precedingText = xml.slice(0, match.index);
  const lastLineBreak = precedingText.lastIndexOf('\n');

  return {
    codePoint: match[0].codePointAt(0) ?? 0,
    line: precedingText.split('\n').length,
    column: match.index - lastLineBreak,
  };
}

/**
 * Asserts the feed is well-formed XML and returns how many entries it holds.
 * Throws FeedValidationError with a located message on anything malformed.
 */
export function validateFeedXml(xml: string): number {
  const invalidCharacter = findInvalidXmlCharacter(xml);
  if (invalidCharacter) {
    const { codePoint, line, column } = invalidCharacter;
    const hex = codePoint.toString(16).padStart(4, '0');
    throw new FeedValidationError(
      `contains a character XML forbids (U+${hex.toUpperCase()}) at line ${line}, column ${column}`,
    );
  }

  const result = XMLValidator.validate(xml);
  if (result !== true) {
    const { msg, line, col } = result.err;
    throw new FeedValidationError(`is not well-formed XML: ${msg} (line ${line}, column ${col})`);
  }

  return countFeedEntries(xml);
}

/**
 * Counts `<entry>` elements via the parsed tree rather than a text match, so a
 * change in how the feed library formats its tags cannot silently zero out the
 * count the drop-off guard depends on.
 */
export function countFeedEntries(xml: string): number {
  const parser = new XMLParser({ isArray: (name) => name === 'entry' });
  const parsed = parser.parse(xml) as { feed?: { entry?: unknown[] } };
  return parsed.feed?.entry?.length ?? 0;
}

/** Smallest entry count still considered a healthy regeneration. */
export function entryCountFloor(previousCount: number): number {
  return Math.floor((previousCount * ENTRY_COUNT_FLOOR_PERCENT) / 100);
}

/**
 * The archive is add-only, so a large drop in entries means a broken run rather
 * than real data loss. A feed with no previous version has nothing to compare.
 */
export function isEntryCountAcceptable(previousCount: number, newCount: number): boolean {
  if (previousCount <= 0) return true;
  return newCount >= entryCountFloor(previousCount);
}
