/**
 * How directly an attachment speaks for its paper, judged from its hand-typed
 * label: 0 = the paper's own Vorlage/Antrag/Anfrage/Stellungnahme, 1 = unknown,
 * 2 = an annex (Anlage, Synopse, Lageplan, …). Orders attachments for the
 * similarity text and decides which file a summary key point links to when its
 * quote occurs in more than one.
 *
 * Explicit annex labels beat words such as "Satzungsbeschluss" embedded in them. */
export function attachmentDocumentPriority(file: { name?: string }): 0 | 1 | 2 {
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
