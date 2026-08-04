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

function parseNonNegativeInteger(environmentVariable: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${environmentVariable} must be a non-negative integer: ${value}`);
  }
  return parsed;
}

function parseIntegerAtLeast(environmentVariable: string, value: string, minimum: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${environmentVariable} must be at least ${minimum}: ${value}`);
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
  feedMaxItemCount: parsePositiveInteger('FEED_MAX_ITEMS', process.env.FEED_MAX_ITEMS || '500'),

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
  generateLlmSummaries: process.env.GENERATE_LLM_SUMMARIES === 'true',

  // LLM paper summaries. The default endpoint is OpenCode Go's OpenAI-compatible API.
  llmApiKey: process.env.LLM_API_KEY || '',
  llmBaseUrl: parseAbsoluteUrl(
    'LLM_BASE_URL',
    process.env.LLM_BASE_URL || 'https://opencode.ai/zen/go/v1/',
  ),
  llmModel: process.env.LLM_MODEL || 'mimo-v2.5',
  summaryPromptVersion: process.env.SUMMARY_PROMPT_VERSION || 'paper-de-v3',
  summaryMaxItemsPerRun: parseNonNegativeInteger(
    'SUMMARY_MAX_ITEMS_PER_RUN',
    process.env.SUMMARY_MAX_ITEMS_PER_RUN || '100',
  ),
  summaryMaxInputCharacters: parseIntegerAtLeast(
    'SUMMARY_MAX_INPUT_CHARS',
    process.env.SUMMARY_MAX_INPUT_CHARS || '100000',
    10_000,
  ),
  summaryConcurrency: parsePositiveInteger(
    'SUMMARY_CONCURRENCY',
    process.env.SUMMARY_CONCURRENCY || '2',
  ),
  summaryRequestTimeoutMs: parsePositiveInteger(
    'SUMMARY_REQUEST_TIMEOUT_MS',
    process.env.SUMMARY_REQUEST_TIMEOUT_MS || '120000',
  ),

  // Digests (meeting previews, monthly Stadtteil/stadtweit rollups) are a
  // separate model budget from per-paper summaries and default to a stronger
  // model. There are ~90 digest calls a month against ~3,000 paper summaries, so
  // the cost difference is marginal, while the task — selecting and framing the
  // politically significant items out of a month's papers — is the one that
  // rewards capability. Stronger models on this endpoint are also far slower, so
  // the timeout is its own setting rather than a reuse of the summary one.
  //
  // The generous default is deliberate. Latency here is dominated by provider
  // jitter rather than input size — a 17 KiB pool completed in 87s while an 11 KiB
  // one exceeded 300s on the same model — and digests are a handful of calls a
  // month on a scheduled workflow, so waiting is nearly free while a timeout costs
  // the whole digest until the next run.
  digestModel: process.env.DIGEST_MODEL || 'mimo-v2.5-pro',
  digestRequestTimeoutMs: parsePositiveInteger(
    'DIGEST_REQUEST_TIMEOUT_MS',
    process.env.DIGEST_REQUEST_TIMEOUT_MS || '900000',
  ),

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
