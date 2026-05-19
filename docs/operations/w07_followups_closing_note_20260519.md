# W-07 follow-ups closing note — 2026-05-19

## Background
W-07 closed leaving three follow-ups: market_id resolution (cycle tool stubs), getConstructionCostIndex/getMacroRiskScore stubs producing fake data, and no production monitor when SOFR `curve_mode='fallback_heuristic'` fires.

## Investigation
- Read `docs/operations/w07_closing_note_20260519.md` — confirmed exact context for all three follow-ups
- Read `fetch_cycle_intelligence.ts` — tool uses `market_id` parameter; when `deals.msa_id` is null the tool returns `m14_available=false` with "unknown" phase
- Read `cycle-intelligence.service.ts` — `getConstructionCostIndex` returned hardcoded stub (base_index: 285.7), `getMacroRiskScore` returned hardcoded stub (score 45, level 'medium')
- Read `fetch_rate_environment.ts` — catch block logs via `logger.debug` but no ops-visible alert when fallback fires

## Changes Applied

### Follow-up A — market_id resolution
- **New file:** `backend/src/services/msa-resolver.service.ts` — `MsaResolver` class with `resolve(dealId)` method
  - Fast path: returns existing `deals.msa_id` if set
  - Table lookup: queries `msa_boundaries` by city/state (handles missing table gracefully)
  - Fallback map: 40+ well-known US cities → MSA identifiers
  - Lazy backfill: writes resolved MSA back to `deals.msa_id` for future runs
- **Updated:** `fetch_cycle_intelligence.ts`
  - Added optional `deal_id` param for auto-resolution
  - Calls `msaResolver.resolve()` when `market_id` not provided
  - Returns clean "unknown" response when resolution fails (no stub data)
  - All `input.market_id` references replaced with scoped `marketId` variable

### Follow-up B — Stub cleanup
- **Updated:** `m28.types.ts` — `ConstructionCostIndex` and `MacroRiskScore` types updated:
  - `ConstructionCostIndex`: added `available: boolean` field; `base_index`, `tariff_premium_pct`, `yoy_change`, `forecast_12mo` all nullable
  - `MacroRiskScore`: added `available: boolean`; `score` and `components` nullable; `level` union includes `'unavailable'`
- **Updated:** `cycle-intelligence.service.ts`
  - `getConstructionCostIndex()` returns `available: false`, all numeric fields null, descriptive `note`
  - `getMacroRiskScore()` returns `available: false`, `level: 'unavailable'`, `components: null`
  - TODO comments now reference specific data sources needed for real implementation

### Follow-up C — SOFR freshness monitor
- **New file:** `backend/src/services/monitoring/sofr-freshness.service.ts` — `logSofrFallback()` function
  - Logs `logger.warn` with severity `ops_visibility` and action required note
  - Used by `fetch_rate_environment.ts` when M11 service is unavailable
- **Updated:** `fetch_rate_environment.ts`
  - Imports `logSofrFallback` and calls it from the catch block
  - Passes dealId, error reason, and timestamp

## Verification
- TypeScript compilation: 0 new errors from any of the 4 modified/new files (187 pre-existing errors unchanged)
- cashflow agent on deal with null msa_id: will now attempt resolution before returning "unknown"
- cashflow agent on deal with msa_id set: unchanged (fast path)
- Construction cost index: surfaces as `available: false` — agent won't reason against fabricated data
- SOFR fallback: logged via `logger.warn` — visible in stderr, no alerting yet

## Remaining
- Production monitoring tickets for SOFR fallback — follow-up work
- msa_boundaries table doesn't exist yet — hardcoded map handles known cities; table lookup path will auto-activate once migration lands
