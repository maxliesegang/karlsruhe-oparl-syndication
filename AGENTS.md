# Karlsruhe OParl Syndication — Agent Guide

This repository builds and publishes an Atom feed for Karlsruhe city council agenda items by pulling OParl data, enriching it with auxiliary files, and writing results to `docs/` (GitHub Pages friendly). Use this guide to work quickly without breaking the pipeline.

## Quick Start

- Use Node 24 LTS (see `.node-version`) with npm; install deps via `npm ci`.
- Dev run (TypeScript): `npm run generate` (runs `tsx src/index.ts`).
- Build JS: `npm run build` then `npm start` to run the compiled `dist/index.js`.
- Serve generated feed locally: `npm run serve` (serves `docs/` on :8080).
- Increase verbosity with `LOG_LEVEL=debug`; set `.env` at repo root (dotenv loaded).

## Data Pipeline (what `generate` does)

1. Load caches into in-memory stores: the per-record dirs `docs/meetings/`, `docs/papers/`, `docs/file-contents/` (plus co-located `.txt` extracted text), `docs/summaries/papers/`, and the monolithic `docs/consultations.json` / `docs/organizations.json`.
2. Fetch data:
   - Organizations: full crawl (no `modified_since` support).
   - Meetings & Papers: paginated fetch (`limit=1000`) with `modified_since = lastModified - 1 day`; toggle full pagination via `FETCH_ALL_PAGES` (default true). Requests run sequentially through `RequestQueue` with `REQUEST_DELAY` ms between items (default 1000) and axios-retry (3 tries).
3. Enrich and build feed: await extraction, refresh Stadtteil matches, optionally update current paper summaries, then iterate meetings → agenda items; resolve consultations → papers → auxiliary files, normalize URLs with `normalizeOParlUrl`, compute freshest date (item/paper), and add Atom entries.
4. Persist artifacts to `docs/`:
   - `tagesordnungspunkte.xml` (or `FEED_FILENAME` override).
   - `meetings/<meetingId>.json` and `papers/<paperId>.json` — **one JSON object per record** (see below). These are the two largest, most git-churning stores.
   - `consultations.json`, `organizations.json`, `paper-stadtteile.json`, `paper-submitters.json` — kept as single monolithic files (small, low churn).
   - `file-contents/<fileId>.json` — **one metadata object per file** (see below), co-located next to its `file-contents/<fileId>.txt` (the single source of truth for extracted text). The metadata JSON never contains the extracted text.
   - `summaries/papers/<paperId>.json` — one content-addressed LLM summary per public paper with usable extracted text.
   - `index.html` — the GitHub Pages landing page, **generated** (see below).

### `docs/index.html` is generated, not hand-edited

- `src/landing-page.ts` renders it; `generation-service.ts` calls `writeLandingPage` with the `FilteredFeedDescriptor[]` that `writeFilteredFeeds` just returned, so a feed that was written is necessarily a feed that is linked. Keep that wiring — passing a separately derived list reintroduces exactly the drift this replaced.
- It was previously a static file committed once and never updated. It still advertised "Neueste 50" after the recent feed moved to 100 entries, and it linked none of `feed-index.json`, `paper-stadtteile.json` or `paper-submitters.json` — every artifact added after the page was written was unreachable from it.
- Deterministic like the feeds: no run timestamp, so an unchanged dataset produces byte-identical HTML. `tests/landing-page.test.ts` pins that, plus HTML escaping of feed titles.
- `DATA_ARTIFACTS` in `src/landing-page.ts` is the published list of consumable files; **add an entry there whenever a new `docs/` artifact is published.** Files that exist only for pipeline bookkeeping carry `internal: true` and render with an "intern" badge — they are served by Pages either way, so the page says which ones are safe to build on.
- Per-record directories (`papers/`, `meetings/`, …) are listed but deliberately **not** hyperlinked: Pages serves no directory listing, so the link would 404. Their description gives the `<id>.json` addressing scheme instead.

### Per-record store layout (`meetings/`, `papers/`, `file-contents/`, `summaries/papers/`)

