/**
 * Detection of Karlsruhe Stadtteile in paper titles and extracted PDF text.
 *
 * Matching is deliberately two-staged. {@link findDistrictMentions}
 * reports *where* every name occurs; {@link classifyPaperDistricts} decides which
 * of those occurrences actually make a paper about a district. Plain "is the name
 * present anywhere" is far too loose: administration papers carry consultation and
 * distribution lists that name most Ortschaften at once, which put the five small
 * Bergdörfer into the top of the archive-wide district ranking despite the papers
 * having nothing to do with them.
 */

/**
 * The 27 official Stadtteile, plus `Innenstadt` as a synthetic parent.
 *
 * `Innenstadt` is not an official Stadtteil — the two official ones are
 * `Innenstadt-Ost` and `Innenstadt-West`. But 1.8k extracted texts say plain
 * "Innenstadt" and never qualify it, and there is no way to infer the half. A
 * parent entry makes those papers addressable instead of silently unmatched;
 * mapping them to both halves would instead inflate two feeds with papers that
 * may concern neither.
 */
const KARLSRUHE_DISTRICTS = [
  'Innenstadt',
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

/** Published so a viewer can render a stable filter list. */
export function listDistricts(): KarlsruheDistrict[] {
  return [...KARLSRUHE_DISTRICTS].sort();
}

/**
 * Additional spellings that name a district without repeating its official name.
 *
 * These are Ortsteile, Siedlungen and the collective name of a joint Ortschaft —
 * all of them distinctive proper nouns, so a bare word-boundary match is safe.
 * Deliberately *not* listed: `Aue` (Durlach's Ortsteil), because "Aue" is an
 * ordinary German word and appears in 630 texts; only the qualified
 * `Durlach-Aue` is unambiguous.
 */
const DISTRICT_ALIASES: ReadonlyArray<readonly [string, readonly KarlsruheDistrict[]]> = [
  // Ortschaft Wettersbach is Grünwettersbach + Palmbach. It is the name the
  // Ortsverwaltung and Ortschaftsrat actually carry, and 1.4k texts use it.
  ['Wettersbach', ['Grünwettersbach', 'Palmbach']],
  ['Bergwald', ['Wolfartsweier']],
  ['Geigersberg', ['Wolfartsweier']],
  ['Killisfeld', ['Durlach']],
  ['Durlach-Aue', ['Durlach']],
  ['Kirchfeld', ['Neureut']],
  ['Hardtwaldsiedlung', ['Neureut']],
  ['Heidenstückersiedlung', ['Rüppurr']],
];

/**
 * German adjectival forms (`Durlacher`, `Rüppurrer`, …). Roughly 2k texts use one
 * without ever writing the base name, so ignoring them costs real recall — but the
 * most frequent uses by far are street names for roads *leading to* a district
 * from somewhere else: `Durlacher Allee` is in the Oststadt, `Rüppurrer Straße` in
 * the Südstadt. Each of these is therefore matched only when it is not followed by
 * a street-name head (see {@link STREET_NAME_GUARD}).
 *
 * The forms are irregular (`Grötzingen` → `Grötzinger`, `Daxlanden` → `Daxlander`,
 * `Grünwinkel` → `Grünwinkler`), so they are listed rather than derived.
 */
const DISTRICT_ADJECTIVES: ReadonlyArray<readonly [string, readonly KarlsruheDistrict[]]> = [
  ['Durlacher', ['Durlach']],
  ['Grötzinger', ['Grötzingen']],
  ['Neureuter', ['Neureut']],
  ['Mühlburger', ['Mühlburg']],
  ['Rüppurrer', ['Rüppurr']],
  ['Knielinger', ['Knielingen']],
  ['Daxlander', ['Daxlanden']],
  ['Hagsfelder', ['Hagsfeld']],
  ['Rintheimer', ['Rintheim']],
  ['Beiertheimer', ['Beiertheim-Bulach']],
  ['Bulacher', ['Beiertheim-Bulach']],
  ['Stupfericher', ['Stupferich']],
  ['Palmbacher', ['Palmbach']],
  ['Grünwinkler', ['Grünwinkel']],
  ['Oberreuter', ['Oberreut']],
  ['Waldstädter', ['Waldstadt']],
  ['Wolfartsweierer', ['Wolfartsweier']],
  ['Hohenwettersbacher', ['Hohenwettersbach']],
  ['Grünwettersbacher', ['Grünwettersbach']],
  ['Wettersbacher', ['Grünwettersbach', 'Palmbach']],
];

/**
 * Heads of Karlsruhe street and area names that follow a district adjective while
 * denoting a place outside that district. `Mühlburger Feld` and `Beiertheimer Feld`
 * are quarters of the Nordweststadt and Südweststadt respectively, so `Feld` earns
 * its place here alongside the ordinary street heads.
 */
const STREET_NAME_GUARD =
  '(?![-\\s]*(?:Str(?:aße|asse|\\.|\\b)|Allee|Weg\\b|Tor\\b|Platz|Ring\\b|Chaussee|Feld\\b|Wald\\b))';

/** A run this dense with distinct district names is a list, not a subject. */
const ENUMERATION_WINDOW_CHARS = 400;
const ENUMERATION_MIN_DISTINCT_DISTRICTS = 8;
/** Title, addressee and subject line of a paper live well inside this prefix. */
const LEAD_TEXT_CHARS = 1500;
/** Below this, a body-only district is a passing reference rather than a subject. */
const PRIMARY_MIN_BODY_MENTIONS = 2;

/** Committees whose name identifies the district they speak for. */
const DISTRICT_AUTHORITY_NAME = /^(?:Ortschaftsrat|Ortsverwaltung)\b/;

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compound names are written with a hyphen, a space or an en-dash in the wild. */
function compoundSeparators(escaped: string): string {
  return escaped.replace(/-/g, '[-\\s–]');
}

interface AliasPattern {
  /** Regex source, without anchors. */
  source: string;
  /** Lowercased literal with separators normalised to `-`, used to resolve a hit. */
  key: string;
  districts: readonly KarlsruheDistrict[];
}

function buildAliasPatterns(): AliasPattern[] {
  const patterns: AliasPattern[] = [];
  const add = (literal: string, districts: readonly KarlsruheDistrict[], guard = ''): void => {
    patterns.push({
      source: compoundSeparators(escapeRegularExpression(literal)) + guard,
      key: literal.toLowerCase(),
      districts,
    });
  };

  for (const district of KARLSRUHE_DISTRICTS) {
    add(district, [district]);

    // Distinctive halves of a compound name stand in for the whole district.
    // Innenstadt-* is excluded: its parts are the generic `Innenstadt` (handled as
    // its own entry) and the bare cardinal directions.
    if (district.includes('-') && !district.startsWith('Innenstadt')) {
      for (const part of district.split('-')) add(part, [district]);
    }
  }

  for (const [literal, districts] of DISTRICT_ALIASES) add(literal, districts);
  for (const [literal, districts] of DISTRICT_ADJECTIVES)
    add(literal, districts, STREET_NAME_GUARD);

  return patterns;
}

const aliasPatterns = buildAliasPatterns();

const districtsByAliasKey = new Map<string, readonly KarlsruheDistrict[]>(
  aliasPatterns.map((pattern) => [pattern.key, pattern.districts]),
);

/**
 * One combined alternation rather than one regex per name: it is ~4.5x faster over
 * the archive's 290 MB of extracted text (1.2 s vs 5.2 s for a full rebuild) and,
 * unlike a per-name `test()`, it yields match positions — which is what the
 * enumeration and lead-text rules below are built on.
 *
 * Alternatives are sorted longest-first so that regex alternation, which is
 * leftmost-first rather than longest-match, consumes `Innenstadt-Ost` whole
 * instead of stopping at `Innenstadt`.
 */
const districtExpression = new RegExp(
  `\\b(${[...aliasPatterns]
    .sort((a, b) => b.key.length - a.key.length)
    .map((pattern) => pattern.source)
    .join('|')})\\b`,
  'gi',
);

export interface DistrictMention {
  district: KarlsruheDistrict;
  /** Character offset of the matched name within the searched text. */
  index: number;
  /**
   * The mention sits in a run naming many districts at once — a consultation or
   * distribution list — so it says nothing about what the paper is about.
   */
  inEnumeration: boolean;
}

/** Every district name occurrence in one document, in order of appearance. */
export function findDistrictMentions(text: string): DistrictMention[] {
  const mentions: DistrictMention[] = [];
  districtExpression.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = districtExpression.exec(text)) !== null) {
    const key = match[1].toLowerCase().replace(/[\s–]/g, '-');
    const districts = districtsByAliasKey.get(key);
    if (!districts) continue;
    for (const district of districts) {
      mentions.push({ district, index: match.index, inEnumeration: false });
    }
  }

  markEnumerations(mentions);
  return mentions;
}

