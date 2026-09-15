import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../src/docs-files.js';
import {
  CURRENT_ID_PREFIX,
  LEGACY_ID_PREFIX,
  migrateJsonDocument,
} from '../src/migrate-oparl-host.js';

const paperRecord = {
  auxiliaryFile: [
    {
      downloadUrl: `${LEGACY_ID_PREFIX}0001/downloadfiles/00143887.pdf`,
      id: `${LEGACY_ID_PREFIX}0001/files/143887`,
    },
  ],
  id: `${LEGACY_ID_PREFIX}0001/papers/ag/1`,
  name: 'Linke-Städt. Klinikum Karlsruhe',
};

describe('migrateJsonDocument', () => {
  it('rewrites every stored id and keeps the file canonical', () => {
    const before = canonicalStringify(paperRecord);

    const result = migrateJsonDocument(before, 'docs/papers/1.json');

    expect(result.occurrences).toBe(3);
    expect(result.canonicalityVerified).toBe(true);
    expect(result.contents).toBe(canonicalStringify(JSON.parse(result.contents ?? '')));
    expect(result.contents).not.toContain(LEGACY_ID_PREFIX);
    expect(JSON.parse(result.contents ?? '').id).toBe(`${CURRENT_ID_PREFIX}0001/papers/ag/1`);
  });

  it('leaves a file without the legacy prefix untouched', () => {
    const before = canonicalStringify({ id: `${CURRENT_ID_PREFIX}0001/papers/ag/1` });

    expect(migrateJsonDocument(before, 'docs/papers/1.json')).toEqual({
      canonicalityVerified: false,
      contents: null,
      occurrences: 0,
    });
  });

  it('does not require a non-canonical generated artifact to become canonical', () => {
    // feed-index.json is written with plain JSON.stringify and rebuilt each run.
    const before = JSON.stringify([{ path: 'gremien/28964.xml', id: `${LEGACY_ID_PREFIX}0001/x` }]);

    const result = migrateJsonDocument(before, 'docs/feed-index.json');

    expect(result.canonicalityVerified).toBe(false);
    expect(result.contents).toContain(CURRENT_ID_PREFIX);
  });

  it('rejects a rewrite that would reorder canonical keys', () => {
    // A URL used as an object key is the one case where the swap could move a
    // key past its neighbour; canonical output would then no longer match.
    const before = canonicalStringify({
      [`${LEGACY_ID_PREFIX}z`]: 1,
      'https://web1a.karlsruhe.de/': 2,
    });

    expect(() => migrateJsonDocument(before, 'docs/example.json')).toThrow(/key ordering/);
  });
});
