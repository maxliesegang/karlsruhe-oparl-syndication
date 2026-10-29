import { describe, expect, it } from 'vitest';
import { findSimilarPapers } from '../src/paper-similarity.js';
import {
  scoreReviewQueries,
  summarizeRecommendations,
} from '../src/spike/compare-paper-similarity.js';
import { parseSimilarityReview } from '../src/spike/paper-similarity-review.js';

describe('frozen similarity comparison', () => {
  const documents = [
    { id: 'q', text: 'Stadthalle Sanierung' },
    { id: 'a', text: 'Stadthalle Sanierung' },
    { id: 'b', text: 'Stadthalle Technik' },
    ...Array.from({ length: 40 }, (_, i) => ({
      id: `filler-${i}`,
      text: `Thema${'x'.repeat(i + 1)}`,
    })),
  ];
  const entries = parseSimilarityReview('- [s] `0.5` match <!-- q b -->');
  const relations = { version: 1 as const, papers: { q: { a: ['same-title' as const] } } };

  it('matches production ranking/exclusion and re-scores frozen pairs even when no longer recommended', () => {
    const actual = scoreReviewQueries(documents, entries, relations);
    const production = findSimilarPapers(documents, {
      maximumNeighborCount: 5,
      minimumScore: 0,
      isExcluded: (id, other) => id === 'q' && other === 'a',
    });
    expect(actual.q.neighbors).toEqual(production.get('q'));
    expect(actual.q.reviewed.b.rank).toBe(1);
    const changed = scoreReviewQueries(
      documents.map((doc) => (doc.id === 'b' ? { ...doc, text: 'Velodrom' } : doc)),
      entries,
      relations,
    );
    expect(changed.q.reviewed.b).toEqual({ score: 0, rank: null });
    expect(entries[0].label).toBe('s');
  });

  it('counts unknown and uncertain new results separately instead of calling them successes or failures', () => {
    const queries = {
      q: {
        reviewed: {},
        neighbors: [
          { id: 'b', score: 0.9 },
          { id: 'unreviewed', score: 0.8 },
          { id: 'uncertain', score: 0.7 },
          { id: 'bad', score: 0.6 },
        ],
      },
    };
    const labels = parseSimilarityReview(
      [
        '- [s] `0.9` match <!-- q b -->',
        '- [?] `0.7` uncertain <!-- q uncertain -->',
        '- [n] `0.6` bad <!-- q bad -->',
      ].join('\n'),
    );
    expect(summarizeRecommendations(queries, labels, 0.1, 5)).toEqual({
      slots: 4,
      useful: 1,
      unhelpful: 1,
      unresolved: 2,
      usefulQueries: 1,
    });
    expect(summarizeRecommendations(queries, labels, 0.85)).toEqual({
      slots: 1,
      useful: 1,
      unhelpful: 0,
      unresolved: 0,
      usefulQueries: 1,
    });
  });

  it('applies the same family policy as the published recommendations', () => {
    const policy = {
      isExcluded: () => false,
      familyOf: (id: string) => (id === 'a' || id === 'b' ? 'family' : id),
    };
    const scored = scoreReviewQueries(documents, entries, { version: 1, papers: {} }, policy);
    const production = findSimilarPapers(documents, {
      maximumNeighborCount: 3,
      minimumScore: 0,
      isExcluded: policy.isExcluded,
      familyOf: policy.familyOf,
    });
    expect(scored.q.neighbors).toEqual(production.get('q'));
    expect(scored.q.neighbors.map((entry) => entry.id)).toEqual(['a']);
    expect(scored.q.reviewed.b.rank).toBeNull();
  });
});