/**
 * Flags every mention inside a sliding window that names enough distinct districts
 * to be a list. 248 of the archive's extracted texts contain such a window, and
 * they are what put 84 papers into all 27 district feeds at once.
 */
function markEnumerations(mentions: DistrictMention[]): void {
  for (let start = 0; start < mentions.length; start++) {
    const distinct = new Set<KarlsruheDistrict>();
    let end = start;
    while (
      end < mentions.length &&
      mentions[end].index - mentions[start].index < ENUMERATION_WINDOW_CHARS
    ) {
      distinct.add(mentions[end].district);
      end++;
    }
    if (distinct.size < ENUMERATION_MIN_DISTINCT_DISTRICTS) continue;
    for (let inside = start; inside < end; inside++) mentions[inside].inEnumeration = true;
  }
}

/**
 * Distinct districts named anywhere in the text, sorted. Kept for callers that
 * only need presence (organization names, tests); paper classification should use
 * {@link classifyPaperDistricts}, which weighs where the mention occurred.
 */
export function findDistricts(text: string): KarlsruheDistrict[] {
  return [...new Set(findDistrictMentions(text).map((mention) => mention.district))].sort();
}

/**
 * Districts a committee speaks for, derived from its name.
 *
 * `Ortschaftsrat Durlach` consulting a paper is far stronger evidence than any
 * text match, and it comes straight from the OParl record. Restricted to the two
 * name prefixes that actually denote a district authority so that an ordinary
 * committee cannot claim a district by coincidence.
 */
