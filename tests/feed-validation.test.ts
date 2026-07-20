import { describe, expect, it } from 'vitest';

import {
  countFeedEntries,
  entryCountFloor,
  FeedValidationError,
  findInvalidXmlCharacter,
  isEntryCountAcceptable,
  validateFeedXml,
} from '../src/feed-validation.js';

function atomFeed(...entries: string[]): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '    <id>https://example.test/</id>',
    ...entries.map((entry) => `    ${entry}`),
    '</feed>',
  ].join('\n');
}

const entry = (title: string) => `<entry><title>${title}</title></entry>`;

describe('validateFeedXml', () => {
  it('returns the entry count for a well-formed feed', () => {
    expect(validateFeedXml(atomFeed(entry('a'), entry('b')))).toBe(2);
  });

  it('accepts a feed with no entries and reports zero', () => {
    expect(validateFeedXml(atomFeed())).toBe(0);
  });

  it('rejects a feed with an unclosed tag', () => {
    const malformed = atomFeed('<entry><title>a</title>');
    expect(() => validateFeedXml(malformed)).toThrow(FeedValidationError);
    expect(() => validateFeedXml(malformed)).toThrow(/not well-formed XML/);
  });

  it('rejects an unescaped ampersand', () => {
    expect(() => validateFeedXml(atomFeed(entry('Haushalt & Finanzen')))).toThrow(
      FeedValidationError,
    );
  });

  // The realistic failure mode: text extracted from a PDF carries a control
  // character into an entry. fast-xml-parser accepts these, so the explicit
  // character scan is what catches them.
  it.each([
    ['form feed', 0x0c],
    ['null', 0x00],
    ['vertical tab', 0x0b],
    ['escape', 0x1b],
  ])('rejects a %s character smuggled in by extracted text', (_name, codePoint) => {
    const polluted = atomFeed(entry(`Anlage${String.fromCharCode(codePoint)}1`));
    expect(() => validateFeedXml(polluted)).toThrow(/character XML forbids/);
  });

  it('allows tab, newline and carriage return', () => {
    expect(validateFeedXml(atomFeed(entry('a\tb\r\nc')))).toBe(1);
  });

  it('allows umlauts and astral characters', () => {
    expect(validateFeedXml(atomFeed(entry('Gebäude 🏛 Straße')))).toBe(1);
  });
});

describe('findInvalidXmlCharacter', () => {
  it('returns null for clean text', () => {
    expect(findInvalidXmlCharacter(atomFeed(entry('a')))).toBeNull();
  });

  it('locates the offending character by line and column', () => {
    const polluted = ['<feed>', `<entry>ab${String.fromCharCode(0x0c)}c</entry>`, '</feed>'].join(
      '\n',
    );

    expect(findInvalidXmlCharacter(polluted)).toEqual({
      codePoint: 0x0c,
      line: 2,
      column: 10,
    });
  });

  it('flags a lone surrogate', () => {
    expect(findInvalidXmlCharacter(`<feed>${String.fromCharCode(0xd800)}</feed>`)).not.toBeNull();
  });
});

describe('countFeedEntries', () => {
  it('counts a single entry as one rather than flattening it', () => {
    expect(countFeedEntries(atomFeed(entry('only')))).toBe(1);
  });

  it('counts entries regardless of attributes on the tag', () => {
    const withAttributes = atomFeed('<entry xml:lang="de"><title>a</title></entry>', entry('b'));
    expect(countFeedEntries(withAttributes)).toBe(2);
  });

  it('ignores elements merely named like entries', () => {
    expect(countFeedEntries(atomFeed('<entries><title>a</title></entries>'))).toBe(0);
  });
});

describe('isEntryCountAcceptable', () => {
  it('allows any count when there is no previous feed', () => {
    expect(isEntryCountAcceptable(0, 1)).toBe(true);
  });

  it('allows growth', () => {
    expect(isEntryCountAcceptable(100, 120)).toBe(true);
  });

  it('allows a drop within the floor', () => {
    expect(isEntryCountAcceptable(100, 90)).toBe(true);
  });

  it('rejects a drop below the floor', () => {
    expect(isEntryCountAcceptable(100, 89)).toBe(false);
  });

  it('derives the floor from the previous count', () => {
    expect(entryCountFloor(18105)).toBe(16294);
  });
});
