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
  created: string;
  modified: string;
}
