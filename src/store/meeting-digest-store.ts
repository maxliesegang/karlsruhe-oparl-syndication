import { PerRecordStore } from './per-record-store.js';
import { MeetingDigest } from '../types/index.js';

/**
 * Generated sitting previews, kept separate from authoritative OParl records for
 * the same reason paper summaries are. Keyed by `<meeting id>-<lead>`, so the
 * published basename reads `10566-week`.
 */
export class MeetingDigestStore extends PerRecordStore<MeetingDigest> {
  readonly storageFileName = 'meeting-digests.json';
  readonly recordDirectoryName = 'digests/meetings';
}

export const meetingDigestStore = new MeetingDigestStore();
