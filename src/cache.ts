import fs from 'fs/promises';
import path from 'path';
import { config } from './config';

export async function getCachedData(url: string): Promise<any | null> {
  if (!config.useCache) return null;

  const filename = encodeURIComponent(url) + '.json';
  const filepath = path.join(config.cacheDir, filename);

  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

export async function setCachedData(url: string, data: any): Promise<void> {
  if (!config.useCache) return;

  const filename = encodeURIComponent(url) + '.json';
  const filepath = path.join(config.cacheDir, filename);

  try {
    await fs.mkdir(config.cacheDir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing cache:', error);
  }
}
