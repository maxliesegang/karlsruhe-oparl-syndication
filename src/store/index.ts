import { meetingStore } from './meeting-store.js';
import { paperStore } from './paper-store.js';
import { consultationStore } from './consultation-store.js';
import { organizationStore } from './organization-store.js';
import { fileContentStore } from './file-content-store.js';
import { paperSummaryStore } from './paper-summary-store.js';

/**
 * Minimal contract the lifecycle helpers below need. Declaring it here keeps
 * `stores` from having to name every store three times (load, save, clear) —
 * adding a store used to mean editing three parallel lists, and forgetting one
 * silently dropped it from persistence.
 */
interface PersistableStore {
  loadFromDisk(): Promise<void>;
  saveToDisk(): Promise<void>;
  clear(): void;
}

const registry = {
  meetings: meetingStore,
  papers: paperStore,
  consultations: consultationStore,
  organizations: organizationStore,
  fileContents: fileContentStore,
  paperSummaries: paperSummaryStore,
} as const;

/**
 * Ordered so cross-store side effects fire predictably: papers register their
 * auxiliary files with the file-content store as they load, so papers must be
 * hydrated before file contents.
 */
const all: readonly PersistableStore[] = Object.values(registry);

export const stores = {
  ...registry,

  async saveToDisk(): Promise<void> {
    for (const store of all) await store.saveToDisk();
  },

  async loadFromDisk(): Promise<void> {
    for (const store of all) await store.loadFromDisk();
  },

  clear(): void {
    for (const store of all) store.clear();
  },
};
