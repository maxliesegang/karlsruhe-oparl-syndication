export interface PaperSummary {
  id: string;
  sourceHash: string;
  promptVersion: string;
  provider: string;
  model: string;
  summary: string;
  keyPoints: string[];
  generatedAt: string;
}

export interface GeneratedPaperSummary {
  summary: string;
  keyPoints: string[];
  /**
   * The model that actually answered, when it is not the summarizer's primary
   * one. `PaperSummarizer.model` is a static field, so a summarizer that can
   * fall back to a second model reports the real one here rather than mutating
   * itself — papers are summarized concurrently through one instance.
   */
  provider?: string;
  model?: string;
}
