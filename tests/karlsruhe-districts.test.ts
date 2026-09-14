import { describe, expect, it } from 'vitest';
import {
  classifyPaperDistricts,
  classifyPaperSources,
  findDistrictsForAuthority,
  findDistrictMentions,
  findDistricts,
  isSubstantiveDocumentName,
  listDistricts,
} from '../src/karlsruhe-districts.js';

/** The distribution list that made 84 papers land in all 27 district feeds. */
const ORTSCHAFTEN_DISTRIBUTION_LIST =
  'Verteiler: Daxlanden, Knielingen, Oberreut, Rüppurr, Waldstadt, Hagsfeld, ' +
  'Grötzingen, Stupferich, Hohenwettersbach, Wolfartsweier, Grünwettersbach, ' +
  'Palmbach, Neureut, Durlach';

describe('findDistricts', () => {
  it('finds full names with alternate compound separators', () => {
    expect(findDistricts('Treffen in Innenstadt West und Beiertheim–Bulach')).toEqual([
      'Beiertheim-Bulach',
      'Innenstadt-West',
    ]);
  });

  it('maps distinctive compound-name parts without duplicates', () => {
    expect(findDistricts('Weiherfeld liegt bei Dammerstock. Weiherfeld bleibt genannt.')).toEqual([
      'Weiherfeld-Dammerstock',
    ]);
  });

  it('does not match words that only contain a district name', () => {
    expect(findDistricts('Die Durlacher Allee')).toEqual([]);
  });

  it('prefers the qualified half over the synthetic Innenstadt parent', () => {
    expect(findDistricts('Sanierung Innenstadt-Ost')).toEqual(['Innenstadt-Ost']);
  });

  it('maps an unqualified Innenstadt to the synthetic parent', () => {
    // 1.8k extracted texts never say which half; a parent keeps them addressable.
    expect(findDistricts('Verkehrsversuch in der Innenstadt')).toEqual(['Innenstadt']);
  });

  it('resolves the joint Ortschaft Wettersbach to both of its Stadtteile', () => {
    expect(findDistricts('Sitzung in Wettersbach')).toEqual(['Grünwettersbach', 'Palmbach']);
  });

  it('maps Ortsteile and Siedlungen to their Stadtteil', () => {
    expect(findDistricts('Spielplatz im Bergwald')).toEqual(['Wolfartsweier']);
    expect(findDistricts('Gewerbegebiet Killisfeld')).toEqual(['Durlach']);
    expect(findDistricts('Heidenstückersiedlung')).toEqual(['Rüppurr']);
  });

  describe('adjectival forms', () => {
    it('counts as the district when it is not a street name', () => {
      expect(findDistricts('Der Grötzinger Ortschaftsrat tagt')).toEqual(['Grötzingen']);
      expect(findDistricts('Die Rüppurrer Grundschule')).toEqual(['Rüppurr']);
    });

    it('is ignored in the street names that carry it away from the district', () => {
      // Durlacher Allee is in the Oststadt, Rüppurrer Straße in the Südstadt, and
      // Mühlburger Feld is a quarter of the Nordweststadt.
      expect(findDistricts('Rüppurrer Str. 12, Durlacher Tor')).toEqual([]);
      expect(findDistricts('Baustelle Mühlburger Feld')).toEqual([]);
      expect(findDistricts('Anwohner der Neureuter Straße')).toEqual([]);
    });
  });
});

describe('findDistrictMentions', () => {
  it('flags a distribution list rather than reporting it as subject matter', () => {
    const mentions = findDistrictMentions(ORTSCHAFTEN_DISTRIBUTION_LIST);

    expect(mentions.length).toBeGreaterThan(8);
    expect(mentions.every((mention) => mention.inEnumeration)).toBe(true);
  });

  it('leaves an ordinary sentence unflagged', () => {
    const mentions = findDistrictMentions('Der Radweg verbindet Durlach und Grötzingen.');

    expect(mentions.map((mention) => mention.district)).toEqual(['Durlach', 'Grötzingen']);
    expect(mentions.some((mention) => mention.inEnumeration)).toBe(false);
  });
});

