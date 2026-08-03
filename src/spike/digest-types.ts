/**
 * SPIKE — not part of the published pipeline.
 *
 * Shapes for composed digests. Deliberately kept close to the per-paper summary
 * record (`PaperSummary`) so a promoted version can reuse `PerRecordStore` and the
 * content-addressed cache without a redesign.
 */

/** Lead time at which a meeting digest is produced. */
export type MeetingDigestLead = 'week' | 'day';

export interface DigestBody {
  /** Two to four sentences framing the whole sitting/month. */
  overview: string;
  /** Three to six concrete points, each traceable to one source entry. */
  highlights: string[];
}

export interface DigestRecordBase extends DigestBody {
  sourceHash: string;
  promptVersion: string;
  provider: string;
  model: string;
  generatedAt: string;
  /** Papers whose text fed this digest, by record basename. */
  sourcePapers: string[];
  /** Agenda items or papers that had no usable per-paper summary. */
  uncoveredCount: number;
}

export interface MeetingDigest extends DigestRecordBase {
  kind: 'meeting';
  meetingId: string;
  meetingName: string;
  meetingStart: string;
  lead: MeetingDigestLead;
}

/**
 * The stadtweit section, generated once per month and shared verbatim by every
 * district digest. Composed into `DistrictDigest.cityWide` rather than blended by
 * a further model call, so a city topic can never be re-attributed to a district.
 */
export interface CityWideDigest extends DigestRecordBase {
  kind: 'citywide';
  month: string;
  /** Papers offered to the model before it selected; `sourcePapers` is the pool. */
  candidateCount: number;
}

export interface DistrictDigest extends DigestRecordBase {
  kind: 'district';
  district: string;
  /** YYYY-MM covered by this digest. */
  month: string;
  /** Shared stadtweit section; absent when no city-wide digest was generated. */
  cityWide?: DigestBody;
}

export type Digest = MeetingDigest | DistrictDigest | CityWideDigest;

/** One candidate digest before any model call — what `--dry-run` reports. */
export interface DigestTarget {
  key: string;
  heading: string;
  sourceText: string;
  sourcePapers: string[];
  coveredCount: number;
  uncoveredCount: number;
}
