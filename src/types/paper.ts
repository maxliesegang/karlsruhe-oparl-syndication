import { OParlFile } from './oparl-file.js';
import { Consultation } from './consultation.js';

export interface Paper {
  id: string;
  type: string;
  body: string;
  name: string;
  reference: string;
  date: string;
  paperType: string;
  auxiliaryFile: OParlFile[];
  underDirectionOf: string[];
  consultation: Consultation[];
  /** Set on ~3% of papers, always symmetric with `subordinatedPaper` on the other side. */
  superordinatedPaper?: string[];
  subordinatedPaper?: string[];
  created: string;
  modified: string;
}
