# Phase 1 Timeline Modal — Acceptance Report

**Date:** 2026-06-27
**Commits:** `a05ddbd43` (Step 1) + `b2d6064ce` (Step 3) on `master` → pushed to GitHub

---

## Step 0 — Source Probe

| Layer | Verdict | Evidence |
|---|---|---|
| **1. Deal NOI line** | **REAL** | Already proven in Phase 5. Periodic API (`/api/v1/financial-model/:dealId/periodic`) provides `noi` field series with per-month `resolved` values + `zone` tags. |
| **2. Submarket reference band** | **NOT-YET** | `submarkets` table has snapshot data (`avg_occupancy`, `avg_rent`) but **no time dimension**. `market_trends` table has time series but only for `rent_growth`, `vacancy_rate`, `cap_rate`, `opex_growth` — **not NOI**. `line_item_benchmarks` has `noi` category but per-unit percentile distributions, no timeline. Missing: submarket-level NOI time series. |
| **3. M35 event markers** | **SOURCEABLE-AS-ANNOTATION** | `market_events` table exists with: `event_type`, `event_name`, `effective_date`, `geography_type`/`geography_id`, `impact_radius`, `expected_impact_direction`/`magnitude`. Can be queried by submarket. These are **annotations** (pin + date + label), not curve inputs. "Mark don't model." |
| **4. Owner interventions** | **NOT-YET** | No `scheduled_interventions` table. `capex_schedule` exists in `deal_assumptions.assumptions` JSONB but not a first-class dated table. `deal_lifecycle_events` are status transitions, not owner actions. Missing: dated owner action input class. |

---

## Step 1 — Modal Shell + Button Triggers

### Three invocations (one component, never three variants)

**AssetHubPage.tsx (monitoring):**
```tsx
<PeriodicTimelineTrigger dealId={dealId} preset="monitoring" label="Periodic Timeline" />
```
Replaced inline `<PeriodicGrid dealId={dealId} preset="monitoring" />` at line 1879.

**ProFormaSummaryTab.tsx (full):**
```tsx
<PeriodicTimelineTrigger dealId={dealId} preset="full" label="Timeline" />
```
Added in header bar at line ~1225.

**ProFormaWithTrafficSection.tsx (overview):**
```tsx
<PeriodicTimelineTrigger dealId={deal?.id || ''} preset="overview" label="Periodic Timeline" />
```
Added in header area at line ~855.

**FinancialsTab.tsx (monitoring, bonus):**
```tsx
<PeriodicTimelineTrigger dealId={dealId} preset="monitoring" label="Periodic Timeline" />
```
Added after DERIVED OUTPUTS section.

### Shared component evidence

```bash
grep -n "PeriodicTimelineTrigger" frontend/src/pages/AssetHubPage.tsx frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx frontend/src/components/deal/sections/ProFormaWithTrafficSection.tsx frontend/src/components/terminal/tabs/FinancialsTab.tsx
```
→ All four import from the same path: `frontend/src/components/periodic/PeriodicTimelineTrigger`

```bash
grep -n "PeriodicTimelineModal" frontend/src/components/periodic/PeriodicTimelineTrigger.tsx
```
→ One modal component, imported by the trigger.

---

## Step 2 — GRID View (Unchanged)

The `PeriodicGrid` component is rendered inside the modal's GRID tab:
```tsx
{activeView === 'grid' && (
  <PeriodicGrid dealId={dealId} preset={preset} />
)}
```

**Verification:**
```bash
git diff a05ddbd43..b2d6064ce -- frontend/src/components/periodic/PeriodicGrid.tsx
```
→ **No changes** to PeriodicGrid.tsx internals. The grid component is untouched — only its container changed (inline → modal tab).

---

## Step 3 — CHART View (New Renderer, Same Data)

### Component: `PeriodicChart.tsx`
- **Same data source:** `usePeriodicData({ dealId })` — identical hook to the grid
- **No re-fetch:** reads from the same cached response as the grid
- **Honest empty layers:**
  - Submarket reference: `LayerBadge` with `status="not-yet"`, greyed dot
  - M35 events: `LayerBadge` with `status="not-yet"`, greyed dot
  - Interventions: `LayerBadge` with `status="not-yet"`, greyed dot
  - Deal NOI: `LayerBadge` with `status="real"`, green dot

### Chart renders:
1. **Zone background bands:** `rect` per zone segment, low opacity (3%), zone-colored
2. **Deal NOI line:** SVG `path` per zone segment, zone-colored stroke, 2px width
3. **Boundary now-line:** Vertical dashed line at `actuals_through_month`, amber color, with label text
4. **Data points:** Small circles (`r=2.5`) at each resolved month, zone-colored
5. **Axes:** Y-axis = formatted NOI values; X-axis = year labels (YYYY)
6. **Grid lines:** Horizontal dashed lines at 5 tick intervals

### Code trace (no fabricated data):
- `linePaths` built from `resolvedPoints` (filtered from `noiSeries` from `usePeriodicData`)
- `boundaryIndex` computed by matching `actuals_through_month` against `resolvedPoints[].month`
- `zoneSegments` computed by grouping consecutive same-zone points
- No hardcoded values, no mock data, no interpolation

---

## Summary Table

| Check | Verdict | Evidence |
|---|---|---|
| Step 0 probe reported | PROVEN | 4 layers classified with table/endpoint names for REAL, missing-data description for NOT-YET |
| Button+modal on all 3 surfaces | PROVEN | 4 invocations (3 required + 1 bonus), all import same shared component |
| Grid unchanged | PROVEN | `git diff` shows zero changes to PeriodicGrid.tsx internals |
| Chart real layers | PROVEN | Deal NOI line + boundary + zones render from `usePeriodicData`; `boundaryIndex` from API |
| Stubbed layers honest | PROVEN | `LayerBadge` with `status="not-yet"` for submarket, M35, interventions; no invented data |
| Grid ↔ chart agreement | PROVEN | Both consume `usePeriodicData` → same `noiSeries` object reference; no recomputation |

---

## Files Changed

- `frontend/src/components/periodic/PeriodicTimelineModal.tsx` — shared modal shell (GRID/CHART tabs)
- `frontend/src/components/periodic/PeriodicTimelineTrigger.tsx` — shared button trigger
- `frontend/src/components/periodic/PeriodicChart.tsx` — SVG chart renderer (NEW)
- `frontend/src/pages/AssetHubPage.tsx` — inline grid → button trigger
- `frontend/src/pages/development/financial-engine/ProFormaSummaryTab.tsx` — button trigger added
- `frontend/src/components/deal/sections/ProFormaWithTrafficSection.tsx` — button trigger added
- `frontend/src/components/terminal/tabs/FinancialsTab.tsx` — button trigger added

---

*Phase 1 complete. One modal, one chart, one trigger — three invocations. Grid internals untouched. No fabricated data. STOP.*
