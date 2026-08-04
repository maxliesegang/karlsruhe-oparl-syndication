import { describe, expect, it } from 'vitest';

import { ReferenceIndex, ExclusiveReferenceIndex } from '../src/store/reference-index.js';

describe('ReferenceIndex', () => {
  it('resolves every owner of a shared key', () => {
    const index = new ReferenceIndex();
    index.setReferences('paper-1', ['file-a', 'file-b']);
    index.setReferences('paper-2', ['file-b']);

    expect([...(index.getReferrers('file-b') ?? [])]).toEqual(['paper-1', 'paper-2']);
    expect([...(index.getReferrers('file-a') ?? [])]).toEqual(['paper-1']);
  });

  it('drops keys an owner no longer references, keeping the ones it still does', () => {
    const index = new ReferenceIndex();
    index.setReferences('paper-1', ['file-a', 'file-b']);
    index.setReferences('paper-1', ['file-b', 'file-c']);

    expect(index.getReferrers('file-a')).toBeUndefined();
    expect([...(index.getReferrers('file-b') ?? [])]).toEqual(['paper-1']);
    expect([...(index.getReferrers('file-c') ?? [])]).toEqual(['paper-1']);
  });

  it('leaves another owner attached when one owner stops referencing a shared key', () => {
    const index = new ReferenceIndex();
    index.setReferences('paper-1', ['file-a']);
    index.setReferences('paper-2', ['file-a']);
    index.setReferences('paper-1', []);

    expect([...(index.getReferrers('file-a') ?? [])]).toEqual(['paper-2']);
  });

  it('removes an owner from every key it referenced', () => {
    const index = new ReferenceIndex();
    index.setReferences('paper-1', ['file-a', 'file-b']);
    index.setReferences('paper-2', ['file-b']);
    index.removeReferrer('paper-1');

    expect(index.getReferrers('file-a')).toBeUndefined();
    expect([...(index.getReferrers('file-b') ?? [])]).toEqual(['paper-2']);
  });

  it('forgets everything on clear', () => {
    const index = new ReferenceIndex();
    index.setReferences('paper-1', ['file-a']);
    index.clear();

    expect(index.getReferrers('file-a')).toBeUndefined();
  });
});

describe('ExclusiveReferenceIndex', () => {
  it('resolves a key to its owner, last writer winning', () => {
    const index = new ExclusiveReferenceIndex();
    index.setReferences('paper-1', ['consultation-1']);
    index.setReferences('paper-2', ['consultation-1']);

    expect(index.getReferrer('consultation-1')).toBe('paper-2');
  });

  it('does not let a re-indexed record release a key another record now owns', () => {
    const index = new ExclusiveReferenceIndex();
    index.setReferences('paper-1', ['consultation-1']);
    index.setReferences('paper-2', ['consultation-1']);
    // paper-1 is re-indexed without the consultation it lost to paper-2.
    index.setReferences('paper-1', []);

    expect(index.getReferrer('consultation-1')).toBe('paper-2');
  });

  it('releases keys the owner stopped referencing', () => {
    const index = new ExclusiveReferenceIndex();
    index.setReferences('paper-1', ['consultation-1', 'consultation-2']);
    index.setReferences('paper-1', ['consultation-2']);

    expect(index.getReferrer('consultation-1')).toBeUndefined();
    expect(index.getReferrer('consultation-2')).toBe('paper-1');
  });

  it('releases every key on removal', () => {
    const index = new ExclusiveReferenceIndex();
    index.setReferences('paper-1', ['consultation-1']);
    index.removeReferrer('paper-1');

    expect(index.getReferrer('consultation-1')).toBeUndefined();
  });
});
