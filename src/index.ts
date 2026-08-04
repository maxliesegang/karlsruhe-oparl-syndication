import { runFeedGeneration } from './services/feed-generation-service.js';

/**
 * `--no-summaries` forces the LLM step off for this run regardless of
 * `GENERATE_LLM_SUMMARIES`. Every other part of the pipeline still runs, so this is
 * the flag to use when regenerating `docs/` to check a change to the feed, the
 * Stadtteil index or any other artifact: cached summaries still reach the feed, but
 * no request — and no billing — reaches the provider. Only the scheduled workflow
 * needs summaries actually refreshed.
 */
await runFeedGeneration({
  clearCache: process.argv.includes('--clear-cache'),
  generateSummaries: process.argv.includes('--no-summaries') ? false : undefined,
});
