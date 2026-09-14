import { MeetingDigestBody } from '../../types/index.js';

export interface MeetingDigestRequest {
  heading: string;
  sourceText: string;
  /**
   * Conversation id for the `x-opencode-session` header. OpenCode Go answers a
   * request without one with a non-retryable HTTP 400 `MissingSessionID`.
   */
  sessionId: string;
  /** Numeric literals the deterministic grounding check rejected last attempt. */
  numericLiteralsToCorrect?: string[];
}

/**
 * Provider-neutral seam, mirroring `PaperSummarizer`. `model` is a static field
 * because one instance serves every digest of a run.
 */
export interface MeetingDigestWriter {
  readonly providerName: string;
  readonly model: string;
  write(request: MeetingDigestRequest): Promise<MeetingDigestBody>;
}
