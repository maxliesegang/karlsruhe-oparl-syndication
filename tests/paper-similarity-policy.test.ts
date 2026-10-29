import { describe, expect, it } from 'vitest';
import { createPaperSimilarityPolicy } from '../src/paper-similarity-policy.js';
import { Paper } from '../src/types/index.js';

function paper(id: string, name: string, reference = `2026/${id.padStart(4, '0')}`): Paper {
  return {
    id: `https://example.test/papers/${id}`,
    name,
    reference,
    auxiliaryFile: [],
    date: '2026-01-01',
  } as unknown as Paper;
}

describe('paper similarity publication policy', () => {
  it('rejects routine paperwork and shared planning formulas while keeping a real subject', () => {
    const papers = [
      paper('1', 'Annahme des Angebots von Zuwendungen'),
      paper('2', 'Annahme des Angebots von Zuwendungen'),
      paper('3', 'Bebauungsplan Ahaweg: Aufstellungsbeschluss gemäß BauGB'),
      paper('4', 'Bebauungsplan Rüppurrer Straße: Aufstellungsbeschluss gemäß BauGB'),
      paper('5', 'Beleuchtung der Calisthenics-Anlage'),
      paper('6', 'Erfahrungsbericht Calisthenics-Anlagen'),
    ];
    const policy = createPaperSimilarityPolicy(papers, () => undefined, {});
    expect(policy.isExcluded('1', '2')).toBe(true);
    expect(policy.isExcluded('3', '4')).toBe(true);
    expect(policy.isExcluded('5', '6')).toBe(false);
  });

  it('requires actual parcel overlap instead of matching a common street and legal form', () => {
    const papers = [
      paper('1', 'Rückerwerb Grundstück Nr. 1290, Kaiserstraße'),
      paper('2', 'Verkauf Grundstück Nr. 1837, Kaiserstraße'),
      paper('3', 'Verlängerung Erbbaurecht Grundstück Nr. 1290, Kaiserstraße'),
    ];
    const policy = createPaperSimilarityPolicy(papers, () => undefined, {});
    expect(policy.isExcluded('1', '2')).toBe(true);
    expect(policy.isExcluded('1', '3')).toBe(false);
  });

  it('groups whole title/reference families without following citation hubs', () => {
    const papers = [
      paper('1', 'Stadthalle Modernisierung', '2026/0010'),
      paper('2', 'Andere Fassung Stadthalle', '2026/0010/1'),
      paper('3', 'Stadthalle Modernisierung', '2025/0030'),
      paper('4', 'Stadthalle Brandschutz'),
    ];
    const policy = createPaperSimilarityPolicy(papers, () => undefined, {
      '1': { '4': ['cites'] },
    });
    expect(policy.familyOf('1')).toBe(policy.familyOf('2'));
    expect(policy.familyOf('1')).toBe(policy.familyOf('3'));
    expect(policy.familyOf('1')).not.toBe(policy.familyOf('4'));
    expect(policy.isExcluded('2', '3')).toBe(true);
    expect(policy.isExcluded('1', '4')).toBe(true);
  });
});
