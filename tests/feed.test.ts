import { afterEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('fs/promises', () => ({ default: fsMocks }));

import { config } from '../src/config.js';
import { createFeed, writeTrimmedFeedToFile } from '../src/feed.js';

describe('feed identity', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses absolute HTTPS production URLs in the default metadata', async () => {
    expect(new URL(config.feedId).protocol).toBe('https:');
    expect(new URL(config.feedLink).protocol).toBe('https:');
    expect(new URL(config.authorLink).protocol).toBe('https:');
    expect(config.feedId).not.toContain('localhost');

    const feed = await createFeed([], new Date('2026-07-18T12:00:00Z'));
    expect(() => feed.atom1()).not.toThrow();
  });

  it('gives the recent feed its own id and self link', async () => {
    const fullFeed = await createFeed([], new Date('2026-07-18T12:00:00Z'));

    await writeTrimmedFeedToFile(fullFeed);

    const xml = fsMocks.writeFile.mock.calls[0]?.[1];
    expect(xml).toEqual(expect.any(String));
    expect(xml).toContain(
      `<id>${new URL(config.feedFilenameRecent, config.feedLink).toString()}</id>`,
    );
    expect(xml).toContain(
      `rel="self" href="${new URL(config.feedFilenameRecent, config.feedLink).toString()}"`,
    );
    expect(xml).not.toContain(`<id>${config.feedId}</id>`);
  });
});
