# Capital & Exit Subsystem Audit — Phase 0

**Audit date:** 2026-05-14
**Auditor:** Claude (agent)
**Scope:** Exit Strategy + Debt (debt-advisor/) + Exit Timing (exitCapRate.yaml /
trajectory-engine / Exit LIU lines). Read-only — no code changes.
**Out of scope:** DebtMarketSection.tsx (confirmed `PlaceholderContent
status="to-be-built"` stub, see §2.3); M08 strategy internals (only the
M08 → Debt interface contract); empirical calibration itself (Phase B,
gated on `historical_observations` corpus); whether the three modules
should be merged (audit documents alignment, not architecture choice).

> **Methodology** follows
> `docs/architecture/TRAFFIC_ENGINE_STATE_AUDIT.md` — same classification
> taxonomy, finding inventory style, and Phase 1 fix sequence pattern. The
> precedence rule for the calibration / alignment classifications is:
> **STRUCTURALLY_MISALIGNED > NOT_WIRED > HARDCODED > FALLBACK > DISPLAY_ONLY
> > ON_MOCK_DATA > WIRED/LIVE**.

---

## Table of Contents

1. [Files of Record](#1-files-of-record)
2. [Module State Summary](#2-module-state-summary)
3. [Event Feed Audit (0a)](#3-event-feed-audit-0a)
4. [Calibration State Audit (0b)](#4-calibration-state-audit-0b)
5. [Cross-Module Alignment Audit (0c)](#5-cross-module-alignment-audit-0c)
6. [Pro Forma Push Audit (0d)](#6-pro-forma-push-audit-0d)
7. [Current-State vs Target-State Flow (0e)](#7-current-state-vs-target-state-flow-0e)
8. [Finding Inventory (CE-N)](#8-finding-inventory-ce-n)
9. [Phase 1 Fix Sequence](#9-phase-1-fix-sequence)

---

## 1. Files of Record

### 1.1 Debt module

| File | Role | Status |
|---|---|---|
| `backend/src/services/debt-advisor/rate-environment.service.ts` | RATE_CLASSIFIER | INVOKED |
| `backend/src/services/debt-advisor/debt-plan-formulator.service.ts` | PLAN_BUILDER | INVOKED |
| `backend/src/services/debt-advisor/debt-context-modifier.service.ts` | MODIFIER | INVOKED |
| `backend/src/services/debt-advisor/lender-targeting.service.ts` | LENDER_DB | INVOKED |
| `backend/src/services/debt-advisor/m08-strategy-output.service.ts` | M08_ADAPTER | INVOKED |
| `backend/src/services/debt-advisor/strategy-debt-mapping.json` | CONFIG | INVOKED (imported by formulator) |
| `backend/src/services/rate-index.service.ts` | LIVE_FEED | INVOKED — NY Fed + Treasury.gov |
| `backend/src/services/m28-scheduler.service.ts` | CRON | INVOKED — daily 08:00 ET FRED ingest |
| `backend/src/scripts/ingest-rate-data.ts` | INGESTOR | INVOKED — writes `m28_rate_environment` |
| `backend/src/api/rest/debt-advisor.routes.ts` | ROUTE | INVOKED |
| `backend/src/services/proforma-adjustment.service.ts` (`applyDebtAdvisorPlatformDefault`, line 4903) | PROFORMA_BRIDGE | INVOKED on Accept |
| `backend/src/services/operatorStance.service.ts` (lines 112–127) | RATE_BRIDGE | INVOKED — seeds stance from m28 |
| `backend/src/services/cycle-intelligence.service.ts` (lines 103, 124) | M28_READER | INVOKED |
| `frontend/src/hooks/useDebtAdvisor.ts` | HOOK | INVOKED |
| `frontend/src/components/deal/sections/DebtTab.tsx` | UI | INVOKED |
| `frontend/src/components/deal/sections/DebtAdvisorSection.tsx` | UI | INVOKED |
| `frontend/src/components/deal/sections/DebtMarketSection.tsx` | UI | ✗ STUB (`PlaceholderContent status="to-be-built"`, line 19) |
| `frontend/src/components/deal/sections/DebtSection.legacy.tsx`, `DebtSection.demo.tsx` | UI | ON_MOCK (imports `debtMockData`) |

### 1.2 Exit Timing module (LIUS + Trajectory Engine)

| File | Role | Status |
|---|---|---|
| `backend/src/services/lius/lines/exit/exitCapRate.yaml` | SCHEMA | EXISTS |
| `backend/src/services/lius/lines/exit/*.yaml` (brokerCommission, closingCosts, defeasancePrepayment, dispositionCosts, exitTransferTax) | SCHEMA | EXISTS |
| `backend/src/services/lius/trajectory-engine.ts` | PROJECTION | INVOKED only from `lius/engine.ts` |
| `backend/src/services/lius/source-resolver.ts` | RESOLVER | INVOKED only from `lius/engine.ts` |
| `backend/src/services/lius/engine.ts` (`runLIUSEngine`) | ORCHESTRATOR | ✗ ORPHANED — no live caller found in `api/`, `routes/`, or any other service. Re-export in `lius/index.ts` is the only consumer pattern. |
| `backend/src/services/deterministic/deterministic-model-runner.ts` | EXIT_CONSUMER | INVOKED — reads `a.exitCap` from proforma assumptions bridge, **NOT from LIUS**. |
| `backend/src/services/deterministic/proforma-assumptions-bridge.ts` (line 319) | BRIDGE | INVOKED — `exitCap = toNumber(a.disposition?.exitCapRate, 0.065)` |

### 1.3 Exit Strategy module (frontend)

| File | Role | Status |
|---|---|---|
| `frontend/src/components/deal/sections/ExitStrategyTabs.tsx` | UI | INVOKED — `ExitWindowsTab`, `SensitivityTab`, `MonitorTab` mounted in DebtTab.tsx (lines 1076–1078) |
| `frontend/src/components/deal/sections/ExitCapitalModule.tsx` | UI | INVOKED — top-level module mounted in `pages/DealDetailPage.tsx:202` |
| `frontend/src/components/deal/sections/ExitDrivesCapital.tsx` | UI | INVOKED from DebtTab.tsx |
| `frontend/src/components/deal/sections/ConvergenceChart.tsx` | UI | INVOKED — 21yr quarterly chart |
| `frontend/src/shared/calculations/returns.ts` | CALC | shared with ExitCapitalModule |
| `frontend/src/data/exitMockData.ts` | MOCK | **NOT IMPORTED ANYWHERE** — grep across the repo returns zero consumers (verified via `grep -rn exitMockData /home/user/JediRe`). |
| `frontend/src/contexts/DealModuleContext.tsx` | CONTEXT | provides `financial`, `capitalStructure`, `market` to ExitDrivesCapital + DebtTab's `exitConfig` |
| `frontend/src/components/deal/sections/EventTimelineSection.tsx` | UI | reads `/api/v1/m35/deals/:dealId/events-context` |

### 1.4 Shared boundary services

| File | Role | Status |
|---|---|---|
| `backend/src/services/proforma-adjustment.service.ts` | PROFORMA_WRITER | INVOKED — `updatePlatformLayer()` (line 720) writes `exit_cap_current`; `applyDebtAdvisorPlatformDefault()` writes `per_year_overrides.debt:*` |
| `backend/src/services/trafficToProFormaService.ts` (lines 700–724) | M07_PROFORMA_BRIDGE | INVOKED — writes `exit_cap_current` from `assumptions.exitCap.platform.values[4]` |
| `backend/src/services/financial-model-engine.service.ts` (lines 501–502) | M26/M27_ENHANCER | INVOKED |
| `backend/src/routes/m35-events.routes.ts` (`/deals/:dealId/events-context`, line 602) | M35_FACADE | INVOKED |
| `backend/src/services/tax/taxProjection.service.ts` | M26_ACTUAL | INVOKED — M26 = Tax Projection, **not** a cap rate archive |

### 1.5 Database tables relevant to subsystem

| Table | Writer | Reader |
|---|---|---|
| `m28_rate_environment` | `scripts/ingest-rate-data.ts` scheduled daily 08:00 ET via `m28-scheduler.service.ts` (line 23) | rate-environment.service (line 137), cycle-intelligence (lines 103, 124), operatorStance (line 117), sentiment-history (line 218), economic-context.routes |
| `proforma_assumptions.exit_cap_current` | `trafficToProFormaService.persistPlatformLayer()` (line 707), `proforma-adjustment.service.updatePlatformLayer()` (line 753), `proforma-adjustment.service.finalize()` (line 788) | `proforma-assumptions-bridge.ts` (line 319), capsule-bridge.routes (line 213) |
| `deal_assumptions.per_year_overrides` (debt:* keys) | `applyDebtAdvisorPlatformDefault()` (proforma-adjustment.service line 4903) | DebtTab Configure resolver (F9 `debtOvr()`) |
| `archive_line_items` | (unverified writer) | `source-resolver.queryTier3()` (line 268). Cap rate trajectory is NOT a special table — it would be a row in this generic archive table. |
| `key_events`, `event_forecasts`, `event_subtypes`, `event_playbooks` | M35 ingestion pipeline | M35 routes only — none of the capital/exit modules query these tables directly. |

---

## 2. Module State Summary

### 2.1 Debt module — **real-but-event-blind, partly live-data-grounded**

The Debt module is the most fully-implemented of the three. Its rate
environment classifier reads live SOFR + Treasury data from NY Fed /
Treasury.gov (`rate-index.service.ts`) and enriches with FRED macro
indicators from `m28_rate_environment` which has a real daily writer
(`m28-scheduler.service.ts:23`, cron `'0 8 * * *'` ET). The plan
formulator composes that with a real M08 strategy adapter
(`m08-strategy-output.service.ts`) and a real seeded lender database
(`lender-targeting.service.ts`). On Accept it writes seven to nine
fields into the proforma's per-year-overrides as `resolution:'platform'`
— a genuine Pro Forma push.

**But it is fully event-blind.** Grep across the entire `debt-advisor/`
directory for `key_events`, `event_forecasts`, `MarketEvent`, `m35*`,
`primary_channel`, `rate_move`, `recession_indicator` returns **zero
matches**. The Debt module cannot incorporate a Fed rate-move event, a
recession indicator, or a regional shock except indirectly through the
NY Fed feed reflecting a rate change after the fact. Per
`Causal_Discipline_Addendum.md` §3.1 the `rate_move` and
`recession_indicator` event subtypes route to **`M14_macro`** — the Debt
module is the natural M14_macro consumer and currently is not.

### 2.2 Exit Timing module — **schema-only, orphaned**

Exit Timing exists as **schema definitions and a projection engine, both
fully built, but with no live caller**. `lius/engine.ts:runLIUSEngine`
has no consumer in any route, service, or job. The deterministic model
runner reads `exitCap` from a separate path
(`proforma-assumptions-bridge.ts:319`), bypassing LIUS entirely.

The single exit-cap-trajectory constant `-0.0025` at
`trajectory-engine.ts:84` is the **only number** that would actually
drive trajectory motion today if the engine were called — and it is a
hardcoded compression bias. `exitCapRate.yaml:31` declares
`sourcePreference: [3, 2.5, 4, 5]` (Tier 3 = "M26 archive submarket cap
rate trajectory"), but Tier 3 in `source-resolver.queryTier3()` (line
268) queries the generic `archive_line_items` table for
`line_item = 'exitCapRate'` — there is no cap rate trajectory series, no
dedicated submarket time-series table. The "M26 archive" referenced in
the YAML is a **spec-only concept** — M26 in this codebase is the Tax
Projection Service (`services/tax/taxProjection.service.ts`), not a cap
rate archive. See §4.2 finding **CE-M26**.

### 2.3 Exit Strategy module — **real-but-hardcoded, with display-only event ingestion**

ExitStrategyTabs (Exit Windows / Sensitivity / Monitor) reads real
`financial.noi`, `capitalStructure.totalEquity`, and
`capitalStructure.loanBalance` from `useDealModule()` via the
`exitConfig` prop assembled in DebtTab.tsx (lines 106–111). But the
RSS sub-scores (marketWindow, rateEnv, supplyPos, opReady,
buyerPressure) and the cap-rate / rent-growth / supply trajectory
arrays are **all hardcoded** —
`ExitStrategyTabs.tsx:265–268` (the `rg`, `cr`, `sp`, `va` arrays for
the 10yr projection) and `ExitCapitalModule.tsx:108–158` (the four
21-year hardcoded series RENT_GROWTH_21Y, CAP_RATES_21Y, SUPPLY_21Y,
T10_21Y). The Monitor tab is entirely hardcoded
(`useMonitoringData()`, `ExitStrategyTabs.tsx:373–418`).

`ExitCapitalModule` does fetch live M35 events from
`/m35/deals/${dealId}/events-context` (line 838) — but only renders
them as Case-For bullets, key-trigger cards, and chart markers (lines
909–998). The RSS_21Y and CAP_RATES_21Y series that drive the actual
exit-window decision **do not change** in response to those events.
Event ingestion is **DISPLAY_ONLY**.

`frontend/src/data/exitMockData.ts` exists but is **not imported
anywhere** (verified by `grep -rn exitMockData /home/user/JediRe`,
zero matches). Per the spec's Supplementary Clarification A, this would
have been a P0 finding had mock-data interception been live; in fact,
the module is on a worse failure mode — hardcoded arrays compiled
directly into the component code. That is harder to swap out than mock
data files would be.

### 2.4 DebtMarketSection.tsx — STUB (out of scope)

`PlaceholderContent status="to-be-built"` (line 19), zero functional
logic. Documented and skipped.

---

## 3. Event Feed Audit (0a)

### 3.1 Verifying the early grep

A definitive search for M35 / event consumption across all three
modules:

| Symbol searched | `backend/src/services/debt-advisor/` | `backend/src/services/lius/` | `frontend/.../ExitStrategyTabs.tsx`, `ExitCapitalModule.tsx`, `ExitDrivesCapital.tsx`, `DebtTab.tsx`, `DebtAdvisorSection.tsx` |
|---|---|---|---|
| `key_events` table | 0 | 0 | 0 |
| `event_forecasts` table | 0 | 0 | 0 |
| `event_playbooks` table | 0 | 0 | 0 |
| `MarketEvent` type | 0 | 0 | 0 |
| `m35TrafficApi*` | 0 | 0 | 0 |
| `m35-*.service` | 0 | 0 | 0 |
| `m35-*.routes` import | 0 | 0 | 0 |
| `primary_channel` / Causal Discipline registry | 0 | 0 | 0 |
| `rate_move`, `recession_indicator`, `regional_shock`, `multifamily_delivery` | 0 | 0 | 0 |
| `/m35/deals/...` API call | 0 | 0 | **1** — `ExitCapitalModule.tsx:838` calls `/m35/deals/:dealId/events-context` |

The single non-zero cell is `ExitCapitalModule.tsx:838`. Inspection
(lines 909–998) confirms the fetched events feed only:

- `caseForBullets` (Case-For panel) — display-only narrative.
- `keyTriggers` (Key Triggers card) — display-only.
- `caseForDataAsOf` / `keyTriggersDataAsOf` — timestamp display.
- Chart markers (via `liveEvents` prop, `ConvergenceChart21`) — display-only.

The `RSS_21Y` array (the actual exit decision data) is generated
from four hardcoded 21-year arrays (`computeRSS21`, lines 161–183) and
never reads `m35Events`. Verdict: events are **rendered, not
consumed**.

### 3.2 SHOULD-consume matrix per Causal Discipline §3.1

| Event subtype | Primary channel | Debt SHOULD | Debt actual | Exit Timing SHOULD | Exit Timing actual | Exit Strategy SHOULD | Exit Strategy actual |
|---|---|---|---|---|---|---|---|
| `rate_move` | M14_macro | WIRED | NOT_WIRED | WIRED | NOT_WIRED | WIRED | NOT_WIRED (display-only on Module) |
| `recession_indicator` | M14_macro | WIRED | NOT_WIRED | WIRED | NOT_WIRED | WIRED | NOT_WIRED (display-only) |
| `regional_shock` | multi_channel (M07 + M14) | (M14 leg) WIRED | NOT_WIRED | WIRED | NOT_WIRED | WIRED | NOT_WIRED (display-only) |
| `multifamily_delivery` | M07_traffic | n/a (supply ≠ debt) | n/a | WIRED — supply affects buyer-pressure / cap demand | NOT_WIRED | WIRED — feeds `supplyPressure` & `buyerPressure` RSS components | NOT_WIRED (display-only) |
| `employer_expansion/contraction` | M07_traffic | n/a | n/a | indirect via cap pressure | NOT_WIRED | indirect via `marketWindow` | NOT_WIRED (display-only) |
| `major_relocation_announcement` | multi_channel | (M14 leg) WIRED | NOT_WIRED | (M14 leg) WIRED | NOT_WIRED | WIRED | NOT_WIRED (display-only) |

The WIRED column is empty across every module × event-subtype pairing
that the Causal Discipline addendum requires. This is the central
finding of the audit.

### 3.3 Causal-Discipline corollary

Per `Causal_Discipline_Addendum.md` §3.4, the policy is enforced "at
the wiring layer via Kafka subscription policy, not at runtime
per-call." No Kafka subscription for `event.classified` was found in
any of the three modules; the modules are not subscribers (forbidden
or otherwise) of the M35 event topic. This is structurally
**NOT_WIRED**, not "wired but disabled."

---

## 4. Calibration State Audit (0b)

### 4.1 Debt module

| Calibration input | Classification | Evidence |
|---|---|---|
| SOFR spot (`liveRates.sofr`) | **LIVE** | `rate-index.service.ts:170` — `fetchLiveRates()` fetches NY Fed `rates/all/latest.json`. Cache TTL 15min. Network failure: `LiveRates` falls back to `lastKnownLive` (line 259). |
| SOFR 30/90/180-day compounded averages (`sofrAvg30/90/180`) | **LIVE_WITH_FALLBACK** | `rate-index.service.ts:196` — read from `SOFRAI` rate-type. **Fallback in `buildSofrForwardCurve()` `rate-environment.service.ts:84`** — if `sofrAvg30 === 0`, switches to level-shift heuristic keyed on absolute spot. Whether the curve runs on the heuristic depends on whether the NY Fed `SOFRAI` response shipped `average30day/90day/180day` fields populated; in production this should ship, but the code path silently degrades. |
| Treasury 10Y (`liveRates.treasury10Y`) | **LIVE** | `rate-index.service.ts:220` — Treasury.gov CSV daily yield curve. |
| Fed Funds target band (`effrTargetLow/High`) | **LIVE** | `rate-index.service.ts:204` — NY Fed `EFFR` rate-type. |
| `m28_rate_environment` (GDP, CPI, UNRATE, consumer sentiment, M2, DXY) | **LIVE** | Daily writer: `m28-scheduler.service.ts:23` `cron.schedule('0 8 * * *', ingestRateData, { timezone: 'America/New_York' })`. **Unlike the original `traffic_calibration_factors` situation pre-FIX-1, this table HAS a scheduled writer.** Reader: `rate-environment.service.ts:137`. |
| `strategy-debt-mapping.json` (sub-strategy → product map, structure, alternatives, rationale) | **CONFIG (live-applied)** | Imported `debt-plan-formulator.service.ts:21`; consumed in `buildPhases()` (line 386 `mapping.structure`), `buildAlternatives()` (line 555), and at every Phase-1/Phase-2 product, IO months, amort years, target LTV, spread, prepay-type resolution. Not dead config. |
| `strategy-debt-mapping.json` magnitudes (numeric defaults like `targetLtv: 0.70`) | **HARDCODED (config)** | Static JSON values, no Bayesian update path, no empirical refit cron. Source: editor-authored constants. |
| Debt-context modifiers — size tiers (`SIZE_TIERS`, `debt-context-modifier.service.ts:50–55`) | **HARDCODED** | `MICRO: 2_000_000`, `SMALL: 5_000_000`, `MID: 25_000_000`, `LARGE: 75_000_000`. |
| Debt-context modifiers — geography exclusions (`AGENCY_EXCLUDED_STATES`, `RESTRICTED_STATE_PRODUCTS`, `CMBS_RESTRICTED_STATES`, lines 40–48) | **HARDCODED** | Hand-curated state lists, no upstream source. |
| Debt-context modifiers — asset-age haircuts (`age >= 45 → ltvHaircutPct: 0.025`, `age >= 30 → 0.01`, lines 174–185) | **HARDCODED** | Magic numbers. |
| Debt-context modifiers — sponsor (`sponsorDealCount <= 1 → recourse`, `sponsorLiquidityRatio < 0.10`, lines 190, 197) | **HARDCODED** | Thresholds in code. |
| Lender database (`LENDER_DB`, `lender-targeting.service.ts:33+`) | **HARDCODED** | Seeded array of agency / CMBS / bridge lenders with magnitudes (typicalLtv, minLoanM, maxLoanM, recoursePreference) hand-entered. No live lender-quote feed. `LENDER_QUOTES` in `ExitCapitalModule.tsx:239` is a separate hardcoded UI array. |
| Spread defaults (`spreadBps = phaseStructure.spread ? Math.round(phaseStructure.spread * 10000) : 275`, formulator line 394) | **HARDCODED FALLBACK** | If mapping doesn't supply spread, defaults to 275bps. |
| Pricing-window heuristic (`computePricingWindowScore`, rate-environment.service:100–120) | **HARDCODED weights** | `+20 if Dropping`, `−20 if Rising`, `+10/−10` spread bands, `+15/−15` SOFR-level bands. |

### 4.2 Exit Timing module

| Calibration input | Classification | Evidence |
|---|---|---|
| `exit_cap_trajectory: -0.0025` default growth rate | **HARDCODED** | `trajectory-engine.ts:84`. Single numeric constant. Confirms prior scan. |
| `exitCapRate.yaml` scheduled events Year 1 `deltaPct: 0.0`, Year 3 `deltaPct: 1.0`, both `source: "schema"` | **HARDCODED** | `exitCapRate.yaml:53–65`. Schema-default placeholders, `binding: false`, `confidence: 0.6 / 0.4`. |
| `exitCapRate.yaml:31` `sourcePreference: [3, 2.5, 4, 5]` (Tier 3 first) | **NOT_WIRED** | Tier 3 in `source-resolver.queryTier3()` (line 268) queries `archive_line_items WHERE line_item = $1 AND ad.state = $2` — generic per-line-item annual amount. There is no `cap_rate_trajectory`, `cap_rate_series`, or `submarket_cap_rate` table in the schema (grep across `backend/src/database/migrations/` and `backend/src/` returns zero matches). If `archive_line_items` has no rows for `line_item='exitCapRate'`, every deal falls through to tier 5 (going-in + 25bps). |
| Tier 4 (broker OM going-in cap) | **CONDITIONAL_LIVE** | `source-resolver.queryTier4()` (line 309) reads `ctx.brokerAssumptions['exitCapRate']`. Live when broker OM is parsed and present; absent otherwise. |
| Tier 5 fallback default | **HARDCODED** | `queryTier5()` does not define `exitCapRate` in its defaults map (lines 338–380). For exit cap the cascade therefore lands on Tier 4 if broker present, otherwise yields `null` — no compute path returns "going-in + 25bps" automatically. The schema *comment* says "going-in cap + 25bps" but no code path implements it for exitCapRate. |
| `lius/engine.ts:runLIUSEngine` invocation | **NOT_WIRED** | No live caller (see §1.2). Even if Tier 3 / 4 / 5 worked, no service calls the engine. |
| `M26 archive submarket cap rate trajectory` (`exitCapRate.yaml:32` and `:85`) | **SPEC_ONLY / NOT_WIRED** | M26 in this codebase = Tax Projection Service (`services/tax/taxProjection.service.ts:2`). Grep for `cap_rate_archive`, `cap_rate_series`, `cap_rate_trajectory`, `submarket_cap_rate`, `cap_rate_history`, `exit_cap_archive`, `m26.*cap` returns zero matches. The YAML's reasoning template references `{{five_year_forward}}`, `{{ten_year_forward}}`, `{{going_in_range}}` — none of these template variables have a populating writer. **The M26 cap rate trajectory does not exist as a table, service, or even a draft.** |
| `archive_line_items` writer | **UNVERIFIED** | grep for `INSERT INTO archive_line_items` returns no rows from production code paths; the table may exist as schema-only with manual seeding or backfill scripts not surfaced. |

### 4.3 Exit Strategy module (frontend)

| Calibration input | Classification | Evidence |
|---|---|---|
| `RENT_GROWTH_21Y` (84 quarters) | **HARDCODED** | `ExitCapitalModule.tsx:108–119` |
| `CAP_RATES_21Y` (84 quarters) | **HARDCODED** | `ExitCapitalModule.tsx:121–132` |
| `SUPPLY_21Y` (84 quarters) | **HARDCODED** | `ExitCapitalModule.tsx:134–145` |
| `T10_21Y` (84 quarters) | **HARDCODED** | `ExitCapitalModule.tsx:147–158` |
| RSS computation (`computeRSS21`) | **HARDCODED FORMULA** | `ExitCapitalModule.tsx:161–183` — weighted blend `mw*0.35 + re*0.25 + sp*0.2 + opR*0.15 + bp*0.05` of derived terms from the four hardcoded arrays + sinusoidal `txn`/`bp` (line 166–167). No upstream live data. |
| ExitWindowsTab rg/cr/sp/va arrays | **HARDCODED** | `ExitStrategyTabs.tsx:265–268` — 10-element fixed series. |
| `useMonitoringData()` (alerts, signals, scenarios, rssHistory, drift) | **HARDCODED MOCK** | `ExitStrategyTabs.tsx:373–418` — all fields fixed strings/numbers. |
| `LENDER_QUOTES` UI table | **HARDCODED** | `ExitCapitalModule.tsx:239–244` |
| `FOMC_MEETINGS_2026` | **HARDCODED** | `ExitCapitalModule.tsx:210–219` |
| `FED_DOT_PLOT` | **HARDCODED** | `ExitCapitalModule.tsx:221–227` |
| `ExitDrivesCapital` `DEFAULT_RENT_GROWTH`, `RATES`, `SUPPLY_DELIVERING` | **HARDCODED** | `ExitDrivesCapital.tsx:28–32` |
| `ExitDrivesCapital` rent growth derivation (line 121–130) | **PARTIAL_LIVE** | If `market.rentGrowth` is set on `useDealModule()` context, scales the hardcoded fallback array by a decay factor; otherwise uses hardcoded array verbatim. Decay-from-single-scalar, not a real time series. |
| `exitConfig.baseNOI`, `equityInvested`, `loanBalance` (DebtTab.tsx:106–111) | **LIVE (with fallback defaults)** | Read from `useDealModule().financial.noi`, `capitalStructure.totalEquity`, `capitalStructure.loanBalance[0]`. Defaults `8000000` / `19200000` when absent. |
| Live rates panel (`liveRates` state in DebtTab/ExitCapitalModule) | **LIVE** | Calls `${API_BASE}/rates/live` — same NY Fed feed as rate-environment service. |
| M35 events panel | **LIVE — DISPLAY_ONLY** | `ExitCapitalModule.tsx:830–855` polls `/m35/deals/${dealId}/events-context` every 5min. Per §3.1, does not feed RSS or projection. |
| `frontend/src/data/exitMockData.ts` interception | **NOT_LIVE — file exists but no importer** | `grep -rn exitMockData /home/user/JediRe` → 0 matches. File is orphaned; per Supplementary Clarification A this would have been P0 had it been live. |

---

## 5. Cross-Module Alignment Audit (0c)

The three modules each produce a forward-looking view of "exit
conditions" but use different inputs and compute the answer N times.

### 5.1 Pairing matrix

| Pairing | Classification | Evidence |
|---|---|---|
| Debt `rate-environment.service.classification` (Dropping/Flat/Rising) ↔ Exit Timing `exit_cap_trajectory: -0.0025` | **STRUCTURALLY_MISALIGNED** | Exit Timing's exit-cap trajectory is a hardcoded constant (`trajectory-engine.ts:84`); a constant cannot align with anything dynamic. Per Supplementary Clarification C, this is the right call. Debt could say "Rising" while exit trajectory still says −0.25%/yr compression. |
| Debt `RateEnvironment` ↔ Exit Strategy `rateEnv` RSS sub-score (`ExitStrategyTabs.tsx:282`) | **STRUCTURALLY_MISALIGNED (computed independently)** | Exit Strategy `rateEnv = y <= 3 ? 68 : y <= 6 ? 62 : 55` — a deterministic year-index lookup, ignores the Debt module's live classification entirely. In ExitCapitalModule it's `re = ((5.0 − rate) / 2.5) * 100 * 0.4 + …` (line 170) using the hardcoded `T10_21Y` array — also independent of the Debt module's `RateEnvironment`. Two independent computations with no shared source. |
| Debt `RateEnvironment` ↔ `operatorStance.rateEnvironment` | **SHARED_SOURCE (one-way, partial)** | `operatorStance.service.ts:117` reads `policy_stance, forward_direction` from the same `m28_rate_environment` table the Debt module reads. Both seeded from one truth source. But the Debt module's classifier and the stance's classifier are independent functions over the same row — they could disagree on the label. |
| Exit Timing trajectory ↔ Exit Strategy cap-rate series (`CAP_RATES_21Y`, `cr[]`) | **STRUCTURALLY_MISALIGNED** | Two unrelated hardcoded sources for the same conceptual quantity. The Exit Strategy projection's exit cap (e.g., Year 3 `cr[3] = 5.05`) does not derive from LIUS/trajectory-engine output. Even if both were dynamic they'd be independent computations. |
| Exit Strategy `supplyPressure` / `buyerPressure` RSS components ↔ Traffic Engine supply data / M35 events | **INDEPENDENT_COULD_DIVERGE** | Exit Strategy `sp[y]` is a 10-element hardcoded array (`ExitStrategyTabs.tsx:267`); ExitCapitalModule `SUPPLY_21Y` is an 84-quarter hardcoded array. Neither reads from `multifamily_delivery` M35 events or from traffic supply intelligence. Per §3.1 both would be "supply-event WIRED" consumers if events flowed in. |
| Exit Strategy exit-window timing ↔ Exit Timing cap-rate trajectory | **STRUCTURALLY_MISALIGNED** | Exit windows are derived from RSS thresholds (RSS ≥ 70 = prepare, ≥ 85 = sell; `ExitStrategyTabs.tsx:336`). RSS is built from the hardcoded arrays, not from LIUS exitCapRate output. There is no flow from LIUS to ExitWindows. |
| Debt phase exit timing (`phaseLabel: 'Phase ${n} — Exit / Payoff (M${holdMonths})'`, formulator line 498) ↔ Exit Strategy `optimalYear` | **INDEPENDENT_COULD_DIVERGE** | Debt's exit phase month comes from `holdMonths` (M08 strategy or deal-level hold), Exit Strategy's optimal exit comes from RSS-argmax over the hardcoded projection. Both reach the same person but neither informs the other. |
| Debt `correlationContext.rssAdjustmentBps` (formulator line 522–547) ↔ Exit Strategy RSS gauge | **NAMING_COLLISION — different concepts** | Formulator's `rssAdjustmentBps` is a bps adjustment to debt economics keyed by risk score and rate classification (10–35bps in code). Exit Strategy's RSS is a 0–100 "Sell Readiness Score" computed independently. Same acronym, unrelated scales. |

### 5.2 Dependency map — what SHOULD be one computed value vs N

```
                       Causal Discipline §3.1 + 3.3 target
                    ┌─────────────────────────────────────┐
                    │  M14_macro events                   │
                    │  (rate_move, recession_indicator,   │
                    │   regional_shock)                   │
                    └────────────────┬────────────────────┘
                                     │
                                     ▼
              ┌─────────────────────────────────────────┐
              │  Single rate environment value          │
              │  (Dropping/Flat/Rising + classification │
              │   confidence + trajectory)              │
              └─────┬───────────────┬───────────────────┘
                    │               │
       ┌────────────▼──┐  ┌─────────▼───────────┐
       │ Debt          │  │ Exit cap trajectory │
       │ ratePreference│  │ (LIUS exit.exitCap) │
       │ + product mix │  │ + Exit window timing│
       └───────────────┘  └─────────────────────┘
                                     │
                                     ▼
                         ┌─────────────────────┐
                         │ Pro Forma exit cap  │
                         │ (proforma.exit_cap) │
                         └─────────────────────┘
```

Today: **four** independent computations of the rate / cap-rate
posture:

1. `rate-environment.service.classifyRateEnvironment()` — Dropping/Flat/Rising.
2. `operatorStance.service.mapM28ToRateEnvironment()` — policy_stance string.
3. `ExitStrategyTabs.useProjectionModel().projectionModel[y].rateEnv` — hardcoded year-index.
4. `ExitCapitalModule.computeRSS21(i).re` — derived from hardcoded `T10_21Y`.

…plus the exit cap rate value, computed in **three** independent paths:

1. LIUS `exit.exitCapRate` → trajectory engine projection (orphaned).
2. `proforma_assumptions.exit_cap_current` — written by trafficToProForma (M07 path) and updatePlatformLayer.
3. `ExitCapitalModule.CAP_RATES_21Y` — 84-element hardcoded array used to color the UI.

…and consumers do not know they are reading different numbers.

---

## 6. Pro Forma Push Audit (0d)

### 6.1 Debt module → Pro Forma

**WIRED** — `applyDebtAdvisorPlatformDefault()` is the canonical write
path (`proforma-adjustment.service.ts:4903`). Invoked from
`debt-plan-formulator.acceptDebtPlan()` (line 864 onward). For each
non-exit phase it writes:

- `debt:{loanId}:loanAmount`
- `debt:{loanId}:termYears`
- `debt:{loanId}:amortYears`
- `debt:{loanId}:ioMonths`
- `debt:{loanId}:origFee`
- `debt:{loanId}:exitFee`
- `debt:{loanId}:rateType`
- `debt:{loanId}:prepayType`
- For Fixed: `debt:{loanId}:interestRate`
- For Floating: `debt:{loanId}:sofr` + `debt:{loanId}:spread` (split so Configure derives the same rate)

All written with `resolution: 'platform'`, source `'debt_advisor'`. The
F9 Configure resolver consumes these via the `debtOvr()` helper. **The
debt plan's loan amount, rate, IO period, and amort flow into the Pro
Forma's debt service calculation through the Configure layer; they are
not a parallel system.**

One caveat: the write happens on **Accept** (user-initiated). Pre-Accept,
the Pro Forma's `debt_service` is computed from its own
`a.financing.*` fields (`proforma-assumptions-bridge.ts:309–316`), not
from the Debt Advisor's recommended plan. If the user never clicks
Accept, the recommended plan never reaches the model. Classification
nuance: **WIRED, on-explicit-user-action.**

### 6.2 Exit Timing module → Pro Forma

**NOT_WIRED.** Two unbroken disconnects:

1. `lius/engine.ts:runLIUSEngine` has no live caller (§1.2). LIUS
   evidence and trajectory projections are computed by code that no
   route, agent, or job invokes today.
2. Even if LIUS ran, `proforma-assumptions-bridge.ts:319`
   (`exitCap = toNumber(a.disposition?.exitCapRate, 0.065) || 0.065`)
   reads the exit cap from `proforma_assumptions`, not from any LIUS
   output. There is no
   `liusResult.evidence.find(e => e.liuid === 'exit.exitCapRate')`
   anywhere in the deterministic model runner.

The trajectory-engine projection for `exit.exitCapRate` (year-by-year
values) exists in `LIUSEngineResult.evidence[].trajectory.yearProjections`
but is consumed by zero callers.

### 6.3 Exit Strategy module → Pro Forma

**DISPLAY_ONLY.** ExitStrategyTabs, ExitCapitalModule, and
ExitDrivesCapital all **read** from `useDealModule().financial.noi`,
`capitalStructure`, `market.rentGrowth`. None of them call
`useDealModule().updateFinancial()`, `updateCapitalStructure()`, or
any backend write endpoint with their derived IRR / multiple / exit-cap
sensitivity / drift detection output.

- IRR sensitivity grid (`SensitivityTab`, ExitStrategyTabs.tsx:655) —
  computed in `useMemo`, rendered, never persisted.
- Exit windows (`useProjectionModel().windows`,
  ExitStrategyTabs.tsx:332) — rendered as badge / chart highlight, not
  persisted.
- Monitor drift detection (`useMonitoringData()`,
  ExitStrategyTabs.tsx:373) — hardcoded mock to start with; even the
  real values it shows are not written back.

### 6.4 Where exit_cap_current actually comes from

Writers to `proforma_assumptions.exit_cap_current`:

| Source | File:line | Trigger |
|---|---|---|
| `trafficToProFormaService.persistPlatformLayer()` | trafficToProFormaService.ts:707 | Called from `pushTrafficToProForma()` after M07 traffic prediction refresh. Reads `assumptions[exitCap].platform.values[4]` (a Year-5 sparse value). |
| `proforma-adjustment.service.updatePlatformLayer()` | proforma-adjustment.service.ts:753 | Called explicitly with `{exitCap: ...}`. Live callers: only `trafficToProFormaService` indirectly. |
| `proforma-adjustment.service.finalize()` (line 788) | proforma-adjustment.service.ts:788 | Called when M11 capital structure engine signals finalization with `debtServiceConfig.exitCap`. |
| Manual `exit_cap_baseline` migration / seed | (varies) | Initial value. |

The exit cap rate in the model today is whatever the **M07
trafficToProFormaService** last wrote, or the manual baseline if M07
never ran. Per the spec note in exitCapRate.yaml ("the single most
important assumption — a 25bps error at 5.5% exit cap is ~4.5% of
value, ~$2.7M on a $60M deal"), the model is currently driven by an
M07-derived sparse-year exit cap, **not** by Exit Strategy
sensitivity analysis, **not** by Exit Timing LIUS, **not** by Debt
rate environment, and **not** by an empirical cap rate trajectory.

---

## 7. Current-State vs Target-State Flow (0e)

### 7.1 Current state

```
  NY Fed + Treasury.gov          FRED daily ingest (cron 08:00 ET)
  rate-index.service.ts                ingest-rate-data.ts
            │                                    │
            ▼                                    ▼
  ┌──────────────────┐              ┌──────────────────────────┐
  │ classifyRate     │◀─────────────│  m28_rate_environment    │
  │ Environment      │              │  (GDP, CPI, UNRATE, ...) │
  └────────┬─────────┘              └────────────┬─────────────┘
           │                                     │
           ▼                                     ▼
  ┌──────────────────┐              ┌──────────────────────────┐
  │ debt-plan-       │              │ operatorStance           │
  │ formulator       │              │ (separate classifier)    │
  └────────┬─────────┘              └──────────────────────────┘
           │ Accept
           ▼
  ┌────────────────────────────────────┐
  │ proforma_assumptions               │
  │  per_year_overrides.debt:*         │◀── ✓ WIRED (Debt → PF)
  └────────────────────┬───────────────┘
                       │
                       ▼
              deterministic-model-runner

  ✗ NO EVENT INPUT ──── (M35 key_events / event_forecasts) ──── ✗ NO INPUT

  ┌──────────────────────────────────────────────────────────────┐
  │  ExitStrategyTabs   ExitCapitalModule   ExitDrivesCapital    │
  │    ╞ hardcoded        ╞ hardcoded         ╞ hardcoded        │
  │    │   rg/cr/sp/va    │   RENT_GROWTH_21Y, CAP_RATES_21Y,    │
  │    │   arrays         │   SUPPLY_21Y, T10_21Y                │
  │    │                  │                                       │
  │    │                  ├── fetches /m35/deals/:id/events-     │
  │    │                  │   context  ─── DISPLAY_ONLY          │
  │    │                  │                                       │
  │    ╰─ reads useDealModule().financial.noi, capitalStructure  │
  │                                                                │
  │  No writes back to proforma_assumptions or dealStore           │
  └──────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │  LIUS engine (exit.exitCapRate + trajectory-engine)          │
  │    ╞ schema, resolver, trajectory engine all built           │
  │    ╞ exit_cap_trajectory = -0.0025 (hardcoded)               │
  │    ╞ Tier 3 "M26 archive" — does not exist as a service      │
  │    ╞ No live caller anywhere                                  │
  │    ╰ ✗ ORPHANED                                               │
  └──────────────────────────────────────────────────────────────┘

  proforma_assumptions.exit_cap_current is set by:
   - trafficToProFormaService (M07 path, sparse Y5/Y10)
   - manual baseline at deal creation

  → deterministic-model-runner reads exitCap from this single field
  → Exit Strategy, Exit Timing, and Debt do NOT read or write it
```

### 7.2 Target state

```
  M14_macro Kafka topic
  (rate_move, recession_indicator, regional_shock)
            │
            ├──────────────────────────────────────┐
            ▼                                      ▼
  ┌──────────────────────────────┐    ┌──────────────────────────────┐
  │ Single Rate Environment      │    │ Single Exit Cap Trajectory   │
  │ Service                      │    │ Service                      │
  │  - reads m28 + live + events │    │  - reads m28 + events +      │
  │  - emits {classification,    │    │    historical_observations   │
  │    forwardCurve, confidence} │    │    realized_cap_rate_change_t│
  └──────────────┬───────────────┘    └──────────────┬───────────────┘
                 │                                   │
        ┌────────┼───────────┬───────────┐           │
        ▼        ▼           ▼           ▼           ▼
   ┌────────┐ ┌──────┐  ┌──────────┐ ┌─────────┐ ┌──────────┐
   │  Debt  │ │ Exit │  │  Exit    │ │  LIUS   │ │ ProForma │
   │ plan   │ │Strat-│  │ Drives   │ │ exit.   │ │ exit_cap │
   │ formul-│ │ egy  │  │ Capital  │ │ exitCap │ │ _current │
   │ ator   │ │ tabs │  │          │ │ Rate    │ │ (writer) │
   └────────┘ └──────┘  └──────────┘ └─────────┘ └────┬─────┘
                                                       │
                                                       ▼
                                          deterministic-model-runner
                                          (single source of truth)
```

The delta between 7.1 and 7.2 is the Phase 1 fix inventory.

---

## 8. Finding Inventory (CE-N)

| ID | Classification | Description | Priority | Effort | Downstream Impact | Phase |
|---|---|---|---|---|---|---|
| CE-01 | STRUCTURALLY_MISALIGNED | `exit_cap_trajectory: -0.0025` is a single hardcoded constant (`trajectory-engine.ts:84`); cannot align with the Debt module's dynamic rate classification. | P0 | S | Pro Forma exit value, IRR | A |
| CE-02 | NOT_WIRED | LIUS `runLIUSEngine` has no live caller. `exit.exitCapRate` schema and trajectory projections are orphaned. The deterministic model reads `exitCap` from a parallel proforma_assumptions path. | P0 | M | Pro Forma exit value | A |
| CE-03 | NOT_WIRED | None of Debt, Exit Timing, or Exit Strategy consume `key_events`, `event_forecasts`, `event_playbooks`, or subscribe to the `event.classified` Kafka topic. `M14_macro` channel has zero registered consumers. | P0 | M-L | All three modules — event impact never propagates | A (consumer wiring) / B (impact magnitudes) |
| CE-04 | HARDCODED (worse than ON_MOCK) | `ExitStrategyTabs.useProjectionModel` rg/cr/sp/va arrays (lines 265–268) and `ExitCapitalModule` four 21-year arrays (lines 108–158) drive every exit-window decision shown in the UI. `exitMockData.ts` is orphaned — the worse state is **hardcoded in component code**. | P0 | M | Exit Strategy correctness; user trust in the module | A (scaffold) / B (data) |
| CE-05 | HARDCODED MOCK | `useMonitoringData()` (ExitStrategyTabs.tsx:373) is entirely hardcoded — alerts, signals, scenarios, rssHistory, drift. The Monitor tab does not monitor anything. | P1 | M | Monitor tab user trust | A |
| CE-M26 | SPEC_ONLY / NOT_WIRED | The "M26 archive submarket cap rate trajectory" referenced in `exitCapRate.yaml:32,85` and in the comment at `:13` does NOT exist as a table, service, or service plan. M26 in this codebase is `services/tax/taxProjection.service.ts` (Tax Projection). No `cap_rate_archive`, `cap_rate_trajectory`, or `submarket_cap_rate` table exists. Tier 3 resolver queries `archive_line_items` for `line_item='exitCapRate'` — a row whose writer is also unverified. **Decision: M26 cap rate archive is a spec-only concept.** | P0 | L | Exit Timing entire premise | B (corpus-gated; needs historical_observations realized_cap_rate_change_t* per HISTORICAL_OBSERVATIONS_SPEC §10) |
| CE-06 | LIVE_WITH_FALLBACK | `buildSofrForwardCurve()` (rate-environment.service.ts:69–82) silently degrades to a level-shift heuristic when `sofrAvg30 === 0`. No telemetry surfaces which mode is active in production. | P2 | S | Debt rate trajectory accuracy | A |
| CE-07 | INDEPENDENT_COULD_DIVERGE | Four independent rate-environment computations exist: `rate-environment.service`, `operatorStance.service`, `ExitStrategyTabs.rateEnv` (hardcoded), `ExitCapitalModule.re` (derived from `T10_21Y` hardcoded). | P1 | M | Cross-module consistency | A |
| CE-08 | INDEPENDENT_COULD_DIVERGE | Three independent exit-cap values: LIUS `exit.exitCapRate` (orphaned), `proforma_assumptions.exit_cap_current` (live, written by M07), `ExitCapitalModule.CAP_RATES_21Y` (hardcoded UI). | P0 | M | Exit valuation; user confusion | A (single-writer) / B (model) |
| CE-09 | WIRED_BUT_GATED | `applyDebtAdvisorPlatformDefault` only fires on Accept (debt-plan-formulator.acceptDebtPlan, line 864). If user does not Accept, Pro Forma uses its own debt assumptions and the Debt Advisor recommendation is display-only. | P2 | S | Pro Forma accuracy vs recommended | A |
| CE-10 | HARDCODED | Debt-context modifier magnitudes (size tiers, age haircuts, sponsor thresholds, geography exclusions) are hardcoded constants in `debt-context-modifier.service.ts:40–55, 174–199`. No upstream source, no calibration loop. | P2 | M | Debt recommendation accuracy across non-modal deals | A (config externalization) / B (empirical calibration) |
| CE-11 | DISPLAY_ONLY | Exit Strategy IRR sensitivity grid (`SensitivityTab`) computes a 6×5 cap × growth IRR matrix per render; result is not persisted, not picked up by drift detection, and not made available to other modules. | P1 | M | Sensitivity outputs are non-reusable | A |
| CE-12 | NOT_WIRED | Exit Strategy `supplyPressure` / `buyerPressure` RSS components do not read from Traffic Engine supply data or M35 `multifamily_delivery` events. | P1 | M | Exit timing supply blindness | A (wiring) / B (model) |
| CE-13 | UNVERIFIED | `archive_line_items` writer not found in production code paths. If table is empty, LIUS Tier 3 always misses and the cascade falls through. Verify by querying production. | P1 | S | LIUS data integrity | A |
| CE-14 | DISPLAY_ONLY | `ExitCapitalModule` does fetch live M35 events but only renders them in `caseForBullets`, `keyTriggers`, and chart markers. The actual RSS / cap-rate trajectory that drives exit-window decisions ignores these events entirely. | P1 | M | Misleading user experience: events shown but not modeled | A |

### 8.1 Load-bearing facts (per Supplementary Clarification B)

- **`m28_rate_environment` HAS a writer.** `m28-scheduler.service.ts:23`,
  `cron.schedule('0 8 * * *', ingestRateData, ...)`. This is **NOT**
  the dormant-infrastructure pattern that FIX-1 (traffic) addressed.
  The Debt module's macro context is currently fresh.
- **M26 archive submarket cap rate trajectory is spec-only.** No
  table, no service, no draft writer. This IS the dormant-infrastructure
  shape — and worse, because the infrastructure does not even exist
  yet. Per Supplementary Clarification B, the fix shape is known
  (schedule a writer) but **the table itself has to be created first**.
  CE-M26 is the load-bearing finding of this audit.
- **`exitMockData.ts` is NOT imported.** Verified by repo-wide grep.
  Exit Strategy is on a worse failure mode (hardcoded inline arrays,
  CE-04) but is not blocked by mock-data interception per
  Supplementary Clarification A.

---

## 9. Phase 1 Fix Sequence

Fixes ordered by leverage. Each tagged **A** (offline-able against
fixtures) or **B** (corpus-gated — requires `historical_observations`
`realized_cap_rate_change_t*` columns populated per
HISTORICAL_OBSERVATIONS_SPEC §10).

---

### FIX-1 — Make the Exit Cap a single-writer value (resolves CE-01, CE-08; partial CE-02)

**Why first:** Three independent producers of exit cap (LIUS,
trafficToProForma, ExitCapitalModule) with one consumer
(`proforma-assumptions-bridge.ts:319`). Until there is one writer, no
downstream module can be aligned with anything.

**Files (Phase A):**
- `backend/src/services/deterministic/proforma-assumptions-bridge.ts:319`
  — replace the inline `toNumber(a.disposition?.exitCapRate, 0.065)`
  with a call to a new `exit-cap-resolver.service.ts` that returns a
  single resolved value with a `source` tag.
- New `backend/src/services/exit-cap-resolver.service.ts` — implements
  cascade: subject deal exit_cap override → LIUS `exit.exitCapRate`
  (gate behind a feature flag until CE-02 is fixed) → `proforma_assumptions.exit_cap_current` →
  going-in cap + 25bps default.
- `backend/src/services/trafficToProFormaService.ts:700–724` — convert
  to write via the same resolver-mediated path rather than directly
  to `exit_cap_current`.

**Phase B follow-up:** The trajectory itself becomes empirical, see
FIX-4.

**Tag:** A.

---

### FIX-2 — Schedule a writer for the M26 cap rate archive (resolves CE-M26, second half of CE-08)

**Why second:** Without a real cap-rate trajectory data source, every
downstream alignment fix has nothing to align to. This is the
dormant-infrastructure pattern — except the infrastructure has to be
*created*, not just scheduled.

**Files (Phase A):**
- New migration: `cap_rate_archive` table with `(msa_id, submarket_id,
  property_class, vintage_band, observed_at, cap_rate,
  source_label)` columns.
- New `backend/src/services/cap-rate-archive.service.ts` — read API
  matching the LIUS Tier 3 query shape, plus a fingerprinted
  cache.
- `backend/src/services/lius/source-resolver.ts:268` — replace the
  generic `archive_line_items` query with a call to the new service
  when `liuid === 'exit.exitCapRate'`.
- New ingestor `backend/src/scripts/ingest-cap-rates.ts` — initial seed
  from a manual CSV or partner feed; followed by Phase B.
- New Inngest function or extend `m28-scheduler.service.ts` —
  monthly cron, same shape as `ingest-rate-data`.

**Phase B follow-up:** Empirical refit against `historical_observations.realized_cap_rate_change_t*`
per HISTORICAL_OBSERVATIONS_SPEC §10.

**Tag:** A (scaffold + manual seed) / B (continuous calibration).

---

### FIX-3 — Wire LIUS into the deterministic model runner (resolves CE-02)

**Why third:** Once a real exit-cap archive exists (FIX-2) and a single
resolver pattern exists (FIX-1), wire LIUS as the producer.

**Files (Phase A):**
- `backend/src/services/deterministic/deterministic-model-runner.ts`
  — call `runLIUSForLine(dealId, 'exit.exitCapRate')` at the start of
  the disposition phase (around line 1375), pass the
  `yearProjections` array into the exit cap calculation rather than a
  scalar.
- `backend/src/services/lius/engine.ts` — already exposes
  `runLIUSForLine`; add caching by dealId × liuid.
- Update the resolver from FIX-1 to call LIUS as the highest-priority
  source.
- Surface `evidence.trajectory.yearProjections` to the frontend so
  Exit Strategy can render the LIUS exit cap trajectory rather than its
  hardcoded `cr[]` array.

**Tag:** A.

---

### FIX-4 — Empirical exit cap trajectory replacing the hardcoded -0.0025 (resolves CE-01 fully)

**Why fourth:** Now there is real data flowing through LIUS, the
trajectory itself can be derived rather than hardcoded.

**Files (Phase B):**
- `backend/src/services/lius/trajectory-engine.ts:84` —
  `exit_cap_trajectory` value computed at runtime from
  `historical_observations.realized_cap_rate_change_t12` /
  `realized_cap_rate_change_t24` for the subject's submarket × class ×
  vintage bucket, with Bayesian fallback to platform when sample size
  is insufficient. The mechanism mirrors M07's Subject-First
  calibration rule.

**Tag:** B (corpus-gated).

---

### FIX-5 — Subscribe Debt and Exit Timing to `M14_macro` events (resolves CE-03)

**Why fifth:** Now that the data plumbing exists, wire event impact.
Causal Discipline Addendum §3.1 explicitly designates `rate_move` and
`recession_indicator` as M14_macro events, and the Debt + Exit modules
are the natural consumers.

**Files (Phase A):**
- `backend/src/services/debt-advisor/rate-environment.service.ts` —
  query `key_events WHERE primary_channel = 'M14_macro' AND status NOT
  IN ('cancelled','reversed')` and `event_forecasts`. Use to bias the
  `forward12moBps` and the `pricingWindowScore`.
- `backend/src/services/cap-rate-archive.service.ts` (new from FIX-2)
  — similarly query M14_macro events for the resolved msa_id.
- Kafka subscription registration for `event.classified` filtered to
  primary_channel `M14_macro` (must be added to the wiring policy
  reference table per Causal Discipline §3.4).
- Cache invalidation on `event.classified` arrival.

**Phase B follow-up:** The event-impact magnitudes themselves (how much
a hurricane event widens cap spreads, how much a Fed surprise rate
move shifts the forward curve) — those are empirical and require the
M37 analog library / M38 reliability backtests.

**Tag:** A (subscription) / B (magnitudes).

---

### FIX-6 — Replace ExitStrategyTabs / ExitCapitalModule hardcoded arrays with live trajectory feeds (resolves CE-04, CE-07, CE-12, CE-14)

**Why sixth:** Now the backend produces real cap-rate, rate-env, and
supply trajectories, the frontend can stop hardcoding them.

**Files (Phase A):**
- New backend endpoint `GET /api/v1/deals/:dealId/exit-trajectory` —
  returns LIUS exit cap year projections + Debt rate trajectory + M07
  / M35 supply trajectory + the canonical rateEnvironment classification.
- `frontend/src/components/deal/sections/ExitStrategyTabs.tsx:265–268`
  — replace `rg`, `cr`, `sp`, `va` arrays with reads from the new
  endpoint's payload.
- `frontend/src/components/deal/sections/ExitCapitalModule.tsx:108–158`
  — replace `RENT_GROWTH_21Y`, `CAP_RATES_21Y`, `SUPPLY_21Y`, `T10_21Y`
  with the endpoint's payload (extended to 21 years with the historical
  back-half coming from `historical_observations`).
- `frontend/src/components/deal/sections/ExitDrivesCapital.tsx:28–32`
  — same.

**Tag:** A (wiring) — historical back-half is corpus-gated B.

---

### FIX-7 — Pro Forma write-back for Exit Strategy sensitivity (resolves CE-11)

**Files (Phase A):**
- Add `frontend/src/components/deal/sections/ExitStrategyTabs.tsx`
  `SensitivityTab` write path — on "save scenario" the user can pin a
  cap × growth grid cell as the recommended underwriting case; persist
  to `proforma_assumptions.exit_cap_current` via
  `updatePlatformLayer({ exitCap })` with `source: 'exit_strategy_tab'`.
- Same pattern for the `MonitorTab` "Sell Now" / "Optimal" / "Hold"
  scenario selector.

**Tag:** A.

---

### FIX-8 — Auto-apply Debt Advisor recommendation when divergence is small (resolves CE-09)

**Files (Phase A):**
- `backend/src/services/debt-advisor/debt-plan-formulator.service.ts` —
  when `divergence.hasDivergence === false`, automatically call
  `applyDebtAdvisorPlatformDefault` for the seven base fields; require
  explicit Accept only when divergence > threshold or user-defined
  rate-type changes.

**Tag:** A.

---

### FIX-9 — Replace Monitor tab hardcoded data with live drift detection (resolves CE-05)

**Files (Phase A):**
- `frontend/src/components/deal/sections/ExitStrategyTabs.tsx`
  `useMonitoringData()` — replace hardcoded mock with a real fetch
  from a new backend endpoint that joins `deal_monthly_actuals` (drift
  signals), `proforma_assumptions` (plan vs actual), and live
  M35 events (alerts feed).

**Tag:** A.

---

### FIX-10 — Externalize debt-context-modifier magnitudes (resolves CE-10)

**Files (Phase A):**
- Move size tiers, geography exclusions, asset-age haircut magnitudes,
  sponsor-experience thresholds out of code into `strategy-debt-mapping.json`
  or a new `debt-context-modifier.config.json` so they can be tuned
  without a code release.

**Phase B follow-up:** Empirical calibration from realized lender
quotes (when a quote-tracking corpus exists).

**Tag:** A (externalization) / B (empirical calibration).

---

### FIX-11 — Add telemetry for SOFR forward-curve fallback path (resolves CE-06)

**Files (Phase A):**
- `backend/src/services/debt-advisor/rate-environment.service.ts:84`
  — emit a `logger.warn` (or a counter metric) when
  `sofrAvg30 === 0` and the heuristic path is taken, so operators
  know which deals are getting the heuristic vs the real average curve.

**Tag:** A.

---

### FIX-12 — Verify `archive_line_items` writer (resolves CE-13)

**Files (Phase A):**
- Audit the production database for non-zero rows in
  `archive_line_items`. If empty, either populate via a backfill script
  from `archive_deals` or document the table as deprecated. Either way,
  LIUS Tier 3 needs a real data source.

**Tag:** A.

---

*End of CAPITAL_EXIT_SUBSYSTEM_AUDIT.md*
