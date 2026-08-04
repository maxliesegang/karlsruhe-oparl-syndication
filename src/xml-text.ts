/**
 * Text sanitation for XML output. The `feed` library passes control characters
 * through unescaped, so text extracted from a PDF can otherwise produce a feed
 * no reader will parse; `src/feed-validation.ts` gates the written file on the
 * same rule.
 */

/** Replace characters forbidden by XML 1.0 while preserving tabs and line breaks. */
export function replaceInvalidXmlCharacters(value: string, replacement = ' '): string {
  let sanitized = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const valid =
      codePoint === 0x09 ||
      codePoint === 0x0a ||
      codePoint === 0x0d ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    sanitized += valid ? character : replacement;
  }
  return sanitized;
}
