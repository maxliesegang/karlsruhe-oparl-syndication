import { runFeedGeneration } from './services/generation-service.js';

await runFeedGeneration({ clearCache: process.argv.includes('--clear-cache') });
