# T4d Flywheel Coefficients Audit Report
**Date:** 2026-07-20
**Scope:** DATA SOURCE UNIFICATION AUDIT (T4+T5 phase) — Flywheel coefficient source-of-truth, namespace unification, and feedback-loop wiring
**Rule:** S1-01 — exact file:line citations
**HEAD:** 34f4405bf


## EXECUTIVE SUMMARY
The flywheel coefficient layer is **fragmented across three independent namespaces**, served by **two disconnected backend resolution paths**, with **zero live feedback wiring** from actual deal outcomes back into coefficient calibration. The DealFlywheelDashboard renders entirely static mock data for its platform-intelligence feed tab. Frontend and backend coefficient vocabularies do not map to each other. The revenue engine CONFIG constants remain hardcoded with no evidence of flywheel-driven updates.

## FINDING 1 — FLYWHEEL_FEEDS IS ENTIRELY STATIC MOCK DATA
**File:** frontend/src/pages/deal/DealFlywheelDashboard.tsx:78-139
**Classification:** GAP
**Severity:** P1

The FLYWHEEL_FEEDS array (lines 78-139) contains six hardcoded feed objects with fabricated metrics:
    +8.4% avg over-prediction in summer, -7.1% under-prediction in snowbird season
    Actual rent growth: +10.3% over 11 months vs underwritten +6.8%
    JEDI Score at underwriting: 74. Predicted 18-month IRR band: 14-19%
    Actual trajectory IRR: 22.4% (outperforming)
    M26 predicted post-sale assessed value: $31.8M-$33.2M

None of these values are computed from backend data. The PlatformFeedTab component (lines 557-633) renders this static array with no API calls. The flywheel dashboard fetches real data only for the Performance tab (projected-vs-actual, traffic, summary endpoints) and the Traffic Validation tab. The Platform Feed tab — the core flywheel visualization — is a static demo.

## FINDING 2 — THREE INDEPENDENT COEFFICIENT NAMESPACES WITH NO UNIFICATION
**Classification:** GAP
**Severity:** P0

The platform maintains three mutually incompatible coefficient vocabularies:

### Namespace A: M07 Backend (traffic-calibration.types.ts)
    visibility_capture_rate
    apartment_seeker_pct
    stop_probability
    walkin_to_tour
    tour_to_app
    app_to_signed

### Namespace B: Leasing Traffic Frontend (TrafficCoefficientsTab.tsx)
    visit_to_tour_ratio (baseline 0.50)
    closing_ratio (baseline 0.207)
    tour_conversion (legacy, baseline 0.45)
    avg_days_to_lease (baseline 7)
    seasonal_factor (baseline 1.0)
    dow_factor (baseline 1.0)
    renewal_rate (baseline 0.55)

### Namespace C: Revenue Engine (revenue-engine.service.ts)
    rentRunwayFullBps: 250
    renewalCapFraction: 0.55
    pushAboveMarketCeiling: 0.06
    vacancyElasticity: 0.9
    controllableFractionDefault: 0.6

**Impact:** There is no canonical coefficient registry. A change to M07 baseline constants (trafficCalibrationJob.ts:29-36) does not propagate to TrafficCoefficientsTab.tsx baseline defaults (line 37-48) or to the revenue engine CONFIG (line 149-189). The frontend displays visit_to_tour_ratio = 0.50 while the M07 backend uses walkin_to_tour = 0.40 — same semantic concept, different name, different value.

## FINDING 3 — TWO DISCONNECTED BACKEND COEFFICIENT RESOLUTION PATHS
**Classification:** GAP
**Severity:** P1

Path A: M07 CoefficientResolverService
    Route: GET /api/v1/calibration/coefficients/:dealId (m07-calibration.routes.ts:410)
    Source table: traffic_calibration_factors
    Hierarchy: SUBJECT -> PLATFORM -> BASELINE (DEAL excluded)

Path B: Leasing Traffic Calibration
    Route: GET /api/v1/leasing-traffic/weekly-report/:dealId/calibration (leasing-traffic.routes.ts:846)
    Source table: traffic_submarket_calibration
    Service: trafficCalibrationService.getCalibrationStats() (traffic-calibration.service.ts:174)

These two paths query different tables, use different coefficient names, compute different confidence bands, and return different response shapes. The TrafficCoefficientsTab.tsx consumes Path B. The M07 engine consumes Path A. There is no bridge, arbiter, or reconciliation between them.

## FINDING 4 — DEAL LAYER INTENTIONALLY EXCLUDED FROM M07 RESOLUTION
**File:** backend/src/services/coefficient-resolver.service.ts:215
**Classification:** GAP
**Severity:** P1

The LayeredValue type (traffic-calibration.types.ts:26-37) defines a four-layer hierarchy: subject -> deal -> platform -> baseline. However, the resolver hardcodes deal: null at line 215 with the comment DEAL proxy excluded from M07 calibration path. The M07 spec comment at lines 59-61 explains this is intentional: The DEAL proxy layer (single-snapshot rent roll proxy) is intentionally excluded from M07 resolution — subject-history blending supersedes the pre-M07 binary deal-first approach.

While the architectural rationale is documented, the result is that a deal with uploaded rent rolls cannot contribute its own derived coefficients to the resolution. The LayeredValue interface promises four layers but the resolver only populates three. This is a contract-vs-implementation gap.

## FINDING 5 — STALE PRE-P0 DEFAULT PERSISTS IN CALIBRATION STATS
**File:** backend/src/services/traffic-calibration.service.ts:212-216
**Classification:** FINDING
**Severity:** P0

