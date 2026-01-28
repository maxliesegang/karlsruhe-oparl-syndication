# Karlsruhe OParl Syndication

Generates and publishes an Atom feed of Karlsruhe city council agenda items from the official OParl API. The published feed is hosted via GitHub Pages.

## Live Feed
- Atom URL: `https://maxliesegang.github.io/karlsruhe-oparl-syndication/tagesordnungspunkte.xml`
- Add the URL to any RSS/Atom reader to stay updated on new agenda items.

## How It Works (Pipeline)
1. Load cached data from `docs/*.json` and `docs/file-contents*` into in-memory stores.
2. Fetch organizations (full crawl) plus meetings and papers with pagination (`limit=1000`). Meetings and papers use `modified_since = lastModified - 1 day` for incremental updates unless `FETCH_ALL_PAGES=false`.
3. Enrich agenda items with consultation/paper info and auxiliary files; fix URLs via `correctUrl`.
4. Generate Atom feed and persist artifacts into `docs/` for GitHub Pages: `tagesordnungspunkte.xml`, `meetings.json`, `papers.json`, `consultations.json`, `organizations.json`, and extracted PDF text.

## Requirements
- Node.js >= 20 and npm (use `npm ci`).
- Network access to Karlsruhe OParl endpoints.

## Local Development
- Install: `npm ci`
- Run pipeline (TypeScript): `npm run generate`
- Build JS: `npm run build`
- Run compiled build: `npm start`
- Serve generated feed locally: `npm run serve` (serves `docs/` on http://localhost:8080)
- Quality: `npm run typecheck`, `npm run lint`, `npm run lint:fix`, `npm run format`
- Verbose logs: `LOG_LEVEL=debug npm run generate`

### Configuration (env or `.env`)
- API: `MEETINGS_API_URL`, `PAPERS_API_URL`, `ORGANIZATIONS_API_URL`
- Feed: `FEED_TITLE`, `FEED_DESCRIPTION`, `FEED_ID`, `FEED_LINK`, `FEED_FILENAME`, `FEED_LANGUAGE`, `FEED_COPYRIGHT`
- Author: `AUTHOR_NAME`, `AUTHOR_EMAIL`, `AUTHOR_LINK`
- Flags: `EXTRACT_PDF_TEXT` (default true), `FETCH_ALL_PAGES` (default true)
- Rate limit: `REQUEST_DELAY` (ms, default 1000)

### PDF Text Extraction
- PDFs referenced by papers are fetched and parsed when their `fileModified` is within the last 3 years.
- Extraction queue: up to 10 concurrent, ~1s batch delay, max 1000 queued items.
- Outputs are stored as:
  - `docs/file-contents.json` (index without text)
  - `docs/file-contents/<fileId>.txt` (one file per PDF)
  - `docs/file-contents-chunks/chunk-*.json` (batch downloads)
- Disable extraction by setting `EXTRACT_PDF_TEXT=false`.

### Caching and Refresh
- Data is cached in `docs/*.json`. Running `npm run generate` reuses caches and fetches only recent changes.
- Use `npm run generate -- --clear-cache` to discard in-memory caches for a run; to force a full refetch/re-extract, delete the `docs/*.json` and `docs/file-contents*` artifacts first.

## Deployment
- GitHub Pages can serve the feed directly from `docs/`. After running `npm run generate`, commit the updated `docs/` artifacts and push to the branch configured for Pages.

## Contributing
- Open issues or PRs are welcome. Please run `npm run typecheck && npm run lint` before submitting.
- If your changes affect generated output, include updated `docs/` artifacts (or document why not). 
