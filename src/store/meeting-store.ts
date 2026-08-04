import { PerRecordStore } from './per-record-store.js';
import { Meeting } from '../types/index.js';
import { ReferenceIndex } from './reference-index.js';

export class MeetingStore extends PerRecordStore<Meeting> {
  /** Organization id -> meetings held by it. */
  private readonly organizationIndex = new ReferenceIndex();

  readonly storageFileName = 'meetings.json';
  readonly recordDirectoryName = 'meetings';

  getIncrementalSyncStart(): Date | undefined {
    return this.findLatestTimestamp(1); // Include one overlapping day for safety.
  }

  protected onItemAdd(meeting: Meeting): void {
    this.organizationIndex.setReferences(meeting.id, meeting.organization ?? []);
  }

  protected onItemLoad(meeting: Meeting): void {
    this.organizationIndex.setReferences(meeting.id, meeting.organization ?? []);
  }

  protected onItemRemove(meeting: Meeting): void {
    this.organizationIndex.removeReferrer(meeting.id);
  }

  getMeetingsByOrganizationId(organizationId: string): Meeting[] {
    const meetingIds = this.organizationIndex.getReferrers(organizationId);
    if (!meetingIds) return [];
    return Array.from(meetingIds)
      .map((id) => this.getById(id))
      .filter((meeting): meeting is Meeting => meeting !== undefined);
  }

  clear(): void {
    super.clear();
    this.organizationIndex.clear();
  }
}

export const meetingStore = new MeetingStore();
