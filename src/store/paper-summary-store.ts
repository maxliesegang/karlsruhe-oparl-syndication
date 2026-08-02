import { PerRecordStore } from './per-record-store.js';
import { PaperSummary } from '../types/index.js';

/** Content-addressed LLM summaries, kept separate from authoritative OParl records. */
export class PaperSummaryStore extends PerRecordStore<PaperSummary> {
  readonly storageFileName = 'paper-summaries.json';
  readonly recordDirectoryName = 'summaries/papers';
}

export const paperSummaryStore = new PaperSummaryStore();
