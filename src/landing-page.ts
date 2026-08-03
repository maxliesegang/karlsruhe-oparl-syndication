import { config } from './config.js';
import { RECENT_FEED_MAX_ITEMS } from './constants.js';
import { FILTERED_FEED_INDEX_FILENAME, FilteredFeedDescriptor } from './filtered-feed-contract.js';
import { atomicWriteFile, docsPath } from './file-utils.js';
import { logger } from './logger.js';

/** Landing page for the published GitHub Pages site. */
export const LANDING_PAGE_FILENAME = 'index.html';

export interface LandingPageInput {
  /** Descriptors returned by `writeFilteredFeeds`, so the page lists exactly the
   *  feeds that were actually written this run. */
  filteredFeeds: FilteredFeedDescriptor[];
  /** Entries in the main feed after `FEED_MAX_ITEMS` capping. */
  fullFeedEntryCount: number;
}

/**
 * A machine-readable artifact published under `docs/`, as advertised to consumers.
 *
 * Everything in `docs/` is served by GitHub Pages whether or not it is meant to be
 * consumed, so `internal` marks the files that exist for the pipeline's own
 * bookkeeping. Listing them and saying so is more honest than omitting them —
 * they are reachable either way — and stops a viewer author from building on a
 * file whose shape we change freely.
 */
interface DataArtifact {
  path: string;
  description: string;
  internal?: boolean;
}

const DATA_ARTIFACTS: readonly DataArtifact[] = [
  {
    path: FILTERED_FEED_INDEX_FILENAME,
    description: 'Verzeichnis aller gefilterten Feeds mit Titel, URL, Typ und Eintragszahl.',
  },
  {
    path: 'paper-submitters.json',
    description:
      'Antragstellende Fraktion(en) je Vorlage, plus das vollständige Fraktionsverzeichnis. ' +
      'Schlüssel ist der Dateiname unter papers/, dort stehen Titel, Datum und Aktenzeichen.',
  },
  {
    path: 'paper-stadtteile.json',
    description:
      'Erkannte Stadtteile je Vorlage, getrennt nach "primary" (Vorlage handelt davon, ' +
      'speist die Stadtteil-Feeds) und "mentioned" (nur beiläufig genannt). Schlüssel ist ' +
      'der Dateiname unter papers/.',
  },
  {
    path: 'papers/',
    description:
      'Eine JSON-Datei je Vorlage, unverändert aus der OParl-API: papers/<id>.json, ' +
      'wobei <id> das letzte Segment der OParl-URL ist.',
  },
  {
    path: 'meetings/',
    description: 'Eine JSON-Datei je Sitzung inklusive Tagesordnungspunkten: meetings/<id>.json.',
  },
  {
    path: 'file-contents/',
    description:
      'Je Anhang eine Metadaten-Datei file-contents/<id>.json und der extrahierte PDF-Text ' +
      'als gleichnamige .txt-Datei.',
  },
  {
    path: 'summaries/papers/',
    description:
      'Maschinell erzeugte Kurzfassungen je Vorlage (LLM, mit Quell-Hash): ' +
      'summaries/papers/<id>.json.',
  },
  {
    path: 'consultations.json',
    description: 'Beratungsfolgen, die Tagesordnungspunkte mit Vorlagen verbinden.',
  },
  {
    path: 'organizations.json',
    description: 'Gremien und Ämter, auf die Sitzungen verweisen.',
  },
  {
    path: 'generation-manifest.json',
    description: 'Laufzeitprotokoll des letzten Durchlaufs.',
    internal: true,
  },
  {
    path: 'consultation-resolution-failures.json',
    description: 'Wiederholungszustand für Vorlagen, die die API nicht herausgibt.',
    internal: true,
  },
];

