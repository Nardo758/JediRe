# TICKET — LeasingTrafficService: 0.98 Inquiry→Tour Near-1.0 Conversion (P2)

## Finding
`backend/src/services/leasingTrafficService.ts:91` uses `toursConversionRate = 0.98` — a near-1.0 conversion ratio that erases the inquiry→tour drop-off stage. Same *species* as the P0 bug (visit→tour stage erased by near-1.0 ratio), different *stage* (inquiry→tour).

## Why It Matters
This is **live code** consumed by two API routes:
- `GET /api/leasing-traffic/predict/:propertyId` — `predictCurrentWeek()` (line 19, `leasing-traffic.routes.ts`)
- `GET /api/leasing-traffic/forecast/:propertyId` — `forecast()` (line 53, `leasing-traffic.routes.ts`)

And by the P2 pipeline: `p2-service-adapters.ts:24` lazy-loads `leasingTrafficService` for M07 Traffic Intelligence wiring.

The 0.98 rate means "98% of inquiries schedule a tour" — industry reality is 40–60% (same range as visit→tour). The result is inflated tour counts, which cascade to inflated lease projections wherever this service's output feeds downstream.

## Root Cause
`leasingTrafficService.ts` is a **placeholder implementation** (explicitly commented as such at line 61: "PLACEHOLDER IMPLEMENTATION: Uses baseline multifamily metrics until ML model is trained"). The 0.98 was chosen as a "most inquiries schedule a tour" heuristic without calibration data. The file has not been touched since the placeholder was written — it predates the P0 fix and was never updated.

## Correct Fix Path: R4 Conversion Registry (Do NOT Patch Standalone)
The R4 conversion registry (from `TRAFFIC_PHASE1_RULINGS_R1_R5.md`) is designed to be the **sole proprietor** of all conversion coefficients:
- `visit_to_tour_ratio` (inherited from P0 ticket)
- `inquiry_to_tour_ratio` (this ticket)
- `closing_ratio` (tours→leases)

The registry owns calibration, override, and per-source stage-labeling. A one-off patch to `leasingTrafficService.ts` would:
1. Duplicate the registry's responsibility
2. Create a second source of truth for the same coefficient
3. Require migration when the registry lands

## Ticket Routing
- **Blocks on:** R4 conversion registry implementation (Wave 3, Absorption Phase 1)
- **Absorbed by:** Registry's coefficient migration inventory
- **Registry's job:** Replace `leasingTrafficService.ts`'s hardcoded 0.98 with a registry-resolved `inquiry_to_tour_ratio` (platform default ~0.50, overridable via calibration)

## Interim Mitigation (If Needed Before Registry)
If any consumer needs corrected numbers before Wave 3, the `weekly-report-parser.service.ts` path already has calibrated `avgTourConversion` — route consumers there instead of `leasingTrafficService.ts`.

## Evidence
```typescript
// backend/src/services/leasingTrafficService.ts:88-96
const baseInquiryRate = 0.038;
const weeklyInquiries = Math.round(units * baseInquiryRate);
const toursConversionRate = 0.98;  // <-- the near-1.0 bug
const weeklyTours = Math.round(weeklyInquiries * toursConversionRate);
```

## Live Consumers
| Consumer | File:Line | What It Reads |
|---|---|---|
| `/predict` route | `leasing-traffic.routes.ts:19` | `predictCurrentWeek()` → `weekly_tours`, `net_leases` |
| `/forecast` route | `leasing-traffic.routes.ts:53` | `forecast()` → `weekly_tours`, `net_leases` |
| P2 M07 wiring | `p2-service-adapters.ts:24,186` | `leasingService.predictCurrentWeek()` → `expected_leases` |

## Acceptance Criteria (Registry Phase)
- [ ] `inquiry_to_tour_ratio` is a first-class registry coefficient
- [ ] `leasingTrafficService.ts` reads from registry, not hardcoded 0.98
- [ ] Platform default ~0.50 (industry 40–60%), overridable via calibration
- [ ] Frontend `TrafficCoefficientsTab.tsx` displays `inquiry_to_tour_ratio` alongside `visit_to_tour_ratio`
- [ ] Live proof: Bishop via `leasingTrafficService` path shows ~50% reduction in tour count

## Cross-Links
- Parent: P0 ticket (visit→tour ratio, same species, already fixed in `multifamilyTrafficService.ts`)
- Blocks on: R4 Conversion Registry (Wave 3)
- Related: `TICKET_RENT_GROWTH_ALLOWLIST_GAP.md` (D3 overlay allowlist — same "hardcoded constant vs. overridable LayeredValue" class)

## Status
**P2 — Deferred to R4 Registry. No standalone patch.**

Filed: 2026-07-20
P0 Status: CLOSED-INTERIM (over-projection dead, override wiring deferred to registry)
