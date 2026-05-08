# F9 Data Flow — TODO Log

Items tracked here are pending backend or infrastructure work that unblocks frontend features. Each entry includes the requesting task, the blocker, and the downstream feature it gates.

---

## M07 — Asymmetric percentile bands on trafficProjection.yearly

**Requested by:** Task #633 (Enrich Projections Traffic Engine UI)
**Blocking:** Full "Calibration Confidence Bands" visualization in `TrafficFunnelPanel` (ProjectionsTab.tsx)
**Spec reference:** `docs/architecture/traffic_engine_v2_leasing_prediction.md` (TRAFFIC_ENGINE_CALIBRATION_SPEC)

**Required backend change:**
Surface asymmetric percentile bands (P10 / P25 / P75 / P90) on each `trafficProjection.yearly[*]` entry for the following fields:
- `vacancyPct` — P10/P25/P75/P90 bounds
- `effRent` — P10/P25/P75/P90 bounds
- `rentGrowthPct` — P10/P25/P75/P90 bounds

Current response shape (`F9TrafficYear` in `types.ts:210-216`) has no band fields. A suggested extension:

```typescript
interface F9TrafficYear {
  year: number;
  vacancyPct: number | null;
  occupancyPct: number | null;
  effRent: number | null;
  rentGrowthPct: number | null;
  // ... existing fields ...

  // TODO — add once M07 backend wires calibration output:
  bands?: {
    vacancyPct?: { p10: number; p25: number; p75: number; p90: number };
    effRent?:    { p10: number; p25: number; p75: number; p90: number };
    rentGrowthPct?: { p10: number; p25: number; p75: number; p90: number };
  };
}
```

**Frontend placeholder:** The "Calibration Confidence Bands" sub-panel inside `TrafficFunnelPanel` currently renders a "Pending M07 backend wiring" message. Once the bands are on the response, the placeholder swaps to a rendered band visualization (no graph library needed — an inline range bar suffices).

**Priority:** Defer until M07 backend has bandwidth. Frontend placeholder is in place.

---

## M07 — Peer benchmark data for LEASING Intel Panel

**Requested by:** Task #630 (Add M07 intel panel to Leasing tab)
**Resolved by:** Task #648

**Fields added to `TrafficProjectionResult.peerBenchmark`:**
- `nPeerProperties` — from `deal_market_data.comp_count` when populated; falls back to `apartment_market_snapshots.total_properties` for deal city
- `submarketPercentile.rent` — from `deal_market_data.rent_percentile` (integer); vacancy/leaseVelocity null until true per-property distribution available
- `peerDistribution.{vacancy,rent,leaseVelocity}.p50` — derived from market averages (comp avg or city avg); P25/P75 null until seeded
- `dataSource` — `'deal_market_data'` | `'apartment_market_snapshots'` | null

**SQL joins added to `getTrafficProjection`:**
- `LEFT JOIN deals d ON d.id = tp.deal_id` (city lookup)
- `LEFT JOIN LATERAL (apartment_market_snapshots WHERE LOWER(city)=LOWER(d.city) ORDER BY snapshot_date DESC LIMIT 1) mkt ON TRUE`
- `LEFT JOIN deal_market_data dmd ON dmd.deal_id = tp.deal_id`

**Status:** RESOLVED — backend wired in `trafficToProFormaService.ts`, frontend panel in `M07IntelPanel.tsx` renders real rows. All fields show `—` gracefully when source data is absent. P25/P75 distribution bands pending per-property data seeding.

---

## M07 — Pre-leased % and reno metrics for LEASING Intel Panel (Lease-Up / Reno modes)

**Requested by:** Task #630 (Add M07 intel panel to Leasing tab)
**Resolved by:** Task #649

**Fields added to `LeasingSignals`:**
- `preLeasedPct` — derived from `per_year_overrides['lease_velocity.inputs.pre_leased_count:yr0'] / da.total_units`
- `peakDownUnits` — derived from `per_year_overrides['reno.assumptions.pct_of_units_to_renovate:yr0'] × da.total_units`
- `postRenoAbsorptionLagWks` — derived from `per_year_overrides['reno.assumptions.absorption_lag_days:yr0'] / 7`

**Status:** RESOLVED — backend wired in `trafficToProFormaService.ts`, frontend chips live in `M07IntelPanel.tsx` (`LeaseUpKpis` and `ValueAddKpis`). Chips show `—` gracefully when the user hasn't entered the source assumptions yet.

---

## POST-FIX: Audit Claude-generated narratives on recent deals

**Reference:** Pct unit-break audit, May 2026 (fix commit: replit/fix-projections-pct-formatting)
**Effort:** S

