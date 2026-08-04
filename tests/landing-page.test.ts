import { describe, expect, it } from 'vitest';

import { buildLandingPage } from '../src/landing-page.js';
import { RECENT_FEED_MAX_ITEM_COUNT } from '../src/constants.js';
import { FilteredFeedDescriptor } from '../src/filtered-feed-contract.js';

function descriptor(overrides: Partial<FilteredFeedDescriptor> = {}): FilteredFeedDescriptor {
  return {
    type: 'committee',
    id: 'https://web1.karlsruhe.de/oparl/bodies/0001/organizations/gr/28964',
    title: 'Tagesordnungspunkte – Haupt- und Finanzausschuss',
    path: 'gremien/28964.xml',
    url: 'https://example.test/gremien/28964.xml',
    entryCount: 770,
    ...overrides,
  };
}

const input = {
  filteredFeeds: [
    descriptor(),
    descriptor({
      type: 'district',
      id: 'Durlach',
      title: 'Tagesordnungspunkte – Durlach',
      path: 'stadtteile/durlach.xml',
      entryCount: 42,
    }),
  ],
  fullFeedEntryCount: 1000,
};

describe('landing page', () => {
  it('is byte-identical for identical input', () => {
    // Same contract as the feeds and JSON indexes: an unchanged dataset must not
    // produce a diff, so the page carries no run timestamp.
    expect(buildLandingPage(input)).toBe(buildLandingPage(input));
    expect(buildLandingPage(input)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('links every filtered feed that was written', () => {
    const html = buildLandingPage(input);

    for (const feed of input.filteredFeeds) {
      expect(html).toContain(`href="${feed.path}"`);
    }
    expect(html).toContain('Gremien (1)');
    expect(html).toContain('Stadtteile (1)');
  });

  it('links the published data artifacts and marks the internal ones', () => {
    const html = buildLandingPage(input);

    for (const path of ['feed-index.json', 'paper-submitters.json', 'paper-stadtteile.json']) {
      expect(html).toContain(`href="${path}"`);
    }
    // Served but not a consumer contract — the page must say so rather than imply
    // these are safe to build on.
    expect(html).toContain('<a href="generation-manifest.json"><code>generation-manifest.json');
    expect(html).toMatch(/generation-manifest\.json<\/code><\/a> <span class="badge">intern/);
  });

  it('does not link the per-record directories', () => {
    // GitHub Pages serves no directory listing, so href="papers/" would 404.
    const html = buildLandingPage(input);

    expect(html).toContain('<code>papers/</code>');
    expect(html).not.toContain('href="papers/"');
    expect(html).not.toContain('href="summaries/papers/"');
  });

  it('states the real recent-feed size instead of a hard-coded one', () => {
    // The hand-written page this replaced still advertised "Neueste 50" long after
    // the recent feed moved to 100 entries.
    const html = buildLandingPage(input);

    expect(html).toContain(`Neueste ${RECENT_FEED_MAX_ITEM_COUNT} Tagesordnungspunkte`);
    expect(html).not.toContain('Neueste 50 ');
  });

  it('reports the recent feed as capped by the available entries', () => {
    const html = buildLandingPage({ ...input, fullFeedEntryCount: 7 });

    expect(html).toContain('den 7 zuletzt aktualisierten Einträgen');
  });

  it('escapes feed titles', () => {
    const html = buildLandingPage({
      ...input,
      filteredFeeds: [descriptor({ title: 'Tagesordnungspunkte – Bau & <Planung>' })],
    });

    expect(html).toContain('Bau &amp; &lt;Planung&gt;');
    expect(html).not.toContain('<Planung>');
  });
});
