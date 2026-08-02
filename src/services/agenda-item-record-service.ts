import {
  AgendaItem,
  Meeting,
  OParlFile,
  Organization,
  Paper,
  PaperSummary,
} from '../types/index.js';
import { KarlsruheDistrict, PaperDistrictIndex } from '../karlsruhe-districts.js';
import { stores } from '../store/index.js';
import { latestValidDate, parseValidDate } from '../utils.js';

export interface AgendaItemRecordOptions {
  districtIndex?: PaperDistrictIndex;
  fallbackDate?: Date;
  resolvePaper?: (consultationId: string) => Paper | undefined;
  resolveOrganization?: (organizationId: string) => Organization | undefined;
  resolvePaperSummary?: (paper: Paper) => PaperSummary | undefined;
}

/**
 * Joined representation used by every public output. Keeping resolution here
 * prevents the full, recent, committee and district feeds from drifting apart.
 */
export interface AgendaItemRecord {
  agendaItem: AgendaItem;
  meeting: Meeting;
  paper?: Paper;
  paperSummary?: PaperSummary;
  attachments: OParlFile[];
  organizations: OrganizationReference[];
  districts: KarlsruheDistrict[];
  updatedAt: Date;
  publishedAt: Date;
}

export interface OrganizationReference {
  id: string;
  name: string;
  organization?: Organization;
}

const FALLBACK_DATE = new Date(0);

/** Build deterministic, public agenda-item records from the archived stores. */
export function buildAgendaItemRecords(
  meetings: Meeting[],
  options: AgendaItemRecordOptions = {},
): AgendaItemRecord[] {
  const districtIndex = options.districtIndex ?? {};
  const fallbackDate = options.fallbackDate ?? FALLBACK_DATE;
  const resolvePaper =
    options.resolvePaper ?? ((id: string) => stores.papers.getPaperByConsultationId(id));
  const resolveOrganization =
    options.resolveOrganization ?? ((id: string) => stores.organizations.getById(id));
  const resolvePaperSummary = options.resolvePaperSummary ?? (() => undefined);
  const records: AgendaItemRecord[] = [];

  for (const meeting of meetings) {
    for (const agendaItem of meeting.agendaItem ?? []) {
      if (agendaItem.public !== true || !agendaItem.number) continue;
      records.push(
        buildRecord(
          meeting,
          agendaItem,
          districtIndex,
          fallbackDate,
          resolvePaper,
          resolveOrganization,
          resolvePaperSummary,
        ),
      );
    }
  }

  return records.sort(
    (a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime() ||
      a.agendaItem.id.localeCompare(b.agendaItem.id),
  );
}

function buildRecord(
  meeting: Meeting,
  agendaItem: AgendaItem,
  districtIndex: PaperDistrictIndex,
  fallbackDate: Date,
  resolvePaper: (consultationId: string) => Paper | undefined,
  resolveOrganization: (organizationId: string) => Organization | undefined,
  resolvePaperSummary: (paper: Paper) => PaperSummary | undefined,
): AgendaItemRecord {
  const paper = agendaItem.consultation ? resolvePaper(agendaItem.consultation) : undefined;
  const attachmentsById = new Map<string, OParlFile>();

  for (const file of agendaItem.auxiliaryFile ?? []) attachmentsById.set(file.id, file);
  for (const file of paper?.auxiliaryFile ?? []) attachmentsById.set(file.id, file);
  const attachments = [...attachmentsById.values()];

  const itemCreated = parseValidDate(agendaItem.created);
  const itemModified = parseValidDate(agendaItem.modified);
  const updatedAt =
    latestValidDate(
      itemModified,
      itemCreated,
      meeting.modified,
      meeting.created,
      paper?.modified,
      paper?.created,
      ...attachments.flatMap((file) => [file.modified, file.created]),
    ) ??
    parseValidDate(meeting.start) ??
    fallbackDate;

  return {
    agendaItem,
    meeting,
    paper,
    paperSummary: paper ? resolvePaperSummary(paper) : undefined,
    attachments,
    organizations: [...new Set(meeting.organization ?? [])].map((id) =>
      toOrganizationReference(id, resolveOrganization(id)),
    ),
    districts: paper?.reference ? [...(districtIndex[paper.reference] ?? [])] : [],
    updatedAt,
    publishedAt: itemCreated ?? itemModified ?? updatedAt,
  };
}

function toOrganizationReference(
  id: string,
  organization: Organization | undefined,
): OrganizationReference {
  return {
    id,
    name: organization?.name || organization?.shortName || id.split('/').pop() || id,
    organization,
  };
}
