import fs from 'fs/promises';

import { config } from './config.js';
import {
  COMMITTEE_FEED_DIRECTORY,
  DISTRICT_FEED_DIRECTORY,
  FILTERED_FEED_INDEX_FILE_NAME,
  FilteredFeedDescriptor,
  FilteredFeedType,
  slugifyFeedSegment,
} from './filtered-feed-contract.js';
import { buildAgendaFeed, FeedMetadata, writeFeedFile } from './feed.js';
import { atomicWriteFile, canonicalStringify, docsPath, recordBasename } from './docs-files.js';
import { logger } from './logger.js';
import { AgendaItemRecord, OrganizationReference } from './services/agenda-item-record-service.js';

interface FeedGroup {
  type: FilteredFeedType;
  id: string;
  title: string;
  description: string;
  path: string;
  records: AgendaItemRecord[];
}

/** Generate discoverable Atom feeds for every referenced committee and Stadtteil. */
export async function writeFilteredFeeds(
  records: AgendaItemRecord[],
  maximumItemCount = config.feedMaxItemCount,
): Promise<FilteredFeedDescriptor[]> {
  const groups = buildFilteredFeedGroups(records, maximumItemCount);

  // Serialize one feed at a time. The largest committee feed is tens of MiB, so
  // bounded memory is more valuable here than opening every output concurrently.
  for (const group of groups) {
    const metadata = createFeedMetadata(group);
    const feed = buildAgendaFeed(group.records, { metadata, logProgress: false });
    await writeFeedFile(feed, group.path);
  }

  await removeOrphanFeedFiles(COMMITTEE_FEED_DIRECTORY, groups);
  await removeOrphanFeedFiles(DISTRICT_FEED_DIRECTORY, groups);

  const descriptors = groups.map(toDescriptor);
  await atomicWriteFile(docsPath(FILTERED_FEED_INDEX_FILE_NAME), canonicalStringify(descriptors));
  logger.info(`Generated ${descriptors.length} filtered feed(s).`);
  return descriptors;
}

export function buildFilteredFeedGroups(
  records: AgendaItemRecord[],
  maximumItemCount = config.feedMaxItemCount,
): FeedGroup[] {
  if (!Number.isSafeInteger(maximumItemCount) || maximumItemCount <= 0) {
    throw new Error(`maximumItemCount must be a positive integer: ${maximumItemCount}`);
  }
  const groups = [
    ...buildCommitteeGroups(records, maximumItemCount),
    ...buildDistrictGroups(records, maximumItemCount),
  ].sort((a, b) => a.path.localeCompare(b.path));
  assertUniqueFeedPaths(groups);
  return groups;
}

function buildCommitteeGroups(records: AgendaItemRecord[], maximumItemCount: number): FeedGroup[] {
  const grouped = new Map<
    string,
    { organization: OrganizationReference; records: AgendaItemRecord[] }
  >();
  for (const record of records) {
    for (const organization of record.organizations) {
      const group = grouped.get(organization.id) ?? { organization, records: [] };
      if (group.records.length < maximumItemCount) group.records.push(record);
      grouped.set(organization.id, group);
    }
  }

  return [...grouped.values()].map(({ organization, records: groupRecords }) => ({
    type: 'committee',
    id: organization.id,
    title: `Tagesordnungspunkte – ${organization.name}`,
    description: `Öffentliche Tagesordnungspunkte des Gremiums ${organization.name}`,
    path: `${COMMITTEE_FEED_DIRECTORY}/${recordBasename(organization.id)}.xml`,
    records: groupRecords,
  }));
}

function buildDistrictGroups(records: AgendaItemRecord[], maximumItemCount: number): FeedGroup[] {
  const grouped = new Map<string, AgendaItemRecord[]>();
  for (const record of records) {
    for (const district of record.districts) {
      const group = grouped.get(district) ?? [];
      if (group.length < maximumItemCount) group.push(record);
      grouped.set(district, group);
    }
  }

  return [...grouped.entries()].map(([district, groupRecords]) => ({
    type: 'district',
    id: district,
    title: `Tagesordnungspunkte – ${district}`,
    description: `Öffentliche Tagesordnungspunkte mit Bezug zum Stadtteil ${district}`,
    path: `${DISTRICT_FEED_DIRECTORY}/${slugifyFeedSegment(district)}.xml`,
    records: groupRecords,
  }));
}

function createFeedMetadata(group: FeedGroup): FeedMetadata {
  const url = new URL(group.path, config.feedBaseUrl).href;
  return {
    title: group.title,
    description: group.description,
    id: url,
    link: url,
    selfLink: url,
  };
}

function toDescriptor(group: FeedGroup): FilteredFeedDescriptor {
  return {
    type: group.type,
    id: group.id,
    title: group.title,
    path: group.path,
    url: new URL(group.path, config.feedBaseUrl).href,
    entryCount: group.records.length,
  };
}

function assertUniqueFeedPaths(groups: FeedGroup[]): void {
  const idByPath = new Map<string, string>();
  for (const group of groups) {
    const previousId = idByPath.get(group.path);
    if (previousId && previousId !== group.id) {
      throw new Error(
        `Filtered feed filename collision: ${previousId} and ${group.id} both map to ${group.path}`,
      );
    }
    idByPath.set(group.path, group.id);
  }
}

async function removeOrphanFeedFiles(directory: string, groups: FeedGroup[]): Promise<void> {
  const expected = new Set(
    groups.filter((group) => group.path.startsWith(`${directory}/`)).map((group) => group.path),
  );
  let entries: string[];
  try {
    entries = await fs.readdir(docsPath(directory));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.xml')) continue;
    const relativePath = `${directory}/${entry}`;
    if (!expected.has(relativePath)) await fs.unlink(docsPath(relativePath));
  }
}
