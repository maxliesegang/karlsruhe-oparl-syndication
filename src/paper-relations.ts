import { isMeetingRecordAttachment } from './services/paper-summary-source.js';
import { OParlFile, Paper } from './types/index.js';

/**
 * Evidence links between papers, kept separate from lexical topic similarity.
 * Same-title links are heuristic hints, not proof of a shared proceeding. OParl's `relatedPaper` is
 * empty on every Karlsruhe paper, so the links are assembled from four signals the
 * archive does carry. Each is deterministic and states its own reason; none is a
 * similarity score.
 *
 * - `superordinated` / `subordinated`: OParl's own fields, copied with their API
 *   names and direction. ~3% of papers; always symmetric in the archive. Karlsruhe
 *   sets `subordinatedPaper` on an Änderungsantrag pointing at the Vorlage it
 *   amends, which reads backwards — the names are not reinterpreted here.
 * - `reference-family`: `2021/0167/1` and `2021/0167`. The suffix numbers motions
 *   filed against a Vorlage; 347 of 398 such pairs are also OParl-linked.
 * - `cites` / `cited-by`: another paper's reference written in this paper's own
 *   attachments ("siehe Vorlage Nr. 2013/0262").
 * - `same-title`: an identical normalised title, chained chronologically.
 */
export type PaperRelationKind =
  'superordinated' | 'subordinated' | 'reference-family' | 'cites' | 'cited-by' | 'same-title';

/** Paper id → related paper id → the reasons, sorted. */
export type PaperRelations = Map<string, Map<string, PaperRelationKind[]>>;

/**
 * Reference numbers as written in running text: `2013/0262`, `2021/0167/1`,
 * `DHH/2024/0012`. The five-digit references of pre-2013 Vorlagen are left out —
 * a bare five-digit number in a PDF is far more often an amount or a postcode.
 */
const CITED_REFERENCE_PATTERN = /(?<![\w/])((?:DHH\/)?(20\d\d)\/(\d{4}))(\/\d+)?\b/g;

/**
 * References cited in a text, deduplicated, each with and without its `/n` suffix
 * so a motion number that is not itself archived still resolves to its Vorlage.
 *
 * `2023/2024` is both a valid reference (2023 ran to 2502) and how every
 * Doppelhaushalt is named, so a number that reads as a year range is skipped. That
 * costs the real papers 2022/2023 and 2023/2024 any incoming citation.
 */
export function findCitedReferences(text: string): string[] {
  const references = new Set<string>();
  for (const match of text.matchAll(CITED_REFERENCE_PATTERN)) {
    const [, base, year, sequence, suffix] = match;
    if (Number(sequence) === Number(year) + 1) continue;
    if (suffix) references.add(base + suffix);
    references.add(base);
  }
  return [...references];
}

/** "Änderungsantrag AfD: …", "Antrag GRÜNE: …" — the submitter prefix, not the subject. */
const MOTION_TITLE_PREFIX =
  /^(?:Interfraktionelle[rs]?\s+)?(?:Änderungs-\/Ergänzungsantrag|Änderungsantrag|Ergänzungsantrag|Antrag|Anfrage|Resolution)\b[^:]{0,60}:\s*/i;

/**
 * Titles that recur without denoting one matter: standing agenda slots, and
 * procedures repeated for unrelated cases — 118 papers are titled "Annahme des
 * Angebots von Zuwendungen", each a different donation. A recurring statute
 * amendment ("Satzung zur Änderung der Hauptsatzung") is deliberately *not* listed:
 * the same statute changing over the years is exactly a matter's history.
 */
const GENERIC_TITLE_PATTERN =
  /^(?:mitteilungen|bekanntgaben?|verschiedenes|sonstiges|bauanträge|bürgerfragestunde|einwohnerfragestunde|(?:mündliche )?anfragen(?: und anregungen)?(?: aus dem ortschaftsrat)?|anregungen aus dem ortschaftsrat|annahme des angebots von zuwendungen\b.*|berufung sachkundiger\b.*)$/;

/**
 * The comparison key for `same-title`, or `undefined` when the title is too generic
 * to mean anything. Case, punctuation and a motion's submitter prefix are ignored,
 * so "Antrag GRÜNE: Umfahrung Hagsfeld" joins the Vorlage "Umfahrung Hagsfeld".
 */
