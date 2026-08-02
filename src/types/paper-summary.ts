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
}
