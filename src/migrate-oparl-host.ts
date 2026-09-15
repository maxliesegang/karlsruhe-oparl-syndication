import fs from 'fs/promises';
import path from 'path';

import { atomicWriteFile, canonicalStringify, docsPath } from './docs-files.js';
import { logger } from './logger.js';
import { mapInBatches } from './store/record-files.js';

/**
 * One-off migration: rewrite every stored OParl id from the web1 host to web2.
 *
 * web1 serves OParl only under `/ris/oparl/` but emits every id, sub-collection
 * link and downloadUrl without the `/ris/` prefix, which is why the pipeline
 * carried `normalizeOParlUrl`. web2 mirrors the requested prefix into every URL
 * it emits, so pointing the config at it removes the need for that rewrite —
 * but only once the archive's stored ids agree. Stores key on the full id URL
 * and the archive is add-only, so without this migration the first web2 run
 * would hold two records per object and die on a per-record filename collision.
 *
 * The rewrite is a literal byte-level swap of one prefix for another inside
 * already-canonical JSON, so formatting, key order and the trailing newline are
 * preserved exactly and git sees a one-line-per-URL diff rather than a reformat.
 */

export const LEGACY_ID_PREFIX = 'https://web1.karlsruhe.de/oparl/bodies/';
export const CURRENT_ID_PREFIX = 'https://web2.karlsruhe.de/ris/oparl/bodies/';

export interface FileMigrationResult {
  /** Occurrences of the legacy prefix that were replaced. */
  occurrences: number;
  /** The migrated contents, or null when the file held no legacy prefix. */
  contents: string | null;
  /** True when the file was canonical before and stayed canonical after. */
  canonicalityVerified: boolean;
}

/**
 * Migrates one JSON document held as text.
 *
 * Verification is deliberately conditional on the input: a per-record store file
 * is written with `canonicalStringify`, so its migrated form must re-serialize
 * byte-identically — that is what proves the swap touched only values and left
 * key order alone. Generated artifacts (feed-index.json) are written with plain
 * `JSON.stringify`, are not canonical to begin with, and are rebuilt by the next
 * run anyway, so they are only checked for parseability.
 */
export function migrateJsonDocument(contents: string, filePath: string): FileMigrationResult {
  const occurrences = contents.split(LEGACY_ID_PREFIX).length - 1;
  if (occurrences === 0) {
    return { occurrences: 0, contents: null, canonicalityVerified: false };
  }

  const wasCanonical = isCanonicalJson(contents);
  const migrated = contents.split(LEGACY_ID_PREFIX).join(CURRENT_ID_PREFIX);

  let parsed: unknown;
  try {
    parsed = JSON.parse(migrated);
  } catch (error) {
    throw new Error(`${filePath}: migrated contents are not valid JSON`, { cause: error });
  }

  if (migrated.includes(LEGACY_ID_PREFIX)) {
    throw new Error(`${filePath}: legacy prefix survived the rewrite`);
  }

  if (wasCanonical && canonicalStringify(parsed) !== migrated) {
    throw new Error(
      `${filePath}: was canonical before the rewrite but is not after; ` +
        'the prefix swap changed key ordering',
    );
  }

  return { occurrences, contents: migrated, canonicalityVerified: wasCanonical };
}

function isCanonicalJson(contents: string): boolean {
  try {
    return canonicalStringify(JSON.parse(contents)) === contents;
  } catch {
    return false;
  }
}

/** Every `*.json` file under the given root, recursively. */
async function listJsonFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

export interface MigrationSummary {
  filesScanned: number;
  filesChanged: number;
  occurrences: number;
  canonicalityVerified: number;
}

export async function migrateDocsDirectory(
  root: string,
  { dryRun }: { dryRun: boolean },
): Promise<MigrationSummary> {
  const files = await listJsonFiles(root);
  const summary: MigrationSummary = {
    filesScanned: files.length,
    filesChanged: 0,
    occurrences: 0,
    canonicalityVerified: 0,
  };

  await mapInBatches(files, async (filePath) => {
    const contents = await fs.readFile(filePath, 'utf8');
    const result = migrateJsonDocument(contents, filePath);
    if (result.contents === null) return;

    summary.filesChanged += 1;
    summary.occurrences += result.occurrences;
    if (result.canonicalityVerified) summary.canonicalityVerified += 1;

    if (!dryRun) {
      await atomicWriteFile(filePath, result.contents);
    }
  });

  return summary;
}

/**
 * Extracted PDF text is never rewritten: `.txt` files are source prose, and a
 * handful of them legitimately quote unrelated web1.karlsruhe.de pages.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const directoryFlag = args.indexOf('--docs-dir');
  const root = directoryFlag === -1 ? docsPath() : path.resolve(args[directoryFlag + 1] ?? '');

  logger.info(`Migrating ${LEGACY_ID_PREFIX} -> ${CURRENT_ID_PREFIX}`);
  logger.info(`Root: ${root}${dryRun ? ' (dry run, nothing is written)' : ''}`);

  const started = Date.now();
  const summary = await migrateDocsDirectory(root, { dryRun });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  logger.info(
    `Scanned ${summary.filesScanned} JSON files, ` +
      `${dryRun ? 'would rewrite' : 'rewrote'} ${summary.filesChanged} ` +
      `(${summary.occurrences} URLs, ${summary.canonicalityVerified} canonical-verified) in ${seconds}s`,
  );

  if (!dryRun && summary.filesChanged > 0) {
    logger.info('Next: npm run generate:no-summaries && npm run validate:feed');
  }
}

const invokedAsScript = /migrate-oparl-host\.(ts|js)$/.test(process.argv[1] ?? '');
if (invokedAsScript) {
  main().catch((error: unknown) => {
    logger.error(`Migration failed: ${String(error)}`);
    process.exitCode = 1;
  });
}
