# DISPATCH — Timeline Modal P2-4: Chart Crash Hotfix + CHART-First Tab Order + P2-3 Completion

**Arc:** Proforma Timeline — follows `TIMELINE_MODAL_P2_DEFECT_FIX_AND_M35_LAYER.md`
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Status:** P2-0 fixed (pending re-observation below). P2-1 gate passed (Bishop `3f32276f-...317c5109b403`, 16 events via city strategy). P2-2 reported built — **but the chart crashes on open (operator-observed), so P2-2 is NOT accepted.** P2-3 items 3, 4, 5 were never observed and remain open.
**Standing rule (S1-01):** the chart rendering is the acceptance object. Code that should render is not a render. "≤16 pins" is not evidence; the count must be exact and observed.

---

## P2-4a — CRASH: reproduce, trace, fix

**Symptom (operator-observed):** opening the CHART view crashes.

1. **Reproduce with the real stack trace.** Open Bishop's Periodic Timeline modal → CHART tab in a browser with devtools. Paste the full console error + component stack. **Do not guess-fix before the trace is captured** — the fix must be attributed to an observed error, not a plausible one.
2. **Diagnose.** Prime suspects, in order of likelihood given the new code touched:
   - `dateXScale` on Bishop's sparse series: 24 rows, 7-year gap (2017-08→2018-07, then 2026-01→2026-12). Check divide-by-zero when min==max, NaN from date parsing, or indexing an empty `resolvedPoints`.
   - The stagger/label math added for pin overlap.
   - The `magnitude?` optional field shape vs. the chart's expectations.
   - The leftover-variable cleanup (`labelY` removal) leaving a dangling reference.
   But follow the stack, not this list.
3. **Fix at the root.** No try/catch-and-render-nothing wrapper as the fix — a swallowed crash is a silently-empty layer, which violates the honest-layer rule. If a data shape is genuinely unrenderable, the layer must show a labeled reason, not a blank.
4. **Regression check both deals:** chart opens crash-free on Bishop (populated path) AND Highlands (empty path). Screenshot each.

## P2-4b — Tab order: CHART first, GRID second

Product decision (operator): **CHART is the primary view.**

1. In `PeriodicTimelineModal`: reorder the toggle tabs to CHART | GRID and make **CHART the default active tab on open**, for all presets and all trigger surfaces.
2. GRID behavior unchanged — same proven numbers, one tab over.
3. Screenshot: modal freshly opened lands on CHART.

## P2-4c — Complete the outstanding P2-3 acceptance (observed, both paths)

1. **(P2-3 item 3) Populated render:** screenshot of Bishop's chart with pins rendered. **Exactly 16 pins** — count them on screen; paste the 16 `market_events` rows alongside. If any pin is not visually countable due to overlap/stagger, that's a render-quality finding to report, not a pass.
2. **(P2-3 item 4) Empty render:** screenshot of Highlands' chart with the labeled-empty M35 layer (`no geography resolved` badge), DB query pasted alongside (`WHERE LOWER(geography_id)='duluth'` → 0).
3. **(P2-3 item 5) No curve effect:** NOI values (grid + chart) for a Bishop month, identical with events layer present vs. absent (toggle by prop or compare to pre-P2 values). Paste both.
4. **(P2-0 re-observation) Deal Details clean:** screenshot of DealDetailPage for Highlands — trigger button visible, NO raw periodic data inline below the nav. This closes the original operator-reported defect by observation.
5. **Counts equal, observed:** pins on screen == endpoint count == DB count == 16. All three pasted.

## ACCEPTANCE SUMMARY (all observed, no code-path substitutes)
| # | Item | Evidence |
|---|---|---|
| 1 | Crash root-caused + fixed | Stack trace pasted + fix diff |
| 2 | Chart opens on Bishop and Highlands | 2 screenshots |
| 3 | CHART default-first tab | Screenshot on fresh open |
| 4 | 16 pins exact, 1:1 to rows | Screenshot + rows |
| 5 | Honest empty on Highlands | Screenshot + query |
| 6 | NOI unmoved by events layer | Paired values pasted |
| 7 | Deal Details inline defect gone | Screenshot |

**Blockers: 1, 4, 6.**

## OUT OF SCOPE
Unchanged from P2 dispatch: submarket band, interventions, event→curve modeling, lifecycle wiring, Highlands geography backfill, `PeriodicGrid.tsx` internals.

**Capture the stack trace first. Fix second. Then run the full observation pass and report.**
