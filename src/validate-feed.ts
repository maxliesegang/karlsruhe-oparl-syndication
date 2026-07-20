import { execFileSync } from 'node:child_process';
import fs from 'fs/promises';
import path from 'path';

import { config } from './config.js';
import {
  countFeedEntries,
  entryCountFloor,
  FeedValidationError,
  isEntryCountAcceptable,
  validateFeedXml,
} from './feed-validation.js';
import { docsPath } from './file-utils.js';
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

async function validateFeedFile(fileName: string): Promise<boolean> {
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

  const oldCount = previousEntryCount(relativePath);
  logger.info(`${relativePath}: previous=${oldCount} new=${newCount}`);

  if (newCount === 0) {
    reportError(`${relativePath} has zero entries`);
    return false;
  }

  if (!isEntryCountAcceptable(oldCount, newCount)) {
    reportError(
      `${relativePath} entry count dropped from ${oldCount} to ${newCount} ` +
        `(below floor of ${entryCountFloor(oldCount)}); refusing to commit`,
    );
    return false;
  }

  return true;
}

const results = await Promise.all(
  [config.feedFileName, config.recentFeedFileName].map(validateFeedFile),
);

if (results.includes(false)) {
  process.exit(1);
}

logger.info('All generated feeds passed validation');
