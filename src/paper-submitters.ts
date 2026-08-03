import { Paper } from './types/index.js';

/**
 * Karlsruhe's OParl endpoint never populates `originatorPerson` /
 * `originatorOrganization`, and `docs/organizations.json` contains no factions at
 * all — only administrative units and council bodies. `underDirectionOf` names the
 * department that answers a paper, not who submitted it. The submitting faction is
 * therefore only available as text in the letterhead of the paper's own PDFs, which
 * this module parses.
 */

interface FactionDefinition {
  /**
   * Stable identifier for this faction. There is no OParl id to borrow — the API
   * models no faction entity of any kind — so these are ours and are the join key
   * consumers should use. Hand-written rather than slugified from `name`, so that
   * renaming the display name never moves the identifier. **Never change or reuse
   * an id**; retire one by leaving it in place with its aliases removed.
   */
  readonly id: string;
  /** Display name, as printed on submitted papers. Safe to change. */
  readonly name: string;
  /** Spellings seen in the archive. Joint submissions such as "FDP/FW" are not
   *  listed here: they resolve to their individual parties by plain scanning. */
  readonly aliases: readonly string[];
  /** Match case-sensitively. Set for acronyms that collide with ordinary German
   *  words — without it, "für" in a subject line would be read as the FÜR group. */
  readonly caseSensitive?: boolean;
}

const FACTION_DEFINITIONS = [
  {
    id: 'gruene',
    name: 'GRÜNE',
    aliases: [
      'Bündnis 90/Die Grünen',
      "B'90/DIE GRÜNEN",
      'B´90/DIE GRÜNEN',
      'B’90/DIE GRÜNEN',
      'DIE GRÜNEN',
      // No bare "GRÜNEN": it never appears alone as a submitter but does appear as
      // an inflection in subject lines ("zur Grünen Mitte").
      'GRÜNE',
      'GRUENE',
    ],
  },
  { id: 'cdu', name: 'CDU', aliases: ['CDU'] },
  { id: 'spd', name: 'SPD', aliases: ['SPD'] },
  { id: 'afd', name: 'AfD', aliases: ['AfD-Gruppe', 'AfD'] },
  { id: 'fdp', name: 'FDP', aliases: ['FDP'] },
  { id: 'fw', name: 'FW', aliases: ['Freie Wähler', 'FW'] },
  { id: 'fuer', name: 'FÜR', aliases: ['FÜR Karlsruhe', 'FÜR'], caseSensitive: true },
  { id: 'kal', name: 'KAL', aliases: ['KAL'] },
  // Case-sensitive so the adjective "linke" is not read as the party.
  {
    id: 'die-linke',
    name: 'Die Linke',
    aliases: ['DIE LINKE', 'Die Linke', 'LINKE', 'Linke'],
    caseSensitive: true,
  },
  { id: 'volt', name: 'Volt', aliases: ['Volt'] },
  { id: 'die-partei', name: 'Die PARTEI', aliases: ['Die PARTEI', 'DiePartei'] },
  { id: 'kult', name: 'KULT', aliases: ['KULT'] },
  { id: 'gfk', name: 'GfK', aliases: ['GfK'] },
  { id: 'mfg', name: 'MfG', aliases: ['MfG'] },
  { id: 'buergerliste', name: 'Bürgerliste', aliases: ['Bürgerliste'] },
] as const satisfies readonly FactionDefinition[];

/** Stable faction identifier, e.g. `"gruene"`. */
export type FactionId = (typeof FACTION_DEFINITIONS)[number]['id'];

export type PaperSubmitterResolver<TPaper extends Pick<Paper, 'id'> = Paper> = (
  paper: TPaper,
) => FactionId[];

const FACTION_BY_ID = new Map<string, FactionDefinition>(
  FACTION_DEFINITIONS.map((faction) => [faction.id, faction]),
);

/** All factions, for publishing a registry alongside the per-paper ids. */
export function listFactions(): Array<{ id: FactionId; name: string }> {
  return FACTION_DEFINITIONS.map((faction) => ({ id: faction.id, name: faction.name }));
}

