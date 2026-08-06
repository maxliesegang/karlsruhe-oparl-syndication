import { describe, expect, it } from 'vitest';
import {
  findTemplateAbstract,
  stripTemplateBoilerplate,
} from '../src/services/paper-document-template.js';

/** Verbatim shape of the office template, as pdf extraction leaves it. */
const vorlage = `Beschlussvorlage
Vorlage Nr.: 2026/0459 Verantwortlich: Dez. 6
Jahresabschluss zum 31.12.2025 des Eigenbetriebs „Fußballstadion im Wildpark“
Gremien Termin TOP Ö / N Zuständigkeit
Betriebsausschuss "Eigenbetrieb
Fußballstadion im Wildpark"
2.07.2026 1 N Vorberatung
Gemeinderat 28.07.2026 33 Ö Entscheidung
Kurzfassung
1. Der Gemeinderat stellt den geprüften Jahresabschluss 2025 fest.
2. Das Jahresergebnis 2025 beträgt 0,00 Euro.

-- 1 of 3 --
Finanzielle Auswirkungen Ja ☐ Nein ☒
☐ Investition
Gesamtkosten: ca. 500.000 Euro
Gesamteinzahlung:
Finanzierung
☒ bereits vollständig budgetiert
IQ-relevant Nein ☒ Ja ☐ Korridorthema:
Erläuterungen
Der Eigenbetrieb betreibt das Stadion im Wildpark.`;

describe('paper document template', () => {
  it('removes the scheduling table and the checkbox form', () => {
    const stripped = stripTemplateBoilerplate(vorlage);

    expect(stripped).not.toContain('Gremien Termin TOP');
    expect(stripped).not.toContain('Betriebsausschuss');
    expect(stripped).not.toContain('28.07.2026');
    expect(stripped).not.toMatch(/[☐☒☑]/);
    expect(stripped).not.toContain('vollständig budgetiert');
    expect(stripped).not.toContain('Gesamteinzahlung');
    expect(stripped).toContain('Der Eigenbetrieb betreibt das Stadion im Wildpark.');
  });

  it('keeps form lines that carry an actual amount', () => {
    expect(stripTemplateBoilerplate(vorlage)).toContain('Gesamtkosten: ca. 500.000 Euro');
  });

  // An Antrag or Anfrage puts its own text straight after the table with no heading,
  // and its numbered points are short. Only the rows may be removed.
  it('stops at motion text that follows the table without a heading', () => {
    const text = [
      'Gremien Termin TOP Ö / N Zuständigkeit',
      'Gemeinderat 24.03.2026 15.2 Ö Kenntnisnahme',
      '1. Wie bewertet die Verwaltung das',
      'Kosten-Nutzen-Verhältnis der Planung?',
      '2. Wofür sind die Folgekosten vorgesehen?',
    ].join('\n');

    expect(stripTemplateBoilerplate(text)).toBe(
      [
        '1. Wie bewertet die Verwaltung das',
        'Kosten-Nutzen-Verhältnis der Planung?',
        '2. Wofür sind die Folgekosten vorgesehen?',
      ].join('\n'),
    );
  });

  it('consumes a committee name that wraps before its date', () => {
    const text = [
      'Gremien Termin TOP Ö / N Zuständigkeit',
      'Betriebsausschuss "Eigenbetrieb',
      'Fußballstadion im Wildpark"',
      '2.07.2026 1 N Vorberatung',
      'Die Sanierung beginnt im Frühjahr.',
    ].join('\n');

    expect(stripTemplateBoilerplate(text)).toBe('Die Sanierung beginnt im Frühjahr.');
  });

  // Extracted from the raw text, not from the stripped text: the form heading that
  // terminates the abstract carries a checkbox, so stripping first loses the boundary.
  it('extracts the administration abstract without page furniture or form lines', () => {
    const abstract = findTemplateAbstract(vorlage);

    expect(abstract).toBe(
      '1. Der Gemeinderat stellt den geprüften Jahresabschluss 2025 fest.\n2. Das Jahresergebnis 2025 beträgt 0,00 Euro.',
    );
  });

  it('returns nothing when the document has no Kurzfassung section', () => {
    expect(findTemplateAbstract('Antrag\nWir fordern eine Kurzfassung des Berichts.')).toBe('');
  });

  it('truncates an implausibly long abstract on a line boundary', () => {
    const line = 'Ein sehr langer Beschlusspunkt mit Erläuterungen.';
    const abstract = findTemplateAbstract(
      ['Kurzfassung', ...Array(200).fill(line), 'Erläuterungen', 'Rest'].join('\n'),
    );

    expect(abstract.length).toBeLessThanOrEqual(4000);
    expect(abstract.endsWith(line)).toBe(true);
  });
});
