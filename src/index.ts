import { runFeedGeneration } from './services/feed-generation-service.js';

const args = process.argv.slice(2);

/**
 * `--no-summaries` forces the LLM step off for this run regardless of
 * `GENERATE_LLM_SUMMARIES`. Every other part of the pipeline still runs, so this is
 * the flag to use when regenerating `docs/` to check a change to the feed, the
 * Stadtteil index or any other artifact: cached summaries still reach the feed, but
 * no request — and no billing — reaches the provider.
 *
 * `--skip-fetch` works on the committed archive only (no OParl request, no PDF
 * download). Combined with `--no-summaries`, an unchanged archive must reproduce
 * `docs/` byte for byte on any machine, which makes it a cheap regression check.
 */
await runFeedGeneration({
  clearCache: args.includes('--clear-cache'),
  generateSummaries: args.includes('--no-summaries') ? false : undefined,
  skipFetch: args.includes('--skip-fetch'),
});
