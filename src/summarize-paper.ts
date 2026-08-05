import { config } from './config.js';
import { recordBasename } from './docs-files.js';
import { logger } from './logger.js';
import { OpenCodePaperSummarizer } from './services/llm/opencode-paper-summarizer.js';
import { updatePaperSummaries } from './services/paper-summary-service.js';
import { stores } from './store/index.js';
import { Paper } from './types/index.js';

interface Options {
  paper: string;
  model: string;
}

const options = parseOptions(process.argv.slice(2));

if (!config.llmApiKey) {
  throw new Error('LLM_API_KEY is required to generate a paper summary.');
}

// Loading archived file metadata normally schedules missing PDF extraction. A targeted
// summary must use only current cached text and must not start unrelated downloads.
config.extractPdfText = false;
await stores.loadFromDisk();
const paper = resolvePaper(options.paper, stores.papers.getAll());
const previous = stores.paperSummaries.getById(paper.id);
const summarizer = new OpenCodePaperSummarizer({
  apiKey: config.llmApiKey,
  baseUrl: config.llmBaseUrl,
  model: options.model,
  timeoutMs: config.summaryRequestTimeoutMs,
});

logger.info(
  `Generating summary for ${paper.reference} (${recordBasename(paper.id)}) with ${options.model}.`,
);
await updatePaperSummaries(stores.meetings.getAll(), {
  enabled: true,
  summarizer,
  maximumItems: 1,
  paperIds: new Set([paper.id]),
  regenerate: true,
  throwOnFailure: true,
});

const generated = stores.paperSummaries.getById(paper.id);
if (!generated || generated === previous) {
  throw new Error(
    `No summary was generated for ${paper.reference}. The paper must occur on a public agenda and have current extracted text.`,
  );
}

await stores.paperSummaries.saveToDisk();
logger.info(`Saved docs/summaries/papers/${recordBasename(paper.id)}.json.`);

function parseOptions(args: string[]): Options {
  const paper = readFlag(args, 'paper');
  if (!paper) {
    throw new Error('Usage: npm run summarize -- --paper <reference-or-id> [--model <id>]');
  }
  return { paper, model: readFlag(args, 'model') ?? config.llmModel };
}

function readFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || undefined;
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1]?.trim() || undefined : undefined;
}

function resolvePaper(input: string, papers: Paper[]): Paper {
  const normalizedInput = normalizeReference(input);
  const matches = papers.filter(
    (paper) =>
      paper.id === input ||
      recordBasename(paper.id) === input ||
      normalizeReference(paper.reference) === normalizedInput,
  );
  if (matches.length === 0) throw new Error(`No paper found for ${input}.`);
  if (matches.length > 1) {
    throw new Error(
      `Paper reference ${input} is ambiguous; use one of these OParl ids: ${matches.map((paper) => paper.id).join(', ')}`,
    );
  }
  return matches[0];
}

function normalizeReference(value: string): string {
  const withoutExtension = value.trim().replace(/\.html$/i, '');
  return /^\d{4}(?:-\d+)+$/.test(withoutExtension)
    ? withoutExtension.replaceAll('-', '/')
    : withoutExtension;
}
