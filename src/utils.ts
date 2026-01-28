/** Corrects OParl URLs to use the /ris/oparl/ path */
export function correctUrl(url: string): string {
  if (url.includes('/ris/')) {
    return url;
  }
  return url.replace('/oparl/', '/ris/oparl/');
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
