import { config } from './src/config.js';
import { logger } from './src/logger.js';
import { stores } from './src/store/index.js';
import { updatePaperSummaries } from './src/services/paper-summary-service.js';

config.extractPdfText = false;
await stores.loadFromDisk();
logger.info(`Regenerating every eligible summary with ${config.llmModel}.`);
await updatePaperSummaries(stores.meetings.getAll(), {
  enabled: true,
  regenerate: true,
  maximumItems: 2000,
  concurrency: 4,
});
await stores.paperSummaries.saveToDisk();
logger.info('Done.');
