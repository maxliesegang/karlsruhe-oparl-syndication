import { LlmBudgetDecision, LlmRunBudget } from './llm-budget.js';
import { logger } from './logger.js';

/** A unit of LLM work. Essential work runs regardless of quota pacing; see `LlmRunBudget`. */
export interface LlmWorkItem {
  essential: boolean;
}

/**
 * Runs `work` over `items` in order, `concurrency` at a time, asking `budget`
 * before each batch and stopping at its first refusal; the items left over are
 * picked up by the next run. Items must be ordered by importance, essential ones
 * first, so a refusal never strands an essential item behind a deferred one. A
 * batch never mixes essential and non-essential items, so pacing applies exactly.
 *
 * Every LLM step goes through here, so the time budget, quota pacing and their log
 * lines behave the same for all of them.
 */
export async function runLlmWorkQueue<T extends LlmWorkItem>(
  items: readonly T[],
  options: {
    /** Singular noun for log lines, e.g. "paper summary". */
    label: string;
    concurrency: number;
    budget?: LlmRunBudget;
    work: (item: T) => Promise<void>;
  },
): Promise<void> {
  const budget = options.budget ?? new LlmRunBudget();
  let offset = 0;
  while (offset < items.length) {
    const first = items[offset];
    const decision = await budget.check(first.essential);
    if (decision !== 'go') {
      logStop(decision, items.length - offset, options.label);
      return;
    }
    const batch = [first];
    for (
      let next = offset + 1;
      next < items.length &&
      batch.length < options.concurrency &&
      items[next].essential === first.essential;
      next++
    ) {
      batch.push(items[next]);
    }
    await Promise.all(batch.map(options.work));
    offset += batch.length;
  }
}

function logStop(decision: Exclude<LlmBudgetDecision, 'go'>, remaining: number, label: string) {
  const items = `${remaining} ${label}(s)`;
  if (decision === 'deadline') {
    logger.info(`LLM time budget used up; ${items} left for the next run.`);
  } else if (decision === 'exhausted') {
    // Not an outage: the quota resets on its own. Deliberately not the
    // "attempt(s) failed this run" phrase the workflow alarms on.
    logger.warn(`LLM quota exhausted; ${items} left for the next run.`);
  } else {
    logger.info(`Paced by account usage; ${items} wait for spare capacity.`);
  }
}