export function normalizePaperTitle(name: string | undefined): string | undefined {
  const title = (name ?? '')
    .replace(MOTION_TITLE_PREFIX, '')
    .toLocaleLowerCase('de-DE')
    .replace(/[^a-zäöüß0-9]+/g, ' ')
    .trim();
  if (!title || GENERIC_TITLE_PATTERN.test(title)) return undefined;
  return title;
}

const INVERSE_KIND: Record<PaperRelationKind, PaperRelationKind> = {
  superordinated: 'subordinated',
  subordinated: 'superordinated',
  'reference-family': 'reference-family',
  cites: 'cited-by',
  'cited-by': 'cites',
  'same-title': 'same-title',
};

function compareChronologically(a: Paper, b: Paper): number {
  return (
    (a.date ?? '').localeCompare(b.date ?? '') ||
    (a.reference ?? '').localeCompare(b.reference ?? '') ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Direct relations only. Threads are deliberately not computed: following links
 * transitively joins 347 papers into one component through the Haushaltssicherung
 * status reports, which cite up to 98 Vorlagen each. A viewer can walk the links
 * and decide where to stop; a precomputed thread would have to decide for it.
 *
 * Minutes are never read for citations. They list every agenda item of a sitting
 * with its "Vorlage: 2019/0743", so 3,027 of 5,169 raw citations in the archive
 * linked a paper to whatever happened to share its sitting.
 */
export function buildPaperRelations(
  papers: readonly Paper[],
  getExtractedText: (file: OParlFile) => string | undefined,
): PaperRelations {
  const relations: PaperRelations = new Map();
  const paperIds = new Set(papers.map((paper) => paper.id));

  const addRelation = (fromId: string, toId: string, kind: PaperRelationKind): void => {
    if (fromId === toId || !paperIds.has(fromId) || !paperIds.has(toId)) return;
    for (const [sourceId, targetId, relationKind] of [
      [fromId, toId, kind],
      [toId, fromId, INVERSE_KIND[kind]],
    ] as const) {
      let related = relations.get(sourceId);
      if (!related) relations.set(sourceId, (related = new Map()));
      const kinds = related.get(targetId) ?? [];
      if (!kinds.includes(relationKind)) related.set(targetId, [...kinds, relationKind].sort());
    }
  };

  // References are not unique (`2019/1012` names two papers); an ambiguous one is
  // dropped rather than guessed.
  const papersByReference = new Map<string, Paper[]>();
  for (const paper of papers) {
    if (!paper.reference) continue;
    papersByReference.set(paper.reference, [
      ...(papersByReference.get(paper.reference) ?? []),
      paper,
    ]);
  }
  const resolveReference = (reference: string): Paper | undefined => {
    const candidates = papersByReference.get(reference);
    return candidates?.length === 1 ? candidates[0] : undefined;
  };

  const papersByTitle = new Map<string, Paper[]>();

  for (const paper of papers) {
    for (const subordinatedId of paper.subordinatedPaper ?? []) {
      addRelation(paper.id, subordinatedId, 'subordinated');
    }
    for (const superordinatedId of paper.superordinatedPaper ?? []) {
      addRelation(paper.id, superordinatedId, 'superordinated');
    }

    const familyBase = /^(.+\/\d{4})\/\d+$/.exec(paper.reference ?? '')?.[1];
    const familyHead = familyBase ? resolveReference(familyBase) : undefined;
    if (familyHead) addRelation(paper.id, familyHead.id, 'reference-family');

    for (const file of paper.auxiliaryFile ?? []) {
      if (isMeetingRecordAttachment(file.name)) continue;
      const text = getExtractedText(file);
      if (!text) continue;
      for (const reference of findCitedReferences(text)) {
        const cited = resolveReference(reference);
        if (cited) addRelation(paper.id, cited.id, 'cites');
      }
    }

    const title = normalizePaperTitle(paper.name);
    if (title) papersByTitle.set(title, [...(papersByTitle.get(title) ?? []), paper]);
  }

  // Chained rather than fully connected: 29 Friedhofsgebühren papers would otherwise
  // carry 28 links each, while a chain still lets a viewer walk the whole history.
  for (const group of papersByTitle.values()) {
    group.sort(compareChronologically);
    for (let index = 1; index < group.length; index += 1) {
      addRelation(group[index - 1].id, group[index].id, 'same-title');
    }
  }

  return relations;
}
