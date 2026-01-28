import { File } from './file-type';
import { Consultation } from './consultation-type';

export type AuxiliaryFile = File;

export interface Paper {
  id: string;
  type: string;
  body: string;
  name: string;
  reference: string;
  date: string;
  paperType: string;
  auxiliaryFile: AuxiliaryFile[];
  underDirectionOf: string[];
  consultation: Consultation[];
  created: string;
  modified: string;
}
