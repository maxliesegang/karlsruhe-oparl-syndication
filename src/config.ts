import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  allMeetingsApiUrl:
    process.env.MEETINGS_API_URL || 'https://web1.karlsruhe.de/oparl/bodies/0001/meetings',
  allPapersApiUrl:
    process.env.PAPERS_API_URL || 'https://web1.karlsruhe.de/ris/oparl/bodies/0001/papers',
  allOrganizationsApiUrl:
    process.env.ORGANIZATIONS_API_URL ||
    'https://web1.karlsruhe.de/ris/oparl/bodies/0001/organizations',
  feedTitle: process.env.FEED_TITLE || 'Alle Tagesordnungspunkte',
  feedDescription:
    process.env.FEED_DESCRIPTION ||
    'Feed der Tagesordnungspunkte aus den Sitzungen aller Karlsruher Gremien',
  feedId: process.env.FEED_ID || 'http://localhost:8080/',
  feedLink: process.env.FEED_LINK || 'http://localhost:8080/',
  feedLanguage: process.env.FEED_LANGUAGE || 'de',
  feedCopyright: process.env.FEED_COPYRIGHT || 'Kein Copyright',
  authorName: process.env.AUTHOR_NAME || 'Maximilian Liesegang',
  authorEmail: process.env.AUTHOR_EMAIL || 'feeds@liesegang.io',
  authorLink: process.env.AUTHOR_LINK || 'github.com/maxliesegang',
  extractPdfText: process.env.EXTRACT_PDF_TEXT ? process.env.EXTRACT_PDF_TEXT === 'true' : true,
  feedFilename: process.env.FEED_FILENAME || 'tagesordnungspunkte.xml',
  fetchAllPages: process.env.FETCH_ALL_PAGES ? process.env.FETCH_ALL_PAGES === 'true' : true,
  requestDelay: parseInt(process.env.REQUEST_DELAY || '1000', 10),
  cacheDir: process.env.CACHE_DIR || path.join(__dirname, '..', 'cache'),
};
