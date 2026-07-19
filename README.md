# Karlsruhe OParl Syndication

Generates and publishes Atom feeds of Karlsruhe city council agenda items from the official [OParl](https://oparl.org) API. Feeds are hosted via GitHub Pages.

## Live Feeds

| Feed             | URL                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| All agenda items | [`tagesordnungspunkte.xml`](https://maxliesegang.github.io/karlsruhe-oparl-syndication/tagesordnungspunkte.xml)               |
| Latest 100 items | [`tagesordnungspunkte-recent.xml`](https://maxliesegang.github.io/karlsruhe-oparl-syndication/tagesordnungspunkte-recent.xml) |

Add either URL to any RSS/Atom reader. Use the recent feed if your reader struggles with large feeds.

## How It Works

1. **Load cache** — read the persisted stores under `docs/` (per-record `meetings/`, `papers/`, `file-contents/` plus the monolithic `consultations.json` / `organizations.json`) into memory.
2. **Fetch updates** — organizations (full crawl) + meetings and papers via paginated OParl API (`limit=1000`, `modified_since = lastModified − 1 day`).
3. **Enrich** — resolve agenda items → consultations → papers → auxiliary files; fix OParl URLs.
4. **Generate** — build Atom feed, write `tagesordnungspunkte.xml` (all items) and `tagesordnungspunkte-recent.xml` (latest 100 by date).
5. **Persist** — write only the records that changed back to `docs/` for the next incremental run.

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
| `FEED_LANGUAGE`                                | `de`                             | Feed language code                                   |
| `FEED_COPYRIGHT`                               | `Kein Copyright`                 | Feed copyright notice                                |
| `AUTHOR_NAME` / `AUTHOR_EMAIL` / `AUTHOR_LINK` | —                                | Feed author                                          |
| `EXTRACT_PDF_TEXT`                             | `true`                           | Extract text from referenced PDFs                    |
| `FETCH_ALL_PAGES`                              | `true`                           | Paginate through all API pages                       |
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

### Caching

Meetings, papers, and file-contents metadata are stored one file per record under `docs/meetings/`, `docs/papers/`, and `docs/file-contents/`, so a run only rewrites the records that actually changed (keeping git history small and staying under GitHub's 100 MB-per-file limit). Consultations and organizations stay as single `docs/*.json` files. Each run is incremental — only records changed since the last run are re-fetched.

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
