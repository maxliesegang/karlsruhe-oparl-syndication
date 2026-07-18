/** Official Karlsruhe district names indexed in feed paper content. */
const KARLSRUHE_DISTRICTS = [
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

export type KarlsruheDistrict = (typeof KARLSRUHE_DISTRICTS)[number];

interface DistrictSearchPattern {
  expression: RegExp;
  district: KarlsruheDistrict;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDistrictSearchPatterns(): DistrictSearchPattern[] {
  const patterns: DistrictSearchPattern[] = [];

  for (const district of KARLSRUHE_DISTRICTS) {
    // Full name — allow hyphen, space, or en-dash between compound parts
    const escaped = escapeRegularExpression(district).replace(/-/g, '[-\\s–]');
    patterns.push({
      expression: new RegExp(`\\b${escaped}\\b`, 'i'),
      district,
    });

    // Sub-parts of compound names (except Innenstadt-* where parts are too generic)
    if (district.includes('-') && !district.startsWith('Innenstadt')) {
      for (const part of district.split('-')) {
        patterns.push({
          expression: new RegExp(`\\b${escapeRegularExpression(part)}\\b`, 'i'),
          district,
        });
      }
    }
  }

  return patterns;
}

const districtSearchPatterns = buildDistrictSearchPatterns();

export function findKarlsruheDistricts(text: string): KarlsruheDistrict[] {
  const matchingDistricts = new Set<KarlsruheDistrict>();
  for (const { expression, district } of districtSearchPatterns) {
    if (expression.test(text)) {
      matchingDistricts.add(district);
    }
  }
  return [...matchingDistricts].sort();
}
