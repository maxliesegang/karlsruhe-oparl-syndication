import { describe, expect, it } from 'vitest';
import {
  classifyPaperDistricts,
  findDistrictsForAuthority,
  findKarlsruheDistrictMentions,
  findKarlsruheDistricts,
  listKarlsruheDistricts,
} from '../src/karlsruhe-districts.js';

/** The distribution list that made 84 papers land in all 27 district feeds. */
const ORTSCHAFTEN_DISTRIBUTION_LIST =
  'Verteiler: Daxlanden, Knielingen, Oberreut, Rüppurr, Waldstadt, Hagsfeld, ' +
  'Grötzingen, Stupferich, Hohenwettersbach, Wolfartsweier, Grünwettersbach, ' +
  'Palmbach, Neureut, Durlach';

describe('findKarlsruheDistricts', () => {
  it('finds full names with alternate compound separators', () => {
    expect(findKarlsruheDistricts('Treffen in Innenstadt West und Beiertheim–Bulach')).toEqual([
      'Beiertheim-Bulach',
      'Innenstadt-West',
    ]);
  });

  it('maps distinctive compound-name parts without duplicates', () => {
    expect(
      findKarlsruheDistricts('Weiherfeld liegt bei Dammerstock. Weiherfeld bleibt genannt.'),
    ).toEqual(['Weiherfeld-Dammerstock']);
  });

  it('does not match words that only contain a district name', () => {
    expect(findKarlsruheDistricts('Die Durlacher Allee')).toEqual([]);
  });

  it('prefers the qualified half over the synthetic Innenstadt parent', () => {
    expect(findKarlsruheDistricts('Sanierung Innenstadt-Ost')).toEqual(['Innenstadt-Ost']);
  });

  it('maps an unqualified Innenstadt to the synthetic parent', () => {
    // 1.8k extracted texts never say which half; a parent keeps them addressable.
    expect(findKarlsruheDistricts('Verkehrsversuch in der Innenstadt')).toEqual(['Innenstadt']);
  });

  it('resolves the joint Ortschaft Wettersbach to both of its Stadtteile', () => {
    expect(findKarlsruheDistricts('Sitzung in Wettersbach')).toEqual([
      'Grünwettersbach',
      'Palmbach',
    ]);
  });

  it('maps Ortsteile and Siedlungen to their Stadtteil', () => {
    expect(findKarlsruheDistricts('Spielplatz im Bergwald')).toEqual(['Wolfartsweier']);
    expect(findKarlsruheDistricts('Gewerbegebiet Killisfeld')).toEqual(['Durlach']);
    expect(findKarlsruheDistricts('Heidenstückersiedlung')).toEqual(['Rüppurr']);
  });

  describe('adjectival forms', () => {
    it('counts as the district when it is not a street name', () => {
      expect(findKarlsruheDistricts('Der Grötzinger Ortschaftsrat tagt')).toEqual(['Grötzingen']);
      expect(findKarlsruheDistricts('Die Rüppurrer Grundschule')).toEqual(['Rüppurr']);
    });

    it('is ignored in the street names that carry it away from the district', () => {
      // Durlacher Allee is in the Oststadt, Rüppurrer Straße in the Südstadt, and
      // Mühlburger Feld is a quarter of the Nordweststadt.
      expect(findKarlsruheDistricts('Rüppurrer Str. 12, Durlacher Tor')).toEqual([]);
      expect(findKarlsruheDistricts('Baustelle Mühlburger Feld')).toEqual([]);
      expect(findKarlsruheDistricts('Anwohner der Neureuter Straße')).toEqual([]);
    });
  });
});

describe('findKarlsruheDistrictMentions', () => {
  it('flags a distribution list rather than reporting it as subject matter', () => {
    const mentions = findKarlsruheDistrictMentions(ORTSCHAFTEN_DISTRIBUTION_LIST);

    expect(mentions.length).toBeGreaterThan(8);
    expect(mentions.every((mention) => mention.inEnumeration)).toBe(true);
  });

  it('leaves an ordinary sentence unflagged', () => {
    const mentions = findKarlsruheDistrictMentions('Der Radweg verbindet Durlach und Grötzingen.');

    expect(mentions.map((mention) => mention.district)).toEqual(['Durlach', 'Grötzingen']);
    expect(mentions.some((mention) => mention.inEnumeration)).toBe(false);
  });
});

