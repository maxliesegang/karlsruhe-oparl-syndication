import { BaseStore } from './base-store';
import { Meeting } from '../types';

class MeetingStore extends BaseStore<Meeting> {
  private organizationMeetings: Map<string, Set<string>> = new Map();

  getFileName(): string {
    return 'meetings.json';
  }

  getLastModifiedWithSafetyMargin(): Date | undefined {
    return this.getLastModified(1); // Subtract 1 day for safety
  }

  protected onItemAdd(meeting: Meeting): void {
    for (const orgId of meeting.organization) {
      let orgMeetings = this.organizationMeetings.get(orgId);
      if (!orgMeetings) {
        orgMeetings = new Set();
        this.organizationMeetings.set(orgId, orgMeetings);
      }
      orgMeetings.add(meeting.id);
    }
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
}

export const meetingStore = new MeetingStore();
