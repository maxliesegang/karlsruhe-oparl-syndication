import { createRetryingHttpClient } from '../../api/http-client.js';
import { LlmUsage, LlmUsageWindow } from '../../llm-budget.js';
import { logger } from '../../logger.js';

const USAGE_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Reads the OpenCode Go account's usage: one entry per billing window (`rolling`
 * 5 h, `weekly`, `monthly`), each with a whole-number `percent`, a `status` and
 * `resetsAt`. Measured 2026-11-04:
 *
 *   {"usage":{"rolling":{"status":"ok","percent":0,"resetsAt":"…"},
 *             "weekly":{"status":"ok","percent":1,"resetsAt":"…"},
 *             "monthly":{"status":"ok","percent":3,"resetsAt":"…"}}}
 *
 * The endpoint is **undocumented** (discovered in farion1231/cc-switch#6433) but
 * takes the ordinary API key, unlike the console's own status route, which needs a
 * browser session. It covers the whole account, so another project using the same
 * subscription is counted too. Returns undefined on any failure or unexpected
 * shape: the caller must treat unknown usage as "do only the necessary work".
 */
export async function fetchOpenCodeUsage(options: {
  apiKey: string;
  baseUrl: string;
}): Promise<LlmUsage | undefined> {
  try {
    const client = createRetryingHttpClient({ timeout: USAGE_REQUEST_TIMEOUT_MS });
    const response = await client.get<unknown>(new URL('usage', options.baseUrl).toString(), {
      headers: { Authorization: `Bearer ${options.apiKey}` },
    });
    const usage = parseOpenCodeUsage(response.data);
    if (!usage)
      logger.warn('OpenCode usage response had an unexpected shape; treating usage as unknown.');
    return usage;
  } catch (error) {
    logger.warn('Could not read OpenCode usage; treating it as unknown.', error);
    return undefined;
  }
}

export function parseOpenCodeUsage(body: unknown): LlmUsage | undefined {
  const usage = (body as { usage?: unknown } | null)?.usage;
  if (!usage || typeof usage !== 'object') return undefined;
  const windows: LlmUsageWindow[] = [];
  for (const [name, value] of Object.entries(usage as Record<string, unknown>)) {
    const window = value as { percent?: unknown; status?: unknown; resetsAt?: unknown } | null;
    if (typeof window?.percent !== 'number' || typeof window.status !== 'string') continue;
    windows.push({
      name,
      percent: window.percent,
      status: window.status,
      ...(typeof window.resetsAt === 'string' ? { resetsAt: window.resetsAt } : {}),
    });
  }
  return windows.length > 0 ? { windows } : undefined;
}
