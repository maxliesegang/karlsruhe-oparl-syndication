import { describe, expect, it } from 'vitest';
import {
  buildReviewContext,
  parseSimilarityReview,
  mergeReviewJudgments,
  reviewEvidence,
} from '../src/spike/paper-similarity-review.js';
import { OParlFile, Paper } from '../src/types/index.js';

const row = (label: string, candidate = '2', suffix = '') =>
  `- [${label}] \`0.250\` title <!-- 1 ${candidate} -->${suffix}`;

describe('similarity review', () => {
  it('adds follow-up judgments and resolves uncertainty without changing the original review', () => {
    const original = parseSimilarityReview([row('s'), row('?', '3')].join('\n'));
    const followUp = parseSimilarityReview(
      [
        row('n', '3', ' <!-- reviewer: assistant; confidence: medium -->'),
        row('t', '4', ' <!-- reviewer: assistant; confidence: high -->'),
      ].join('\n'),
    );
    const result = mergeReviewJudgments(original, followUp);
    expect(
      result.map(({ candidateId, label, reviewer }) => ({ candidateId, label, reviewer })),
    ).toEqual([
      { candidateId: '2', label: 's', reviewer: 'human' },
      { candidateId: '3', label: 'n', reviewer: 'assistant' },
      { candidateId: '4', label: 't', reviewer: 'assistant' },
    ]);
    expect(original[1].label).toBe('?');
    expect(mergeReviewJudgments(original, parseSimilarityReview(row('s')))[0].reviewer).toBe(
      'human',
    );
    expect(() => mergeReviewJudgments(original, parseSimilarityReview(row('n')))).toThrow(
      'Conflicting resolved review judgments',
    );
  });

  it('keeps human judgments separate from provisional assistant labels and uncertainty', () => {
    const entries = parseSimilarityReview(
      [
        '### First query',
        row('s'),
        row('n', '3', ' <!-- reviewer: assistant; confidence: high -->'),
        row('?', '4', ' <!-- reviewer: assistant; confidence: low -->'),
        row(' ', '5'),
      ].join('\n'),
    );
    expect(
      entries.map(({ label, reviewer, confidence, rank }) => ({
        label,
        reviewer,
        confidence,
        rank,
      })),
    ).toEqual([
      { label: 's', reviewer: 'human', confidence: undefined, rank: 1 },
      { label: 'n', reviewer: 'assistant', confidence: 'high', rank: 2 },
      { label: '?', reviewer: 'assistant', confidence: 'low', rank: 3 },
      { label: ' ', reviewer: 'human', confidence: undefined, rank: 4 },
    ]);
  });

  it('rejects malformed labels/provenance and duplicate pairs instead of silently dropping them', () => {
    expect(() => parseSimilarityReview(row('x'))).toThrow('Malformed');
    expect(() => parseSimilarityReview(row('s', '2', ' <!-- reviewer: assitant -->'))).toThrow(
      'Malformed',
    );
    expect(() => parseSimilarityReview(`${row('s')}\n${row('n')}`)).toThrow('Duplicate');
  });

  it('provides original evidence with working relative links, prioritizes the proposal, and omits minutes', () => {
    const files = [
      {
        id: 'https://example.org/files/map',
        name: 'Lageplan',
        accessUrl: 'https://example.org/map.pdf',
      },
      {
        id: 'https://example.org/files/own',
        name: 'Beschlussvorlage',
        accessUrl: 'https://example.org/own.pdf',
      },
      { id: 'https://example.org/files/minutes', name: 'Protokoll GR' },
    ] as OParlFile[];
    const paper = {
      id: 'https://example.org/papers/1',
      name: 'Campus',
      auxiliaryFile: files,
    } as Paper;
    const candidate = {
      ...paper,
      id: 'https://example.org/papers/2',
      name: 'Second campus',
      auxiliaryFile: [],
    };
    const text = new Map([
      ['own', 'Kurzfassung\nA new laboratory is proposed.\nBegründung\nDetails'],
      ['map', 'Map furniture'],
      ['minutes', 'Unrelated meeting'],
    ]);
    const entries = parseSimilarityReview(row('s'));
    const before = JSON.stringify(entries);
    const result = buildReviewContext(
      entries,
      new Map([
        ['1', paper],
        ['2', candidate],
      ]),
      (file) => text.get(file.id.split('/').at(-1)!),
    );
    expect(result).toContain('A new laboratory is proposed.');
    expect(result).toContain('../../../docs/file-contents/own.txt');
    expect(result).toContain('[PDF](<https://example.org/own.pdf>)');
    expect(result).not.toContain('Unrelated meeting');
    expect(result).not.toContain('Map furniture');
    expect(result).toContain('No usable original text');
    expect(result).not.toContain('0.250');
    expect(files[0].name).toBe('Lageplan');
    expect(JSON.stringify(entries)).toBe(before);
  });

  it('gets past long budget forms and flags glyph-only extraction rather than inventing context', () => {
    const file = { id: 'https://example.org/files/own', name: 'Antrag' } as OParlFile;
    const paper = {
      id: 'https://example.org/papers/1',
      name: 'Lighting',
      auxiliaryFile: [file],
    } as Paper;
    const text =
      'Budget table and letterhead\n'.repeat(100) +
      '\n\uF075 Sachverhalt | Begründung\nKeep the lighting at the exercise area.\n';
    const evidence = reviewEvidence(paper, undefined, () => text);
    expect(evidence).toContain('> Keep the lighting at the exercise area.');
    expect(evidence).not.toContain('Budget table');
    expect(reviewEvidence(paper, undefined, () => '☒ ☐  ')).toContain('No usable original text');
  });

  it('fails clearly if a frozen pair no longer resolves, rather than replacing the sample', () => {
    expect(() =>
      buildReviewContext(parseSimilarityReview(row('s')), new Map(), () => undefined),
    ).toThrow('Reviewed paper 1 is absent');
  });
});
