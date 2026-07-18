import { File } from './file-type.js';

export interface AgendaItem {
  id: string;
  type: string;
  meeting: string;
  number: string;
  order: number;
  name: string;
  public: boolean;
  consultation?: string;
  result?: string;
  created: string;
  modified: string;
  auxiliaryFile?: File[];
}
