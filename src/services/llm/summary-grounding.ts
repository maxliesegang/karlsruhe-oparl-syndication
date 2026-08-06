import { GeneratedPaperSummary } from '../../types/index.js';

// Match common German numeric forms without treating punctuation at sentence
// boundaries as part of a value. Dates and grouped thousands are kept whole.
const NUMERIC_LITERAL =
  /\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,3}(?:[.\u00a0\u202f ]\d{3})+(?:,\d+)?|\d+,\d+|\d+/gu;
const DATE_LITERAL = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/;
const GROUPING_SEPARATOR = /[.\u00a0\u202f ]/g;

/**
 * Return numeric literals used by a generated summary that do not occur in the
 * supplied source. Comparison is by value, not by spelling: the same amount
 * written with or without thousands separators, with trailing decimal zeros
 * dropped, or a source date's day/month/year written out in prose all count as
 * grounded. Nothing else does — no arithmetic, no unit conversion, no fuzzy
 * matching, so a derived total or a "21,24 Millionen" restatement of
 * `21.240.000` stays unsupported even though every digit occurs in the source.
 */
export function findUngroundedNumericLiterals(
  generated: GeneratedPaperSummary,
  sourceText: string,
): string[] {
  const sourceKeys = new Set(extractNumericLiterals(sourceText).flatMap(groundedLiteralKeys));
  const generatedText = [generated.summary, ...generated.keyPoints].join('\n');

  return [
    ...new Set(
      extractNumericLiterals(generatedText)
        .map((literal) => literal.trim())
        .filter((literal) => !sourceKeys.has(literalKey(literal))),
    ),
  ];
}

function extractNumericLiterals(value: string): string[] {
  return value.match(NUMERIC_LITERAL) ?? [];
}

/** The value a literal denotes, independent of how it is spelled. */
function literalKey(literal: string): string {
  const date = DATE_LITERAL.exec(literal);
  if (date) {
    return `date:${stripLeadingZeros(date[1])}.${stripLeadingZeros(date[2])}.${date[3]}`;
  }
  return `num:${normalizeNumber(literal)}`;
}

/**
 * The keys a source literal vouches for. A date vouches for its own components
 * too: a table's `31.05.2027` is routinely written back as "31. Mai 2027", and
 * the day would otherwise read as an invented number.
 */
function groundedLiteralKeys(literal: string): string[] {
  const date = DATE_LITERAL.exec(literal);
  if (!date) return [literalKey(literal)];
  return [
    literalKey(literal),
    ...date.slice(1).flatMap((part) => [`num:${part}`, `num:${stripLeadingZeros(part)}`]),
  ];
}

/** Drop thousands separators and value-less trailing decimal zeros: `1.860.000,00` → `1860000`. */
function normalizeNumber(literal: string): string {
  const [integerPart, fractionPart = ''] = literal.replace(GROUPING_SEPARATOR, '').split(',');
  const fraction = fractionPart.replace(/0+$/, '');
  return fraction ? `${integerPart},${fraction}` : integerPart;
}

function stripLeadingZeros(value: string): string {
  return value.replace(/^0+(?=\d)/, '');
}
