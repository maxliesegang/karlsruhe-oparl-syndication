import { BaseStore } from './baseStore';
import { Meeting } from '../types';
import { readJsonFromFile, writeJsonToFile } from '../fileUtils';

class MeetingStore extends BaseStore<Meeting> {
  private organizationMeetings: Map<string, Set<string>> = new Map();

  getFileName(): string {
    return 'meetingStore.json';
  }

  addMeeting(meeting: Meeting) {
    super.add(meeting);

    meeting.organization.forEach((orgId) => {
      if (!this.organizationMeetings.has(orgId)) {
        this.organizationMeetings.set(orgId, new Set());
      }
      const orgMeetings = this.organizationMeetings.get(orgId);
      if (orgMeetings) {
        orgMeetings.add(meeting.id);
      }
    });
  }

  getMeetingsByOrganizationId(organizationId: string): Meeting[] {
    const meetingIds = this.organizationMeetings.get(organizationId);
    if (!meetingIds) {
      return [];
    }
    return Array.from(meetingIds)
      .map((id) => this.getById(id)!)
      .filter(Boolean);
  }

  async saveToDisk(): Promise<void> {
    const data = {
      meetings: Array.from(this.items.entries()),
      organizationMeetings: Array.from(this.organizationMeetings.entries()).map(([key, value]) => [
        key,
        Array.from(value),
      ]),
    };
    await writeJsonToFile(data, this.getFileName());
  }

  async loadFromDisk(): Promise<void> {
    const data = await readJsonFromFile(this.getFileName());
    if (data) {
      this.items = new Map(data.meetings);
      this.organizationMeetings = new Map(
        (data.organizationMeetings as [string, string[]][]).map(
          ([key, value]) => [key, new Set(value)] as [string, Set<string>],
        ),
      );
    }
  }
}

export const meetingStore = new MeetingStore();
