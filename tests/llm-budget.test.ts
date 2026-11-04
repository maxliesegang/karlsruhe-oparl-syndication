import { describe, expect, it } from 'vitest';
import { archiveUsageThreshold, classifyLlmUsage, LlmUsage } from '../src/llm-budget.js';
import { parseOpenCodeUsage } from '../src/services/llm/opencode-usage.js';

const now = new Date('2026-11-04T12:00:00Z');

function usage(weeklyPercent: number, weeklyResetsAt: string, status = 'ok'): LlmUsage {
  return {
    windows: [
      { name: 'rolling', percent: 0, status: 'ok', resetsAt: '2026-11-04T16:00:00Z' },
      { name: 'weekly', percent: weeklyPercent, status, resetsAt: weeklyResetsAt },
      { name: 'monthly', percent: 3, status: 'ok', resetsAt: '2026-11-25T18:50:36Z' },
    ],
  };
}

describe('LLM budget', () => {
  it('paces weekly and monthly usage along a line from -margin to 100', () => {
    const weekly = (resetsAt: string) => ({ name: 'weekly', percent: 0, status: 'ok', resetsAt });
    // Just reset: below zero, so no archive work on the first hours of the week.
    expect(archiveUsageThreshold(weekly('2026-11-11T12:00:00Z'), 10, now)).toBeCloseTo(-10);
    // Half the week gone: (100 + 10) x 0.5 - 10.
    expect(archiveUsageThreshold(weekly('2026-11-08T00:00:00Z'), 10, now)).toBeCloseTo(45);
    // Moments before the reset, everything left may be used.
    expect(archiveUsageThreshold(weekly('2026-11-04T12:00:01Z'), 10, now)).toBeCloseTo(100);
  });

  it('measures the monthly window from the subscription date, not as 30 days', () => {
    // 10 of the 31 days from 2026-10-25 to the 2026-11-25 reset have passed.
    const monthly = { name: 'monthly', percent: 0, status: 'ok', resetsAt: '2026-11-25T12:00:00Z' };
    expect(archiveUsageThreshold(monthly, 10, now)).toBeCloseTo(110 * (10 / 31) - 10, 5);
  });

  it('gives the rolling burst window and unknown windows a flat ceiling', () => {
    // The rolling window starts with the run itself, so a line would read ~0% here.
    const freshRolling = {
      name: 'rolling',
      percent: 0,
      status: 'ok',
      resetsAt: '2026-11-04T17:00:00Z',
    };
    expect(archiveUsageThreshold(freshRolling, 10, now)).toBe(90);
    expect(archiveUsageThreshold({ name: 'daily', percent: 0, status: 'ok' }, 10, now)).toBe(90);
    expect(archiveUsageThreshold({ name: 'weekly', percent: 0, status: 'ok' }, 10, now)).toBe(90);
  });

  it('classifies usage into exhausted, reserved, available and unknown', () => {
    expect(classifyLlmUsage(undefined, 10, now)).toBe('unknown');
    expect(classifyLlmUsage(usage(100, '2026-11-09T00:00:00Z'), 10, now)).toBe('exhausted');
    expect(classifyLlmUsage(usage(10, '2026-11-09T00:00:00Z', 'limited'), 10, now)).toBe(
      'exhausted',
    );
    // Weekly at 20% with 2.5 of 7 days gone: the line is at ~29%, so still available …
    expect(classifyLlmUsage(usage(20, '2026-11-09T00:00:00Z'), 10, now)).toBe('available');
    // … but the same 20% right after a reset is ahead of the line.
    expect(classifyLlmUsage(usage(20, '2026-11-11T12:00:00Z'), 10, now)).toBe('reserved');
  });

  it('parses the OpenCode usage response and rejects anything else', () => {
    const body = {
      usage: {
        rolling: { status: 'ok', percent: 0, resetsAt: '2026-11-04T13:31:12.000Z' },
        weekly: { status: 'ok', percent: 1, resetsAt: '2026-11-09T00:00:00.000Z' },
        monthly: { status: 'ok', percent: 3, resetsAt: '2026-11-25T18:50:36.000Z' },
      },
    };
    expect(parseOpenCodeUsage(body)?.windows.map((window) => window.name)).toEqual([
      'rolling',
      'weekly',
      'monthly',
    ]);
    expect(parseOpenCodeUsage({ error: 'Unauthorized' })).toBeUndefined();
    expect(parseOpenCodeUsage({ usage: { weekly: { percent: '1' } } })).toBeUndefined();
    expect(parseOpenCodeUsage(null)).toBeUndefined();
  });
});
