import { describe, expect, it } from 'vitest';
import { mapInBatches } from '../src/store/record-files.js';

describe('mapInBatches', () => {
  it('preserves result order while limiting concurrency', async () => {
    let active = 0;
    let peak = 0;

    const results = await mapInBatches(
      [1, 2, 3, 4, 5],
      async (value) => {
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active--;
        return value * 2;
      },
      2,
    );

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });

  it.each([0, -1, 1.5])('rejects invalid batch size %s', async (batchSize) => {
    await expect(mapInBatches([], async () => undefined, batchSize)).rejects.toThrow(RangeError);
  });
});