describe('isSubstantiveDocumentName', () => {
  it('recognises older proposal labels without treating annexes or minutes as proposals', () => {
    expect(isSubstantiveDocumentName('TOP 6 ANTRAG SPD - Radverkehr')).toBe(true);
    expect(isSubstantiveDocumentName('Vorl.Nr. 281_Änderung Hauptsatzung')).toBe(true);
    expect(isSubstantiveDocumentName('Anlage 1_Beschlussvorlage Vergleichstabelle')).toBe(false);
    expect(isSubstantiveDocumentName('Protokoll GR Antrag TOP 3')).toBe(false);
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

  it('ignores office names in a citywide administrative inventory', () => {
    const offices =
      'Ortsverwaltung Grötzingen ja\nOrtsverwaltung Hohenwettersbach ja\n' +
      'Ortsverwaltung Neureut ja\nOrtsverwaltung Stupferich ja\n' +
      'Ortsverwaltung Wettersbach ja\nStadtamt Durlach ja';
    expect(classifyPaperDistricts({ bodies: [offices, offices] })).toEqual({
      primary: [],
      mentioned: [],
    });
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

  it('keeps locations found only in supplementary material searchable, but out of feeds', () => {
    expect(
      classifyPaperDistricts({
        title: 'Bebauungsplan Karlsruhe-Südstadt',
        bodies: ['Die Planung betrifft die Südstadt.'],
        supportingBodies: ['Kompensationsfläche in Knielingen. Knielingen ist im Plan markiert.'],
      }),
    ).toEqual({ primary: ['Südstadt'], mentioned: ['Knielingen'] });
  });

  it('promotes a place supported once by the proposal and again by an annex', () => {
    expect(
      classifyPaperDistricts({
        bodies: [`${'x'.repeat(5000)} Die Parkanlagen in der Oststadt werden erweitert.`],
        supportingBodies: ['Die Oststadt ist im Umweltbericht beschrieben.'],
      }),
    ).toEqual({ primary: ['Oststadt'], mentioned: [] });
  });

  it('retains a substantive multi-site report even when it names many districts', () => {
    expect(
      classifyPaperDistricts({
        bodies: ['Die Förderung betrifft Stadtteilhäuser in Oberreut und Daxlanden.'],
      }),
    ).toEqual({ primary: ['Daxlanden', 'Oberreut'], mentioned: [] });
  });

  it('keeps the only specific district when the title says plain Innenstadt', () => {
    expect(
      classifyPaperSources({
        title: 'Bebauungsplan Innenstadt',
        attachments: [
          {
            name: 'TOP 2 - Markgrafenstraße',
            text: 'Das Plangebiet liegt im Sanierungsgebiet Innenstadt-Ost.',
          },
        ],
      }),
    ).toEqual({ primary: ['Innenstadt', 'Innenstadt-Ost'], mentioned: [] });
  });

  it('uses annex evidence for a generic title with no specific locality', () => {
    expect(
      classifyPaperSources({
        title: 'Konzeptbeschluss Vogesenschule',
        attachments: [
          { name: 'Beschlussvorlage', text: 'Der Neubau der Schule wird beschlossen.' },
          { name: 'Anlage 1 Präsentation', text: 'Die Schule steht in Mühlburg.' },
        ],
      }),
    ).toEqual({ primary: ['Mühlburg'], mentioned: [] });
  });

  it('keeps directly affected sites in an annex despite other Ortschaftsrat consultations', () => {
    expect(
      classifyPaperSources({
        title: 'Rückbau von Spielanlagen als Instrument zur Qualitätssicherung',
        structural: ['Grötzingen', 'Stupferich'],
        attachments: [
          {
            name: 'Beschlussvorlage',
            text: 'Nach Anhörung der Ortschaftsräte Grötzingen und Stupferich.',
          },
          {
            name: 'Anlage Anlagenübersicht',
            text: 'Rückbau Spielplätze: Mühlburg Lindenplatz; Hagsfeld Alte Bach.',
          },
        ],
      }),
    ).toEqual({ primary: ['Grötzingen', 'Hagsfeld', 'Mühlburg', 'Stupferich'], mentioned: [] });
  });

  it('treats proposed new opening hours as local evidence, not the current comparison table', () => {
    expect(
      classifyPaperSources({
        title: 'Schließung Hagsfeld und Daxlanden und Änderung der Öffnungszeiten',
        attachments: [
          { name: 'Anlage 1_Aktuelle OeZ', text: 'Grötzingen. Durlach.' },
          { name: 'Anlage 2_Neue OeZ', text: 'Grötzingen: 9:30 bis 17 Uhr.' },
          { name: 'Beschlussvorlage', text: 'Schließung der Stationen Hagsfeld und Daxlanden.' },
        ],
      }),
    ).toEqual({ primary: ['Daxlanden', 'Grötzingen', 'Hagsfeld'], mentioned: ['Durlach'] });
  });

  it('does not read Neue Mitte as a proposed-state annex', () => {
    expect(
      classifyPaperSources({
        title: 'Planungs-Szenarien Neue Mitte Stupferich',
        attachments: [
          { name: 'Informationsvorlage', text: 'Die Planung betrifft Stupferich.' },
          { name: 'Anlage Planungs-Szenarien Neue Mitte', text: 'Grötzingen. Grünwettersbach.' },
        ],
      }),
    ).toEqual({ primary: ['Stupferich'], mentioned: ['Grötzingen', 'Grünwettersbach'] });
  });
});

describe('listDistricts', () => {
  it('publishes the full registry sorted and deduplicated', () => {
    const districts = listDistricts();

    expect(districts).toHaveLength(28); // 27 official Stadtteile + synthetic Innenstadt
    expect(districts).toEqual([...districts].sort());
    expect(new Set(districts).size).toBe(districts.length);
    expect(districts).toContain('Innenstadt');
    expect(districts).toContain('Innenstadt-Ost');
  });
});