The getCalibrationStats() method returns a comparisons object that includes a default value for Tour Conversion:

    comparisons[Tour Conversion] = { calibrated: <value>, default: 0.99 }

The value 0.99 is the PRE-P0 default that was explicitly replaced because it erased the visit-to-tour stage and caused ~2x over-projection. The P0 fix (multifamilyTrafficService.ts:28) changed the default to 0.50 (visit_to_tour_ratio). The TrafficCoefficientsTab.tsx displays this 0.99 default to operators, showing a calibrated vs default comparison where the default is factually wrong. This is a live data-integrity defect in the calibration display pipeline.

## FINDING 6 — REVENUE ENGINE CONFIG IS FULLY HARDCODED WITH NO FLYWHEEL FEEDBACK
**File:** backend/src/services/revenue/revenue-engine.service.ts:149-189
**Classification:** GAP
**Severity:** P2

The CONFIG object contains hardcoded constants:

    w: { rentRunway: 0.30, trafficVelocity: 0.28, inMigration: 0.14, pipeline: 0.18, concession: 0.10 }
    rentRunwayFullBps: 250
    renewalCapFraction: 0.55
    pushAboveMarketCeiling: 0.06
    vacancyElasticity: 0.9
    controllableFractionDefault: 0.6

The file header comment (lines 25-26) states: Calibration params (CONFIG) default to sane values but should be learned from the archive flywheel + owned actuals, not hardcoded long-term.

There is no evidence in the codebase of any mechanism that updates these CONFIG values from actual deal outcomes. The resolveConfig() function (lines 203-213) accepts ConfigOverrides, but the beat-plan route comment (lines 145-148) says overrides come from revenue_engine_calibration table via revenue-calibration.service.ts. That service file does not exist in the repo at HEAD 34f4405bf. The CONFIG remains permanently static.

## PASS ITEMS
**PASS 1 — M07 calibration routes are wired and functional**
    File: backend/src/api/rest/m07-calibration.routes.ts:410
    GET /api/v1/calibration/coefficients/:dealId resolves coefficients via CoefficientResolverService
    Authorization via assertDealOwnership is enforced

**PASS 2 — TrafficCalibrationJob publishes Kafka events**
    File: backend/src/jobs/trafficCalibrationJob.ts:729-761
    publishCalibrationEvent() emits traffic.calibration.updated with job metadata
    Non-blocking: publish failure does not abort the calibration transaction

**PASS 3 — Subject history S1/S2 pipeline is operational**
    File: backend/src/api/rest/m07-calibration.routes.ts:133-284
    Rent roll upload triggers parse -> derive -> S1 aggregation -> S2 diff extraction
    S1 occupancy sync to properties.current_occupancy is implemented (lines 169-205)

## SUMMARY TABLE
| ID | File:Line | Finding | Classification | Severity |
|----|-----------|---------|----------------|----------|
| F1 | frontend/src/pages/deal/DealFlywheelDashboard.tsx:78-139 | FLYWHEEL_FEEDS is entirely static mock data | GAP | P1 |
| F2 | Multiple files — see Finding 2 | Three independent coefficient namespaces with no unification | GAP | P0 |
| F3 | m07-calibration.routes.ts:410 + leasing-traffic.routes.ts:846 | Two disconnected backend coefficient resolution paths | GAP | P1 |
| F4 | backend/src/services/coefficient-resolver.service.ts:215 | DEAL layer intentionally excluded from M07 resolution | GAP | P1 |
| F5 | backend/src/services/traffic-calibration.service.ts:212-216 | Stale pre-P0 default (0.99) persists in calibration stats | FINDING | P0 |
| F6 | backend/src/services/revenue/revenue-engine.service.ts:149-189 | Revenue engine CONFIG fully hardcoded, no flywheel feedback | GAP | P2 |
| P1 | backend/src/api/rest/m07-calibration.routes.ts:410 | M07 calibration routes wired and functional | PASS | — |
| P2 | backend/src/jobs/trafficCalibrationJob.ts:729-761 | Kafka event publishing on calibration complete | PASS | — |
| P3 | backend/src/api/rest/m07-calibration.routes.ts:133-284 | S1/S2 subject history pipeline operational | PASS | — |

## CROSS-REFERENCES
- TRAFFIC_ENGINE_AUDIT.md T4 (Conversion Gap) documents 5+ fragmented conversion services
- DATA_ARCHITECTURE_AND_FLYWHEEL.md Section 6 describes the intended learning flywheel
- ABSORPTION_ENGINE_PHASE1_DESIGN.md R4 mandates one conversion registry (sole proprietor)
- TICKET_RENT_GROWTH_ALLOWLIST_GAP.md (live evidence) shows related data-source gaps

## AUDIT VERDICT
**Status:** 3 PASS / 6 FINDINGS (2 P0, 3 P1, 1 P2)

The flywheel coefficient layer fails DATA SOURCE UNIFICATION. Coefficients live in three namespaces with no canonical registry. Two backend resolution paths operate independently. The flywheel dashboard renders static fiction for its platform-intelligence tab. The revenue engine calibration parameters are hardcoded with no feedback mechanism. The pre-P0 Tour Conversion default (0.99) is still served to operators as the platform baseline.

**Required unification actions:**
1. Canonical coefficient registry (one vocabulary, one set of baselines)
2. Single resolution backend (merge Path A and Path B into one service)
3. Live flywheel data feed (replace FLYWHEEL_FEEDS static array with backend-driven data)
4. Fix stale default 0.99 -> 0.50 in traffic-calibration.service.ts
5. Revenue engine CONFIG override wiring from actuals (revenue-calibration.service.ts or equivalent)

---
**End of Report**