- `PerRecordStore` (`src/store/per-record-store.ts`) persists each record to `docs/<entity>/<recordId>.json`. `recordId` is the last path segment of the record's `id` URL (`extractRecordId`), sanitized to a safe basename (`sanitizeRecordId`); filename collisions fail loudly rather than overwrite.
- **File format (viewer contract):** exactly one JSON object per file — the full record, not a single-element array. Serialization is canonical (`canonicalStringify`): object keys sorted recursively, 2-space indent, UTF-8, single trailing newline. This makes an unchanged record byte-identical every run so git dedupes its blob; only changed/new records are rewritten each run (dirty tracking).
- **Deletion:** an OParl `deleted:true` tombstone removes the record; its file is unlinked by the post-write orphan sweep (any `docs/<entity>/*.json` whose id is not in the store is removed, always _after_ all writes succeed).
- **Migration:** if `docs/<entity>/` is absent but the legacy `docs/<entity>.json` exists, the store loads the legacy array, then the next persist writes the per-record files and deletes the legacy file (one-time cutover).

- **`file-contents/` (metadata) — `FileContentStore`, `src/store/file-content-store.ts`:** does _not_ extend `PerRecordStore` (it also owns PDF-extraction scheduling and the `changedFileIds` re-resolution signal) but mirrors the same pattern. Each file's metadata is one canonical JSON object at `docs/file-contents/<fileId>.json` with fields `{ id, downloadUrl, fileModified, lastModifiedExtractedDate?, hasExtractedText }` — **never the extracted text**, which stays in the co-located `<fileId>.txt`. `<fileId>` uses the same `sanitizeRecordId(extractRecordId(id))` basename as the .txt so a metadata record and its text share a name. Dirty tracking compares each record's canonical metadata against the exact bytes last loaded/written, so only changed metadata is rewritten. The post-write orphan sweep is scoped to `*.json` only, so sibling `.txt` files are never deleted by mistake. **Migration:** when `docs/file-contents/` holds no `*.json` files but the legacy `docs/file-contents.json` index exists, the store loads from it and the next persist writes the per-record metadata files and deletes the legacy index (one-time cutover; the directory already exists because it holds the `.txt` files).

## PDF Text Extraction

- Controlled by `EXTRACT_PDF_TEXT` (default true). Only files whose `fileModified` falls within the last 3 years (`isRecentFile`) are considered.
- Queue settings: max 10 concurrent, ~1s batch delay, capped at 1000 queued items; extractions happen while fetching and are awaited before persistence.
- Downloads (`pdf-service.ts`) go through a retrying axios client built by `createRetryingHttpClient` (shared with the OParl API client), with a per-request timeout (`PDF_DOWNLOAD_TIMEOUT_MS`) and response-size cap (`PDF_MAX_CONTENT_BYTES`). This keeps PDF fetches off the polite sequential `requestQueue` while still retrying transient failures.
- Failures are logged; 4xx responses stay at debug to avoid noise. To skip extraction entirely, set `EXTRACT_PDF_TEXT=false`.

## Stadtteil Detection

- `src/karlsruhe-districts.ts` matches district names; `src/services/district-index-service.ts` maintains the index and publishes `docs/paper-stadtteile.json`.
- **Matching is a single combined alternation**, not one regex per name. It is ~4.5x faster over the archive's 290 MB of extracted text (1.2 s vs 5.2 s for a full rebuild) and it yields match positions, which everything below is built on. Alternatives are sorted longest-first because regex alternation is leftmost-first, not longest-match — that is what makes `Innenstadt-Ost` win over `Innenstadt`. Don't split this back into per-name `test()` calls.
- **Presence is not relevance.** Administration papers carry consultation and distribution lists naming most Ortschaften at once; under plain presence-matching those lists put the five small Bergdörfer near the top of the archive-wide ranking and gave 84 papers all 27 districts. `classifyPaperDistricts` therefore grades evidence:
  - **primary** — the consulting committee is an Ortschaftsrat/Ortsverwaltung for it, the title names it, an attachment names it within the first 1500 chars, or it recurs (≥2×) in the body.
  - **mentioned** — a single passing occurrence deep in one attachment. 38% of all detected pairs before this rule. Published for viewers, kept out of every feed.
  - **dropped** — occurs only inside an enumeration window (≥8 distinct districts within 400 chars).