/** Display name for a faction id, falling back to the id for one we retired. */
export function getFactionName(id: FactionId): string {
  return FACTION_BY_ID.get(id)?.name ?? id;
}

/**
 * `\b` is ASCII-only in JavaScript, so it treats "ü" as a boundary and would match
 * "GRÜNE" inside "Grüneweg". These lookarounds include the German letters.
 */
const WORD_CHARACTER = '[A-Za-zÄÖÜäöüß0-9]';

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One alternation per case mode. Aliases are sorted longest-first so that at any
 * position the longest spelling wins — "B´90/DIE GRÜNEN" must be consumed as a
 * whole rather than leaving "GRÜNEN" to match again.
 */
function buildFactionPattern(caseSensitive: boolean): RegExp {
  // Widened to FactionDefinition: `as const satisfies` narrows each entry to its
  // literal type, so entries that omit `caseSensitive` have no such property.
  const aliases = (FACTION_DEFINITIONS as readonly FactionDefinition[])
    .filter((faction) => (faction.caseSensitive ?? false) === caseSensitive)
    .flatMap((faction) => faction.aliases);
  const alternation = [...aliases]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegularExpression)
    .join('|');

  return new RegExp(
    `(?<!${WORD_CHARACTER})(?:${alternation})(?!${WORD_CHARACTER})`,
    caseSensitive ? 'g' : 'gi',
  );
}

const ALIAS_TO_FACTION = new Map<string, FactionId>(
  FACTION_DEFINITIONS.flatMap((faction) =>
    faction.aliases.map((alias) => [alias.toLowerCase(), faction.id] as const),
  ),
);

const CASE_INSENSITIVE_PATTERN = buildFactionPattern(false);
const CASE_SENSITIVE_PATTERN = buildFactionPattern(true);

/**
 * Faction ids mentioned in a fragment, in order of appearance and deduplicated.
 *
 * Callers pass only fragments already identified as submitter-bearing. Scanning a
 * closed vocabulary also self-validates those fragments: a line like
 * "Antrag: Tempo 30 im gesamten Stadtteil" — where "Antrag:" introduces the motion
 * text rather than a submitter — simply yields nothing.
 */
export function findFactionsInText(fragment: string): FactionId[] {
  const matches: Array<{ index: number; faction: FactionId }> = [];

  for (const pattern of [CASE_INSENSITIVE_PATTERN, CASE_SENSITIVE_PATTERN]) {
    pattern.lastIndex = 0;
    for (const match of fragment.matchAll(pattern)) {
      const faction = ALIAS_TO_FACTION.get(match[0].toLowerCase());
      if (faction) matches.push({ index: match.index, faction });
    }
  }

  matches.sort((a, b) => a.index - b.index);
  return [...new Set(matches.map((match) => match.faction))];
}

/** Paper types that a faction submits. Everything else (Beschlussvorlage,
 *  Informationsvorlage, Offenlage) originates in the administration and is
 *  attributed through `underDirectionOf` instead. Without this gate, an
 *  administration paper responding to a motion would be credited to the faction
 *  that filed the motion. */
const MOTION_PAPER_TYPES = new Set(['Antrag', 'Anfrage', 'Änderungs-/Ergänzungsantrag']);

/** Budget motions are typed per Teilhaushalt ("Haushalt THH 4100"). */
const BUDGET_PAPER_TYPE_PREFIX = 'Haushalt';

export function isMotionPaper(paperType: string): boolean {
  return MOTION_PAPER_TYPES.has(paperType) || paperType.startsWith(BUDGET_PAPER_TYPE_PREFIX);
}

/** Lines of the PDF letterhead scanned for a submitter. The block always sits above
 *  the "Gremien / Termin / TOP" table, well within this window. */
const HEADER_LINE_LIMIT = 25;

/** A line is ignored past this length: the letterhead is made of short lines, and
 *  longer ones are body text where a faction mention means something else. */
