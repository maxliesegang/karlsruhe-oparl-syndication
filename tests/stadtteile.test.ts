import { describe, expect, it } from 'vitest';
import { findStadtteile } from '../src/stadtteile.js';

describe('findStadtteile', () => {
  it('finds full names with alternate compound separators', () => {
    expect(findStadtteile('Treffen in Innenstadt West und Beiertheim–Bulach')).toEqual([
      'Beiertheim-Bulach',
      'Innenstadt-West',
    ]);
  });

  it('maps distinctive compound-name parts without duplicates', () => {
    expect(findStadtteile('Weiherfeld liegt bei Dammerstock. Weiherfeld bleibt genannt.')).toEqual([
      'Weiherfeld-Dammerstock',
    ]);
  });

  it('does not match words that only contain a district name', () => {
    expect(findStadtteile('Die Durlacher Allee')).toEqual([]);
  });
});
