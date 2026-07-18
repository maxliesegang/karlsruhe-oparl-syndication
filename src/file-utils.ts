import fs from 'fs/promises';
import path from 'path';

const DOCS_DIR = path.join(import.meta.dirname, '..', 'docs');

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
