import { File } from './file-type';
import { Consultation } from './consultation-type';

export interface Paper {
  id: string;
  type: string;
  body: string;
  name: string;
  reference: string;
  date: string;
  paperType: string;
  auxiliaryFile: File[];
  underDirectionOf: string[];
  consultation: Consultation[];
  created: string;
  modified: string;
}
