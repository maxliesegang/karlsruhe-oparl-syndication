/** Offline comparison against the checked-in index and a small, inspectable review set.
 * Run before changing the district rule. No network calls or writes. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  classifyPaperSources,
  findDistrictsForAuthority,
  KarlsruheDistrict,
  listDistricts,
} from '../karlsruhe-districts.js';
import { PaperDistrictIndex } from '../services/paper-district-index-service.js';
import { Organization, Paper } from '../types/index.js';

interface ReviewCase {
  paper: string;
  district: KarlsruheDistrict;
  local: boolean;
  reason: string;
}

const index = process.argv.includes('--baseline=head')
  ? (JSON.parse(
      execFileSync('git', ['show', 'HEAD:docs/paper-stadtteile.json'], { encoding: 'utf8' }),
    ) as PaperDistrictIndex)
  : readJson<PaperDistrictIndex>('docs/paper-stadtteile.json');
const organizations = new Map(
  readJson<Organization[]>('docs/organizations.json').map((item) => [item.id, item]),
);
const reviews = readJson<ReviewCase[]>('src/spike/fixtures/district-review.json');
const reviewByPaper = new Map<string, ReviewCase[]>();
for (const item of reviews)
  reviewByPaper.set(item.paper, [...(reviewByPaper.get(item.paper) ?? []), item]);

const totals = { papers: 0, oldPairs: 0, newPairs: 0, removed: 0, added: 0 };
const districtTotals = new Map(listDistricts().map((district) => [district, { old: 0, next: 0 }]));
const reviewed = { oldCorrect: 0, newCorrect: 0, count: 0 };
const removals: Array<{ paper: string; title: string; district: string }> = [];
const additions: Array<{ paper: string; title: string; district: string }> = [];
for (const fileName of fs.readdirSync('docs/papers')) {
  if (!fileName.endsWith('.json')) continue;
  const paper = readJson<Paper>(`docs/papers/${fileName}`);
  const key = fileName.slice(0, -5);
  const attachments: Array<{ name: string; text: string }> = [];
  for (const file of paper.auxiliaryFile ?? []) {
    const path = `docs/file-contents/${file.id.split('/').at(-1)}.txt`;
    if (!fs.existsSync(path)) continue;
    attachments.push({ name: file.name ?? '', text: fs.readFileSync(path, 'utf8') });
  }
  const structural = new Set<KarlsruheDistrict>();
  for (const consultation of paper.consultation ?? []) {
    for (const id of consultation.organization ?? []) {
      const name = organizations.get(id)?.name;
      if (name) for (const district of findDistrictsForAuthority(name)) structural.add(district);
    }
  }
  const next = new Set(
    classifyPaperSources({
      title: paper.name,
      attachments,
      structural,
    }).primary,
  );
  const previous = new Set(index.papers[key]?.primary ?? []);
  totals.papers++;
  totals.oldPairs += previous.size;
  totals.newPairs += next.size;
  totals.removed += [...previous].filter((district) => !next.has(district)).length;
  totals.added += [...next].filter((district) => !previous.has(district)).length;
  for (const district of previous) districtTotals.get(district)!.old++;
  for (const district of next) districtTotals.get(district)!.next++;
  for (const district of previous) {
    if (!next.has(district)) removals.push({ paper: key, title: paper.name, district });
  }
  for (const district of next) {
    if (!previous.has(district)) additions.push({ paper: key, title: paper.name, district });
  }
  for (const review of reviewByPaper.get(key) ?? []) {
    reviewed.count++;
    if (previous.has(review.district) === review.local) reviewed.oldCorrect++;
    if (next.has(review.district) === review.local) reviewed.newCorrect++;
    if (previous.has(review.district) !== next.has(review.district)) {
      console.log(
        `${key} ${review.district}: ${previous.has(review.district) ? 'primary' : 'other'} -> ${next.has(review.district) ? 'primary' : 'other'}; expected ${review.local ? 'local' : 'other'}`,
      );
    }
  }
}
console.log(JSON.stringify({ baselineVersion: index.version, totals, reviewed }, null, 2));
if (process.argv.includes('--districts')) {
  console.log(JSON.stringify(Object.fromEntries(districtTotals), null, 2));
}
if (process.argv.includes('--samples')) {
  console.log(
    JSON.stringify(
      {
        removed: removals
          .filter((_, index) => index % Math.max(1, Math.floor(removals.length / 30)) === 0)
          .slice(0, 30),
        added: additions
          .filter((_, index) => index % Math.max(1, Math.floor(additions.length / 30)) === 0)
          .slice(0, 30),
      },
      null,
      2,
    ),
  );
}

function readJson<T>(path: string): T {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as T;
}
