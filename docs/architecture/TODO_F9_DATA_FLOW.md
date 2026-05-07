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
**Blocking:** "Peer Benchmark" sub-panel in `M07IntelPanel.tsx` (LEASING sub-tab)
**Spec reference:** `docs/architecture/traffic_engine_v2_leasing_prediction.md`

**Required backend change:**
Surface the following peer benchmark fields on the `trafficProjection` response:
- `nPeerProperties` — number of peer properties in calibration sample
- `submarketPercentile` — subject property's percentile position within peer set (vacancy, rent, lease velocity)
- Peer distribution: vacancy %, effective rent, lease velocity at P25/P50/P75

**Frontend placeholder:** The "Peer Benchmark" collapsible in `M07IntelPanel.tsx` currently renders
"pending M07 backend wiring" notes for all three sub-fields. Once available, swap for rendered rows.

**Priority:** Defer until M07 backend has bandwidth. Frontend placeholder is in place.

---

## M07 — Pre-leased % and reno metrics for LEASING Intel Panel (Lease-Up / Reno modes)

**Requested by:** Task #630 (Add M07 intel panel to Leasing tab)
**Blocking:** Lease-Up KPI chip "PRE-LEASED %" and Value-Add/Reno chip "RENO METRICS" in `M07IntelPanel.tsx`

**Required backend change:**
- `leasingSignals.preLeasedPct` — current pre-leased percentage (Lease-Up mode only)
- `leasingSignals.peakDownUnits` — peak units offline during renovation (VALUE_ADD/REDEVELOPMENT)
- `leasingSignals.postRenoAbsorptionLagWks` — weeks of absorption lag post-renovation

**Frontend placeholder:** Dashed-border placeholder chips are rendered in `M07IntelPanel.tsx`
for these fields. Swap to `KpiChip` once on response.

**Priority:** Defer until M07 backend has bandwidth. Frontend placeholders are in place.
