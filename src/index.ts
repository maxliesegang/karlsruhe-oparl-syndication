import { fetchDataAndGenerateFeed } from './services/feed-service.js';

await fetchDataAndGenerateFeed({ clearCache: process.argv.includes('--clear-cache') });