const MAX_CANDIDATE_LINE_LENGTH = 200;

/**
 * Lines that carry a submitter. The archive uses three layouts:
 *   "Antrag: GRÜNE"                                          (Gemeinderat)
 *   "Interfraktionelle Resolution: GRÜNE, CDU, SPD"          (joint submissions)
 *   "FDP-OR-Fraktion" / "Eingang: 10.03.2026 / Antrag der SPD" (Ortschaftsrat)
 */
const SUBMITTER_LINE =
  /Fraktion|(?:Antrag|Anfrage|Resolution|Antragsteller(?:in)?|Eingang)\s*(?::|\bder\b|\bvon\b|\bdes\b)/i;

/** "Änderungsantrag AfD: Resolution des Gemeinderates …" — the pre-2020 title style. */
const TITLE_PREFIX =
  /^(?:Interfraktionelle[rs]?\s+)?(?:Änderungs-\/Ergänzungsantrag|Änderungsantrag|Ergänzungsantrag|Antrag|Anfrage|Resolution)\s+([^:]{1,60}):/i;

/** "Anfrage zur Situation „Alter Hälden Weg“ (MfG-Fraktion)" — the trailing style. */
const TITLE_SUFFIX = /\(([^)]{1,80})\)\s*$/;

function findSubmittersInTitle(name: string): FactionId[] {
  // The prefix pattern already consumed the paper-type word, so what follows is the
  // submitter slot and needs no further gate. A parenthesised suffix can hold
  // anything, so it must look like a submitter before it is scanned.
  const suffix = TITLE_SUFFIX.exec(name)?.[1];
  const fragments = [
    TITLE_PREFIX.exec(name)?.[1],
    suffix && SUBMITTER_LINE.test(suffix) ? suffix : undefined,
  ].filter((fragment): fragment is string => !!fragment);

  return fragments.flatMap(findFactionsInText);
}

function findSubmittersInDocument(text: string): FactionId[] {
  const submitters: FactionId[] = [];
  let headerLineCount = 0;
  let lineStart = 0;
  while (lineStart <= text.length && headerLineCount < HEADER_LINE_LIMIT) {
    const newlineIndex = text.indexOf('\n', lineStart);
    const lineEnd = newlineIndex === -1 ? text.length : newlineIndex;
    const line = text.slice(lineStart, lineEnd).trim();

    if (line.length > 0) {
      headerLineCount += 1;
      if (line.length <= MAX_CANDIDATE_LINE_LENGTH && SUBMITTER_LINE.test(line)) {
        submitters.push(...findFactionsInText(line));
      }
    }

    if (newlineIndex === -1) break;
    lineStart = newlineIndex + 1;
  }

  return submitters;
}

/**
 * Memoizes parsing for the lifetime of a build. A paper can occur in multiple
 * agenda items, while extracted text is immutable during record construction.
 */
export function createMemoizedPaperSubmitterResolver(
  getExtractedText: (fileId: string) => string | undefined,
): PaperSubmitterResolver<Paper> {
  const cache = new Map<string, FactionId[]>();

  return (paper) => {
    const cached = cache.get(paper.id);
    if (cached !== undefined) return cached;

    const submitters = findPaperSubmitters(paper, getExtractedText);
    cache.set(paper.id, submitters);
    return submitters;
  };
}

/**
 * Ids of the factions that submitted a paper, in order of appearance. Empty
 * for administration papers, for papers whose attachments have no extracted text
 * yet, and whenever the letterhead names no known faction.
 */
export function findPaperSubmitters(
  paper: Paper,
  getExtractedText: (fileId: string) => string | undefined,
): FactionId[] {
  if (!isMotionPaper(paper.paperType)) return [];

  const submitters = findSubmittersInTitle(paper.name ?? '');
  for (const file of paper.auxiliaryFile ?? []) {
    const text = getExtractedText(file.id);
    if (text) submitters.push(...findSubmittersInDocument(text));
  }

  return [...new Set(submitters)];
}
