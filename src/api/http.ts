import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config.js';
import { delay, normalizeOParlUrl } from '../utils.js';
import { logger } from '../logger.js';
import { createRetryingHttpClient } from './http-client.js';

/** Shared client for OParl JSON collections and resources. */
const httpClient: AxiosInstance = createRetryingHttpClient({
  timeout: 30000,
  // Ask for JSON explicitly so a misconfigured endpoint is less likely to answer
  // with an HTML error page that would parse into a non-collection body.
  headers: { Accept: 'application/json' },
});

export { httpClient, normalizeOParlUrl };

/**
 * A queue that processes HTTP requests sequentially with configurable delay.
 * Prevents overwhelming the API with concurrent requests.
 */
class RateLimitedRequestQueue {
  private queue: Array<{
    execute: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private isProcessing = false;
  private completedCount = 0;
  private totalCount = 0;
  /** Wall-clock time of the last dispatched request; used to enforce a minimum interval. */
  private lastRequestTime = 0;

  /**
   * Adds a request to the queue and returns its result when processed.
   */
  async add<T>(request: () => Promise<T>): Promise<T> {
    this.totalCount++;

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: request as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      // Throttle by elapsed wall-clock time rather than queue depth. Callers typically await
      // each request before enqueuing the next, so the queue drains to empty between requests;
      // gating on queue length (the old behavior) therefore never delayed anything.
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < config.requestIntervalMs) {
        await delay(config.requestIntervalMs - elapsed);
      }
      this.lastRequestTime = Date.now();

      try {
        const result = await item.execute();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }

      this.completedCount++;
      this.logProgress();
    }

    this.isProcessing = false;
  }

  private logProgress(): void {
    const percentage = ((this.completedCount / this.totalCount) * 100).toFixed(1);
    logger.debug(`Progress: ${this.completedCount}/${this.totalCount} (${percentage}%)`);
  }
}

export const requestQueue = new RateLimitedRequestQueue();

/** Formats a Date for use in API URL parameters */
export function formatOParlDateQueryValue(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/** Response type for paginated API endpoints */
export interface OParlCollectionResponse<T> {
  data: T[];
  links: {
    next?: string;
  };
}

/**
 * Fetches all pages from a paginated API endpoint.
 * Uses the request queue to respect rate limits.
 */
export async function fetchPaginatedCollection<T>(
  initialUrl: string,
  onPage: (items: T[]) => void,
  options?: { modifiedSince?: Date; followPagination?: boolean },
): Promise<{ pageCount: number; totalItems: number }> {
  let nextUrl: string | null = initialUrl;

  if (options?.modifiedSince) {
    const formatted = formatOParlDateQueryValue(options.modifiedSince);
    nextUrl += `&modified_since=${encodeURIComponent(formatted)}`;
    logger.info(`Using modified_since: ${formatted}`);
  }

  let pageCount = 0;
  let totalItems = 0;
  // Guard against a self-referential or cyclic `next` looping forever and
  // hammering the API; a repeated URL terminates the crawl.
  const visitedUrls = new Set<string>();

  while (nextUrl) {
    const url = normalizeOParlUrl(nextUrl);
    if (visitedUrls.has(url)) {
      throw new Error(
        `Pagination cycle detected at ${url} after ${pageCount} page(s); collection is incomplete.`,
      );
    }
    visitedUrls.add(url);
    logger.debug(`Fetching: ${url}`);

    const response = await requestQueue.add<AxiosResponse<OParlCollectionResponse<T>>>(() =>
      httpClient.get<OParlCollectionResponse<T>>(url),
    );

    // An HTTP 200 with a non-collection body is still an incomplete crawl. Fail
    // explicitly so a full reconciliation cannot be checkpointed as successful.
    const body = response.data as Partial<OParlCollectionResponse<T>> | undefined;
    if (!Array.isArray(body?.data)) {
      throw new Error(`Response from ${url} had no data array; collection is incomplete.`);
    }
    const items = body.data;
    onPage(items);

    pageCount++;
    totalItems += items.length;
    logger.debug(`Fetched page ${pageCount} with ${items.length} items. Total: ${totalItems}`);

    const next = body?.links?.next;
    const shouldContinue =
      options?.followPagination !== false && typeof next === 'string' && next.length > 0;
    nextUrl = shouldContinue ? next : null;
  }

  return { pageCount, totalItems };
}

/**
 * Fetches a single resource by URL with error handling.
 * Returns null if the resource is not found (404).
 */
export async function fetchOParlResource<T>(url: string): Promise<T | null> {
  const correctedUrl = normalizeOParlUrl(url);

  try {
    const response = await requestQueue.add<AxiosResponse<T>>(() =>
      httpClient.get<T>(correctedUrl),
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      logger.warn(`Resource not found: ${url}`);
      return null;
    }
    throw error;
  }
}
