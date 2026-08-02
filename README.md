# Karlsruhe OParl Syndication

Generates and publishes Atom feeds of Karlsruhe city council agenda items from the official [OParl](https://oparl.org) API. Feeds are hosted via GitHub Pages.

## Live Feeds

| Feed                          | URL                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Latest 1,000 items            | [`tagesordnungspunkte.xml`](https://maxliesegang.github.io/karlsruhe-oparl-syndication/tagesordnungspunkte.xml)               |
| Latest 100 items              | [`tagesordnungspunkte-recent.xml`](https://maxliesegang.github.io/karlsruhe-oparl-syndication/tagesordnungspunkte-recent.xml) |
| Committee and Stadtteil feeds | [`feed-index.json`](https://maxliesegang.github.io/karlsruhe-oparl-syndication/feed-index.json)                               |

Add a feed URL to any RSS/Atom reader. Use the recent feed if your reader struggles with large feeds, or choose a focused feed from the index.

## How It Works

1. **Load cache** — read the persisted stores under `docs/` (per-record `meetings/`, `papers/`, `file-contents/`, `summaries/papers/` plus the monolithic `consultations.json` / `organizations.json`) into memory.
2. **Fetch updates** — organizations (full crawl) + meetings and papers via paginated OParl API (`limit=1000`, `modified_since = lastModified − 1 day`).
3. **Enrich** — join agenda items → meetings → organizations → consultations → papers → auxiliary files, update Stadtteil matches, and optionally refresh cached LLM paper summaries; fix OParl URLs.
4. **Generate** — build the main and recent Atom feeds plus filtered feeds under `gremien/` and `stadtteile/`.
5. **Persist** — write only the records that changed back to `docs/` for the next incremental run.

### Filtered feeds and categories

Every public agenda item is enriched once and then reused by all outputs. The scraper publishes:

- `gremien/<organization-id>.xml` for each referenced committee or organization.
- `stadtteile/<stadtteil-slug>.xml` for each detected Karlsruhe district.
- `feed-index.json`, a deterministic directory containing each feed's title, URL, filter id, type, and entry count.

Entries in every Atom feed also include categories for their organizations, Stadtteile, and paper type. Stadtteil assignment is based on the paper title and extracted text, so one item may occur in several district feeds.

The main, committee, and Stadtteil feeds contain at most `FEED_MAX_ITEMS` entries (1,000 by default). This only limits the subscription-facing XML; the stores under `docs/` remain a complete archive. The recent feed remains fixed at 100 entries.

## Local Development

**Requirements:** Node.js ≥ 24 (see `.node-version`), npm

```sh
npm ci                          # install dependencies
npm run generate                # run the full pipeline (TypeScript via tsx)
npm run serve                   # serve docs/ at http://localhost:8080
```

Other scripts:

```sh
npm run build        # compile TypeScript → dist/
npm start            # run compiled build
npm run typecheck    # type-check only
npm run lint         # ESLint
npm run format       # Prettier
```

Verbose logging: `LOG_LEVEL=debug npm run generate`

### Configuration

All options can be set via environment variables or a `.env` file at the repo root.

| Variable                                       | Default                          | Description                                          |
| ---------------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| `MEETINGS_API_URL`                             | Karlsruhe endpoint               | OParl meetings list URL                              |
| `PAPERS_API_URL`                               | Karlsruhe endpoint               | OParl papers list URL                                |
| `ORGANIZATIONS_API_URL`                        | Karlsruhe endpoint               | OParl organizations list URL                         |
| `FEED_TITLE`                                   | `Alle Tagesordnungspunkte`       | Feed title                                           |
| `FEED_DESCRIPTION`                             | —                                | Feed description                                     |
| `FEED_ID` / `FEED_LINK`                        | Public GitHub Pages URL          | Feed identity and link                               |
| `FEED_FILENAME`                                | `tagesordnungspunkte.xml`        | Full feed output filename                            |
| `FEED_FILENAME_RECENT`                         | `tagesordnungspunkte-recent.xml` | Recent feed output filename                          |
| `FEED_MAX_ITEMS`                               | `1000`                           | Maximum entries in main and filtered feeds           |
| `FEED_LANGUAGE`                                | `de`                             | Feed language code                                   |
| `FEED_COPYRIGHT`                               | `Kein Copyright`                 | Feed copyright notice                                |
| `AUTHOR_NAME` / `AUTHOR_EMAIL` / `AUTHOR_LINK` | —                                | Feed author                                          |
| `EXTRACT_PDF_TEXT`                             | `true`                           | Extract text from referenced PDFs                    |
| `FETCH_ALL_PAGES`                              | `true`                           | Paginate through all API pages                       |
| `GENERATE_LLM_SUMMARIES`                       | `false`                          | Generate cached summaries for public papers          |
| `LLM_API_KEY`                                  | —                                | OpenCode Go API key                                  |
| `LLM_BASE_URL`                                 | OpenCode Go endpoint             | OpenAI-compatible API base URL                       |
| `LLM_MODEL`                                    | `mimo-v2.5`                      | Model used for summaries                             |
| `SUMMARY_PROMPT_VERSION`                       | `paper-de-v3`                    | Cache-busting prompt version                         |
| `SUMMARY_MAX_ITEMS_PER_RUN`                    | `100`                            | Maximum papers generated per run                     |
| `SUMMARY_MAX_INPUT_CHARS`                      | `100000`                         | Maximum source characters per LLM request            |
| `SUMMARY_CONCURRENCY`                          | `2`                              | Concurrent paper-summary jobs                        |
| `SUMMARY_REQUEST_TIMEOUT_MS`                   | `60000`                          | Per-request timeout                                  |
| `REQUEST_DELAY`                                | `1000`                           | Delay between API requests (ms)                      |
| `FULL_RECONCILIATION_INTERVAL_DAYS`            | `7`                              | Days between authoritative full meeting/paper crawls |
| `PDF_DOWNLOAD_TIMEOUT_MS`                      | `30000`                          | Per-PDF download timeout (ms)                        |
| `PDF_MAX_CONTENT_BYTES`                        | `52428800`                       | Max PDF download size (50 MiB)                       |

### PDF Text Extraction

Papers reference auxiliary PDF files. When `EXTRACT_PDF_TEXT=true`, recent files (modified within the last 3 years) are fetched and parsed. Extracted text is used for Stadtteil (neighbourhood) detection.

- Queue: up to 10 concurrent extractions, ~1 s batch delay, capped at 1000 queued items.
- Downloads share the API retry policy (3 attempts; honours `Retry-After`; retries network errors, timeouts, and 429/503) and are bounded by `PDF_DOWNLOAD_TIMEOUT_MS` and `PDF_MAX_CONTENT_BYTES`.
- Output: per-file metadata `docs/file-contents/<id>.json` plus the extracted text `docs/file-contents/<id>.txt` (the metadata never contains the text itself).
- Disable: `EXTRACT_PDF_TEXT=false`.

### LLM paper summaries

When `GENERATE_LLM_SUMMARIES=true`, public agenda items with papers dated 2026 or later and
extracted attachment text receive a concise German summary. Summaries are generated once per
paper, reused across agenda items and stored as canonical per-record JSON under
`docs/summaries/papers/`.

Cache validity is based on a SHA-256 hash of the paper metadata and current extracted text.
Changed sources are regenerated; a stale summary is never published while regeneration is
failing. Long inputs are summarized in chunks and synthesized. Provider failures do not stop
the normal feed run, and `SUMMARY_MAX_ITEMS_PER_RUN` bounds gradual archive backfills.

The prompt forbids derived calculations, preserves qualifiers, interprets only visibly selected
checkboxes, and requires clear attribution of requests, administrative recommendations, proposals,
and decisions. It favors three to four strong key points instead of padding the result. A
deterministic grounding check rejects every numeric literal absent from the source. One focused
correction is attempted; if it still contains an unsupported number, that summary is omitted and
retried on the next run.

The scheduled workflow expects an `OPENCODE_API_KEY` repository secret. For a local trial:

```sh
GENERATE_LLM_SUMMARIES=true LLM_API_KEY=... npm run generate
```

Every feed summary is labelled as automatically generated and links remain available to the
authoritative original documents.

### Caching

Meetings, papers, file-contents metadata, and paper summaries are stored one file per record under `docs/meetings/`, `docs/papers/`, `docs/file-contents/`, and `docs/summaries/papers/`, so a run only rewrites the records that actually changed (keeping git history small and staying under GitHub's 100 MB-per-file limit). Consultations and organizations stay as single `docs/*.json` files. Each run is incremental — only records changed since the last run are re-fetched.

```sh
# Ignore incremental cursors and perform a full reconciliation while preserving the archive:
npm run generate -- --clear-cache

# Full reset (re-fetches and re-extracts everything):
rm -rf docs/meetings docs/papers docs/file-contents docs/*.json && npm run generate -- --clear-cache
```

## Deployment

GitHub Actions runs `npm run generate` on a schedule and commits updated `docs/` artifacts. GitHub Pages serves `docs/` directly.

To deploy manually: run `npm run generate`, commit the updated `docs/` files, and push.

## Contributing

Please run `npm run typecheck && npm run lint` before opening a PR. If your changes affect generated output, include updated `docs/` artifacts.
