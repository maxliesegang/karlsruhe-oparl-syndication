import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';
import { MeetingDigestWriter } from '../src/services/llm/meeting-digest-writer.js';
import { updateMeetingDigests } from '../src/services/meeting-digest-service.js';
import { stores } from '../src/store/index.js';
import { Meeting, Paper, PaperSummary } from '../src/types/index.js';

const consultationId = 'https://example.test/consultations/digest-1';

const paper: Paper = {
  id: 'https://example.test/papers/vo/900',
  type: 'Paper',
  body: 'https://example.test/bodies/1',
  name: 'Umbau des Marktplatzes',
  reference: '2026/42',
  date: '2026-07-01',
  paperType: 'Beschlussvorlage',
  auxiliaryFile: [],
  underDirectionOf: [],
  consultation: [
    {
      id: consultationId,
      type: 'Consultation',
      agendaItem: 'https://example.test/agendaItems/digest-1',
      meeting: 'https://example.test/meetings/500',
      organization: [],
      role: 'beratend',
      created: '2026-07-01T00:00:00Z',
      modified: '2026-07-01T00:00:00Z',
    },
  ],
  created: '2026-07-01T00:00:00Z',
  modified: '2026-07-02T00:00:00Z',
};

const meeting: Meeting = {
  id: 'https://example.test/meetings/500',
  type: 'Meeting',
  name: 'Gemeinderat (öffentlich)',
  start: '2026-08-08T16:00:00Z',
  end: '2026-08-08T19:00:00Z',
  location: {} as Meeting['location'],
  organization: [],
  created: '2026-07-01T00:00:00Z',
  modified: '2026-07-02T00:00:00Z',
  agendaItem: [
    {
      id: 'https://example.test/agendaItems/digest-1',
      type: 'AgendaItem',
      meeting: 'https://example.test/meetings/500',
      number: '1',
      order: 1,
      name: 'Umbau des Marktplatzes',
      public: true,
      consultation: consultationId,
      created: '2026-07-01T00:00:00Z',
      modified: '2026-07-02T00:00:00Z',
    },
  ],
};

const summary: PaperSummary = {
  id: paper.id,
  sourceHash: 'sha256:current',
  promptVersion: 'paper-de-v7',
  provider: 'test-provider',
  model: 'test-model',
  summary: 'Die Vorlage schlägt den Umbau des Marktplatzes vor.',
  keyPoints: ['Die Kosten betragen 2.000.000 Euro.'],
  generatedAt: '2026-07-02T00:00:00Z',
};

/** One week before the sitting, so the `week` lead is due and `day` is not. */
const weekBefore = () => new Date('2026-08-01T09:00:00Z');

function createWriter(body?: Partial<{ overview: string; highlights: string[] }>) {
  const write = vi.fn().mockResolvedValue({
    overview: body?.overview ?? 'Der Gemeinderat berät über den Umbau des Marktplatzes.',
    highlights: body?.highlights ?? ['TOP 1: Der Umbau des Marktplatzes steht zur Beratung an.'],
  });
  const writer: MeetingDigestWriter = {
    providerName: 'test-provider',
    model: 'test-model',
    write,
  };
  return { writer, write };
}

