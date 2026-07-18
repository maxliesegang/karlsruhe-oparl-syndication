/** Corrects OParl URLs to use the /ris/oparl/ path */
export function normalizeOParlUrl(url: string): string {
  if (url.includes('/ris/')) {
    return url;
  }
  return url.replace('/oparl/', '/ris/oparl/');
}

/** Parses a value into a Date, returning undefined for missing or invalid dates. */
export function parseValidDate(value: string | Date | null | undefined): Date | undefined {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Returns the most recent valid date from the given values, or undefined if none are valid.
 * Uses a reduce loop (no argument spread) so it stays safe for large inputs and ignores
 * missing or malformed dates instead of poisoning the result with NaN.
 */
export function latestValidDate(...values: (string | Date | null | undefined)[]): Date | undefined {
  let latest: Date | undefined;
  for (const value of values) {
    const date = parseValidDate(value);
    if (date && (!latest || date.getTime() > latest.getTime())) {
      latest = date;
    }
  }
  return latest;
}

const YEARS_TO_KEEP = 3;

/**
 * True when `dateString` parses to a date within the current or the preceding
 * `YEARS_TO_KEEP - 1` calendar years (e.g. 2024–2026 when run in 2026).
 *
 * Parsing the date and comparing the calendar year — instead of the previous
 * substring year-match — avoids false positives from a recent-year fragment
 * appearing elsewhere in the string, and treats an unparseable date as not
 * recent rather than accidentally matching.
 */
export function isRecentFile(dateString: string): boolean {
  const date = parseValidDate(dateString);
  if (!date) return false;
  const oldestYearToKeep = new Date().getFullYear() - (YEARS_TO_KEEP - 1);
  return date.getFullYear() >= oldestYearToKeep;
}