describe('findDistrictsForAuthority', () => {
  it('reads the district out of a district committee name', () => {
    expect(findDistrictsForAuthority('Ortschaftsrat Durlach')).toEqual(['Durlach']);
    expect(findDistrictsForAuthority('Ortsverwaltung Wettersbach')).toEqual([
      'Grünwettersbach',
      'Palmbach',
    ]);
  });

  it('ignores committees that merely name a district', () => {
    // Only Ortschaftsrat/Ortsverwaltung speak *for* a district; anything else that
    // happens to carry a district name in its title must not claim one.
    expect(findDistrictsForAuthority('Arbeitskreis Durlach')).toEqual([]);
    expect(findDistrictsForAuthority('Gemeinderat')).toEqual([]);
  });
});

describe('classifyPaperDistricts', () => {
  it('treats a title mention as primary', () => {
    expect(classifyPaperDistricts({ title: 'Sanierung der Schule in Hagsfeld' })).toEqual({
      primary: ['Hagsfeld'],
      mentioned: [],
    });
  });

  it('treats a structural district as primary without any text', () => {
    expect(classifyPaperDistricts({ structural: ['Neureut'] })).toEqual({
      primary: ['Neureut'],
      mentioned: [],
    });
  });

  it('treats a lead-text mention as primary', () => {
    expect(classifyPaperDistricts({ bodies: ['Ortsverwaltung Stupferich — Antrag'] })).toEqual({
      primary: ['Stupferich'],
      mentioned: [],
    });
  });

  it('demotes a single passing mention deep in an attachment', () => {
    const body = `${'x'.repeat(5000)} vergleichbar mit dem Vorgehen in Oberreut.`;

    expect(classifyPaperDistricts({ bodies: [body] })).toEqual({
      primary: [],
      mentioned: ['Oberreut'],
    });
  });

  it('promotes a district that recurs in the body', () => {
    const body = `${'x'.repeat(5000)} in Oberreut. Und weiter in Oberreut.`;

    expect(classifyPaperDistricts({ bodies: [body] })).toEqual({
      primary: ['Oberreut'],
      mentioned: [],
    });
  });

  it('drops districts that appear only inside a distribution list', () => {
    const body = `${'x'.repeat(5000)} ${ORTSCHAFTEN_DISTRIBUTION_LIST}`;

    expect(classifyPaperDistricts({ bodies: [body] })).toEqual({ primary: [], mentioned: [] });
  });

  it('keeps a district that is both the subject and in the distribution list', () => {
    const result = classifyPaperDistricts({
      title: 'Neubau Turnhalle Grötzingen',
      bodies: [`${'x'.repeat(5000)} ${ORTSCHAFTEN_DISTRIBUTION_LIST}`],
    });

    expect(result).toEqual({ primary: ['Grötzingen'], mentioned: [] });
  });

  it('offsets are per attachment, so the second file also has a lead text', () => {
    const filler = 'x'.repeat(5000);

    expect(classifyPaperDistricts({ bodies: [filler, 'Antrag Ortschaftsrat Palmbach'] })).toEqual({
      primary: ['Palmbach'],
      mentioned: [],
    });
  });
});

describe('listKarlsruheDistricts', () => {
  it('publishes the full registry sorted and deduplicated', () => {
    const districts = listKarlsruheDistricts();

    expect(districts).toHaveLength(28); // 27 official Stadtteile + synthetic Innenstadt
    expect(districts).toEqual([...districts].sort());
    expect(new Set(districts).size).toBe(districts.length);
    expect(districts).toContain('Innenstadt');
    expect(districts).toContain('Innenstadt-Ost');
  });
});
