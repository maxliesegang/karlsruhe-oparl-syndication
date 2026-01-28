# Karlsruhe OParl Syndication — Agent Guide

This repository builds and publishes an Atom feed for Karlsruhe city council agenda items by pulling OParl data, enriching it with auxiliary files, and writing results to `docs/` (GitHub Pages friendly). Use this guide to work quickly without breaking the pipeline.

## Quick Start
- Use a modern Node LTS (>=20) with npm; install deps via `npm ci`.
- Dev run (TypeScript): `npm run generate` (runs `ts-node src/index.ts`).
- Build JS: `npm run build` then `npm start` to run the compiled `dist/index.js`.
- Serve generated feed locally: `npm run serve` (serves `docs/` on :8080).
- Increase verbosity with `LOG_LEVEL=debug`; set `.env` at repo root (dotenv loaded).

## Data Pipeline (what `generate` does)
1) Load caches from `docs/*.json` and `docs/file-contents*` into in-memory stores.  
2) Fetch data:
   - Organizations: full crawl (no `modified_since` support).
   - Meetings & Papers: paginated fetch (`limit=1000`) with `modified_since = lastModified - 1 day`; toggle full pagination via `FETCH_ALL_PAGES` (default true). Requests run sequentially through `RequestQueue` with `REQUEST_DELAY` ms between items (default 1000) and axios-retry (3 tries).
3) Build feed: iterate meetings → agenda items; resolve consultations → papers → auxiliary files, fix URLs with `correctUrl`, compute freshest date (item/paper), and add Atom entries.
4) Persist artifacts to `docs/`:
   - `tagesordnungspunkte.xml` (or `FEED_FILENAME` override).
   - `meetings.json`, `papers.json`, `consultations.json`, `organizations.json`.
   - `file-contents.json` (index) plus `file-contents/<fileId>.txt` and chunked JSON in `file-contents-chunks/` for bulk loading.

## PDF Text Extraction
- Controlled by `EXTRACT_PDF_TEXT` (default true). Only files whose `fileModified` falls within the last 3 years (`isRecentFile`) are considered.
- Queue settings: max 10 concurrent, ~1s batch delay, capped at 1000 queued items; extractions happen while fetching and are awaited before persistence.
- Failures are logged; 4xx responses stay at debug to avoid noise. To skip extraction entirely, set `EXTRACT_PDF_TEXT=false`.

## Configuration (from `src/config.ts`, dotenv-enabled)
- API: `MEETINGS_API_URL`, `PAPERS_API_URL`, `ORGANIZATIONS_API_URL` (defaults to Karlsruhe endpoints).
- Feed: `FEED_TITLE`, `FEED_DESCRIPTION`, `FEED_ID`, `FEED_LINK`, `FEED_FILENAME`, `FEED_LANGUAGE`, `FEED_COPYRIGHT`.
- Author: `AUTHOR_NAME`, `AUTHOR_EMAIL`, `AUTHOR_LINK`.
- Flags: `EXTRACT_PDF_TEXT` (default true), `FETCH_ALL_PAGES` (default true).
- Rate limiting: `REQUEST_DELAY` (ms, default 1000).

## Caching and Refresh Strategy
- Stores serialize to `docs/`; reruns are incremental thanks to `modified_since`. The `--clear-cache` flag only clears in-memory maps; it does not delete files.
- To force a full refetch/re-extract: delete the relevant `docs/*.json` and `docs/file-contents*` directories, then run `npm run generate -- --clear-cache`.
- Keep `docs/` under the GitHub 100 MB per-file limit; chunking exists to help, so avoid large single-file changes.

## Repo Scripts
- `npm run generate` — primary pipeline (ts-node).
- `npm run build` — compile TypeScript to `dist/`.
- `npm start` — run compiled build.
- `npm run typecheck` — TS type-only.
- `npm run lint` / `npm run lint:fix` — ESLint (typescript-eslint).
- `npm run format` — Prettier on `src/**/*.ts`.
- `npm run serve` — static server for `docs/` on port 8080.

## Operational Notes
- `correctUrl` rewrites `/oparl/` to `/ris/oparl/`; rely on it when storing URLs.
- `API_LIMIT` is fixed at 1000; `FETCH_ALL_PAGES=false` will truncate after first page.
- Logging lives in `src/logger.ts` with ANSI color; respects `LOG_LEVEL` env.
- No tests exist yet; prefer adding regression coverage before refactoring the pipeline or store persistence logic.
- Avoid hand-editing generated `docs/` artifacts unless debugging; regenerate instead.

## Safe Contribution Checklist
- Install deps → run `npm run typecheck && npm run lint` before PRs.
- After code changes that affect output, run `npm run generate` and include updated `docs/` artifacts if they are part of the deliverable.
- Verify feed locally via `npm run serve` and open `/tagesordnungspunkte.xml`.
- Be mindful of network load on Karlsruhe OParl; adjust `REQUEST_DELAY` if APIs appear rate-limited.
