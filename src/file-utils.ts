import fs from 'fs/promises';
import path from 'path';

const DOCS_DIR = path.join(import.meta.dirname, '..', 'docs');

/** Resolves a path inside the published docs directory. */
export function docsPath(...segments: string[]): string {
  return path.join(DOCS_DIR, ...segments);
}

/**
 * Deterministic JSON serialization: object keys are sorted recursively and the
 * output is 2-space indented UTF-8 with a single trailing newline. An unchanged
 * record therefore serializes byte-identically on every run regardless of the
 * key order the API happened to return, which lets git dedupe per-record blobs.
 * Array element order is preserved because it is semantically meaningful.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2) + '\n';
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** Extracts a record id from an OParl id URL (its last path segment). */
export function extractRecordId(id: string): string {
  return id.split('/').pop() || id;
}

/** Maps a record id to a filesystem-safe basename (no extension). */
export function sanitizeRecordId(recordId: string): string {
  return recordId.replace(/[^A-Za-z0-9._-]/g, '_');
}

/**
 * Replace a file atomically by writing its complete contents to a temporary
 * sibling first. Keeping the temporary file in the destination directory
 * ensures the final rename stays on the same filesystem.
 */
export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );

  try {
    await fs.writeFile(temporaryPath, data, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function writeJsonToFile<T>(data: T, filename: string): Promise<void> {
  const filePath = path.join(DOCS_DIR, filename);
  await atomicWriteFile(filePath, JSON.stringify(data, null, 2));
}

export async function readJsonFromFile<T>(filename: string): Promise<T | null> {
  const filePath = path.join(DOCS_DIR, filename);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