describe('meeting digest service', () => {
  beforeEach(() => {
    stores.clear();
    config.extractPdfText = false;
    stores.papers.add(structuredClone(paper));
  });

  afterEach(() => stores.clear());

  it('generates a preview for a sitting due at a lead time', async () => {
    const { writer, write } = createWriter();
    const digests = await updateMeetingDigests([meeting], new Map([[paper.id, summary]]), {
      enabled: true,
      writer,
      now: weekBefore,
    });

    expect(digests).toHaveLength(1);
    expect(digests[0]).toMatchObject({
      id: `${meeting.id}-week`,
      lead: 'week',
      meetingName: 'Gemeinderat (öffentlich)',
      sourcePapers: ['900'],
      uncoveredCount: 0,
      model: 'test-model',
    });
    // The visibility suffix belongs to the sitting's record, not the committee,
    // and is stripped before the model ever sees it.
    expect(write.mock.calls[0][0].heading).toBe('Gemeinderat am 08. August 2026');
    expect(write.mock.calls[0][0].sessionId).toBe('karlsruhe-meeting-500-week');
  });

  it('reuses a cached preview instead of calling the model again', async () => {
    const first = createWriter();
    await updateMeetingDigests([meeting], new Map([[paper.id, summary]]), {
      enabled: true,
      writer: first.writer,
      now: weekBefore,
    });
    expect(first.write).toHaveBeenCalledTimes(1);

    // The spike computed this hash and never read it back, so a daily schedule
    // regenerated every due sitting every day it stayed in window.
    const second = createWriter();
    const digests = await updateMeetingDigests([meeting], new Map([[paper.id, summary]]), {
      enabled: true,
      writer: second.writer,
      now: weekBefore,
    });
    expect(second.write).not.toHaveBeenCalled();
    expect(digests).toHaveLength(1);
  });

  it('regenerates when a consulted summary changed', async () => {
    const first = createWriter();
    await updateMeetingDigests([meeting], new Map([[paper.id, summary]]), {
      enabled: true,
      writer: first.writer,
      now: weekBefore,
    });

    const second = createWriter();
    await updateMeetingDigests(
      [meeting],
      new Map([[paper.id, { ...summary, summary: 'Die Vorlage schlägt etwas anderes vor.' }]]),
      { enabled: true, writer: second.writer, now: weekBefore },
    );
    expect(second.write).toHaveBeenCalledTimes(1);
  });

  it('omits a paper whose summary is not current this run', async () => {
    // An empty map is what `updatePaperSummaries` returns for a paper whose
    // stored summary no longer matches its source. Composing the stale text here
    // would publish through the preview exactly what the feed suppresses.
    const { writer, write } = createWriter();
    const digests = await updateMeetingDigests([meeting], new Map(), {
      enabled: true,
      writer,
      now: weekBefore,
    });
    expect(write).not.toHaveBeenCalled();
    expect(digests).toHaveLength(0);
  });

  it('counts a public agenda item without a summary as uncovered', async () => {
    const withExtraItem = structuredClone(meeting);
    withExtraItem.agendaItem!.push({
      ...withExtraItem.agendaItem![0],
      id: 'https://example.test/agendaItems/digest-2',
      number: '2',
      order: 2,
      name: 'Bericht der Verwaltung',
      consultation: undefined,
    });

    const { writer } = createWriter();
    const digests = await updateMeetingDigests([withExtraItem], new Map([[paper.id, summary]]), {
      enabled: true,
      writer,
      now: weekBefore,
    });
    expect(digests[0].uncoveredCount).toBe(1);
  });

  it('skips a sitting that is not due at either lead time', async () => {
    const { writer, write } = createWriter();
    const digests = await updateMeetingDigests([meeting], new Map([[paper.id, summary]]), {
      enabled: true,
      writer,
      now: () => new Date('2026-08-04T09:00:00Z'),
    });
    expect(write).not.toHaveBeenCalled();
    expect(digests).toHaveLength(0);
  });

  it('publishes cached previews without calling the provider when disabled', async () => {
    const first = createWriter();
    await updateMeetingDigests([meeting], new Map([[paper.id, summary]]), {
      enabled: true,
      writer: first.writer,
      now: weekBefore,
    });

    const second = createWriter();
    const digests = await updateMeetingDigests([meeting], new Map([[paper.id, summary]]), {
      enabled: false,
      writer: second.writer,
      now: weekBefore,
    });
    expect(second.write).not.toHaveBeenCalled();
    expect(digests).toHaveLength(1);
  });

  it('rejects a preview whose numbers are not in the composed source', async () => {
    // Two attempts, then the digest is dropped and retried next run — the same
    // fail-open contract as a per-paper summary.
    const { writer, write } = createWriter({
      highlights: ['TOP 1: Der Umbau kostet 2,5 Millionen Euro.'],
    });
    const digests = await updateMeetingDigests([meeting], new Map([[paper.id, summary]]), {
      enabled: true,
      writer,
      now: weekBefore,
    });
    expect(write).toHaveBeenCalledTimes(2);
    expect(digests).toHaveLength(0);
  });

  it('keeps generating after one sitting fails', async () => {
    const other = structuredClone(meeting);
    other.id = 'https://example.test/meetings/501';
    other.name = 'Hauptausschuss';
    other.agendaItem![0].id = 'https://example.test/agendaItems/digest-3';
    other.agendaItem![0].meeting = other.id;

    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error('provider exploded'))
      .mockResolvedValue({ overview: 'Vorschau.', highlights: ['TOP 1: Beratung.'] });
    const writer: MeetingDigestWriter = {
      providerName: 'test-provider',
      model: 'test-model',
      write,
    };
    const digests = await updateMeetingDigests([meeting, other], new Map([[paper.id, summary]]), {
      enabled: true,
      writer,
      now: weekBefore,
    });
    expect(digests).toHaveLength(1);
  });
});
