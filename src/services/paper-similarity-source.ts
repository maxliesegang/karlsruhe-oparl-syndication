import { OParlFile } from '../types/index.js';
import { stripTemplateBoilerplate } from './paper-document-template.js';

/** Similarity-only cleanup. Do not change summary input hashes for a retrieval experiment. */
export function stripSimilarityBoilerplate(text: string): string {
  // Both markers belong to the same budget-motion form. Requiring both
  // boundaries avoids discarding real prose merely mentioning a budget/table.
  const formStart = /^[ \t\uF075►X]*Zuordnung im Haushaltsplan\b[^\n]*$/m.exec(text);
  if (formStart) {
    const afterStart = text.slice(formStart.index + formStart[0].length);
    const bodyStart = /^[ \t\uF075►X]*Sachverhalt\s*[|/]\s*Begründung\s*:?[ \t]*$/m.exec(
      afterStart,
    );
    if (bodyStart) {
      // The authoritative paper title is added separately. The letterhead, repeated
      // page headings, broken Word cross-references and numeric form add no topic.
      text = afterStart.slice(bodyStart.index + bodyStart[0].length);
      text = text.split(/\n[ \t]*Unterzeichnet von\s*:/, 1)[0];
    }
  }
  return stripTemplateBoilerplate(text).trim();
}

/** Explicit annex labels beat words such as "Satzungsbeschluss" embedded in them. */
export function similarityAttachmentPriority(file: OParlFile): 0 | 1 | 2 {
  const name = file.name ?? '';
  if (
    /(?:Anlage(?:\b|_)|synopse|lageplan|planzeichnung|umweltbericht|festsetzungen|fachbeitrag|präsentation)/i.test(
      name,
    )
  )
    return 2;
  if (
    /(?:^|[\s_:-])(?:Beschlussvorlage|Informationsvorlage|Änderungsantrag|Ergänzungsantrag|Antrag|Anfrage|Stellungnahme|STN|Vorlage|Satzungsbeschluss|Auslegungsbeschluss|Aufstellungsbeschluss)(?=$|[\s_.:-])/i.test(
      name,
    )
  )
    return 0;
  return 1;
}
