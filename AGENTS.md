# Karlsruhe OParl Syndication — Agent Guide

This repository builds and publishes an Atom feed for Karlsruhe city council agenda items by pulling OParl data, enriching it with auxiliary files, and writing results to `docs/` (GitHub Pages friendly). Use this guide to work quickly without breaking the pipeline.

## Quick Start

- Use Node 24 LTS (see `.node-version`) with npm; install deps via `npm ci`.
- Dev run (TypeScript): `npm run generate` (runs `tsx src/index.ts`).
- Build JS: `npm run build` then `npm start` to run the compiled `dist/index.js`.
- Serve generated feed locally: `npm run serve` (serves `docs/` on :8080).
- Increase verbosity with `LOG_LEVEL=debug`; set `.env` at repo root (dotenv loaded).

## Data Pipeline (what `generate` does)

1) Load caches from `docs/*.json` and `docs/file-contents*` into in-memory stores.  
2) Fetch data:
   - Organizations: full crawl (no `modified_since` support).
   - Meetings & Papers: paginated fetch (`limit=1000`) with `modified_since = lastModified - 1 day`; toggle full pagination via `FETCH_ALL_PAGES` (default true). Requests run sequentially through `RequestQueue` with `REQUEST_DELAY` ms between items (default 1000) and axios-retry (3 tries).
3) Build feed: iterate meetings → agenda items; resolve consultations → papers → auxiliary files, normalize URLs with `normalizeOParlUrl`, compute freshest date (item/paper), and add Atom entries.
4) Persist artifacts to `docs/`:
   - `tagesordnungspunkte.xml` (or `FEED_FILENAME` override).
   - `meetings/<meetingId>.json` and `papers/<paperId>.json` — **one JSON object per record** (see below). These are the two largest, most git-churning stores.
   - `consultations.json`, `organizations.json` — kept as single monolithic files (small, low churn).
   - `file-contents/<fileId>.json` — **one metadata object per file** (see below), co-located next to its `file-contents/<fileId>.txt` (the single source of truth for extracted text). The metadata JSON never contains the extracted text.

### Per-record store layout (`meetings/`, `papers/`, `file-contents/`)

- `PerRecordStore` (`src/store/per-record-store.ts`) persists each record to `docs/<entity>/<recordId>.json`. `recordId` is the last path segment of the record's `id` URL (`extractRecordId`), sanitized to a safe basename (`sanitizeRecordId`); filename collisions fail loudly rather than overwrite.
- **File format (viewer contract):** exactly one JSON object per file — the full record, not a single-element array. Serialization is canonical (`canonicalStringify`): object keys sorted recursively, 2-space indent, UTF-8, single trailing newline. This makes an unchanged record byte-identical every run so git dedupes its blob; only changed/new records are rewritten each run (dirty tracking).
- **Deletion:** an OParl `deleted:true` tombstone removes the record; its file is unlinked by the post-write orphan sweep (any `docs/<entity>/*.json` whose id is not in the store is removed, always *after* all writes succeed).
- **Migration:** if `docs/<entity>/` is absent but the legacy `docs/<entity>.json` exists, the store loads the legacy array, then the next persist writes the per-record files and deletes the legacy file (one-time cutover).

- **`file-contents/` (metadata) — `FileContentStore`, `src/store/file-content-store.ts`:** does *not* extend `PerRecordStore` (it also owns PDF-extraction scheduling and the `changedFileIds` re-resolution signal) but mirrors the same pattern. Each file's metadata is one canonical JSON object at `docs/file-contents/<fileId>.json` with fields `{ id, downloadUrl, fileModified, lastModifiedExtractedDate?, hasExtractedText }` — **never the extracted text**, which stays in the co-located `<fileId>.txt`. `<fileId>` uses the same `sanitizeRecordId(extractRecordId(id))` basename as the .txt so a metadata record and its text share a name. Dirty tracking compares each record's canonical metadata against the exact bytes last loaded/written, so only changed metadata is rewritten. The post-write orphan sweep is scoped to `*.json` only, so sibling `.txt` files are never deleted by mistake. **Migration:** when `docs/file-contents/` holds no `*.json` files but the legacy `docs/file-contents.json` index exists, the store loads from it and the next persist writes the per-record metadata files and deletes the legacy index (one-time cutover; the directory already exists because it holds the `.txt` files).

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

- This repo is a **complete archive**: meetings, papers, and organizations are stored **add-only**. Fetches upsert by `id` and never wipe records that drop out of the collection (e.g. meetings/papers that become member-only and 401, or a truncated crawl that omits the tail). Records are removed **only** on an explicit OParl `deleted: true` tombstone (handled in `BaseStore.add`). A full reconciliation (`modified_since` undefined) therefore refreshes every currently-exposed object without deleting the rest.
- Stores serialize to `docs/`; reruns are incremental thanks to `modified_since`. Meetings, papers, and file-contents metadata are **per-record files** (`docs/meetings/`, `docs/papers/`, `docs/file-contents/`) so a run only rewrites the records that actually changed — this is what keeps git history small and removes the 100 MB-per-file ceiling. Consultations and organizations stay as single files. The `--clear-cache` flag only clears in-memory maps; it does not delete files.
- To force a full refetch/re-extract: delete the relevant per-record directory (`docs/meetings/`, `docs/papers/`, `docs/file-contents/`) or monolithic file (`docs/*.json`), then run `npm run generate -- --clear-cache`. On the next run the per-record stores rebuild the whole directory.
- No single `docs/` file may exceed GitHub's 100 MB limit. Per-record files keep meetings, papers, and file-contents metadata well under it, and extracted text lives in per-record `file-contents/<fileId>.txt` files — avoid reintroducing large single-file artifacts.

## Repo Scripts

- `npm run generate` — primary pipeline (`tsx`).
- `npm run build` — compile TypeScript to `dist/`.
- `npm start` — run compiled build.
- `npm run typecheck` — TS type-only.
- `npm run lint` / `npm run lint:fix` — ESLint (typescript-eslint).
- `npm test` / `npm run test:watch` — run Vitest once / in watch mode.
- `npm run smoke` — load the compiled module graph without fetching remote data.
- `npm run format` — Prettier on `src/**/*.ts`.
- `npm run serve` — static server for `docs/` on port 8080.

## Operational Notes

- `normalizeOParlUrl` rewrites `/oparl/` to `/ris/oparl/`; rely on it when storing URLs.
- `OPARL_PAGE_SIZE` is fixed at 1000; `FETCH_ALL_PAGES=false` will truncate after first page.
- Logging lives in `src/logger.ts` with ANSI color; respects `LOG_LEVEL` env.
- Tests live in `tests/`; add regression coverage before refactoring the pipeline or store persistence logic.
- Avoid hand-editing generated `docs/` artifacts unless debugging; regenerate instead.

## Safe Contribution Checklist

- Install deps → run `npm run typecheck && npm run lint && npm test && npm run build && npm run smoke` before PRs.
- After code changes that affect output, run `npm run generate` and include updated `docs/` artifacts if they are part of the deliverable.
- Verify feed locally via `npm run serve` and open `/tagesordnungspunkte.xml`.
- Be mindful of network load on Karlsruhe OParl; adjust `REQUEST_DELAY` if APIs appear rate-limited.
