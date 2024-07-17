import { Location } from './location-type';
import { File } from './file-type';
import { AgendaItem } from './agendaItem-type';

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
