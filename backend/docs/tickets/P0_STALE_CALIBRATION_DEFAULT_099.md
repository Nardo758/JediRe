# P0 TICKET — Stale Calibration Default: 0.99 Still Shown as "Platform Default"

**Severity:** P0 — live data-integrity defect, operator-facing UI
**Discovered:** 2026-07-20, T4d agent audit
**File:** `backend/src/services/traffic-calibration.service.ts:212`

## The Bug

The P0 fix (commit `90d494584`, 2026-07-13) changed `multifamilyTrafficService.ts` to use `visit_to_tour_ratio: 0.50` (from 0.99). However, `traffic-calibration.service.ts:212` still reports `0.99` as the "platform default" in calibration comparison UI.

Operators using the Traffic Coefficients tab see:
- **Platform default:** 0.99 (WRONG — this is the pre-P0 buggy value)
- **This deal:** whatever was calibrated

The UI displays a divergence (`0.99 platform` vs `0.50 deal`) that is actually a version mismatch, not a real coefficient gap.

## Root Cause

The P0 fix touched `multifamilyTrafficService.ts` and `weekly-report-parser.service.ts` but did not reach `traffic-calibration.service.ts`, which has its own hardcoded fallback. This is the **third independent hardcoded copy** of `visit_to_tour_ratio`:

| File | Value | Role |
|---|---|---|
| `multifamilyTrafficService.ts:28` | 0.50 | Core prediction engine |
| `weekly-report-parser.service.ts:364` | 0.50 (from calibration) | Report parser |
| `traffic-calibration.service.ts:212` | **0.99 (stale)** | Calibration stats display |
| `leasingTrafficService.ts:91` | 0.98 (inquiry→tour placeholder) | Legacy placeholder |

The proposed fix comment — "must match BASELINE_DATA in multifamilyTrafficService" — is a manual-sync instruction, i.e., the fragility R4's conversion registry exists to kill. Ship the interim change, but route to the registry inventory (now four items: two P0-fix sites, this one, V6's 0.98).

## Severity Check — One Line

```bash
cd ~/workspace/backend && grep -n 'PLATFORM_DEFAULT_VISIT_TO_TOUR\|visit_to_tour_ratio\|tour_conversion' src/services/traffic-calibration.service.ts | head -10
```

**If the 0.99 is display-only** (used in comparison UI, not in any computation): downgrade to **P1**.  
**If it feeds any calibration computation** (e.g., used as fallback when calibration is missing): **P0 stands**.

## Fix

Change the hardcoded default in `traffic-calibration.service.ts:212` from `0.99` to `0.50`:

```typescript
// P0 FIX: visit_to_tour_ratio platform default is 0.50 (was 0.99, erasing visit→tour stage).
// See commit 90d494584. This must match BASELINE_DATA.visit_to_tour_ratio in
// multifamilyTrafficService.ts — interim manual sync; R4 registry will kill this class.
const PLATFORM_DEFAULT_VISIT_TO_TOUR = 0.50;
```

The P0 fix touched `multifamilyTrafficService.ts` and `weekly-report-parser.service.ts` but did not reach `traffic-calibration.service.ts`, which has its own hardcoded fallback for the "platform default" displayed in calibration stats.

## Fix

Change the hardcoded default in `traffic-calibration.service.ts:212` from `0.99` to `0.50`, with a comment referencing the P0 fix commit:

```typescript
// P0 FIX: visit_to_tour_ratio platform default is 0.50 (was 0.99, erasing visit→tour stage).
// See commit 90d494584. This must match BASELINE_DATA.visit_to_tour_ratio in
// multifamilyTrafficService.ts.
const PLATFORM_DEFAULT_VISIT_TO_TOUR = 0.50;
```

## Verification

1. Re-run `d3-integration-proofs.ts` — no change expected (proofs don't touch calibration UI).
2. Manual: open Traffic Coefficients tab for Bishop — "Platform" column for "Visit → Tour" should show `50.0%`, not `99.0%`.
3. Re-run `traffic-calibration.service.ts` unit tests if they exist.

## Cross-references

- T4d report: `backend/docs/audits/T4D_FLYWHEEL_COEFFICIENTS_AUDIT_2026-07-20.md`
- T6 synthesis: `backend/docs/audits/T6_DATA_SOURCE_GAP_SYNTHESIS_2026-07-20.md` (P0 item 2)
- P0 fix commit: `90d494584`