const FEED_TYPE_HEADINGS: Record<FilteredFeedDescriptor['type'], string> = {
  committee: 'Gremien',
  district: 'Stadtteile',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** German thousands separator, so "1.000 Einträge" reads naturally on the page. */
function formatCount(value: number): string {
  return value.toLocaleString('de-DE');
}

function renderFeedCard(title: string, description: string, path: string): string {
  return `        <div class="feed-card">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
          <div class="feed-url">
            <a href="${escapeHtml(path)}">${escapeHtml(path)}</a>
            <button class="copy-btn" onclick="copyUrl(this)">Kopieren</button>
          </div>
        </div>`;
}

function renderFilteredFeedGroup(
  feeds: FilteredFeedDescriptor[],
  type: FilteredFeedDescriptor['type'],
): string {
  // Sorted by display title, not by path: committee paths are opaque numeric ids, so
  // path order would scatter the names arbitrarily. Still fully deterministic.
  const group = feeds
    .filter((feed) => feed.type === type)
    .sort((a, b) => a.title.localeCompare(b.title, 'de') || a.path.localeCompare(b.path));
  if (group.length === 0) return '';

  const rows = group
    .map(
      (feed) =>
        `            <li>
              <a href="${escapeHtml(feed.path)}">${escapeHtml(stripFeedTitlePrefix(feed.title))}</a>
              <span class="count">${formatCount(feed.entryCount)}</span>
            </li>`,
    )
    .join('\n');

  return `          <h3>${FEED_TYPE_HEADINGS[type]} (${group.length})</h3>
          <ul class="feed-list">
${rows}
          </ul>`;
}

/** Feed titles are "Tagesordnungspunkte – <name>"; the page heading already says that. */
function stripFeedTitlePrefix(title: string): string {
  return title.replace(/^Tagesordnungspunkte\s+–\s+/, '');
}

function renderDataArtifact(artifact: DataArtifact): string {
  const badge = artifact.internal ? ' <span class="badge">intern</span>' : '';
  const label = `<code>${escapeHtml(artifact.path)}</code>`;
  // Directories are shown unlinked: GitHub Pages serves no directory listing, so a
  // link to `papers/` would just 404. The description says how to address a record.
  const name = artifact.path.endsWith('/')
    ? label
    : `<a href="${escapeHtml(artifact.path)}">${label}</a>`;
  return `          <li>
            ${name}${badge}
            <p>${escapeHtml(artifact.description)}</p>
          </li>`;
}

/**
 * Renders the landing page.
 *
 * Deterministic by construction: it carries no run timestamp and no counter that
 * moves on its own, so an unchanged dataset produces byte-identical HTML and git
 * dedupes the blob — the same contract the feeds and the JSON indexes hold to.
 *
 * Generated rather than hand-maintained because the hand-written page drifted:
 * it advertised "Neueste 50" long after the recent feed moved to 100 entries, and
 * it never gained a link to any artifact added after it was committed.
 */
export function buildLandingPage(input: LandingPageInput): string {
  const recentEntryCount = Math.min(input.fullFeedEntryCount, RECENT_FEED_MAX_ITEMS);
  const filteredFeeds = [...input.filteredFeeds].sort((a, b) => a.path.localeCompare(b.path));

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Karlsruhe Tagesordnungspunkte – Atom Feeds</title>
    <style>
      :root {
        --bg: #ffffff;
        --fg: #1a1a1a;
        --muted: #555;
        --border: #e0e0e0;
        --accent: #005b99;
        --accent-hover: #003f6b;
        --card-bg: #f7f9fc;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #121212;
          --fg: #e8e8e8;
          --muted: #999;
          --border: #2e2e2e;
          --accent: #5aabdd;
          --accent-hover: #82c4ed;
          --card-bg: #1e1e1e;
        }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background: var(--bg);
        color: var(--fg);
        line-height: 1.6;
        padding: 2rem 1rem;
      }
      main {
        max-width: 600px;
        margin: 0 auto;
      }
      h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
      }
      .subtitle {
        color: var(--muted);
        font-size: 0.95rem;
        margin-bottom: 2rem;
      }
      .feeds {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 2rem;
      }
      .feed-card {
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 1.25rem 1.5rem;
      }
      .feed-card h2 {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
      .feed-card p {
        color: var(--muted);
        font-size: 0.875rem;
        margin-bottom: 0.75rem;
      }
      .feed-url {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .feed-url a {
        color: var(--accent);
        font-family: monospace;
        font-size: 0.8rem;
        word-break: break-all;
        text-decoration: none;
      }
      .feed-url a:hover {
        color: var(--accent-hover);
        text-decoration: underline;
      }
      .copy-btn {
        background: none;
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--muted);
        cursor: pointer;
        font-size: 0.75rem;
        padding: 0.2rem 0.5rem;
        white-space: nowrap;
      }
      .copy-btn:hover { color: var(--fg); }
      .copy-btn.copied { color: green; }
      section {
        margin-bottom: 2rem;
      }
      section > h2 {
        font-size: 1.1rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
      }
      section > p {
        color: var(--muted);
        font-size: 0.875rem;
        margin-bottom: 1rem;
      }
      details {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.75rem 1rem;
      }
      summary {
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
      }
      details h3 {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
        margin: 1rem 0 0.25rem;
      }
      .feed-list {
        list-style: none;
        font-size: 0.875rem;
      }
      .feed-list li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.15rem 0;
      }
      .feed-list a {
        color: var(--accent);
        text-decoration: none;
      }
      .feed-list a:hover {
        color: var(--accent-hover);
        text-decoration: underline;
      }
      .feed-list .count {
        color: var(--muted);
        font-size: 0.8rem;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .data-list {
        list-style: none;
      }
      .data-list li {
        border-top: 1px solid var(--border);
        padding: 0.6rem 0;
      }
      .data-list a {
        color: var(--accent);
        text-decoration: none;
      }
      .data-list a:hover {
        text-decoration: underline;
      }
      .data-list code {
        font-size: 0.85rem;
      }
      .data-list p {
        color: var(--muted);
        font-size: 0.8rem;
      }
      .badge {
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--muted);
        font-size: 0.7rem;
        padding: 0.05rem 0.35rem;
        vertical-align: 0.1em;
      }
      footer {
        color: var(--muted);
        font-size: 0.8rem;
        border-top: 1px solid var(--border);
        padding-top: 1rem;
      }
      footer a { color: inherit; }
    </style>
  </head>
  <body>
    <main>
      <h1>Karlsruher Tagesordnungspunkte</h1>
      <p class="subtitle">
        Atom-Feeds der Tagesordnungspunkte aus den Sitzungen aller Karlsruher Gremien,
        generiert aus dem <a href="https://web1.karlsruhe.de/oparl/" style="color:var(--accent)">OParl-API</a>.
      </p>

      <div class="feeds">
