import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmRunBudget, LlmUsage } from '../src/llm-budget.js';
import { runLlmWorkQueue } from '../src/llm-work-queue.js';

const reservedUsage: LlmUsage = {
  windows: [{ name: 'rolling', percent: 95, status: 'ok' }],
};

function items(...essential: boolean[]) {
  return essential.map((value, id) => ({ id, essential: value }));
}

describe('LLM work queue', () => {
  afterEach(() => vi.useRealTimers());

  it('runs batches of `concurrency` in order, splitting where essential work ends', async () => {
    const events: string[] = [];
    await runLlmWorkQueue(items(true, true, true, false, false), {
      label: 'test item',
      concurrency: 2,
      work: async ({ id }) => {
        events.push(`start ${id}`);
        await Promise.resolve();
        events.push(`end ${id}`);
      },
    });
    // The third essential item runs alone rather than sharing a batch with archive work.
    expect(events).toEqual([
      'start 0',
      'start 1',
      'end 0',
      'end 1',
      'start 2',
      'end 2',
      'start 3',
      'start 4',
      'end 3',
      'end 4',
    ]);
  });

  it('never puts essential and paced work in one batch', async () => {
    const started: number[] = [];
    await runLlmWorkQueue(items(true, false, false), {
      label: 'test item',
      concurrency: 2,
      budget: new LlmRunBudget({ readUsage: async () => reservedUsage, marginPercent: 10 }),
      work: async ({ id }) => {
        started.push(id);
      },
    });
    // Usage leaves no room for non-essential work: the essential item still runs.
    expect(started).toEqual([0]);
  });

  it('stops at the deadline', async () => {
    const work = vi.fn().mockResolvedValue(undefined);
    await runLlmWorkQueue(items(true, true), {
      label: 'test item',
      concurrency: 1,
      budget: new LlmRunBudget({ deadline: new Date(Date.now() - 1) }),
      work,
    });
    expect(work).not.toHaveBeenCalled();
  });

  it('reads account usage at most every two minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    const readUsage = vi.fn().mockResolvedValue({ windows: [] });
    const budget = new LlmRunBudget({ readUsage });

    await budget.check(false);
    await budget.check(false);
    expect(readUsage).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date('2026-11-04T12:02:00Z'));
    await budget.check(false);
    expect(readUsage).toHaveBeenCalledTimes(2);
  });
});
