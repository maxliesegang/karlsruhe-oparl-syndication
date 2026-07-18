import { PerRecordStore } from './per-record-store.js';
import { Meeting } from '../types/index.js';

export class MeetingStore extends PerRecordStore<Meeting> {
  private organizationMeetings: Map<string, Set<string>> = new Map();
  private meetingOrganizations: Map<string, Set<string>> = new Map();

  getFileName(): string {
    return 'meetings.json';
  }

  getDirName(): string {
    return 'meetings';
  }

  getLastModifiedWithSafetyMargin(): Date | undefined {
    return this.getLastModified(1); // Subtract 1 day for safety
  }

  protected onItemAdd(meeting: Meeting): void {
    this.removeFromOrganizationIndex(meeting.id);
    const organizationIds = new Set(meeting.organization ?? []);
    for (const orgId of organizationIds) {
      let orgMeetings = this.organizationMeetings.get(orgId);
      if (!orgMeetings) {
        orgMeetings = new Set();
        this.organizationMeetings.set(orgId, orgMeetings);
      }
      orgMeetings.add(meeting.id);
    }
    this.meetingOrganizations.set(meeting.id, organizationIds);
  }

  protected onItemLoad(meeting: Meeting): void {
    this.onItemAdd(meeting);
  }

  protected onItemRemove(meeting: Meeting): void {
    this.removeFromOrganizationIndex(meeting.id);
  }

  private removeFromOrganizationIndex(meetingId: string): void {
    for (const organizationId of this.meetingOrganizations.get(meetingId) ?? []) {
      const meetingIds = this.organizationMeetings.get(organizationId);
      meetingIds?.delete(meetingId);
      if (meetingIds?.size === 0) this.organizationMeetings.delete(organizationId);
    }
    this.meetingOrganizations.delete(meetingId);
  }

  getMeetingsByOrganizationId(organizationId: string): Meeting[] {
    const meetingIds = this.organizationMeetings.get(organizationId);
    if (!meetingIds) {
      return [];
    }
    return Array.from(meetingIds)
      .map((id) => this.getById(id))
      .filter((m): m is Meeting => m !== undefined);
  }

  clearAllItems(): void {
    super.clearAllItems();
    this.organizationMeetings.clear();
    this.meetingOrganizations.clear();
  }
}

export const meetingStore = new MeetingStore();
