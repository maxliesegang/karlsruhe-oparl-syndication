import { Location } from './locationType';
import { File } from './fileType';
import { AgendaItem } from './agendaItemType';

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