${renderFeedCard(
  'Alle Tagesordnungspunkte',
  `Vollständiger Feed mit ${formatCount(input.fullFeedEntryCount)} Einträgen ` +
    `(höchstens ${formatCount(config.feedMaxItemCount)}).`,
  config.feedFileName,
)}

${renderFeedCard(
  `Neueste ${formatCount(RECENT_FEED_MAX_ITEMS)} Tagesordnungspunkte`,
  `Kompakter Feed mit den ${formatCount(recentEntryCount)} zuletzt aktualisierten Einträgen – ` +
    'empfohlen für RSS-Reader.',
  config.recentFeedFileName,
)}
      </div>

      <section>
        <h2>Gefilterte Feeds</h2>
        <p>
          Je ein Feed pro Gremium und pro Stadtteil (${formatCount(filteredFeeds.length)} insgesamt).
          Maschinenlesbar als <a href="${FILTERED_FEED_INDEX_FILENAME}"><code>${FILTERED_FEED_INDEX_FILENAME}</code></a>.
        </p>
        <details>
          <summary>Alle ${formatCount(filteredFeeds.length)} Feeds anzeigen</summary>
${renderFilteredFeedGroup(filteredFeeds, 'committee')}
${renderFilteredFeedGroup(filteredFeeds, 'district')}
        </details>
      </section>

      <section>
        <h2>Daten</h2>
        <p>
          Alle Feeds entstehen aus diesen Dateien. Sie liegen unter derselben Adresse und können
          direkt weiterverwendet werden. Mit <em>intern</em> markierte Dateien gehören zur
          Pipeline-Buchhaltung – ihr Format kann sich jederzeit ändern.
        </p>
        <ul class="data-list">
${DATA_ARTIFACTS.map(renderDataArtifact).join('\n')}
        </ul>
      </section>

      <footer>
        Datenquelle: <a href="https://sitzungskalender.karlsruhe.de">Stadtrats-Informationssystem Karlsruhe</a> ·
        <a href="https://github.com/maxliesegang/karlsruhe-oparl-syndication">GitHub</a>
      </footer>
    </main>

    <script>
      function copyUrl(btn) {
        const a = btn.parentElement.querySelector('a');
        navigator.clipboard.writeText(a.href).then(() => {
          btn.textContent = 'Kopiert!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Kopieren';
            btn.classList.remove('copied');
          }, 2000);
        });
      }
    </script>
  </body>
</html>
`;
}

export async function writeLandingPage(input: LandingPageInput): Promise<void> {
  await atomicWriteFile(docsPath(LANDING_PAGE_FILENAME), buildLandingPage(input));
  logger.info(
    `Generated ${LANDING_PAGE_FILENAME} linking ${input.filteredFeeds.length} filtered feed(s) ` +
      `and ${DATA_ARTIFACTS.length} data artifact(s)`,
  );
}