- **Only `primary` reaches the feeds.** `AgendaItemRecord.districts` is primary-only, so the district feeds and Atom categories carry it and nothing else. `mentioned` exists solely in `paper-stadtteile.json`. Measured on the full archive: 14,004 papers → 6,803 with a primary district (13,961 primary pairs) + 5,536 mentioned pairs, in **1.2 s**.
- **The Ortschaftsrat signal is free and beats every text heuristic.** `paper.consultation[].organization` is already on the paper record; `Ortschaftsrat Durlach` consulting a paper attributes 3,134 papers without reading a character of PDF. `findDistrictsForAuthority` restricts this to names starting `Ortschaftsrat`/`Ortsverwaltung` so an ordinary committee cannot claim a district by coincidence.
- **`Innenstadt` is a synthetic 28th entry**, not an official Stadtteil. 1,828 texts say plain "Innenstadt" and never qualify it; mapping those to both official halves would inflate two feeds with papers concerning neither.
- **Aliases** cover Ortsteile and the joint Ortschaft Wettersbach (→ Grünwettersbach + Palmbach, 1,465 texts). `Aue` is deliberately absent — it is an ordinary German word; only `Durlach-Aue` is unambiguous.
- **Adjectival forms carry a street-name guard.** `Durlacher`/`Rüppurrer`/… appear in ~2,000 texts without the base name, but their most frequent use is streets leading _to_ a district from outside it (`Durlacher Allee` is Oststadt, `Rüppurrer Straße` is Südstadt, `Mühlburger Feld` is Nordweststadt). The guard is a lookahead for street/area heads; keep it when adding a form, and keep the forms listed rather than derived — they are irregular (`Daxlanden` → `Daxlander`, `Grünwinkel` → `Grünwinkler`).
- **Known gap — `primary` is not the same as "about this Stadtteil".** A paper whose `primary` evidence names five or more districts is a city-wide matter enumerated per location, not a local one. The count distribution has a clear knee: of the papers carrying a primary district, 113 name one, 23 name two, 11 name three, 9 name four, and past that the counts thin into a tail reaching 24. The 2026-07 `Schließung zweier Wertstoffstationen` Beschlussvorlage claims **seven** districts because the comparison table lists other stations twice each — so it currently appears in seven district feeds, five of which it does not concern. Tolerable in a feed (one entry among hundreds), not tolerable in anything that summarizes a district. Measured, not theorized; see `src/spike/README.md`.
- **Known gap:** PDF extraction sometimes glues a district name to the following digits (`Innenstadt-Ost160,12` in a statistics table). The trailing `\b` then fails and the row does not match. Left alone deliberately — relaxing the boundary costs far more precision than the handful of tables is worth.
- The index is **incremental** (changed papers + papers whose attachment text changed), unlike the full-rebuild submitter index; a version mismatch on the stored file forces a full rebuild. Serialized with `canonicalStringify`, so an unchanged archive produces byte-identical output.
- When re-tuning, measure against `docs/` before and after. `tests/karlsruhe-districts.test.ts` pins the matcher and the grading rules; `tests/district-index-service.test.ts` pins the index shape and the incremental paths.

### `docs/paper-stadtteile.json` (viewer contract)

- Shape: `{ version, districts: ["<district>"], papers: { "<recordId>": { primary?: [...], mentioned?: [...] } } }`.
- **Keyed by the paper's record basename** — the same `<recordId>` as `docs/papers/<recordId>.json`, matching `paper-submitters.json`. Version 1 keyed on `paper.reference`, which is not unique, so one paper of every colliding pair silently overwrote the other.
- `districts` publishes the **full** registry, not only what was seen this run, so a viewer's filter list stays stable.
- Empty `primary`/`mentioned` keys are omitted; a paper with neither is left out entirely.
- Bump `PAPER_DISTRICT_INDEX_VERSION` on any shape change — an unrecognised version triggers a full rebuild rather than a merge.
- `paper-stadtteile-meta.json` is **gone**. It existed only to remember which `reference` a paper last had; a basename never changes. The first run after the cutover unlinks it.
- `generation-service.ts` passes the index `updatePaperDistrictIndex` returned straight into `createDistrictResolver`, so the published file and the feed categories cannot drift. Keep that wiring — a re-read of the file would reintroduce the drift.

