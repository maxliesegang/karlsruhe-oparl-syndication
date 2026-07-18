import dotenv from 'dotenv';

dotenv.config();

const PUBLIC_FEED_ROOT = 'https://maxliesegang.github.io/karlsruhe-oparl-syndication/';

function parseAbsoluteUrl(environmentVariable: string, value: string): string {
  try {
    return new URL(value).href;
  } catch {
    throw new Error(`${environmentVariable} must be an absolute URL: ${value}`);
  }
}

function parsePositiveInteger(environmentVariable: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${environmentVariable} must be a positive integer: ${value}`);
  }
  return parsed;
}

export const config = {
  // API endpoints
  meetingsApiUrl:
    process.env.MEETINGS_API_URL || 'https://web1.karlsruhe.de/oparl/bodies/0001/meetings',
  papersApiUrl:
    process.env.PAPERS_API_URL || 'https://web1.karlsruhe.de/ris/oparl/bodies/0001/papers',
  organizationsApiUrl:
    process.env.ORGANIZATIONS_API_URL ||
    'https://web1.karlsruhe.de/ris/oparl/bodies/0001/organizations',

  // Feed metadata
  feedTitle: process.env.FEED_TITLE || 'Alle Tagesordnungspunkte',
  feedDescription:
    process.env.FEED_DESCRIPTION ||
    'Feed der Tagesordnungspunkte aus den Sitzungen aller Karlsruher Gremien',
  feedId: parseAbsoluteUrl('FEED_ID', process.env.FEED_ID || PUBLIC_FEED_ROOT),
  feedBaseUrl: parseAbsoluteUrl('FEED_LINK', process.env.FEED_LINK || PUBLIC_FEED_ROOT),
  feedLanguage: process.env.FEED_LANGUAGE || 'de',
  feedCopyright: process.env.FEED_COPYRIGHT || 'Kein Copyright',
  feedFileName: process.env.FEED_FILENAME || 'tagesordnungspunkte.xml',
  recentFeedFileName: process.env.FEED_FILENAME_RECENT || 'tagesordnungspunkte-recent.xml',

  // Author info
  authorName: process.env.AUTHOR_NAME || 'Maximilian Liesegang',
  authorEmail: process.env.AUTHOR_EMAIL || 'feeds@liesegang.io',
  authorUrl: parseAbsoluteUrl(
    'AUTHOR_LINK',
    process.env.AUTHOR_LINK || 'https://github.com/maxliesegang',
  ),

  // Feature flags
  extractPdfText: process.env.EXTRACT_PDF_TEXT !== 'false',
  followPagination: process.env.FETCH_ALL_PAGES !== 'false',

  // Rate limiting
  requestIntervalMs: Number.parseInt(process.env.REQUEST_DELAY || '1000', 10),
  fullReconciliationIntervalDays: parsePositiveInteger(
    'FULL_RECONCILIATION_INTERVAL_DAYS',
    process.env.FULL_RECONCILIATION_INTERVAL_DAYS || '7',
  ),

  // PDF download limits (guard against hung servers and oversized files stalling the queue)
  pdfDownloadTimeoutMs: parsePositiveInteger(
    'PDF_DOWNLOAD_TIMEOUT_MS',
    process.env.PDF_DOWNLOAD_TIMEOUT_MS || '30000',
  ),
  pdfMaxContentBytes: parsePositiveInteger(
    'PDF_MAX_CONTENT_BYTES',
    process.env.PDF_MAX_CONTENT_BYTES || String(50 * 1024 * 1024),
  ),
};
