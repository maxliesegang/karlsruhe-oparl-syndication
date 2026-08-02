import { GeneratedPaperSummary } from '../../types/index.js';

// Match common German numeric forms without treating punctuation at sentence
// boundaries as part of a value. Dates and grouped thousands are kept whole.
const NUMERIC_LITERAL =
  /\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,3}(?:[.\u00a0\u202f ]\d{3})+(?:,\d+)?|\d+,\d+|\d+/gu;

/**
 * Return numeric literals used by a generated summary that do not occur in the
 * supplied source. This intentionally performs no arithmetic or fuzzy matching:
 * a derived total is unsupported even when all of its operands are present.
 */
export function findUngroundedNumericLiterals(
  generated: GeneratedPaperSummary,
  sourceText: string,
): string[] {
  const sourceLiterals = new Set(extractNumericLiterals(sourceText).map(normalizeLiteral));
  const generatedText = [generated.summary, ...generated.keyPoints].join('\n');

  return [
    ...new Set(
      extractNumericLiterals(generatedText)
        .filter((literal) => !sourceLiterals.has(normalizeLiteral(literal)))
        .map((literal) => literal.trim()),
    ),
  ];
}

function extractNumericLiterals(value: string): string[] {
  return value.match(NUMERIC_LITERAL) ?? [];
}

function normalizeLiteral(value: string): string {
  return value.replace(/[\u00a0\u202f ]/g, '');
}
