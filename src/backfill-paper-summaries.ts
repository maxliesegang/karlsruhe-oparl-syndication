import { config } from './config.js';
import { logger } from './logger.js';
import { OpenCodePaperSummarizer } from './services/llm/opencode-paper-summarizer.js';
import { PaperSummarizer } from './services/llm/paper-summarizer.js';
import {
  buildPaperSummarySessionId,
  updatePaperSummaries,
} from './services/paper-summary-service.js';
import { stores } from './store/index.js';

/**
 * Papers per round. Each round is persisted before the next starts, so a job that
 * hits its time limit keeps everything it has already paid for.
 */
const ROUND_ITEM_COUNT = 20;

interface Options {
  since: Date;
  maximumItemCount: number;
}

const options = parseOptions(process.argv.slice(2));

if (!config.llmApiKey) {
  throw new Error('LLM_API_KEY is required to backfill paper summaries.');
}

// A backfill summarizes text that is already in the archive. It must neither fetch
// from the OParl API nor start PDF downloads, so it can run beside the feed without
// adding load on Karlsruhe's servers; the next scheduled run renders the results.
config.extractPdfText = false;
await stores.loadFromDisk();

logger.info(
  `Backfilling up to ${options.maximumItemCount} paper summary(s) for papers dated ` +
    `${options.since.toISOString().slice(0, 10)} or later, newest first.`,
);

// Records which papers a round actually sent, so a paper that failed is not picked
// again by every following round; it is retried by the next backfill run instead.
const attemptedSessionIds = new Set<string>();
const primary = new OpenCodePaperSummarizer({
  apiKey: config.llmApiKey,
  baseUrl: config.llmBaseUrl,
  model: config.llmModel,
  fallbackModel: config.llmFallbackModel,
  timeoutMs: config.summaryRequestTimeoutMs,
});
const summarizer: PaperSummarizer = {
  providerName: primary.providerName,
  model: primary.model,
  summarize: (request) => {
    attemptedSessionIds.add(request.sessionId);
    return primary.summarize(request);
  },
};

const datedPapers = stores.papers
  .getAll()
  .filter((paper) => new Date(paper.date).getTime() >= options.since.getTime());
let attemptedCount = 0;
while (attemptedCount < options.maximumItemCount) {
  const before = attemptedSessionIds.size;
  const storedBefore = stores.paperSummaries.getAll().length;
  // paperIds bypasses the service's own 2026 cutoff; the date filter above replaces it.
  const paperIds = new Set(
    datedPapers
      .filter((paper) => !attemptedSessionIds.has(buildPaperSummarySessionId(paper)))
      .map((paper) => paper.id),
  );
  await updatePaperSummaries(stores.meetings.getAll(), {
    enabled: true,
    summarizer,
    maximumItems: Math.min(ROUND_ITEM_COUNT, options.maximumItemCount - attemptedCount),
    paperIds,
  });
  await stores.paperSummaries.saveToDisk();
  const roundCount = attemptedSessionIds.size - before;
  if (roundCount === 0) break;
  attemptedCount += roundCount;
  // A round in which every paper failed means the provider, not the papers, is the
  // problem; continuing would only walk the rest of the budget through the same error.
  if (stores.paperSummaries.getAll().length === storedBefore) {
    logger.error('Every paper in this round failed; stopping the backfill.');
    process.exitCode = 1;
    break;
  }
  logger.info(`Backfill progress: ${attemptedCount} of at most ${options.maximumItemCount}.`);
}

function parseOptions(args: string[]): Options {
  const since = readFlag(args, 'since');
  const maximumItemCount = Number(readFlag(args, 'max-items') ?? config.summaryMaxItemsPerRun);
  const sinceDate = since ? new Date(since) : undefined;
  if (!sinceDate || Number.isNaN(sinceDate.getTime())) {
    throw new Error(
      'Usage: npm run summarize:backfill -- --since <YYYY-MM-DD> [--max-items <count>]',
    );
  }
  if (!Number.isInteger(maximumItemCount) || maximumItemCount < 1) {
    throw new Error(`--max-items must be a positive integer, got ${maximumItemCount}.`);
  }
  return { since: sinceDate, maximumItemCount };
}

function readFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || undefined;
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1]?.trim() || undefined : undefined;
}
