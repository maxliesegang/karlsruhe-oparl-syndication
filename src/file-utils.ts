import fs from 'fs/promises';
import path from 'path';

const DOCS_DIR = path.join(import.meta.dirname, '..', 'docs');

export async function writeJsonToFile<T>(data: T, filename: string): Promise<void> {
  const filePath = path.join(DOCS_DIR, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
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
