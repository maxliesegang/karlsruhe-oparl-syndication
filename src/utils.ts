import fs from 'fs/promises';
import path from 'path';
import { parseString } from 'xml2js';

export function correctUrl(url: string): string {
  if (url.includes('/ris/')) {
    return url;
  }
  return url.replace('/oparl/', '/ris/oparl/');
}

export async function getLastUpdatedFromFeed(): Promise<Date | undefined> {
  try {
    const filePath = path.join(__dirname, '..', 'docs', 'tagesordnungspunkte.xml');
    const xmlData = await fs.readFile(filePath, 'utf8');

    return new Promise((resolve, reject) => {
      parseString(xmlData, (err, result) => {
        if (err) {
          reject(err);
        } else {
          const updated = result.feed.updated[0];
          resolve(updated ? new Date(updated) : undefined);
        }
      });
    });
  } catch (error) {
    console.error('Error reading or parsing feed file:', error);
    return undefined;
  }
}
