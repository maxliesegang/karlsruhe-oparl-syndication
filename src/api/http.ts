import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { config } from '../config.js';
import { correctUrl } from '../utils.js';
import { logger } from '../logger.js';

/** Configured axios instance with retry logic */
const httpClient: AxiosInstance = axios.create({
  timeout: 30000,
});

/** HTTP statuses that are safe and worth retrying (rate limiting / transient unavailability). */
const RETRYABLE_STATUS = new Set([429, 503]);

axiosRetry(httpClient, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    // Honor Retry-After (seconds) when the server provides it, e.g. on 429/503.
    const retryAfter = Number(error?.response?.headers?.['retry-after']);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return retryAfter * 1000;
    }
    return retryCount * 1000;
  },
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.code === 'ECONNABORTED' ||
    (error.response?.status !== undefined && RETRYABLE_STATUS.has(error.response.status)),
});

export { httpClient, correctUrl };

/** Delay helper */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A queue that processes HTTP requests sequentially with configurable delay.
 * Prevents overwhelming the API with concurrent requests.
 */
class RequestQueue {
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
      if (elapsed < config.requestDelay) {
        await delay(config.requestDelay - elapsed);
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

  /** Resets the queue statistics (useful between different fetch operations) */
  resetStats(): void {
    this.completedCount = 0;
    this.totalCount = 0;
  }
}

export const requestQueue = new RequestQueue();

/** Formats a Date for use in API URL parameters */
export function formatDateForUrl(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/** Response type for paginated API endpoints */
export interface PaginatedResponse<T> {
  data: T[];
  links: {
    next?: string;
  };
}

/**
 * Fetches all pages from a paginated API endpoint.
 * Uses the request queue to respect rate limits.
 */
export async function fetchAllPages<T>(
  initialUrl: string,
  onPage: (items: T[]) => void,
  options?: { modifiedSince?: Date; fetchAllPages?: boolean },
): Promise<{ pageCount: number; totalItems: number }> {
  let nextUrl: string | null = initialUrl;

  if (options?.modifiedSince) {
    const formatted = formatDateForUrl(options.modifiedSince);
    nextUrl += `&modified_since=${encodeURIComponent(formatted)}`;
    logger.info(`Using modified_since: ${formatted}`);
  }

  let pageCount = 0;
  let totalItems = 0;

  while (nextUrl) {
    const url = correctUrl(nextUrl);
    logger.debug(`Fetching: ${url}`);

    const response = await requestQueue.add<AxiosResponse<PaginatedResponse<T>>>(() =>
      httpClient.get<PaginatedResponse<T>>(url),
    );

    const items = response.data.data;
    onPage(items);

    pageCount++;
    totalItems += items.length;
    logger.debug(`Fetched page ${pageCount} with ${items.length} items. Total: ${totalItems}`);

    const shouldContinue = options?.fetchAllPages !== false && response.data.links.next;
    nextUrl = shouldContinue ? response.data.links.next! : null;
  }

  return { pageCount, totalItems };
}

/**
 * Fetches a single resource by URL with error handling.
 * Returns null if the resource is not found (404).
 */
export async function fetchOne<T>(url: string): Promise<T | null> {
  const correctedUrl = correctUrl(url);

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
