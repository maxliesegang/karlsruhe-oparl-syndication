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
 * Checks if a date string represents a recent file.
 * Files from the last YEARS_TO_KEEP years are considered current.
 */
export function isRecentFile(dateString: string): boolean {
  const currentYear = new Date().getFullYear();
  const recentYears = Array.from({ length: YEARS_TO_KEEP }, (_, i) => String(currentYear - i));
  return recentYears.some((year) => dateString.includes(year));
}
