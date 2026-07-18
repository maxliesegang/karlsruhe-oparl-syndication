import { store } from './store/index.js';
import { fetchDataAndGenerateFeed } from './services/feed-service.js';

if (process.argv.includes('--clear-cache')) {
  store.clearAllFromCache();
}

await fetchDataAndGenerateFeed();