export function findDistrictsForAuthority(organizationName: string): KarlsruheDistrict[] {
  if (!DISTRICT_AUTHORITY_NAME.test(organizationName)) return [];
  return findDistricts(organizationName);
}

export interface DistrictClassificationInput {
  /** The paper's own title. */
  title?: string;
  /** Extracted text of the paper's attachments, one entry per file. */
  bodies?: readonly string[];
  /** Districts asserted by the record itself; always primary. */
  structural?: Iterable<KarlsruheDistrict>;
}

export interface DistrictClassification {
  /** The paper is about these. Drives the district feeds and Atom categories. */
  primary: KarlsruheDistrict[];
  /** Named in passing only. Published for viewers, kept out of the feeds. */
  mentioned: KarlsruheDistrict[];
}

interface DistrictEvidence {
  structural: boolean;
  title: number;
  lead: number;
  body: number;
}

/**
 * Splits detected districts into what the paper is about and what it merely names.
 *
 * A district is primary when the record asserts it (an Ortschaftsrat consultation),
 * when the title names it, when an attachment names it in its lead text, or when it
 * recurs in the body. A single passing mention deep inside one attachment — 38 % of
 * all detected paper/district pairs before this rule — is reported as `mentioned`
 * instead, and matches that occur only inside an enumeration are dropped outright.
 */
export function classifyPaperDistricts(input: DistrictClassificationInput): DistrictClassification {
  const evidence = new Map<KarlsruheDistrict, DistrictEvidence>();
  const entry = (district: KarlsruheDistrict): DistrictEvidence => {
    const existing = evidence.get(district);
    if (existing) return existing;
    const created = { structural: false, title: 0, lead: 0, body: 0 };
    evidence.set(district, created);
    return created;
  };

  for (const district of input.structural ?? []) entry(district).structural = true;

  // A title is too short to enumerate, so every hit in it counts.
  for (const mention of findDistrictMentions(input.title ?? '')) {
    entry(mention.district).title++;
  }

  for (const body of input.bodies ?? []) {
    for (const mention of findDistrictMentions(body)) {
      if (mention.inEnumeration) continue;
      const found = entry(mention.district);
      found.body++;
      if (mention.index < LEAD_TEXT_CHARS) found.lead++;
    }
  }

  const primary: KarlsruheDistrict[] = [];
  const mentioned: KarlsruheDistrict[] = [];
  for (const [district, found] of evidence) {
    if (
      found.structural ||
      found.title > 0 ||
      found.lead > 0 ||
      found.body >= PRIMARY_MIN_BODY_MENTIONS
    ) {
      primary.push(district);
    } else if (found.body > 0) {
      mentioned.push(district);
    }
  }

  return { primary: primary.sort(), mentioned: mentioned.sort() };
}
