import { logger } from './logger.js';

/**
 * Everything one run may spend on LLM work, shared by every LLM step (paper
 * summaries, meeting previews, …) so a later step gets what the earlier ones left:
 *
 * - **Time.** No new request starts after the deadline; whatever is left is picked
 *   up by the next run, because every LLM output is content-addressed and cached.
 *   This — not a per-request timeout — keeps a run short when the provider is slow.
 * - **Account quota.** Read from the provider at most every `USAGE_REFRESH_MS`
 *   (see `classifyLlmUsage`): an exhausted window stops all work, and work that is
 *   not essential (archive backfill) runs only below the pacing line.
 *
 * A step without a budget is unlimited, which is what tests and targeted
 * single-paper runs want.
 */
export class LlmRunBudget {
  private usageState: LlmUsageState = 'available';
  private usageReadAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly options: {
      deadline?: Date;
      /** The provider account's usage; without it, quota never limits the run. */
      readUsage?: () => Promise<LlmUsage | undefined>;
      /** Safety margin of the pacing line; see `archiveUsageThreshold`. */
      marginPercent?: number;
    } = {},
  ) {}

  /** Whether a request may start now, and if not, why. */
  async check(essential: boolean): Promise<LlmBudgetDecision> {
    if (this.options.deadline && Date.now() >= this.options.deadline.getTime()) {
      return 'deadline';
    }
    await this.refreshUsage();
    if (this.usageState === 'exhausted') return 'exhausted';
    if (!essential && this.usageState !== 'available') return 'paced';
    return 'go';
  }

  private async refreshUsage(): Promise<void> {
    if (!this.options.readUsage || Date.now() - this.usageReadAt < USAGE_REFRESH_MS) return;
    // Set first, so concurrent checks do not each fire a request.
    this.usageReadAt = Date.now();
    const usage = await this.options.readUsage();
    const now = new Date();
    const marginPercent = this.options.marginPercent ?? 0;
    this.usageState = classifyLlmUsage(usage, marginPercent, now);
    logger.info(
      `LLM account usage: ${describeLlmUsage(usage, marginPercent, now)} → ${this.usageState}.`,
    );
  }
}

export type LlmBudgetDecision = 'go' | 'deadline' | 'exhausted' | 'paced';

/**
 * How often the account's usage is re-read during a run. A summary takes ~20 s
 * and usage is reported in whole percent, so a few minutes of lag costs at most a
 * percent or two past a line, while a read per request would only add load.
 */
const USAGE_REFRESH_MS = 2 * 60 * 1000;

export function createLlmDeadline(budgetMinutes: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + budgetMinutes * 60_000);
}

/** One billing window of the provider account, e.g. the rolling 5 h or the monthly one. */
export interface LlmUsageWindow {
  name: string;
  /** Share of the window's limit already used, 0–100. */
  percent: number;
  /** `ok` while requests are accepted. */
  status: string;
  resetsAt?: string;
}

export interface LlmUsage {
  windows: LlmUsageWindow[];
}

/**
 * What the account's usage allows this run to spend:
 *
 * - `exhausted` — a window is used up: no LLM work at all, retried next run.
 * - `reserved` — a window has reached its archive threshold (see
 *   `archiveUsageThreshold`): only papers in the summary window, so the remaining
 *   quota stays available for current entries and anything else on the account.
 * - `available` — archive backfill may use the spare capacity.
 * - `unknown` — usage could not be read: treated like `reserved`.
 *
 * Every window is judged on its own and the strictest decides: pacing the monthly
 * window alone could let a late catch-up burst run into the weekly limit (50% of
 * the monthly one), which would block current papers too until Monday.
 */
export type LlmUsageState = 'exhausted' | 'reserved' | 'available' | 'unknown';

/**
 * Windows that are budgets to spread over time, with their length. Observed
 * 2026-11-04: `weekly` resets Monday 00:00 UTC; `monthly` runs from the
 * subscription date to the same date next month (28–31 days), not 30 days.
 */
const PACED_WINDOW_LENGTH_MS: Record<string, (resetsAt: Date) => number> = {
  weekly: () => 7 * 24 * 60 * 60 * 1000,
  monthly: (resetsAt) => {
    const start = new Date(resetsAt);
    start.setUTCMonth(start.getUTCMonth() - 1);
    return resetsAt.getTime() - start.getTime();
  },
};

/**
 * Usage percentage up to which archive backfill may run in this window.
 *
 * A paced window (weekly, monthly) follows a straight line from `−margin` right
 * after a reset to 100 at the next one: `(100 + margin) × elapsed − margin`. So
 * the archive can never get ahead of an even spread — nothing on the first days,
 * when the demand of current papers is still unknown — and whatever stays unused
 * raises the line, until all of it may be used just before the reset, where it
 * would be lost anyway.
 *
 * The `rolling` 5 h window is a burst limit, not a budget: it starts with the
 * first request after the previous one expired, i.e. usually with this very run,
 * so a line would read ~0% at every fresh start and block the archive on every
 * other run. It, and any window this code does not know, gets a flat ceiling of
 * `100 − margin` instead. A paced window without a usable reset time is treated
 * the same way.
 */
export function archiveUsageThreshold(
  window: LlmUsageWindow,
  marginPercent: number,
  now: Date,
): number {
  const resetsAt = window.resetsAt ? new Date(window.resetsAt) : undefined;
  const length = PACED_WINDOW_LENGTH_MS[window.name];
  if (!length || !resetsAt || Number.isNaN(resetsAt.getTime())) return 100 - marginPercent;
  const remaining = resetsAt.getTime() - now.getTime();
  const elapsedShare = 1 - Math.min(1, Math.max(0, remaining / length(resetsAt)));
  return (100 + marginPercent) * elapsedShare - marginPercent;
}

export function classifyLlmUsage(
  usage: LlmUsage | undefined,
  marginPercent: number,
  now: Date = new Date(),
): LlmUsageState {
  if (!usage) return 'unknown';
  if (usage.windows.some((window) => window.status !== 'ok' || window.percent >= 100)) {
    return 'exhausted';
  }
  const reserved = usage.windows.some(
    (window) => window.percent >= archiveUsageThreshold(window, marginPercent, now),
  );
  return reserved ? 'reserved' : 'available';
}

export function describeLlmUsage(
  usage: LlmUsage | undefined,
  marginPercent: number,
  now: Date = new Date(),
): string {
  if (!usage) return 'unknown';
  return usage.windows
    .map(
      (window) =>
        `${window.name} ${window.percent}% (archive up to ` +
        `${Math.floor(archiveUsageThreshold(window, marginPercent, now))}%)`,
    )
    .join(', ');
}
