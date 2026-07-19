import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios';
import axiosRetry from 'axios-retry';

/** HTTP statuses that are safe and worth retrying (rate limiting / transient unavailability). */
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

/**
 * Creates an axios instance wired with the project's shared retry policy: three
 * attempts, honoring `Retry-After`, and retrying network errors, timeouts, and
 * 429/503 responses. Callers pass endpoint-specific defaults (timeout, headers,
 * response type). Sharing one factory keeps every outbound request — API pages
 * and PDF downloads alike — resilient to the same transient failures.
 */
export function createRetryingHttpClient(defaults?: CreateAxiosDefaults): AxiosInstance {
  const client = axios.create(defaults);
  axiosRetry(client, {
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
      (error.response?.status !== undefined && RETRYABLE_STATUS_CODES.has(error.response.status)),
  });
  return client;
}
