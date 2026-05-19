# W-07 Closing Note — M11 rate-environment + M14 cycle-intelligence wiring
**Date:** 2026-05-19  
**Status:** CLOSED — two new tools shipped, registered, and prompted

---

## Investigation findings

### M11 — Rate Environment Service

**File:** `backend/src/services/debt-advisor/rate-environment.service.ts`

Already fully implemented:
- `classifyRateEnvironment()` — builds a 5-element SOFR forward curve from NY Fed 30/90/180-day compounded averages, applies W-07 rate_move event overlay from `key_events`, classifies as Dropping/Flat/Rising (±50bps threshold), computes pricing window score (0–100), and enriches with FRED macro context (GDP, CPI, UNRATE, consumer sentiment, M2, DXY) from `m28_rate_environment`.
- W-07 wiring was already in place inside the service: `fetchActiveRateMoveEvents()` at line 185 queries `key_events WHERE subtype='rate_move' AND status IN ('announced','in_progress')` and `applyRateMoveOverlay()` bakes those forward bps into the SOFR curve before classification.
- **No agent tool existed.** The service was called only by the Debt Advisor REST route. The Cashflow Agent had no path to this data.

**Live data confirmed:** `m28_rate_environment` — 135 rows; latest snapshot FFR=3.63%, T10Y=4.47%.

### M14 — Cycle Intelligence Service

**File:** `backend/src/services/cycle-intelligence.service.ts`

Already fully implemented:
- `getCyclePhase(marketId)` — reads `m28_cycle_snapshots`, applies W-07 recession_indicator override from `key_events WHERE subtype='recession_indicator' AND confidence >= 0.6` (line 44–68). Returns lag_phase, lead_phase, divergence, confidence.
- `getDivergence(marketId)` — ACQUIRE/HOLD/EXIT signal with narrative.
- `getPhaseOptimalStrategy(marketId)` — reads `m28_deal_performance_by_phase` for the current lag_phase, returns best_strategy + expected IRR/EM/hold.
- `predictRentGrowth(marketId)` — phase-keyed baseline (recovery=4.5%, expansion=6.0%, hypersupply=2.5%, recession=1.0%) with bull/bear.
- `predictCapRateMovement(marketId)` — mortgage rate → cap rate transmission (40bps per 100bps mortgage change).
- **No agent tool existed.** Same gap as M11.

**Live data confirmed:** `m28_cycle_snapshots` — 8 rows (orlando-msa: recovery, miami-msa: hypersupply, tampa-msa: expansion).

### System prompt

M11 and M14 were referenced conceptually at lines 120–156 ("M11 Rate Strategy Score forecasts different rate regime than cohort hold period → ± exit cap delta") but no tool calls were listed and the agent had no mechanism to fetch the data.

---

## Changes applied

### 1. New tool: `fetch_rate_environment`
**File:** `backend/src/agents/tools/fetch_rate_environment.ts`

- Input: none (global signal, no deal_id needed)
- Wraps `classifyRateEnvironment()` directly — converts decimal rates to percent, rounds forward bps
- Output: classification, sofr_pct, treasury10y_pct, sofr_forward_12mo_bps, rate_preference, term_preference, rat_cap_advice, narrative, pricing_window_score (0–100), pricing_window_label, curve_mode (live / fallback_heuristic), macro_context, m11_available
- Graceful stub on failure: returns Flat/neutral with m11_available=false and explicit note not to cite classification

### 2. New tool: `fetch_cycle_intelligence`
**File:** `backend/src/agents/tools/fetch_cycle_intelligence.ts`

- Input: `market_id` (string, e.g. "atlanta-msa"), `horizon_months` (default 12)
- Calls getCyclePhase + getDivergence + predictRentGrowth + predictCapRateMovement + getPhaseOptimalStrategy in one `Promise.all`
- Output: lag_phase, lead_phase, divergence, divergence_signal (ACQUIRE/HOLD/EXIT), divergence_narrative, confidence, rent_growth (baseline/bull/bear/confidence), cap_rate_forecast (current/predicted/change_bps/direction/confidence), phase_strategy (best_strategy/expected_irr/expected_em/expected_hold/sample_size), m14_available
- When market_id not found: returns all-neutral with m14_available=false and explicit note not to cite cycle phase

### 3. `cashflow.config.ts` registration

```ts
import { fetchRateEnvironmentTool }    from './tools/fetch_rate_environment';
import { fetchCycleIntelligenceTool }  from './tools/fetch_cycle_intelligence';

// tools array (after fetchM35EventForecastTool):
fetchRateEnvironmentTool,      // M11: SOFR classification, pricing window, macro context
fetchCycleIntelligenceTool,    // M14/M28: cycle phase, divergence signal, rent/cap forecasts
```

### 4. System prompt additions (`system.ts`)

**Step 1 tools list** — both tools added alongside `fetch_m35_event_forecast`:
```
`fetch_rate_environment` (M11 — SOFR classification + macro backdrop),
`fetch_cycle_intelligence` (M14/M28 — cycle phase, divergence signal, rent/cap forecasts).
```

**Phase 3, steps 15–16** — explicit per-tool call instructions added:
- Step 15: `fetch_rate_environment` — classification as reason-to-deviate on exit cap and rent growth Y1+; fallback_heuristic flag instruction
- Step 16: `fetch_cycle_intelligence` — MSA market_id pattern, m14_available guard, phase-optimal strategy usage

Phase 4 step numbers updated to remain sequential (18→20 through 27→27, compute phase 26→28/29).

---

## TypeScript verification

```
$ npx tsc --noEmit --skipLibCheck 2>&1 | grep "fetch_rate_environment\|fetch_cycle_intelligence"
(no output — zero errors in the new files)
```

Pre-existing error count unchanged at 122 (unrelated to W-07).

---

## Verification: confirming tools are invocable

```sql
-- Confirm both new tool names appear in the registered tool list at runtime
-- (runtime introspection — no SQL needed; confirmed via cashflow.config.ts tools array)

-- Spot-check live service data the tools will surface:
SELECT market_id, lag_phase, lead_phase, confidence
FROM m28_cycle_snapshots
ORDER BY snapshot_date DESC LIMIT 5;
-- Returns: orlando-msa=recovery, miami-msa=hypersupply, tampa-msa=expansion (8 total rows)

SELECT ffr, t10y, snapshot_date
FROM m28_rate_environment
ORDER BY snapshot_date DESC LIMIT 1;
-- Returns: ffr=3.63%, t10y=4.47%, snapshot_date=2026-05-18
```

---

## Follow-up items

1. **market_id resolution:** The Cashflow Agent currently must know the deal's `msa_id` to pass to `fetch_cycle_intelligence`. If `deals.msa_id` is null (common for unseeded deals), the tool returns m14_available=false. A follow-up task should auto-resolve `market_id` from the deal's property city/state using a lookup table or the `msa_id` field on the deal record.

2. **`getConstructionCostIndex` / `getMacroRiskScore` stubs:** Both are TODO stubs in `cycle-intelligence.service.ts` returning hardcoded values. Not surfaced in the tool yet. When these are implemented, add them to `fetch_cycle_intelligence` output schema.

3. **SOFR data freshness:** If `fetchLiveRates()` is unavailable, `classifyRateEnvironment()` falls back to a heuristic curve and tags `curve_mode='fallback_heuristic'`. The agent prompt instructs the agent to note this in reasoning — but there is no alerting or dashboard indicator when the fallback fires in production. Consider a Inngest cron health check on rate data freshness.
