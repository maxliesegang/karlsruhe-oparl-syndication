const KARLSRUHE_STADTTEILE = [
  'Innenstadt-Ost',
  'Innenstadt-West',
  'Südstadt',
  'Südweststadt',
  'Weststadt',
  'Nordweststadt',
  'Oststadt',
  'Mühlburg',
  'Daxlanden',
  'Knielingen',
  'Grünwinkel',
  'Oberreut',
  'Beiertheim-Bulach',
  'Weiherfeld-Dammerstock',
  'Rüppurr',
  'Waldstadt',
  'Rintheim',
  'Hagsfeld',
  'Durlach',
  'Grötzingen',
  'Stupferich',
  'Hohenwettersbach',
  'Wolfartsweier',
  'Grünwettersbach',
  'Palmbach',
  'Neureut',
  'Nordstadt',
] as const;

export type Stadtteil = (typeof KARLSRUHE_STADTTEILE)[number];

interface SearchPattern {
  regex: RegExp;
  stadtteil: Stadtteil;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchPatterns(): SearchPattern[] {
  const patterns: SearchPattern[] = [];

  for (const stadtteil of KARLSRUHE_STADTTEILE) {
    // Full name — allow hyphen, space, or en-dash between compound parts
    const escaped = escapeRegex(stadtteil).replace(/\\-/g, '[-\\s–]');
    patterns.push({
      regex: new RegExp(`\\b${escaped}\\b`, 'i'),
      stadtteil,
    });

    // Sub-parts of compound names (except Innenstadt-* where parts are too generic)
    if (stadtteil.includes('-') && !stadtteil.startsWith('Innenstadt')) {
      for (const part of stadtteil.split('-')) {
        patterns.push({
          regex: new RegExp(`\\b${escapeRegex(part)}\\b`, 'i'),
          stadtteil,
        });
      }
    }
  }

  return patterns;
}

const searchPatterns = buildSearchPatterns();

export function findStadtteile(text: string): Stadtteil[] {
  const found = new Set<Stadtteil>();
  for (const { regex, stadtteil } of searchPatterns) {
    if (regex.test(text)) {
      found.add(stadtteil);
    }
  }
  return [...found].sort();
}
