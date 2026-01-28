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
