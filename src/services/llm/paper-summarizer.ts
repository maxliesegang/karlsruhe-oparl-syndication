import { GeneratedPaperSummary } from '../../types/index.js';

export interface PaperSummaryRequest {
  heading: string;
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