## LLM Paper Summaries

- Controlled by `GENERATE_LLM_SUMMARIES` (default false). The scheduled workflow enables it and passes the `OPENCODE_API_KEY` repository secret as `LLM_API_KEY`; a missing key skips updates without breaking feed generation.
- Only papers dated 2026 or later, referenced by public agenda items, and backed by current extracted text are summarized. Papers are processed newest-first and capped by `SUMMARY_MAX_ITEMS_PER_RUN` (default 100), so initial backfills remain bounded.
- The default provider uses OpenCode Go through `@ai-sdk/openai-compatible`, model `mimo-v2.5`. Provider-specific code implements the small `PaperSummarizer` interface under `src/services/llm/`.
- Summaries are content-addressed using a SHA-256 hash of relevant paper metadata and current attachment text. Canonical per-paper records live under `docs/summaries/papers/`; unchanged inputs never call the model again.
- A source/hash mismatch makes the old summary ineligible for publication. If regeneration fails, the cache remains on disk for audit and retry, the stale text is omitted from feeds, and the rest of the pipeline continues.
- Long source text is summarized in chunks of at most `SUMMARY_MAX_INPUT_CHARS` characters, followed by a synthesis request. Feed output clearly labels generated text and retains links to authoritative originals.
- The prompt forbids calculations, treats only visibly marked form checkboxes as selected, preserves recommendation/decision status, and favors three to four strong key points. A provider-neutral numeric-grounding check permits only numeric literals present in the heading/current source, makes one corrective retry, and rejects the summary if that retry is still ungrounded.

## Submitting Faction (Antragsteller)

- **The OParl API does not expose this — there is no faction entity of any kind.** Verified against the live endpoint: `originatorPerson` / `originatorOrganization` are populated on zero papers; the organizations list is 97 records, all administrative units (`at/`) or council bodies (`gr/`), with no `Fraktion` classification; `Person` has no party field; and all 3,000+ memberships point at committees and never set OParl's `onBehalfOf` (the standard way to say "sits on committee X for faction Y"). `underDirectionOf` names the department that _answers_ a paper, not who submitted it. Don't re-litigate this by adding a fetch for `/people` or `/memberships` — the data is not there.
- `src/paper-submitters.ts` therefore parses the faction out of the letterhead of the paper's own PDFs (`file-contents/<fileId>.txt`). It is pure: `findPaperSubmitters(paper, getExtractedText)`. No new persisted artifact and **no new I/O**: the only production wiring of `getExtractedText` reads `stores.fileContents.getById(id)?.extractedText`, the text the store already hydrated in memory for the rest of the pipeline. Nothing here downloads, re-extracts, or re-reads a PDF.
- Only `paper.auxiliaryFile` is traversed. **`mainFile` is never populated** by this endpoint (0 of 4,000 sampled papers; 3,996 have `auxiliaryFile`), so that traversal is already complete — don't add a `mainFile` branch expecting more coverage.
- Production parses each paper exactly once: `generation-service.ts` builds the index, and the feed side gets `createSubmitterResolver(index)`, a plain map lookup. The memoized resolver built in `agenda-item-record-service.ts` is only the fallback for callers that pass no `resolvePaperSubmitters` (tests); keep it lazy so it never runs alongside the index.
- **Closed vocabulary with our own stable ids.** `FACTION_DEFINITIONS` maps a hand-written `id` (`gruene`, `die-linke`, …) plus a display `name` to the spellings seen in the archive. Since there is no OParl id to borrow, these ids are the published join key: **never change or reuse one** — retire a faction by keeping its id and dropping its aliases. `tests/paper-submitters.test.ts` pins the id list so a rename fails CI. Ids are hand-written rather than slugified from `name` so that renaming the display name cannot move the identifier. Joint spellings are _not_ listed: `FDP/FW` resolves to `FDP` + `FW` by plain scanning, so the output is always a set of individual parties. Aliases are matched longest-first so `B´90/DIE GRÜNEN` is consumed whole. `FÜR` and `Die Linke` are matched case-sensitively because `für` and `linke` are ordinary German words — keep that flag when adding acronym-like factions.
- The closed vocabulary also self-validates candidate lines: `Antrag: Tempo 30 im gesamten Stadtteil`, where `Antrag:` introduces the motion text rather than a submitter, simply yields nothing. This is why the line-matching heuristics can stay loose.
- **Only motion papers are attributed** (`isMotionPaper`: Antrag, Anfrage, Änderungs-/Ergänzungsantrag, `Haushalt*`). Beschlussvorlage/Informationsvorlage originate in the administration; without this gate an administration paper _responding_ to a motion would be credited to the faction that filed it (~100 false attributions since 2024 in testing).
- Coverage since 2024: Antrag 95%, Anfrage 92%, Haushalt 91%, Änderungs-/Ergänzungsantrag 99%. Most remaining gaps are papers with no extracted text yet.
- Output: `docs/paper-submitters.json` (see below), `AgendaItemRecord.submitters`, an Atom `<category scheme="…/schema/submitter">` per faction with `term` = stable faction id and `label` = display name (`SUBMITTER_CATEGORY_SCHEME` in `src/constants.ts` — keep stable for subscribers), and an "Antragstellende Fraktion(en)" line in the entry body.

