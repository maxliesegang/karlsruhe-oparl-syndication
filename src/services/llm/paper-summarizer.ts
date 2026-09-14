import { GeneratedPaperSummary } from '../../types/index.js';

export interface PaperSummaryRequest {
  heading: string;
  /**
   * Stable conversation id for the provider. OpenCode Go rejects a request without
   * one (`MissingSessionID`, HTTP 400, not retryable) and uses it to route and to
   * cache the repeated prompt prefix. One paper is one conversation: every chunk,
   * reduction level and corrective retry of a paper shares its id, and the id is
   * derived from the paper so it stays the same across runs.
   */
  sessionId: string;
  /** Structured paper metadata and public consultation history, repeated for every chunk. */
  contextText: string;
  sourceText: string;
  partial: boolean;
  /** Numeric literals rejected by the deterministic grounding check on the previous attempt. */
  numericLiteralsToCorrect?: string[];
}

export interface PaperSummarizer {
  readonly providerName: string;
  readonly model: string;
  summarize(request: PaperSummaryRequest): Promise<GeneratedPaperSummary>;
}
