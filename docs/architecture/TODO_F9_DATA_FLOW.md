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
