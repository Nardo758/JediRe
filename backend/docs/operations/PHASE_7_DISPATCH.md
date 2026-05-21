# Phase 7 Dispatch — Cohort Rollup

**Depends on:** Phases 0-3 (all data in R2, property_descriptions, historical_observations live)
**Reference:** PER_PROPERTY_VISIBILITY_SPEC §7
**Goal:** Multi-dimensional aggregate views across the portfolio — "Show me all Garden Class B properties in Atlanta"

---

## Overview

Two components:

### Part A — Cohort Identifier (Backend)

Map each property into a cohort record. A cohort is a combination of dimensions:

```typescript
interface CohortKey {
  productType: string;       // "Garden" | "Mid-Rise" | "High-Rise" | "Townhouse"
  assetClass: string;        // "Class A" | "Class B" | "Class C"
  market: string;            // MSA name — "Atlanta-Sandy Springs-Roswell, GA"
  vintage: string;           // "Pre-1980" | "1980-2000" | "2000-2015" | "Post-2015"
  sizeRange: string;         // "Small (<100)" | "Medium (100-300)" | "Large (300+)" / "Missing"
}
```

Each property gets a `cohort_key` built from:
1. **productType** — from `property_descriptions.building_type` (extracted from OM, or classified by unit count/stories)
2. **assetClass** — from `property_descriptions.class_type` (OM or CoStar)
3. **market** — from `property_descriptions.msa_name` (already enriched from earlier seeding)
4. **vintage** — from `property_descriptions.year_built` (already enriched from OM parsing)
5. **sizeRange** — from `historical_observations` max of `property_unit_count`

Store in a new table:

```sql
CREATE TABLE IF NOT EXISTS cohort_membership (
  parcel_id TEXT NOT NULL,
  cohort_id UUID NOT NULL REFERENCES cohorts(id),
  PRIMARY KEY (parcel_id, cohort_id)
);

CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT,
  asset_class TEXT,
  market TEXT,
  vintage TEXT,
  size_range TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  aggregated_metrics JSONB,  -- { avg_occupancy, avg_rent, avg_concession, ... }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_type, asset_class, market, vintage, size_range)
);
```

### Part B — Cohort Query API

```
GET /api/v1/cohorts/query
  ?product_type=Garden
  &asset_class=Class+B
  &market=Atlanta
  (all filters optional — omitted = wildcard)

Response:
{
  cohort: {
    id: "uuid",
    productType: "Garden",
    assetClass: "Class B",
    market: "Atlanta-Sandy Springs-Roswell, GA",
    vintage: "2000-2015",
    sizeRange: "Medium (100-300)",
    memberCount: 12,
    aggregatedMetrics: {
      avgOccupancy: 0.93,
      occupancyStdDev: 0.04,
      avgRent: 1542,
      rentStdDev: 128,
      avgConcession: 245,
      concessionStdDev: 67,
      avgUnitCount: 218,
      yearBuiltRange: [2002, 2014],
      medianYearBuilt: 2008
    }
  },
  members: [
    {
      parcelId: "Mirabella Lakes",
      propertyDescription: { name: "Mirabella Lakes", ... },
      currentMetrics: { occupancy: 0.94, avgRent: 1580 }
    }
  ]
}
```

### Part C — Cohort Compare UI

Page at `/cohorts/query`:

- Multi-select filters for each dimension (product type, class, market, vintage, size)
- "Run Query" button → fetches matching cohort + member list
- Results:
  - **Cohort stats bar** at top: member count, avg metrics with confidence (std dev)
  - **Member table** below: sorted by parcel_id, each row links to the property archive page
  - **Visual sparkline** next to metrics: each member's occupancy trend vs cohort average
  - **Export CSV**

### Part D — Cohort Backfill Script

```
POST /api/v1/cohorts/backfill

Rebuilds all cohorts from scratch:
1. Drop + recreate `cohort_membership` and `cohorts` tables
2. For each parcel_id, compute cohort_key from property_descriptions + historical_observations
3. Group by cohort_key → compute aggregated_metrics
4. Insert into cohorts + cohort_membership

Response: { success: true, cohortCount: N, memberCount: N }
```

This is a maintenance endpoint for data refreshes.

---

## Data Quality Considerations

### Missing Dimensions
Not every property has all five dimensions populated. For missing fields:
- `NULL` for that dimension acts as a wildcard — a query without filters includes those properties
- The backfill script logs properties with missing dimensions to a manifest

### Vintage Classification
No year_built → vintage = "Missing"
Otherwise:
- Pre-1980: < 1980
- 1980-2000: 1980-2000
- 2000-2015: 2000-2015
- Post-2015: > 2015

### Size Classification
No unit_count → sizeRange = "Missing"
Otherwise:
- Small: < 100
- Medium: 100-300
- Large: 300+

### Stability
The backfill is idempotent — re-running drops and recreates. Cohorts don't have user-specific state so there's no risk.

---

## Acceptance Criteria

1. **Backfill script runs** — `POST /api/v1/cohorts/backfill` completes in < 30 seconds for 296 properties
2. **Cohort query API returns results** — at least 2 cohorts with > 5 members
3. **Each query filter is optional** — omitting all filters returns all cohorts
4. **Member list includes links** — each parcel_id routes to `/archive/properties/:parcelId`
5. **Cohort stats are meaningful** — std dev, range, median populated correctly
6. **UI renders** — filter form + cohort stats bar + member table + sparklines
7. **Export CSV works** — downloads member table as CSV
