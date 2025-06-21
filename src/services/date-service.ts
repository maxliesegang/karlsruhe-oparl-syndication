/**
 * Service for handling date-related operations
 */
export class DateService {
  /**
   * Checks if a date string represents a current file
   * Current files are those modified in 2023, 2024, or 2025
   * @param dateString The date string to check
   * @returns True if the date represents a current file, false otherwise
   */
  public isCurrentFile(dateString: string): boolean {
    const currentYears = ['2023', '2024', '2025'];
    return currentYears.some((year) => dateString.includes(year));
  }
}

export const dateService = new DateService();
