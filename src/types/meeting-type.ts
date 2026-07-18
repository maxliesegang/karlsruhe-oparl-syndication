import { Location } from './location-type.js';
import { File } from './file-type.js';
import { AgendaItem } from './agenda-item-type.js';

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
  invitation?: File;
  resultsProtocol?: File;
  auxiliaryFile?: File[];
  agendaItem: AgendaItem[];
}
