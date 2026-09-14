# Spike: composed digests (parked)

Status: **parked, not wired into the pipeline.** Nothing here runs during `npm run generate`.
Entry point: `npm run spike:digests` (see the flag list at the top of `run-digests.ts`).

Two digest kinds, both composed from artifacts already in `docs/` — per-paper summaries,
meeting agendas, `paper-stadtteile.json`. No PDF is read and no OParl call is made, so a
digest costs one model call over text the expensive per-paper step already paid for.

- **Meeting previews** — one per sitting at each of two lead times (`week` = 7 days out,
  `day` = 1 day before), keyed separately because they are different documents.
- **Monthly Stadtteil rollups** — a shared `stadtweit` section generated once per month,
  plus a per-district local section.

## What was validated

- **Meeting previews are the strong half.** The 28 July Gemeinderat — 61 summarized papers,
  64 KiB in one call — selected six substantive items out of 65 agenda points and preserved
  the procedural distinctions (`Die Verwaltung empfiehlt, den Antrag abzulehnen` stayed a
  recommendation, not a decision).
- **The stadtweit section costs one call per month regardless of district count.** A July run
  produced 29 district records from 10 calls: 19 districts had no local papers and need no
  call of their own, only the shared body.
- **Compose, never blend.** The stadtweit body is attached verbatim to each district record.
  No model call ever sees a city topic and a district in the same context, so a city item
  cannot be re-attributed to a Stadtteil. Keep this if the spike is resumed — an earlier
  version that mixed them produced exactly that error.

## Re-measured 2026-09-14

The numbers below this heading supersede the ones above where they conflict. Everything in
the original write-up was measured against summaries written before `paper-de-v7` and
`stripTemplateBoilerplate` landed (2026-08-06), two days after the spike was parked, and
against a digest client that predates the OpenCode session-header, salvage and
empty-response fixes. Both inputs changed materially, so the spike was re-run rather than
resumed on the old evidence.

- **The procedural failure did not reproduce.** The summary of `54366` no longer states a
  procedural stance at all under `paper-de-v7` — it reads `Die Vorlage … schlägt … vor`,
  where the v5/v6 text it replaced carried the decision voice the digest was picking up.
  The 28 July preview renders that same paper as `TOP 24: Der vollständige Rückbau der
  Spielgeräte auf 20 Spielanlagen im Stadtgebiet wird vorgeschlagen`. A scan of every
  March digest for decision vocabulary (`wurde beschlossen`, `stimmte zu`, `nahm zur
  Kenntnis`, …) returned **zero hits**. The deterministic check the original plan called
  for is therefore not the next step: the cause was upstream contamination, and the
  template stripper removed it. Re-check on each new month rather than building the check.
- **`overview` naming unbacked topics does still reproduce.** The March stadtweit overview
  promises `Veränderungen in der Zusammensetzung des Gemeinderats`, `Besetzungen in
  Aufsichtsräten`, `Modalfiltern` and `geschützten Radwegen`; none of the six highlights
  covers any of them. This is the one confirmed open prompt failure. Consider dropping the
  field: the highlights carry the content, and `overview` is where the unbacked claims are.
- **A partial object costs the whole digest and is not retried.** `gruenwettersbach-2026-03`
  failed Zod validation with `highlights: expected array, received undefined`, then
  succeeded on each of two immediate re-runs of the identical input. It is the same
  transient class as the per-paper empty-response problem, but `isEmptyResponse` does not
  match a schema rejection, so the retry loop never engages. Widening the retry to cover a
  missing required key is a small change with a real hit rate.
- **Input has grown ~60%.** The 28 July Gemeinderat is now 103 KiB (was 64 KiB) and the
  March stadtweit pool 29 KiB (was 17 KiB) — richer summaries under the new model. Both
  still completed in a single call, so chunk-and-reduce is not yet required.
- **Under-selection on a large pool.** Before `digest-de-v3`, a 34-paper pool produced a
  single highlight while the overview promised four topic areas. Cause was stacked exclusion
  instructions with no floor plus a `max(6)`/no-min schema. Fixed by an explicit
  five-to-six-point instruction that overrides the shared "nicht jede Vorlage muss vorkommen"
  rule — but the shape of the failure is worth remembering: **selection prompts need a floor.**

## Prompt history

`digest-de-v1` → `v4`. Each rule in `SHARED_RULES` exists because of an observed failure:
counting banned in words as well as digits (a digest said "zwei Vorlagen" from three sources,
evading the digit-only grounding check); proper nouns verbatim (`Baubeschuss`, `Grözingen`,
`comunale`); at most one point per paper (a one-paper meeting emitted `TOP 1:` three times).

Two fixes belong on the source side rather than in a prompt: `committeeName()` strips the
`(öffentlich/nicht öffentlich)` suffix from meeting names, and the stadtweit pool renders
summaries without key points — selection does not use them, and it halves the input from
36 KiB to 17 KiB.

## Provider notes

Re-measured 2026-09-14 against OpenCode Go with the session header and `salvageJsonObject`
in place. The earlier table is superseded; it attributed to JSON parsing three failures that
are not about JSON.

| model | result |
| --- | --- |
| `mimo-v2.5-pro` | 7–11 s on district pools, 45 s on the 103 KiB Gemeinderat — current `DIGEST_MODEL` default |
| `glm-5.3-flash` | 8 s; more specific than `mimo-v2.5-pro` on the same Durlach pool (cites the Sachstand date and both sides of the VBK answer). Not in the original table; it is the per-paper default |
| `glm-5.2` | still fails, but as three empty responses (58 s), not a parse error — salvage does not help |
| `deepseek-v4-pro` | fails on a workspace opt-in restriction, unrelated to output format |
| `gpt-5.6-luna` | provider-side HTTP 500 after 4 attempts |
| `kimi-k3` | rejects `temperature: 0` (not re-tested) |

**Latency is an order of magnitude lower than first recorded** — 7–11 s where the original
table reports 87 / 133 / 150 s for the same model, and the largest input in the spike now
finishes in 45 s. Whatever produced those numbers was provider-side and is gone.
`DIGEST_REQUEST_TIMEOUT_MS` at 900000 is now ~20x the observed worst case and should be cut
once a second month confirms this.

## If resumed

Revised after the 2026-09-14 re-measurement.

1. **Implement the cache.** `digestSourceHash` is computed and stamped onto each record but
   never read back, so every run regenerates every target. The comment on it claims
   otherwise. At two lead times on a daily schedule this is the difference between the
   spike's cost argument and what it actually does.
2. **Retry a partial object**, not only an empty one — see the schema failure above.
3. **Promote meeting previews.** They are the strong half and no longer need the procedural
   check that used to gate them. Remaining: highlight-count scaling, and a per-kind `--limit`
   so capping a run cannot silently drop the stadtweit section out of district digests.
4. **Fix the coverage statistic** before trusting it: `buildMeetingDigestTarget` skips public
   agenda items with no `number` without counting them as uncovered.
5. Monthly Stadtteil rollups still depend on the district relevance work described in
   `AGENTS.md` under Stadtteil Detection. Note that `CITY_WIDE_DISTRICT_THRESHOLD` routes a
   17-district paper like `54366` into the stadtweit section, so a genuinely local effect in
   Grünwinkel is only visible there.
