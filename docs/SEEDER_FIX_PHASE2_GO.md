# DISPATCH — Seeder Fix Phase 2 GO: Hybrid Actuals, Derived Boundary, Gap Zone, Projection Trend

**Arc:** Proforma Timeline — Phase 2 of `SEEDER_FIX_HYBRID_ACTUALS_GAP_ZONE.md`. Phase 1 report accepted.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Standing rule (S1-01):** live DB output + rendered observation. Reseeds are production writes — Bishop is authorized below; Highlands is conditional and gated.

## OPERATOR SIGN-OFFS (encoded)
1. **Merge rule APPROVED:** union of `extraction_t12.months` + `deal_monthly_actuals` (non-null financials only), `deal_monthly_actuals` wins on month collision, capped at most-recent-60-months.
2. **Gap/projection-start APPROVED WITH MODIFICATION:** gap = (last actual + 1) → (analysis_date − 1); projection starts at `analysis_date`. **`analysis_date` is persisted INTO the seed as an explicit input field**, defaulting to seed-build date when not supplied. A bare `now()` read at render or re-derivation time is prohibited — reseeding with the same `analysis_date` must be deterministic (version-inputs invariant).
3. **Boundary derived, sibling column demoted:** `periodic_seed.boundary.actuals_through_month` = last `zone:'actual'` month, computed inside `buildPeriodicSeed()`. `deals.actuals_through_month` becomes input-only (raw ingest fact feeding `buildBoundaryContext`); it is never a render-time source of truth. Do not write back to it in this dispatch.

## WORK ITEMS

### W1 · Projection fix — trigger repair FIRST, new code only if disproven
Phase 1 hypothesis: `deriveProjectionSeries` bails silently at `gap-bridge.service.ts:173` (`lastNonProj.resolved == null`) for Bishop, leaving the year1-annual copy in place — while the same path re-trended Highlands correctly today.
1. Trace why Bishop's last actual-zone period had (or has) `resolved: null` at derivation time. Paste the value.
2. If the bail is confirmed: fix the trigger chain so `deriveProjectionForSeed` runs for Bishop (root cause, not a bypass). **The silent no-op itself must die regardless:** per no-silent-stale-fallback, a derivation that cannot run must surface a reason (logged + seed-level flag), never leave placeholder values wearing a real resolution tag.
3. Only if the existing path genuinely cannot serve Bishop: implement option (b) — last-actual/year1 baseline ÷12 + compound trend — matching what `deriveProjectionSeries` already produces for Highlands. No per-year-override consumption in this dispatch.
4. Units: whatever path runs, no annual figure may land in a monthly slot. Add the assertion where the baseline enters (annual source → ÷12 exactly once, at a single named location).

### W2 · Hybrid actuals ingest
Per sign-off 1. Null-financial rows filtered (the 12 × 2026 Bishop shells stay in DB, ignored; deletion remains a separate hygiene ticket).

### W3 · Gap zone
Per sign-off 2. `buildPeriodList` tags `zone:'gap'` for (last actual + 1) → (`analysis_date` − 1); `deriveGapForSeed` populates values (compound trend from last actual, `resolution:'derived_gap'`). Renderers already support gap (Phase 1 confirmed) — no frontend changes expected; report if any prove necessary.

### W4 · Boundary derivation
Per sign-off 3. `has_projection` / `first_projection_month` augmentation runs unconditionally.

### W5 · Reseed Bishop
With `analysis_date` = seed-build date (persisted).

### W6 · Highlands — conditional, gated
1. First: `SELECT COUNT(*), COUNT(DISTINCT report_month) FROM deal_monthly_actuals WHERE <highlands>;` — paste. (Phase 1's "93 rows over 2021-12→2026-04" is 53 months; 93 ≠ 53 implies duplicate/per-line-item rows, NOT un-ingested months. Resolve which.)
2. If distinct months = 53: reseed Highlands for code-path uniformity. Acceptance = **byte-identical rendered values** (boundary 2026-04-01, NOI margin 57.17%, EGI 2025 $6,315,308). Any shift fails.
3. If distinct months > 53: STOP on Highlands, report the extra months found — a boundary move would then be expected-correct, but it gets operator review before the reseed, not after.

## ACCEPTANCE (all observed)
| # | Item | Evidence |
|---|---|---|
| 1 | Bishop seed: 12 merged actuals (2017-08→2018-07; the 3 phantom extraction months are gone from live data — if they reappear, report, don't ingest silently), boundary 2018-07-01 derived, amber gap (2018-08 → analysis_date−1) with trended values, projection from analysis_date at ~$70–110k/mo scale, trended | Seed dump: zone distribution, boundary, `analysis_date`, 5 gap samples, 5 projection samples |
| 2 | Chart: three zones visible, boundary line at last actual, no order-of-magnitude step at any zone edge (steps reported numerically) | Screenshot + values |
| 3 | Grid ↔ chart agreement: one actual, one gap, one projection month | Paired values |
| 4 | Highlands per W6 gate outcome | Query + values/screenshot |
| 5 | 16 pins on Bishop's chart, M35 legend active (closes P2-5a observation debt) | Screenshot + DOM count |
| 6 | No silent-bail path remains: forcing the bail condition produces a surfaced reason, not placeholder values | Log/flag output pasted |
| 7 | Determinism: reseed Bishop twice with same `analysis_date` → identical seed hash/values | Both outputs pasted |

**Blockers: 1, 2, 4, 6.**

## OUT OF SCOPE
Unchanged: shell-row deletion, per-year-override P&L rebuild, event→curve modeling, submarket band, interventions, lifecycle origin/vintage implementation (spec'd separately in `LIFECYCLE_ORIGIN_VINTAGE_ADDENDUM.md` — do not implement any of it here), `deals.actuals_through_month` write-back.

**Run W1 trace first (read the bail condition before editing). Then W2–W6. Report.**
