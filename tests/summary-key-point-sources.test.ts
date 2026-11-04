import { describe, expect, it } from 'vitest';
import {
  findKeyPointSource,
  KeyPointSourceDocument,
} from '../src/services/llm/summary-key-point-sources.js';

const FILE = 'https://web2.karlsruhe.de/ris/oparl/bodies/0001/files/681496';
const OTHER_FILE = 'https://web2.karlsruhe.de/ris/oparl/bodies/0001/files/681498';

function document(text: string, name = 'Stellungnahme', file = FILE): KeyPointSourceDocument {
  return { file, name, text };
}

describe('locating a key point quote', () => {
  it('finds a quote whose source wraps across lines, and names its page', () => {
    // papers/55033: the quote sits on page 2, after the first page marker.
    const text = [
      'Stellungnahme zum Antrag',
      '-- 1 of 2 --',
      'Nennung von zwei Nachnamen wird zudem der Straßenname verkompliziert. Eine Benennung mit zwei',
      'Nachnamen ist in den Richtlinien zur Straßenbenennung nicht vorgesehen.',
      '-- 2 of 2 --',
    ].join('\n');

    expect(
      findKeyPointSource(
        'Eine Benennung mit zwei Nachnamen ist in den Richtlinien zur Straßenbenennung nicht vorgesehen.',
        [document(text)],
      ),
    ).toEqual({
      file: FILE,
      page: 2,
      quote:
        'Eine Benennung mit zwei Nachnamen ist in den Richtlinien zur Straßenbenennung nicht vorgesehen',
    });
  });

  it('matches line-break hyphenation however the model spelled the word', () => {
    // papers/54102: the source breaks "Straßen-zügen" across a line.
    const text =
      'wird eine angemessene Anzahl an geeigneten Straßen-\nzügen identifiziert, auf denen der Versuch läuft.';
    for (const quote of [
      'eine angemessene Anzahl an geeigneten Straßenzügen identifiziert',
      'eine angemessene Anzahl an geeigneten Straßen-zügen identifiziert',
    ]) {
      expect(findKeyPointSource(quote, [document(text)])).toEqual({
        file: FILE,
        quote: 'eine angemessene Anzahl an geeigneten Straßenzügen identifiziert',
      });
    }
  });

  it('keeps a compound split at a line end apart from hyphenation', () => {
    // papers/55033: "Bismarck- und Moltkestraße" with the line break after the hyphen.
    const text =
      'Der nördliche Bereich der Seminarstraße, zwischen Bismarck-\nund Moltkestraße, wird umbenannt.';
    expect(
      findKeyPointSource(
        'Der nördliche Bereich der Seminarstraße, zwischen Bismarck- und Moltkestraße, wird umbenannt.',
        [document(text)],
      ),
    ).toMatchObject({ file: FILE });
  });

  it('folds superscript digits and typographic quotes', () => {
    // papers/54200: the model wrote "m2" for the source's "m²".
    const text =
      'Pro 30 m² Gesamtwohnfläche einen Fahrradstellplatz zu fordern, ist „gängiger Standard“.';
    expect(
      findKeyPointSource(
        'Pro 30 m2 Gesamtwohnfläche einen Fahrradstellplatz zu fordern, ist "gängiger Standard"',
        [document(text)],
      ),
    ).toEqual({
      file: FILE,
      quote:
        'Pro 30 m² Gesamtwohnfläche einen Fahrradstellplatz zu fordern, ist „gängiger Standard“',
    });
  });

  it('finds a quote that spans a page break and names the page it starts on', () => {
    const text = [
      'Neufassung der Entgeltordnung',
      '-- 1 of 3 --',
      'Die Entgelte werden regelmäßig überprüft und',
      '-- 2 of 3 --',
      'spätestens alle fünf Jahre angeglichen.',
      '-- 3 of 3 --',
    ].join('\n');
    expect(
      findKeyPointSource(
        'Die Entgelte werden regelmäßig überprüft und spätestens alle fünf Jahre angeglichen.',
        [document(text)],
      ),
    ).toEqual({
      file: FILE,
      page: 2,
      quote: 'Die Entgelte werden regelmäßig überprüft und spätestens alle fünf Jahre angeglichen',
    });
  });

  it('links the paper’s own document when the passage also appears in an annex', () => {
    // papers/54109: tariff tables repeated in the Vorlage and its Anlagen.
    const passage = 'Die Ferienbetreuung kostet 100,00 Euro pro Woche einschließlich Mittagessen.';
    const annex = document(passage, 'Anlage 4_Vertragsbedingungen Ferienbetreuung', OTHER_FILE);
    const own = document(passage, 'Beschlussvorlage', FILE);

    expect(findKeyPointSource(passage, [annex, own])).toMatchObject({ file: FILE });
  });

  it('accepts a quote with one changed word when a long verbatim run identifies it', () => {
    const text =
      'Die vorgeschlagene Entgelterhöhung für die Vermietung von Schulräumen führt zu jährlichen Mehreinnahmen von circa 70.000 Euro.';
    expect(
      findKeyPointSource(
        'Die geplante Entgelterhöhung für die Vermietung von Schulräumen führt zu jährlichen Mehreinnahmen von circa 70.000 Euro',
        [document(text)],
      ),
    ).toEqual({
      file: FILE,
      quote:
        'Entgelterhöhung für die Vermietung von Schulräumen führt zu jährlichen Mehreinnahmen von circa 70.000 Euro',
    });
  });

  it('rejects a paraphrase that only shares a stock phrase with the source', () => {
    const text = 'Die Verwaltung empfiehlt, den Antrag abzulehnen, da keine Mittel vorhanden sind.';
    expect(
      findKeyPointSource(
        'Die Verwaltung empfiehlt die Ablehnung, weil der Haushalt keine Mittel dafür vorsieht.',
        [document(text)],
      ),
    ).toBeUndefined();
  });

  it('rejects a quote too short to identify a passage', () => {
    expect(
      findKeyPointSource('Die Verwaltung empfiehlt', [document('Die Verwaltung empfiehlt, …')]),
    ).toBeUndefined();
  });

  it('leaves the page out when the extracted text carries no page markers', () => {
    // 2025 extractions predate the markers.
    expect(
      findKeyPointSource('Die Bürgervereine Heide und Kirchfeld werden parallel beteiligt.', [
        document('Die Bürgervereine Heide und Kirchfeld werden parallel beteiligt.'),
      ]),
    ).toEqual({
      file: FILE,
      quote: 'Die Bürgervereine Heide und Kirchfeld werden parallel beteiligt',
    });
  });

  it('drops the comma a mid-sentence quote ends on', () => {
    // papers/54981: the quote stopped at the comma before the next list item.
    expect(
      findKeyPointSource('kulturelle Teilhabe stärkt, insbesondere durch aufsuchende Formate,', [
        document(
          '▪ kulturelle Teilhabe stärkt, insbesondere durch aufsuchende Formate, niedrigschwellige',
        ),
      ]),
    ).toMatchObject({
      quote: 'kulturelle Teilhabe stärkt, insbesondere durch aufsuchende Formate',
    });
  });
});
