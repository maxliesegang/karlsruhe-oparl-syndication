import { describe, expect, it } from 'vitest';
import { findKarlsruheDistricts } from '../src/karlsruhe-districts.js';

describe('findKarlsruheDistricts', () => {
  it('finds full names with alternate compound separators', () => {
    expect(findKarlsruheDistricts('Treffen in Innenstadt West und Beiertheim–Bulach')).toEqual([
      'Beiertheim-Bulach',
      'Innenstadt-West',
    ]);
  });

  it('maps distinctive compound-name parts without duplicates', () => {
    expect(
      findKarlsruheDistricts('Weiherfeld liegt bei Dammerstock. Weiherfeld bleibt genannt.'),
    ).toEqual(['Weiherfeld-Dammerstock']);
  });

  it('does not match words that only contain a district name', () => {
    expect(findKarlsruheDistricts('Die Durlacher Allee')).toEqual([]);
  });
});
