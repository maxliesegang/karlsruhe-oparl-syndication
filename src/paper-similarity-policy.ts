import { recordBasename } from './docs-files.js';
import { listDistricts } from './karlsruhe-districts.js';
import { normalizePaperTitle } from './paper-relations.js';
import { buildPaperSimilarityText, tokenizeForSimilarity } from './paper-similarity.js';
import { OParlFile, Paper } from './types/index.js';

/** Titles that describe routine rosters/ceremonies rather than substantive policy.
 * Keep named association histories (e.g. water-supply representation) eligible. */
const ROUTINE_TITLE =
  /^(?:annahme des angebots von zuwendungen|bestellung der mitglieder des sanierungsbeirat|verpflichtung (?:der|von)|feststellung des nichtvorliegens von hinderungsgründen|wahl gemeinderätlicher ausschussmitglieder|neubesetzung von gemeinderätlichen ausschüssen|beigeordnetenwahl|ende der amtszeit)/i;
const PROCEDURAL_TERMS = new Set(
  (
    'vorlage beschlussvorlage informationsvorlage antrag anfrage änderungsantrag ergänzungsantrag ' +
    'bebauungsplan bebauungsplanverfahren satzungsbeschluss aufstellungsbeschluss auslegungsbeschluss ' +
    'gemäß baugesetzbuch baugb absatz beschluss verfahren satzung änderung bericht sachstand ' +
    'sachstandsinformation umsetzungsstand fortführung vereinbarung vorschlag maßnahmen beiträge beitrag ' +
    'rücknahme kürzung kürzungen bezuschussung förderung zuschüsse zuschuss streichung erhalten halbieren ' +
    'reduzierung haushalt haushaltssicherung haushaltsstabilisierung institutionellen institutionelle ' +
    'grundstück grundstücks grundstücke gebäude freifläche anteil anteils erbbaurecht erbbaurechts ' +
    'städtischen städtischer städtische stadt karlsruher karlsruhe stadtarchiv gemeinderat ' +
    'gemeinderates ortschaftsrat ortschaftsrates mitglieder bestellung besetzung neubesetzung ' +
    'ausschüsse ausschüssen ausschussmitglieder gremien funktionen wahl stellenausschreibung ' +
    'wahlverfahren festlegung termin termins ersten erster beigeordneten dezernat kit thh hhs ' +
    'öffentlichkeit öffentlichen öffentliche öffentlichkeitsbeteiligung frühzeitige beteiligung ' +
    'grundsatzbeschluss straße strasse allee platz weg bereich teilbereich zwischen ' +
    'östlich westlich nördlich südlich reinigung verkehrssicherheit geschwindigkeitsbegrenzung budget'
  ).split(' '),
);
for (const district of listDistricts()) {
  for (const token of tokenizeForSimilarity(district)) PROCEDURAL_TERMS.add(token);
}

function topicTerms(title: string): Set<string> {
  return new Set(
    tokenizeForSimilarity(normalizePaperTitle(title) ?? '').filter(
      (term) => term.length >= 4 && !PROCEDURAL_TERMS.has(term),
    ),
  );
}

function parcels(title: string): Set<string> {
  return new Set(
    [
      ...title.matchAll(
        /(?:Grundstück(?:s|e)?\s*(?:Nr\.?)?|Flst\.?\s*(?:Nr\.?)?)\s*(\d+(?:\/\d+)?)/gi,
      ),
    ].map((match) => match[1]),
  );
}

export interface PaperSimilarityPolicy {
  isExcluded: (id: string, otherId: string) => boolean;
  familyOf: (id: string) => string;
}

/** Precision guard independent of cosine: require topic evidence anchored in the
 * titles, avoid unrelated parcels, and keep narrow title/reference families apart.
 * Citation links never join families: citywide reports would make giant clusters. */
export function createPaperSimilarityPolicy(
  papers: readonly Paper[],
  getText: (file: OParlFile) => string | undefined,
  relations: Record<string, Record<string, unknown>>,
): PaperSimilarityPolicy {
  const parents = new Map(
    papers.map((paper) => [recordBasename(paper.id), recordBasename(paper.id)]),
  );
  const root = (id: string): string => {
    const parent = parents.get(id) ?? id;
    if (parent === id) return id;
    const found = root(parent);
    parents.set(id, found);
    return found;
  };
  const join = (a: string, b: string): void => {
    const first = root(a),
      second = root(b);
    if (first !== second) parents.set(second, first);
  };
  const titles = new Map<string, string>();
  const references = new Map<string, string[]>();
  for (const paper of papers) {
    const id = recordBasename(paper.id);
    const title = normalizePaperTitle(paper.name);
    if (title) {
      const prior = titles.get(title);
      if (prior) join(id, prior);
      else titles.set(title, id);
    }
    if (paper.reference)
      references.set(paper.reference, [...(references.get(paper.reference) ?? []), id]);
  }
  for (const paper of papers) {
    const base = /^(.+\/\d{4})\/\d+$/.exec(paper.reference ?? '')?.[1];
    const head = base ? references.get(base) : undefined;
    if (head?.length === 1) join(recordBasename(paper.id), head[0]);
  }
  const evidence = new Map(
    papers.map((paper) => [
      recordBasename(paper.id),
      {
        routine: ROUTINE_TITLE.test(normalizePaperTitle(paper.name) ?? paper.name),
        title: topicTerms(paper.name),
        body: new Set(tokenizeForSimilarity(buildPaperSimilarityText(paper, getText))),
        parcels: parcels(paper.name),
      },
    ]),
  );
  return {
    familyOf: root,
    isExcluded: (id, otherId) => {
      if (relations[id]?.[otherId] !== undefined || root(id) === root(otherId)) return true;
      const a = evidence.get(id),
        b = evidence.get(otherId);
      if (!a || !b || a.routine || b.routine || a.title.size === 0 || b.title.size === 0)
        return true;
      if (
        a.parcels.size &&
        b.parcels.size &&
        ![...a.parcels].some((parcel) => b.parcels.has(parcel))
      )
        return true;
      // A shared non-procedural title term or specific street provides a direct
      // anchor. Otherwise require two title-derived terms in both selected texts.
      if ([...a.title].some((term) => b.title.has(term))) return false;
      const shared = [...new Set([...a.title, ...b.title])].filter(
        (term) => a.body.has(term) && b.body.has(term),
      );
      return (
        shared.length < 2 &&
        !shared.some((term) => /(?:straße|strasse|allee|weg|platz)$/.test(term))
      );
    },
  };
}
