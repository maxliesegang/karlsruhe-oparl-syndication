/** Lead time at which a meeting preview is produced, in the record and the feed. */
export type MeetingDigestLead = 'week' | 'day';

export interface MeetingDigestBody {
  /**
   * At most two sentences about the sitting as a whole, or empty when there is
   * nothing to say beyond the highlights — forcing one produced filler.
   */
  overview: string;
  /** One to six points, each traceable to one agenda item or a group of routine ones. */
  highlights: string[];
}

/**
 * A generated preview of one upcoming sitting, composed from the per-paper
 * summaries its public agenda items consult. Content-addressed on the composed
 * input exactly like `PaperSummary`, so an unchanged agenda never calls the model
 * twice — the spike this was promoted from computed the hash but never read it
 * back, which made a daily schedule regenerate every due sitting every day.
 */
export interface MeetingDigest extends MeetingDigestBody {
  /**
   * `<meeting id>-<lead>`. The week-ahead and day-before previews are different
   * documents about the same sitting, so the lead is part of the identity rather
   * than only of the filename.
   */
  id: string;
  meetingId: string;
  meetingName: string;
  meetingStart: string;
  lead: MeetingDigestLead;
  sourceHash: string;
  promptVersion: string;
  provider: string;
  model: string;
  generatedAt: string;
  /** Papers whose summary fed this preview, by record basename. */
  sourcePapers: string[];
  /**
   * Public, numbered agenda items that had no current summary to contribute. The
   * model sees them by title and procedure only; the feed tells the reader so.
   */
  uncoveredCount: number;
}
