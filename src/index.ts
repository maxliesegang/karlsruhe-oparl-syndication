import { store } from './store';
import { fetchDataAndGenerateFeed } from './services/feed-service';

if (process.argv.includes('--clear-cache')) {
  store.clearAllFromCache();
}

await fetchDataAndGenerateFeed();
