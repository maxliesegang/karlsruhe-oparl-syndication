import { execFileSync } from 'node:child_process';
import fs from 'fs/promises';
import path from 'path';

import { config } from './config.js';
import { RECENT_FEED_MAX_ITEM_COUNT } from './constants.js';
import { FILTERED_FEED_INDEX_FILE_NAME } from './filtered-feed-contract.js';
import {
  countFeedEntries,
  entryCountFloor,
  FeedValidationError,
  isEntryCountAcceptable,
  validateFilteredFeedIndex,
  validateFeedXml,
} from './feed-validation.js';
import { docsPath } from './docs-files.js';
import { logger } from './logger.js';

/**
 * Validates the generated feeds before they can be committed: well-formed XML,
 * at least one entry, and no unexplained collapse in entry count. Run by CI
 * after `npm run generate`, and locally via `npm run validate:feed`.
 */

/** GitHub renders `::error::` lines as annotations; locally they are just noise. */
function reportError(message: string): void {
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::error::${message}`);
  }
  logger.error(message);
}

/**
 * Entry count of the committed version of a feed, or 0 when it has no history
 * (first run) or the stored copy cannot be parsed — neither is a reason to fail
 * the new feed, so both simply disable the drop-off comparison.
 */
function previousEntryCount(repositoryRelativePath: string): number {
  let committed: string;
  try {
    committed = execFileSync('git', ['show', `HEAD:${repositoryRelativePath}`], {
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024,
    });
  } catch {
    return 0;
  }

  try {
    return countFeedEntries(committed);
  } catch {
    logger.warn(`Could not parse committed ${repositoryRelativePath}; skipping drop-off check`);
    return 0;
  }
}

async function validateFeedFile(
  fileName: string,
  options: {
    compareWithPrevious?: boolean;
    expectedEntryCount?: number;
    maximumItemCount?: number;
  } = {},
): Promise<boolean> {
  const absolutePath = docsPath(fileName);
  const relativePath = path.posix.join('docs', fileName);

  let xml: string;
  try {
    xml = await fs.readFile(absolutePath, 'utf8');
  } catch {
    reportError(`Generated feed ${relativePath} is missing`);
    return false;
  }

  let newCount: number;
  try {
    newCount = validateFeedXml(xml);
  } catch (error) {
    if (error instanceof FeedValidationError) {
      reportError(`${relativePath} ${error.message}`);
      return false;
    }
    throw error;
  }

  const oldCount = options.compareWithPrevious === false ? 0 : previousEntryCount(relativePath);
  const comparison = options.compareWithPrevious === false ? '' : ` previous=${oldCount}`;
  logger.info(`${relativePath}:${comparison} new=${newCount}`);

  if (newCount === 0) {
    reportError(`${relativePath} has zero entries`);
    return false;
  }

  if (options.expectedEntryCount !== undefined && newCount !== options.expectedEntryCount) {
    reportError(
      `${relativePath} has ${newCount} entries but ${FILTERED_FEED_INDEX_FILE_NAME} declares ` +
        `${options.expectedEntryCount}`,
    );
    return false;
  }

  if (options.maximumItemCount !== undefined && newCount > options.maximumItemCount) {
    reportError(
      `${relativePath} has ${newCount} entries, above the configured maximum of ` +
        `${options.maximumItemCount}`,
    );
    return false;
  }

  if (!isEntryCountAcceptable(oldCount, newCount, options.maximumItemCount)) {
    const floor = Math.min(
      entryCountFloor(oldCount),
      options.maximumItemCount ?? Number.POSITIVE_INFINITY,
    );
    reportError(
      `${relativePath} entry count dropped from ${oldCount} to ${newCount} ` +
        `(below floor of ${floor}); refusing to commit`,
    );
    return false;
  }

  return true;
}

async function readFilteredFeedIndex() {
  let raw: string;
  try {
    raw = await fs.readFile(docsPath(FILTERED_FEED_INDEX_FILE_NAME), 'utf8');
  } catch {
    reportError(`Generated feed index docs/${FILTERED_FEED_INDEX_FILE_NAME} is missing`);
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    reportError(`Generated feed index docs/${FILTERED_FEED_INDEX_FILE_NAME} is malformed JSON`);
    return null;
  }

  try {
    return validateFilteredFeedIndex(value);
  } catch (error) {
    if (!(error instanceof FeedValidationError)) throw error;
    reportError(`Generated feed index docs/${FILTERED_FEED_INDEX_FILE_NAME} ${error.message}`);
    return null;
  }
}

const filteredFeeds = await readFilteredFeedIndex();
const results: boolean[] = [];
// Validate sequentially to avoid retaining every large XML document in memory at once.
results.push(
  await validateFeedFile(config.feedFileName, { maximumItemCount: config.feedMaxItemCount }),
);
results.push(
  await validateFeedFile(config.recentFeedFileName, {
    maximumItemCount: RECENT_FEED_MAX_ITEM_COUNT,
  }),
);
for (const descriptor of filteredFeeds ?? []) {
  results.push(
    await validateFeedFile(descriptor.path, {
      compareWithPrevious: false,
      expectedEntryCount: descriptor.entryCount,
      maximumItemCount: config.feedMaxItemCount,
    }),
  );
}
if (!filteredFeeds) results.push(false);

if (results.includes(false)) {
  process.exit(1);
}

logger.info('All generated feeds passed validation');