### `docs/paper-submitters.json` (viewer contract)

- Written by `src/services/paper-submitter-index-service.ts`. Shape: `{ version, factions: { "<factionId>": "<display name>" }, papers: { "<recordId>": ["<factionId>"] } }`.
- `factions` publishes the **full** registry, not only the factions seen this run, so a viewer's filter list stays stable when a faction files nothing. Every id in a `papers` value resolves against it.
- **Keyed by the paper's record basename** — the same `<recordId>` as `docs/papers/<recordId>.json` — so a viewer can look a paper up by the filename it already reads. `recordBasename` guarantees that key exists and is unique.
- **Never key this on `paper.reference`.** References are _not_ unique: `2019/1012` belongs to both `papers/ag/394` and `papers/vo/38195` in the current archive. `paper-stadtteile.json` used to key on reference and lost one of those two papers' districts; it now keys on the record basename too.
- The value is the bare faction-id array. Version 2 also carried `paper` (the OParl id URL) and `reference` per entry; both were dropped in version 3 because `docs/papers/<recordId>.json` already holds them authoritatively and a viewer reads that record anyway for title and date. Duplicating them created a second copy that can go stale (`reference` does change — see `district-index-service`) and inflated the file from ~810 KB to no purpose; the slim shape is ~185 KB for the same 4,341 papers. Note the id URL is _not_ reconstructible from `<recordId>` alone (papers live under both `papers/ag/` and `papers/vo/`) — read the paper record for it.
- Papers with no detected submitter are **omitted**, not stored as an empty array.
- Bump `PAPER_SUBMITTER_INDEX_VERSION` on any shape change so the viewer can detect an index it does not understand.
- **Rebuilt in full every run**, unlike the incremental Stadtteil index. Measured on the full archive: 14,004 papers → 4,752 motion papers → 13,400 extracted texts (~55 M chars) → 4,341 indexed, in **116 ms**. The 25-line header window is what makes that cheap — it reads a few hundred bytes per file, not the 55 MB. `FileContentStore.drainChangedFileIds()` would make an incremental build possible, but it would need invalidation on changed text _and_ on changed `name`/`paperType`/`auxiliaryFile` plus a periodic full rebuild, all to save ~110 ms. Don't. Serialized with `canonicalStringify`, so an unchanged archive produces byte-identical output and git dedupes the blob.
- `generation-service.ts` builds the index once, writes it, and feeds the same object to `buildAgendaItemRecords` via `createSubmitterResolver` — so the published file and the feed categories cannot drift apart. Keep that single-build wiring when changing the pipeline.
- When re-tuning the parser, measure against `docs/` before and after; `tests/paper-submitters.test.ts` pins the four real letterhead layouts.

