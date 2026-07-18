import { Location } from './location.js';
import { OParlFile } from './oparl-file.js';
import { AgendaItem } from './agenda-item.js';

export interface Meeting {
  id: string;
  type: string;
  name: string;
  start: string;
  end: string;
  location: Location;
  organization: string[];
  created: string;
  modified: string;
  invitation?: OParlFile;
  resultsProtocol?: OParlFile;
  auxiliaryFile?: OParlFile[];
  agendaItem: AgendaItem[];
}