**Background:**
`proforma_assumptions.vacancy_current`, `rent_growth_current`, and `exit_cap_current` are stored in percentage form (e.g. 5.5 for 5.5%). Before the fix, both read boundaries (`trafficToProFormaService.ts:979-981` primary path and `proforma-adjustment.service.ts:2072-2074` fallback path) passed these values straight through without ÷100, so every downstream consumer received 100× inflated values. Two high-severity side-effects beyond the display bug:

1. **Excel export gross-sale-value was 100× understated** — `f9-financial-export.service.ts:214,220` computes `Math.round(exitNoi / exitCap)` using the raw calibrated exit cap. With `exitCap = 5.5` instead of `0.055`, gross sale proceeds were divided by 5.5 instead of 0.055, producing values ~1.8% of correct. Any LP deliverables exported pre-fix should be regenerated.

2. **`derivedVacancyPct` was clamped at 30% on every deal** — `proforma-adjustment.service.ts:2016` uses `calibrated.vacancyPct` as the M05 equilibrium floor. With `vacancyPct = 5.0` instead of `0.05`, the floor exceeded the `Math.min(0.30, …)` ceiling on every deal, locking `derivedVacancyPct` at 30% regardless of actual M07 signals. Every projection grid (perYear vacancy column) in the system was using 30% vacancy, inflating vacancy loss and suppressing NOI projections systematically.

**Required action:**
- Cashflow Agent prompts at `deal-assumptions.routes.ts:108` received "350% rent growth" / "550% exit cap" / "500% vacancy" inputs pre-fix.
- AI Coordinator narrative prompts at `deal-assumptions.routes.ts:106` same.
- Regenerate AI commentary on all deals matching: `last_viewed_at > 2026-04-01 AND last_ai_narrative_at < <fix_deploy_timestamp>` (commit b86c537, May 2026). In-memory `narrativeCache` auto-expires in 24 h from server restart; any cached narrative generated before the restart is already stale. If total deal volume is small (< 50), regenerate all regardless of last_viewed_at.
- Done criteria: no deal in the target set has a `narrativeCache` entry older than the fix deploy timestamp.

**Priority:** S — narrative cache cleared automatically on server restart (already done). Explicit re-generation sweep only needed if stale narratives were persisted to `deals.ai_narrative` column; check whether that column is written post-generation before scheduling a sweep job.

---

## POST-FIX: LP deliverable audit — Excel exports pre-fix had 100× understated gross-sale-value

**Reference:** Pct unit-break audit, May 2026 (fix commit: b86c537)
**Effort:** XS (audit) — variable (comms + re-export)

POST-FIX: LP deliverable audit — any Excel exports sent pre-fix (commit
b86c537, May 2026) had gross-sale-value 100× understated (`exitNoi / 5.5`
instead of `exitNoi / 0.055`, f9-financial-export.service.ts:220`). Sweep
the export audit log / sales pipeline for affected recipients. If LP
deliverables are in circulation: communicate correction and re-send updated
workbook. If platform is pre-revenue or no LP exports have been sent, mark
this entry resolved immediately.

**Done criteria:** Export audit confirmed clean, or affected recipients
notified and updated workbooks sent.

---

## POST-FIX: Audit for other dormant seeder improvements (Item 3 Phase 4)

**Reference:** F9 Tier 1 Item 3 fix (extraction hook + backfill script, May 2026)
**Effort:** M (depends on findings)

The seeder is a write-once cache — any seeder logic improvement shipped before
the `forceReseed` mechanism existed may not have propagated to pre-existing deals.
After Parts A+B of Item 3 ship:

1. Grep for write-time logic in `backend/src/services/proforma-seeder.service.ts`
   that depends on extraction data (fields computed from t12/rr/om capsules).
2. Cross-reference against task history for any "seeder improvement" tasks shipped
   before the `forceReseed` extraction hook (Part A, Item 3).
3. For each finding, decide:
   - **Backfill needed**: diverges for existing deals in the same pattern as
     `other_income_per_unit` (reseed script, same structure as
     `backend/scripts/reseed-other-income.ts`)
   - **New-deal-only by design**: logic only applies to deals created after the fix
     (no backfill required)

**Done criteria:** All pre-existing seeder improvements confirmed propagated to live
deals, or each finding documented as new-deal-only with rationale.

**Phase 0 correction (May 2026):** The initial audit query for `other_income_per_unit`
used only `other_income_breakdown` keys in the "expected" formula and missed
`other_income_user_lines`. 464 Bishop was incorrectly flagged as stale (75.34 vs
expected 25.34); the stored 75.34 is correct once the $11,600/month Cable user line
is included: (70,560 + 139,200) / 232 / 12 = 75.34. Both live deals confirmed
correctly seeded after the Item 3 backfill script was corrected to include user lines.
**Future validation queries for other_income_per_unit must sum breakdown + user lines.**
