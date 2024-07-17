// src/api/common.ts
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { config } from '../config';
import { correctUrl } from '../utils';

// Configure axios-retry
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 1000; // Wait 1s, 2s, 3s between retries
  },
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNABORTED';
  },
});

// Add a delay function
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Implement a simple request queue with logging
export class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;
  private totalRequests = 0;
  private completedRequests = 0;

  async add(request: () => Promise<void>): Promise<void> {
    this.queue.push(request);
    this.totalRequests++;
    if (!this.running) {
      this.running = true;
      await this.process();
    }
  }

  private async process() {
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        await request();
        this.completedRequests++;
        this.logProgress();
        await delay(config.requestDelay); // Add delay between requests
      }
    }
    this.running = false;
  }

  private logProgress() {
    const percentage = ((this.completedRequests / this.totalRequests) * 100).toFixed(2);
    console.log(`Progress: ${this.completedRequests}/${this.totalRequests} (${percentage}%)`);
  }
}

export const formatDateForUrl = (date: Date): string => {
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
};

export const requestQueue = new RequestQueue();

export { correctUrl };
