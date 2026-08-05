export interface Consultation {
  id: string;
  type: string;
  paper?: string;
  agendaItem: string;
  meeting: string;
  organization: string[];
  role: string;
  authoritative?: boolean;
  created: string;
  modified: string;
}
