import fs from 'fs/promises';
import path from 'path';

export async function writeJsonToFile(data: any, filename: string): Promise<void> {
  const filePath = path.join(__dirname, '..', 'docs', filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function readJsonFromFile(filename: string): Promise<any> {
  const filePath = path.join(__dirname, '..', 'docs', filename);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
