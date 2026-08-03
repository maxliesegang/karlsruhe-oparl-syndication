import {
  AgendaItem,
  Meeting,
  OParlFile,
  Organization,
  Paper,
  PaperSummary,
} from '../types/index.js';
import { KarlsruheDistrict } from '../karlsruhe-districts.js';
import {
  createMemoizedPaperSubmitterResolver,
  FactionId,
  PaperSubmitterResolver,
} from '../paper-submitters.js';
import { stores } from '../store/index.js';
import { latestValidDate, parseValidDate } from '../utils.js';

export interface AgendaItemRecordOptions {
  resolvePaperDistricts?: (paper: Paper) => KarlsruheDistrict[];
  fallbackDate?: Date;
  resolvePaper?: (consultationId: string) => Paper | undefined;
  resolveOrganization?: (organizationId: string) => Organization | undefined;
  resolvePaperSummary?: (paper: Paper) => PaperSummary | undefined;
  resolvePaperSubmitters?: PaperSubmitterResolver<Paper>;
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
  /**
   * Districts the paper is *about*. Weaker "named in passing" matches are kept out
   * of every feed and live only in `docs/paper-stadtteile.json`, so a Stadtteil
   * subscriber is not sent every citywide paper that lists the Ortschaften.
   */
  districts: KarlsruheDistrict[];
  /** Factions that submitted the paper; empty for administration papers. */
  submitters: FactionId[];
  updatedAt: Date;
  publishedAt: Date;
}

export interface OrganizationReference {
  id: string;
  name: string;
  organization?: Organization;
}

const FALLBACK_DATE = new Date(0);

interface ResolvedRecordOptions {
  resolvePaperDistricts: (paper: Paper) => KarlsruheDistrict[];
  fallbackDate: Date;
  resolvePaper: (consultationId: string) => Paper | undefined;
  resolveOrganization: (organizationId: string) => Organization | undefined;
  resolvePaperSummary: (paper: Paper) => PaperSummary | undefined;
  resolvePaperSubmitters: PaperSubmitterResolver<Paper>;
}

/**
 * Submitters are parsed from extracted PDF text, and the same paper is consulted by
 * several agenda items, so the result is memoized for the lifetime of one build.
 */
function resolveOptions(options: AgendaItemRecordOptions): ResolvedRecordOptions {
  return {
    resolvePaperDistricts: options.resolvePaperDistricts ?? (() => []),
    fallbackDate: options.fallbackDate ?? FALLBACK_DATE,
    resolvePaper:
      options.resolvePaper ?? ((id: string) => stores.papers.getPaperByConsultationId(id)),
    resolveOrganization:
      options.resolveOrganization ?? ((id: string) => stores.organizations.getById(id)),
    resolvePaperSummary: options.resolvePaperSummary ?? (() => undefined),
    resolvePaperSubmitters:
      options.resolvePaperSubmitters ??
      createMemoizedPaperSubmitterResolver(
        (fileId) => stores.fileContents.getById(fileId)?.extractedText,
      ),
  };
}

/** Build deterministic, public agenda-item records from the archived stores. */
export function buildAgendaItemRecords(
  meetings: Meeting[],
  options: AgendaItemRecordOptions = {},
): AgendaItemRecord[] {
  const resolved = resolveOptions(options);
  const records: AgendaItemRecord[] = [];

  for (const meeting of meetings) {
    for (const agendaItem of meeting.agendaItem ?? []) {
      if (agendaItem.public !== true || !agendaItem.number) continue;
      records.push(buildRecord(meeting, agendaItem, resolved));
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
  options: ResolvedRecordOptions,
): AgendaItemRecord {
  const {
    resolvePaperDistricts,
    fallbackDate,
    resolvePaper,
    resolveOrganization,
    resolvePaperSummary,
    resolvePaperSubmitters,
  } = options;
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
    districts: paper ? [...resolvePaperDistricts(paper)] : [],
    submitters: paper ? resolvePaperSubmitters(paper) : [],
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
