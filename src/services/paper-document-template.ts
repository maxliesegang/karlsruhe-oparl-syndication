/**
 * Karlsruhe Beschluss-/Informationsvorlagen are produced from one office template, so
 * the same two machine-generated blocks appear in almost every extracted PDF:
 *
 * - the `Gremien / Termin / TOP / Ö-N / Zuständigkeit` scheduling table (338 of 353
 *   summarized papers carry it), and
 * - the finance/CO₂/IQ form with its ☐/☒ checkboxes.
 *
 * Both are procedural, both are exactly what a summary must not report, and both were
 * previously fought with prompt rules — unsuccessfully: 117 of 353 published summaries
 * opened with "Der Gemeinderat hat", and one reported "ist bereits vollständig
 * budgetiert" straight off a checkbox. Removing them deterministically is cheaper and
 * exact, and it lets the prompt spend its attention on judgement instead.
 *
 * The same template gives us the opposite gift: a `Kurzfassung` section written by the
 * administration, present in 273 of those 353 papers at a median 430 characters. It is
 * the highest-signal passage in the document, so it is hoisted into the model context
 * rather than left to compete with the body text.
 */

/** ☐ ☒ ☑ only ever occur in the form; no prose line in the archive contains one. */
const FORM_CHECKBOX = /[☐☒☑]/;

/**
 * Form labels that carry no value once their checkboxes are gone. Value-bearing lines
 * (`Gesamtkosten: ca. 500.000 Euro`) are deliberately absent from this list: the amount
 * is real content and several published key points correctly cite it.
 */
const EMPTY_FORM_LABEL =
  /^(Gesamtkosten|Jährliche\/r Budgetbedarf\/Folgekosten|Gesamteinzahlung|Jährlicher Ertrag|Korridorthema|abgestimmt mit|Finanzierung|Gegenfinanzierung durch|IQ-relevant|Die Gegenfinanzierung ist im|Erläuterungsteil dargestellt\.|CO2-Relevanz: Auswirkung auf den Klimaschutz|Bei Ja: Begründung \| Optimierung \(im Text ergänzende Erläuterungen\))\s*:?\s*$/;

const CONSULTATION_TABLE_HEADER = /^Gremien\s+Termin\s+TOP\b/;

/**
 * Headings the template uses to open the next section. They terminate both the
 * scheduling table and the `Kurzfassung`, so a scan that finds none of them stops
 * rather than guessing — a wrapped committee row must never eat real prose.
 */
const SECTION_HEADING =
  /^(Kurzfassung|Erläuterung|Sachverhalt|Begründung|Ausgangslage|Beschluss|Antrag|Anfrage|Anlage|Finanzielle Auswirkungen|Betreff|Hintergrund|Stellungnahme|Sachstand)/;

const ABSTRACT_HEADING = /^Kurzfassung\s*:?\s*$/;

/** Committee rows wrap across lines; the longest observed table needs well under this. */
const MAXIMUM_TABLE_LINE_COUNT = 40;

/** Rows and wrapped committee names stay well under this; body prose wraps above it. */
const MAXIMUM_TABLE_ROW_CHARACTERS = 80;

/** A sitting date, the public/non-public marker, or the responsibility column. */
const TABLE_ROW_CONTENT =
  /\d{1,2}\.\d{1,2}\.\d{2,4}|(?:^|\s)[ÖN](?:\s*\/\s*[ÖN])?(?:\s|$)|\b(Entscheidung|Vorberatung|Vorberatend|Anhörung|Kenntnisnahme|Behandlung|Beratung|Mitberatung|Beschlussfassung|Offenlage|Information)\b/;

/** A committee name may wrap over two lines before its date and columns arrive. */
const TABLE_ROW_WRAP_LOOKAHEAD = 3;

/** p90 of the extracted abstract is ~1450 characters; the cap only bounds outliers. */
const MAXIMUM_ABSTRACT_CHARACTERS = 4000;

/** Page furniture pdf extraction leaves behind at a section boundary. */
const PAGE_MARKER = /^(--\s*\d+\s+of\s+\d+\s*--|[–-]\s*\d+\s*[–-])$/;

/** Remove the scheduling table and the checkbox form from one document's extracted text. */
export function stripTemplateBoilerplate(text: string): string {
  const lines = text.split('\n');
  const kept: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();

    if (CONSULTATION_TABLE_HEADER.test(line)) {
      index = findTableEnd(lines, index + 1) - 1;
      continue;
    }
    if (FORM_CHECKBOX.test(line) || EMPTY_FORM_LABEL.test(line)) continue;

    kept.push(lines[index]);
  }

  return kept.join('\n');
}

/**
 * Return the administration's own `Kurzfassung` for a document, or an empty string.
 *
 * Note this is frequently written in decision voice ("Der Gemeinderat beschließt …"):
 * 41% of the archive's abstracts are, which is where the procedural openers came from.
 * The prompt therefore asks for it to be re-expressed, rather than quoted.
 */
export function findTemplateAbstract(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => ABSTRACT_HEADING.test(line.trim()));
  if (start < 0) return '';

  // Extract before stripping: the form's own heading terminates the abstract, and
  // that heading carries a checkbox, so stripping first would delete the boundary.
  const end = findSectionEnd(lines, start + 1, lines.length) ?? lines.length;
  const body = stripTemplateBoilerplate(lines.slice(start + 1, end).join('\n')).split('\n');
  while (body.length > 0 && isTrailingNoise(body[body.length - 1])) body.pop();

  const abstract = body.join('\n').trim();
  if (abstract.length <= MAXIMUM_ABSTRACT_CHARACTERS) return abstract;

  const truncated = abstract.slice(0, MAXIMUM_ABSTRACT_CHARACTERS);
  const boundary = truncated.lastIndexOf('\n');
  return (boundary > 0 ? truncated.slice(0, boundary) : truncated).trim();
}

/**
 * Index of the first line after the scheduling table's rows.
 *
 * Row shape decides where the table ends, not a terminating heading: an `Antrag` or
 * `Anfrage` puts its own text directly after the table with no heading, and both a
 * heading-only scan and a line-length rule swallowed it (numbered questions are short
 * too). A row always carries a date, an Ö/N marker or a Zuständigkeit word. A wrapped
 * committee name carries none of those, so it is consumed only when a real row follows
 * within `TABLE_ROW_WRAP_LOOKAHEAD` lines.
 */
function findTableEnd(lines: string[], from: number): number {
  let index = from;
  while (index < lines.length && index - from < MAXIMUM_TABLE_LINE_COUNT) {
    const line = lines[index].trim();
    if (!line || line.length > MAXIMUM_TABLE_ROW_CHARACTERS || SECTION_HEADING.test(line)) break;
    if (!TABLE_ROW_CONTENT.test(line) && !hasRowWithin(lines, index + 1)) break;
    index++;
  }
  return index;
}

function hasRowWithin(lines: string[], from: number): boolean {
  for (let index = from; index < lines.length && index - from < TABLE_ROW_WRAP_LOOKAHEAD; index++) {
    const line = lines[index].trim();
    if (SECTION_HEADING.test(line)) return false;
    if (TABLE_ROW_CONTENT.test(line)) return true;
  }
  return false;
}

/** Index of the next section heading at or after `from`, within `lineBudget` lines. */
function findSectionEnd(lines: string[], from: number, lineBudget: number): number | undefined {
  for (let index = from; index < lines.length && index - from < lineBudget; index++) {
    if (SECTION_HEADING.test(lines[index].trim())) return index;
  }
  return undefined;
}

function isTrailingNoise(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed || PAGE_MARKER.test(trimmed);
}