## Configuration (from `src/config.ts`, dotenv-enabled)

- API: `MEETINGS_API_URL`, `PAPERS_API_URL`, `ORGANIZATIONS_API_URL` (defaults to Karlsruhe endpoints).
- Feed: `FEED_TITLE`, `FEED_DESCRIPTION`, `FEED_ID`, `FEED_LINK`, `FEED_FILENAME`, `FEED_FILENAME_RECENT`, `FEED_LANGUAGE`, `FEED_COPYRIGHT`.
- Author: `AUTHOR_NAME`, `AUTHOR_EMAIL`, `AUTHOR_LINK`.
- Flags: `EXTRACT_PDF_TEXT` (default true), `FETCH_ALL_PAGES` (default true).
- Summaries: `GENERATE_LLM_SUMMARIES` (default false), `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `SUMMARY_PROMPT_VERSION`, `SUMMARY_MAX_ITEMS_PER_RUN`, `SUMMARY_MAX_INPUT_CHARS`, `SUMMARY_CONCURRENCY`, `SUMMARY_REQUEST_TIMEOUT_MS`.
- Digests (**spike only** — read by `src/spike/`, not by `npm run generate`): `DIGEST_MODEL` (default `mimo-v2.5-pro`), `DIGEST_REQUEST_TIMEOUT_MS` (default 900000). Deliberately separate from `LLM_MODEL`/`SUMMARY_REQUEST_TIMEOUT_MS`: digests are ~90 calls a month against ~3,000 paper summaries, so a stronger and much slower model is affordable there and nowhere else.
- Rate limiting: `REQUEST_DELAY` (ms, default 1000).
- Reconciliation: `FULL_RECONCILIATION_INTERVAL_DAYS` (default 7) — how often the incremental cursors are ignored for an authoritative full crawl.
- PDF limits: `PDF_DOWNLOAD_TIMEOUT_MS` (default 30000), `PDF_MAX_CONTENT_BYTES` (default 50 MiB).

## Caching and Refresh Strategy

- This repo is a **complete archive**: meetings, papers, and organizations are stored **add-only**. Fetches upsert by `id` and never wipe records that drop out of the collection (e.g. meetings/papers that become member-only and 401, or a truncated crawl that omits the tail). Records are removed **only** on an explicit OParl `deleted: true` tombstone (handled in `BaseStore.add`). A full reconciliation (`modified_since` undefined) therefore refreshes every currently-exposed object without deleting the rest.
- Stores serialize to `docs/`; reruns are incremental thanks to `modified_since`. Meetings, papers, and file-contents metadata are **per-record files** (`docs/meetings/`, `docs/papers/`, `docs/file-contents/`) so a run only rewrites the records that actually changed — this is what keeps git history small and removes the 100 MB-per-file ceiling. Consultations and organizations stay as single files. The `--clear-cache` flag only clears in-memory maps; it does not delete files.
- To force a full refetch/re-extract: delete the relevant per-record directory (`docs/meetings/`, `docs/papers/`, `docs/file-contents/`) or monolithic file (`docs/*.json`), then run `npm run generate -- --clear-cache`. On the next run the per-record stores rebuild the whole directory.
- No single `docs/` file may exceed GitHub's 100 MB limit. Per-record files keep meetings, papers, and file-contents metadata well under it, and extracted text lives in per-record `file-contents/<fileId>.txt` files — avoid reintroducing large single-file artifacts.

## Repo Scripts

- `npm run generate` — primary pipeline (`tsx`).
- `npm run generate:no-summaries` — the same pipeline with `--no-summaries`, which forces the LLM step off regardless of `GENERATE_LLM_SUMMARIES`. **Use this whenever you regenerate `docs/` to check a change** — the local `.env` enables summaries, so a plain `npm run generate` bills the provider for up to `SUMMARY_MAX_ITEMS_PER_RUN` papers and adds ~20 minutes to the run. Cached summaries still reach the feed; only the refresh is skipped. Reserve `npm run generate` for the scheduled workflow or when you are deliberately working on summaries.
- `npm run build` — compile TypeScript to `dist/`.
- `npm start` — run compiled build.
- `npm run typecheck` — TS type-only.
- `npm run lint` / `npm run lint:fix` — ESLint (typescript-eslint).
- `npm test` / `npm run test:watch` — run Vitest once / in watch mode.
- `npm run smoke` — load the compiled module graph without fetching remote data.
- `npm run validate:feed` — check the generated feeds in `docs/` before committing them.
- `npm run format` — Prettier on `src/**/*.ts`.
- `npm run serve` — static server for `docs/` on port 8080.
- `npm run spike:digests` — **parked spike**, not part of the pipeline; see `src/spike/README.md`. Writes to `spike-output/` (gitignored) and never to `docs/`. Use `--dry-run` to inspect selection and coverage without spending anything.

## Operational Notes

- HTTP: `src/api/http-client.ts` exposes `createRetryingHttpClient` — the single source of the retry policy (axios + axios-retry: 3 tries, honours `Retry-After`, retries network/timeout/429/503). `src/api/http.ts` builds the shared JSON `httpClient` and the sequential `requestQueue` (spaces API requests by `REQUEST_DELAY` ms); `PdfService` instantiates its own retrying client so bulk PDF downloads stay off that queue. Reuse the factory for any new outbound HTTP rather than re-configuring retries.
- `normalizeOParlUrl` rewrites `/oparl/` to `/ris/oparl/`; rely on it when storing URLs.
- `OPARL_PAGE_SIZE` is fixed at 1000; `FETCH_ALL_PAGES=false` will truncate after first page.
- Logging lives in `src/logger.ts` with ANSI color; respects `LOG_LEVEL` env.
- Tests live in `tests/`; add regression coverage before refactoring the pipeline or store persistence logic.
- Avoid hand-editing generated `docs/` artifacts unless debugging; regenerate instead.

## Feed Validation

- `npm run validate:feed` (`src/validate-feed.ts`) gates the generated feeds — both `FEED_FILENAME` and `FEED_FILENAME_RECENT` — and is what CI runs after `npm run generate`. It exits non-zero on: a missing file, malformed XML, zero entries, or an entry count below 90% of the committed version (the archive is add-only, so a large drop means a broken run).
- The checks themselves live in `src/feed-validation.ts` as pure functions so they are unit-testable (`tests/feed-validation.test.ts`); the CLI only does file/git I/O and reporting.
- Entries are counted from the parsed tree, not by grepping `<entry>`, so a change in how the `feed` library emits tags cannot silently zero out the drop-off guard.
- **Control characters are checked explicitly.** XML 1.0 forbids most of them and the `feed` library passes them through unescaped, so text extracted from a PDF can produce a feed that no reader will parse. fast-xml-parser accepts these characters, so `findInvalidXmlCharacter` scans for them separately — do not drop that scan on the assumption the parser covers it.
- Previously this ran as inline shell using `xmllint`, which broke when GitHub's runner image stopped shipping `libxml2-utils`. Keep validation in-repo rather than reintroducing a dependency on runner-provided tools.

## Safe Contribution Checklist

- Install deps → run `npm run typecheck && npm run lint && npm test && npm run build && npm run smoke` before PRs.
- After code changes that affect output, run `npm run generate` and include updated `docs/` artifacts if they are part of the deliverable.
- After `npm run generate`, run `npm run validate:feed` before committing regenerated `docs/` artifacts.
- Verify feed locally via `npm run serve` and open `/tagesordnungspunkte.xml`.
- Be mindful of network load on Karlsruhe OParl; adjust `REQUEST_DELAY` if APIs appear rate-limited.
