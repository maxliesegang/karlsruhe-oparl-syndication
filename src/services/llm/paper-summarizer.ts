import { GeneratedPaperSummary } from '../../types/index.js';

export interface PaperSummaryRequest {
  heading: string;
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
