import { PerRecordStore } from './per-record-store.js';
import { Meeting } from '../types/index.js';

export class MeetingStore extends PerRecordStore<Meeting> {
  private meetingIdsByOrganizationId: Map<string, Set<string>> = new Map();
  private organizationIdsByMeetingId: Map<string, Set<string>> = new Map();

  readonly storageFileName = 'meetings.json';
  readonly recordDirectoryName = 'meetings';

  getIncrementalSyncStart(): Date | undefined {
    return this.findLatestTimestamp(1); // Include one overlapping day for safety.
  }

  protected onItemAdd(meeting: Meeting): void {
    this.removeFromOrganizationIndex(meeting.id);
    const organizationIds = new Set(meeting.organization ?? []);
    for (const orgId of organizationIds) {
      let orgMeetings = this.meetingIdsByOrganizationId.get(orgId);
      if (!orgMeetings) {
        orgMeetings = new Set();
        this.meetingIdsByOrganizationId.set(orgId, orgMeetings);
      }
      orgMeetings.add(meeting.id);
    }
    this.organizationIdsByMeetingId.set(meeting.id, organizationIds);
  }

  protected onItemLoad(meeting: Meeting): void {
    this.onItemAdd(meeting);
  }

  protected onItemRemove(meeting: Meeting): void {
    this.removeFromOrganizationIndex(meeting.id);
  }

  private removeFromOrganizationIndex(meetingId: string): void {
    for (const organizationId of this.organizationIdsByMeetingId.get(meetingId) ?? []) {
      const meetingIds = this.meetingIdsByOrganizationId.get(organizationId);
      meetingIds?.delete(meetingId);
      if (meetingIds?.size === 0) this.meetingIdsByOrganizationId.delete(organizationId);
    }
    this.organizationIdsByMeetingId.delete(meetingId);
  }

  getMeetingsByOrganizationId(organizationId: string): Meeting[] {
    const meetingIds = this.meetingIdsByOrganizationId.get(organizationId);
    if (!meetingIds) {
      return [];
    }
    return Array.from(meetingIds)
      .map((id) => this.getById(id))
      .filter((m): m is Meeting => m !== undefined);
  }

  clear(): void {
    super.clear();
    this.meetingIdsByOrganizationId.clear();
    this.organizationIdsByMeetingId.clear();
  }
}

export const meetingStore = new MeetingStore();
