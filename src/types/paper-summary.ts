export interface PaperSummary {
  id: string;
  sourceHash: string;
  promptVersion: string;
  provider: string;
  model: string;
  summary: string;
  keyPoints: string[];
  /**
   * Where each key point comes from, index-aligned with `keyPoints`; `null` where
   * no source was found. Absent on summaries written before `paper-de-v9` and when
   * no key point could be located. Additive to the viewer contract: `keyPoints`
   * stays a plain string array.
   */
  keyPointSources?: (PaperSummaryKeyPointSource | null)[];
  generatedAt: string;
}

/**
 * The attachment passage a key point rests on, located deterministically from a
 * verbatim quote the model returned — never a file or page the model named.
 */
export interface PaperSummaryKeyPointSource {
  /** OParl `File` id of the attachment, as in the paper's `auxiliaryFile`. */
  file: string;
  /** 1-based PDF page, when the extracted text carries page markers. */
  page?: number;
  /** The located passage as it reads in the attachment (whitespace collapsed). */
  quote: string;
}

export interface GeneratedPaperSummary {
  summary: string;
  keyPoints: string[];
  /**
   * The verbatim passage the model quoted for each key point, index-aligned with
   * `keyPoints`; `''` where it gave none. Absent when it gave none at all. Only
   * input to the source lookup — never published as is.
   */
  keyPointQuotes?: string[];
  /**
   * The model that actually answered, when it is not the summarizer's primary
   * one. `PaperSummarizer.model` is a static field, so a summarizer that can
   * fall back to a second model reports the real one here rather than mutating
   * itself — papers are summarized concurrently through one instance.
   */
  provider?: string;
  model?: string;
}
