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

## What is still broken

- **The procedural rule does not hold on the prompt alone.** March's digest said
  `Der Rückbau von 20 Spielanlagen wurde beschlossen` where source `54366` says
  `Der Gemeinderat soll den Rückbau von 20 vorgeschlagenen Spielplätzen beschließen`. This
  survived prompt `digest-de-v4`, which names that exact error class with three contrast
  examples, on the stronger model. **The fix is a deterministic check**, a sibling of
  `findUngroundedNumericLiterals`: reject `wurde beschlossen/angenommen/abgelehnt` when the
  item's source carries only `soll … beschließen` / `Beschlussvorschlag` / `wird vorgeschlagen`,
  then one corrective retry. Do this before wiring digests into the pipeline.
- **`overview` still names topics no highlight backs.** May's overview promised
  "Integration und Sprachbildung" and "Energieversorgung"; neither appeared below. Also a
  prompt rule that did not hold.
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

Measured against OpenCode Go, prompt `v4`, three months:

| model | result |
| --- | --- |
| `mimo-v2.5` | ~14 s; weaker on procedural status, occasional typos |
| `mimo-v2.5-pro` | 87 / 133 / 150 s; best precision observed — current `DIGEST_MODEL` default |
| `qwen3.8-max` | ~299 s; richest detail of the three that worked |
| `glm-5.2`, `deepseek-v4-pro`, `gpt-5.6-luna` | fail against `Output.json()` |
| `kimi-k3` | rejects `temperature: 0` |

**Latency is provider jitter, not input size** — a 17 KiB pool finished in 87 s while an
11 KiB one exceeded 300 s on the same model. That is why `DIGEST_REQUEST_TIMEOUT_MS`
defaults high rather than being tuned to input length.

Roughly 2 transient failures per 40 calls (unparseable JSON, timeout). Fail-open and retried
next run, same as the per-paper path.

## If resumed

1. Build the deterministic procedural-status check first.
2. Promote meeting previews — they need only the highlight-count scaling and chunk-and-reduce
   for the 64 KiB Gemeinderat case.
3. Monthly Stadtteil rollups depend on the district relevance work described in `AGENTS.md`
   under Stadtteil Detection.
