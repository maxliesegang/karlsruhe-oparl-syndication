import { describe, expect, it } from 'vitest';
import { comparePromptVersions, isPublishablePromptVersion } from '../src/prompt-versions.js';

describe('prompt versions', () => {
  it('compares numerically within one family only', () => {
    expect(comparePromptVersions('paper-de-v10', 'paper-de-v9')).toBeGreaterThan(0);
    expect(comparePromptVersions('paper-de-v7', 'paper-de-v7')).toBe(0);
    expect(comparePromptVersions('paper-de-v7', 'meeting-de-v7')).toBeUndefined();
    expect(comparePromptVersions('paper-de', 'paper-de-v7')).toBeUndefined();
  });

  it('publishes the current version and older ones down to the minimum', () => {
    expect(isPublishablePromptVersion('paper-de-v8', 'paper-de-v8', 'paper-de-v7')).toBe(true);
    expect(isPublishablePromptVersion('paper-de-v7', 'paper-de-v8', 'paper-de-v7')).toBe(true);
    expect(isPublishablePromptVersion('paper-de-v5', 'paper-de-v8', 'paper-de-v7')).toBe(false);
  });

  it('never publishes a foreign, unparseable or newer-than-current version', () => {
    expect(isPublishablePromptVersion('other-v8', 'paper-de-v8', 'paper-de-v7')).toBe(false);
    expect(isPublishablePromptVersion('experiment', 'paper-de-v8', 'paper-de-v7')).toBe(false);
    // A record from a version this checkout does not know yet, e.g. after a revert.
    expect(isPublishablePromptVersion('paper-de-v9', 'paper-de-v8', 'paper-de-v7')).toBe(false);
  });
});
