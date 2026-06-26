# A6 Audit — Feature↔UI↔Backend (Per Surface)

> **Audit domain:** Surface-level correctness — does every frontend feature have a working backend route, and does the UI render real data?
> **Status:** ● Complete
> **Date:** 2026-06-25
> **Auditor:** Agent

---

## Surfaces Audited

1. **Asset Hub** (CapitalScreen, PerformanceScreen, MarketSignals)
2. **F9 ProForma** (ReturnsTab, OverviewTab, ProFormaSummaryTab, SensitivityTab)
3. **Cross-surface data consistency** (implied, not fully traced)

---

## Finding A6-01: Asset Hub — All Sections Mount-Only, No Live Refresh

| Section | Fetch Endpoint | useEffect Deps | Refresh Mechanism | UX Bug |
|---------|---------------|----------------|-------------------|--------|
| **CapitalScreen** | `GET /api/v1/lifecycle/:dealId/debt`, `GET /api/v1/capital/:dealId/waterfall` | `[dealId]` only | **None** | **Yes** |
| **PerformanceScreen** | `GET /api/v1/operations/:dealId/projected-vs-actual`, etc. | `[dealId, activeScreen]` | None for data changes | **Yes** |
| **MarketSignals** | `GET /api/v1/correlations/property/:propertyId` | `[propertyId, activeScreen]` | None | **Yes** |

**Impact:** If a user edits deal data in F9 while any Asset Hub tab is open, the tab stays stale. The user must navigate away and back to force re-mount → re-fetch.

**Fix options:**
1. Add `useDealStore` subscription and trigger re-fetch when deal slice changes
2. Add manual `↻ REFRESH` button per screen
3. Add global `refreshKey` to store that increments on mutations

---

## Finding A6-02: F9 ProForma — Tabs Use modelResults Directly, No "Run Model" Gate

| Tab | Uses modelResults? | Uses f9Financials? | Conditional Prompt |
|-----|-------------------|-------------------|-------------------|
| ReturnsTab | ✅ `modelResults?.summary` | ✅ fallback | None |
| OverviewTab | ✅ `modelResults?.summary` | ✅ fallback | None |
| ProFormaSummaryTab | ✅ `modelResults` | ✅ fallback | None |
| SensitivityTab | ✅ `modelResults?.summary` | ❌ | None |
| DecisionTab | ✅ `modelResults?.summary` | ✅ fallback | None |
| SourcesUsesTab | ✅ `modelResults?.sourcesAndUses` | ✅ fallback | None |
| WaterfallTab | ✅ `modelResults?.summary` | ✅ fallback | None |
| LeaseVelocitySection | ✅ | N/A | "RUN ENGINE ▶" prompt exists (line 1028) |

**Observation:** The `mergedFinancials` useMemo in `FinancialEnginePage.tsx` does NOT gate tab rendering. Every tab receives both `modelResults` and `f9Financials`. When `modelResults === null`, most tabs fall back to `f9Financials` data. This is **by design** — the F9 GET endpoint (`getDealFinancials`) already computes rich returns, so the model run is optional for most tabs.

**Exception:** `LeaseVelocitySection` has an explicit "RUN ENGINE ▶" prompt. Other tabs do not. The user may not realize whether they're seeing live model data or static F9 data.

**Risk:** LOW. The F9 GET endpoint produces correct values for most tabs. The model run is additive (sensitivity, detailed waterfall), not required for basic correctness.

---

## Finding A6-03: F9 → Asset Hub Cross-Surface Divergence (Inferred)

**Hypothesis:** If a user edits `rent_growth_pct` in F9 AssumptionsTab, the value is written to `per_year_overrides` and `deal_assumptions`. Asset Hub reads from `f9Financials` (static GET) which recomputes on every fetch. The values should be consistent IF the user reloads the Asset Hub page.

**BUT:** Because Asset Hub tabs don't auto-refresh (Finding A6-01), the user sees stale data in Asset Hub until they navigate away and back. This is a **cross-surface stale-data bug**, not a data-integrity bug.

**Fix:** Same as A6-01 — add refresh mechanism to Asset Hub.

---

## Fix Backlog

| ID | What | Surface | Priority |
|----|------|---------|----------|
| A6-F1 | Add refresh mechanism to Asset Hub CapitalScreen | Asset Hub | **P1** |
| A6-F2 | Add refresh mechanism to Asset Hub PerformanceScreen | Asset Hub | **P1** |
| A6-F3 | Add refresh mechanism to Asset Hub MarketSignals | Asset Hub | **P1** |
| A6-F4 | Add "Run Model" badge/gate to tabs that need live model data | F9 | P2 |

---

*END OF A6 REPORT.*
