# Validation Source Grid + Sale Comps with Implied Cap — Investigation & Design

**Date:** 2026-05-26  
**Status:** Spec only — no code changes  
**Brief:** `attached_assets/Pasted-VALIDATION-SOURCE-GRID-SALE-COMPS-WITH-IMPLIED-CAP-INVE_1779818637431.txt`

---

## Table of Contents

1. [Current Source Provenance State](#1-current-source-provenance-state)
2. [Implied Cap Rate from Sale Comps — Full Design](#2-implied-cap-rate-from-sale-comps--full-design)
3. [F3 Market Sale Comps Section Design](#3-f3-market-sale-comps-section-design)
4. [Validation Grid Design](#4-validation-grid-design)
5. [Agent Reasoning Surface Integration](#5-agent-reasoning-surface-integration)
6. [Implementation Phasing Recommendation](#6-implementation-phasing-recommendation)
7. [Open Questions](#7-open-questions)

---

## 1. Current Source Provenance State

### 1A. What exists today — full inventory

**Y1 Source Picker (`frontend/src/pages/development/financial-engine/Y1SourcePicker.tsx`)**

A clickable pill in the Pro Forma Summary tab header that cycles through:
`BROKER → T12 → T6 → T3 → T1 → PLATFORM`

Color-coded (amber=BROKER, blue shades=trailing periods, cyan=PLATFORM). Controls which source column is treated as the "active" Year 1 value for the whole Pro Forma grid. This is a global view toggle — it does not change which value is used in the model; it changes what the operator sees highlighted.

**`OperatingStatementRow` — per-row multi-source data structure** (`ProFormaSummaryTab.tsx`)

Every row in the Pro Forma operating statement carries:

```typescript
{
  field: string;          // e.g. 'vacancy_loss', 'payroll'
  label: string;          // display label
  broker: number | null;  // Broker OM value
  platform: number | null;// Platform-derived value
  t12: number | null;     // Trailing 12-month actual
  t6: number | null;      // Trailing 6-month actual
  t3: number | null;      // Trailing 3-month actual
  t1: number | null;      // Trailing 1-month actual
  rentRoll: number | null;// Rent roll derived
  taxBill: number | null; // Tax bill (for real_estate_tax row only)
  resolved: number | null;// The value actually used in the model
  resolution: string | null; // How resolved was chosen (e.g. 'T12_preferred')
  perUnit: number | null; // $/unit annual
  source: string | null;  // Short source label for display
  confidence: number | null; // 0-1 agent confidence score
  benchmarkPosition: 'above' | 'below' | 'within' | null; // vs benchmark
}
```

**This multi-source data exists per row but the main grid only shows a subset at once** — the Y1 Source Picker controls which trailing period column is the active view; broker and platform are shown in separate columns; only `benchmarkPosition` hints at where resolved lands vs the market.

**EvidencePanel (`frontend/src/components/underwriting/EvidencePanel.tsx`)**

A 440px right-side drawer triggered by clicking an assumption cell. The deepest source attribution surface in the platform today. Contains:

*Three tabs:*
- **Reasoning** — plain-language agent derivation + primary evidence point
- **Evidence** — weighted data points table, tier-ranked:
  - Tier 1: Deal Docs (T12, Rent Roll, Tax Bill) — highest weight
  - Tier 2: Owned Portfolio — platform's own properties
  - Tier 3: Market Data — benchmarks, comps
  - Tier 4: Broker OM — lowest trust
- **Alternatives** — values considered and rejected, with `reason_rejected` per alternative

*Additional context surfaces:*
- `ArchiveContext`: P10/P25/P50/P75/P90 from `archive_assumption_benchmarks`, n_samples, as_of, `archive_percentile`, `range_label`
- `CohortContext`: P25/P50/P75 cohort, `delta_from_cohort_p50`, `delta_reasons` (contribution-by-factor), `outlier_justification`
- `CollisionReport`: agent_value vs broker_value, delta_pct, magnitude (minor/material/severe), direction, narrative

*Override section:* Accept agent value, accept broker, or set custom + reason. Revert to original.

**`underwriting_evidence` table** (created in `20260419_cashflow_evidence.sql`)

Server-side store written by the cashflow agent via `write_evidence_rows` tool. Per-field row schema:

```sql
field_path        TEXT        -- e.g. 'vacancy_pct', 'payroll'
value_numeric     NUMERIC
value_text        TEXT
primary_tier      INTEGER     -- 1-4
data_points       JSONB       -- array of { tier, source, label, value, weight, notes }
reasoning         TEXT        -- plain-language derivation
alternatives      JSONB       -- array of { source, label, value, delta_pct, reason_rejected }
collision         JSONB       -- { agent_value, broker_value, delta_pct, magnitude, narrative }
confidence        TEXT        -- 'high' | 'medium' | 'low'
```

Indexed by `(deal_id, field_path, created_at DESC)` for most-recent lookup.

**CollisionAnalysisSection (`frontend/src/components/deal/sections/CollisionAnalysisSection.tsx`)**

Deal-level `ThreeColumnComparison` (Broker vs Platform vs User) across 5 computed dimensions:
- Strategy Arbitrage: rent delta Broker vs Market
- Portfolio Fit: static score
- Broker Validation: computed from rent delta + occupancy delta
- Risk Assessment: from supply risk score
- Execution Confidence: static score

This is a summary-level comparison, not per-assumption.

**`archive_assumption_benchmarks`** (migration `20260419_archive_assumption_benchmarks.sql`)

Queried by `fetch_archive_assumption_distribution` tool. Returns P10/P25/P50/P75/P90 for a given `assumption_name` × `asset_class` × `deal_type` × (optionally) `submarket_id` × `vintage_band` × `strategy`. Minimum 5 samples guard. Progressive bucket widening: submarket + vintage + strategy → drop strategy → drop vintage → broadest.

**`line_item_benchmarks`** (migration `20260420_line_item_benchmarks.sql`)

Queried by `fetch_line_item_benchmarks` tool. Per OpEx line item P10/P25/P50/P75/P90 per-unit and %EGI distributions. Supports building profile fingerprint matching (garden|2010-2019|elev|pool|fit|club pattern). Used by cashflow agent to validate T12 actuals and flag outliers.

### 1B. What source attribution is already visible to operators

| Surface | Where | What's shown | Operator action available |
|---|---|---|---|
| Y1 Source Picker | Pro Forma Summary header | Active trailing period toggle (BROKER/T12/T6/T3/T1/PLATFORM) | Click to cycle — changes view column |
| Per-row source badge | Pro Forma Summary each row | `source` short label + `confidence` score | None — read only |
| `benchmarkPosition` indicator | Pro Forma Summary each row | 'above' / 'below' / 'within' vs benchmark | Click cell → opens EvidencePanel |
| EvidencePanel | Right-side drawer per field | Full tier-ranked evidence, archive P10-P90 percentile, collision report, alternatives | Override with value + reason |
| CollisionAnalysisSection | OVERVIEW deal section | Deal-level 5-dimension broker vs platform score | View only |
| Collision Table footnote | Pro Forma row broker column | ⚠ badge when collision.magnitude = 'material' or 'severe' | Click → EvidencePanel collision tab |

### 1C. Gap analysis — what is NOT visible today

**The fundamental gap:** there is no view showing all assumptions simultaneously with all validation methods side by side. An operator wanting to audit, say, the vacancy assumption must click into EvidencePanel for that one row, then close, then click another row. There is no at-a-glance convergence/divergence signal across the whole operating statement.

| Missing capability | Detail |
|---|---|
| All-assumptions validation grid | No grid showing all ~30+ assumptions as rows with each method (T12/Broker/Platform/Sale Comps/Archive) as columns — must click per-field |
| Multi-method triangulation score | No "3 sources agree on 5.5% vacancy" convergence signal; no "sources diverge ±200 bps" divergence alert visible at the grid level |
| Actual benchmark percentile in main grid | `benchmarkPosition` shows only above/below/within; the archive_percentile number (e.g. "P72") is hidden inside EvidencePanel |
| Sale comps implied cap in cap rate validation | The cap rate EvidencePanel has archive context but no sale comp-derived implied cap validation |
| Reasoning chain visible without clicking | Source selection logic ("New Construction → Platform stabilized cohort primary") is in EvidencePanel reasoning tab but not surfaced inline |
| State-conditional rule visibility | Which rule selected the source is in the agent reasoning text but not structured/surfaced as a labeled rule |
| Sigma bands in main grid | P25/P50/P75 bands are in EvidencePanel but not shown as a mini sparkline/band on each row in the main grid |

### 1D. Validation methods per assumption category — current coverage

**Revenue assumptions:**

| Assumption | T12/T6/T3/T1 | Rent Roll | Broker OM | Platform/LVE | Archive | Sale Comps Implied |
|---|---|---|---|---|---|---|
| GPR / Market Rent | ✓ OperatingStatementRow | ✓ via rentRoll column | ✓ via broker column | ✓ M07 LVE | ✓ archive_assumption_benchmarks | ✗ not wired |
| Vacancy % | ✓ T12 actual | ✓ occupancy from RR | ✓ | ✓ M07 calibrated | ✓ | ✗ |
| Concessions | ✓ T12 | ✓ RR charge codes | ✓ | ✓ growth assumption | ✓ | ✗ |
| Loss-to-Lease | ✗ not in T12 | ✓ RR-computed LTL | ✓ | ✗ | ✗ | ✗ |

**OpEx assumptions:**

| Assumption | T12/T6/T3/T1 | Broker OM | `line_item_benchmarks` P10-P90 | Archive | Sale Comps |
|---|---|---|---|---|---|
| Payroll | ✓ | ✓ | ✓ (agent uses at underwrite) | ✓ | ✗ |
| Insurance | ✓ | ✓ | ✓ | ✓ | ✗ |
| Real Estate Tax | ✓ | ✓ | ✗ (tax is geo-specific, not benchmark) | ✓ | ✗ |
| Repairs & Maintenance | ✓ | ✓ | ✓ | ✓ | ✗ |
| Management Fee % | ✓ | ✓ | ✓ | ✓ | ✗ |

**Cap rate assumptions:**

| Assumption | Broker OM | Archive benchmarks | Sale Comps (observed) | Sale Comps (platform OpEx implied) | M28 Cycle |
|---|---|---|---|---|---|
| Going-in cap | ✓ | ✓ archive_assumption_benchmarks | ✓ `market_sale_comps.cap_rate` (when disclosed) | ✗ NOT BUILT | ✓ |
| Exit cap | ✓ | ✓ | ✗ | ✗ NOT BUILT | ✓ |

**Growth rates:**

| Assumption | BLS CPI + spread | Archive benchmarks | Broker | FRED API |
|---|---|---|---|---|
| Rent growth | ✓ | ✓ | ✓ | ✓ |
| OpEx growth | ✓ | ✓ | ✓ | ✓ |

---

## 2. Implied Cap Rate from Sale Comps — Full Design

### 2A. Source data for sale comps — current inventory

**`market_sale_comps` table** (queried by `compSet.service.ts`)

Fields confirmed from the query in `compSet.service.ts`:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `sale_date` | Date | |
| `address` | Text | |
| `units` | Integer | |
| `sqft` | Numeric | Building sf |
| `year_built` | Integer | |
| `asset_class` | Text | A/B/C; often null → defaults to 'B' |
| `sale_price` | Numeric | |
| `price_per_unit` | Numeric | |
| `price_per_sqft` | Numeric | |
| `cap_rate` | Numeric | **Disclosed/observed cap — often null** |
| `buyer` | Text | Grantee name |
| `buyer_type` | Text | Institutional / Private / REIT / etc. |
| `qualified` | Boolean | Arms-length flag |
| `latitude` / `longitude` | Numeric | |
| `source` | Text | 'georgia_county' or other ingestion source |

**Coverage assessment:** Georgia county comps are the primary source (`georgia-sale-comps.service.ts`, `georgia-ingestion.routes.ts`). Other states likely sparse. `cap_rate` is often null because sale disclosures don't require cap disclosure.

**Current comp set aggregates** stored in `sale_comp_sets`:
- `median_price_per_unit`, `avg_price_per_unit`, min/max/std_dev
- `median_implied_cap_rate`, `avg_implied_cap_rate` — these are just median/avg of the raw `market_sale_comps.cap_rate` (often null or sparse)
- `subject_price_per_unit`, `subject_vs_median_pct`, `subject_percentile`

**Critical finding:** The label `implied_cap_rate` in `CompTransaction` and `CompSetResult` is misleading. Today it maps directly to `market_sale_comps.cap_rate` — the disclosed cap, when the seller reported it. There is **no computation applying platform OpEx norms** to derive a cap from first principles. Building the platform-implied cap is a new feature.

### 2B. Platform expense norms application — design

The platform already has `line_item_benchmarks` with per-unit OpEx P10/P50/P90 distributions by state × MSA × asset_class × deal_type × vintage_band × unit_count_band. This is the foundation.

**Step 1 — Estimate comp GPR:**

The `market_sale_comps` table does not store rent data. Two approaches to estimate a comp's GPR:

| Approach | Method | Pros | Cons |
|---|---|---|---|
| A. Market rent by comp profile | Use market rent benchmarks for the comp's MSA × asset_class × unit_count_band as a proxy for market rent; multiply by comp units × 12 | Doesn't require rent data on comp | Less precise; ignores comp-specific occupancy |
| B. Disclosed-cap back-calculation | When `cap_rate` is disclosed, back-calculate `comp_NOI = cap_rate × sale_price`, then derive `comp_GPR = comp_NOI / (1 - platform_opex_ratio)` using platform's OpEx %EGI benchmarks | Anchors to actual transaction | Circular only when cap is disclosed; doesn't help when cap is null |
| C. Hybrid | Approach A when cap is null; use disclosed cap as cross-check when available | Best coverage | More complex |

**Recommendation: Approach C (Hybrid).**

**Step 2 — Apply platform OpEx norms:**

```
platform_opex_per_unit = line_item_benchmarks.P50 summed across all OpEx line items
                         for comp's (asset_class × vintage_band × unit_count_band × state)

comp_GPR_estimate = market_rent_benchmark × comp_units × 12  [Approach A]
                    OR back-calculated from disclosed cap     [Approach B when cap available]

comp_platform_opex = platform_opex_per_unit × comp_units

comp_platform_implied_NOI = comp_GPR_estimate × (1 - occupancy_haircut) - comp_platform_opex
  where occupancy_haircut = submarket vacancy benchmark (P50 for the comp's submarket)

platform_implied_cap = comp_platform_implied_NOI / comp_sale_price
```

**Step 3 — Comparison with disclosed cap:**

When both `disclosed_cap` (from `market_sale_comps.cap_rate`) and `platform_implied_cap` are available, the divergence signal carries interpretation:

| Divergence | Magnitude | Interpretation |
|---|---|---|
| `disclosed_cap` < `platform_implied_cap` | > 50bps | Buyer assumed better operations OR paid for upside (value-add premium) OR seller's disclosed NOI inflated |
| `disclosed_cap` > `platform_implied_cap` | > 50bps | Buyer used more conservative OpEx OR distressed seller accepted lower pricing OR vintage/location adjustment not captured |
| Convergent | ≤ 50bps | Transaction consistent with platform norms — high confidence signal |

These divergence explanations should be surfaced as structured labels (not raw agent text) so they're actionable.

### 2C. Distribution from N comps — cap rate validation output

For a given subject deal, gather all comps in the comp set (filtered by submarket × asset_class × vintage bucket). Compute both `disclosed_cap` distribution and `platform_implied_cap` distribution.

**Output per comp set:**

```
N = comp count
Disclosed cap: P25 / P50 / P75 (from comps where cap_rate not null)
Platform-implied cap: P25 / P50 / P75 (from all comps with sufficient data)
Subject going-in cap: [the assumption being validated]
Subject position: within P25-P75 | below P25 | above P75
Convergence score: fraction of comps where |disclosed - platform_implied| ≤ 50bps
```

**Positioning visualization (conceptual):**
```
Platform-Implied Cap Rate Distribution (N=14 comps, submarket: Midtown ATL, Class B)

P10   P25      P50      P75   P90
 4.2%  4.8% ──── 5.4% ──── 6.1%  6.8%
              ████████████████
              ↑ SUBJECT
              5.1% (going-in)
              POSITION: within P25-P75 [conservative]
```

If subject cap is below P25 (aggressive) → amber alert. Below P10 → red. Within P25-P75 → green.

### 2D. Backend implementation requirements

**New service method:** `compSet.service.ts` → `computeImpliedCapRates(compSetId: string, dealId: string): Promise<ImpliedCapResult>`

**New columns needed on `sale_comp_sets`** (additive migration):
```sql
ALTER TABLE sale_comp_sets ADD COLUMN IF NOT EXISTS
  platform_implied_p25 NUMERIC,
  platform_implied_p50 NUMERIC,
  platform_implied_p75 NUMERIC,
  disclosed_p25 NUMERIC,
  disclosed_p50 NUMERIC,
  disclosed_p75 NUMERIC,
  n_disclosed INTEGER DEFAULT 0,
  n_implied INTEGER DEFAULT 0,
  implied_cap_computed_at TIMESTAMPTZ,
  opex_bucket_used JSONB; -- which benchmark bucket was applied
```

**New column on `sale_comp_set_members`** (or a sidecar table):
```sql
ALTER TABLE sale_comp_set_members ADD COLUMN IF NOT EXISTS
  platform_implied_cap NUMERIC,
  comp_gpr_estimate NUMERIC,
  comp_platform_opex NUMERIC,
  implied_cap_method TEXT, -- 'market_rent_benchmark' | 'disclosed_cap_backsolve' | 'insufficient_data'
  divergence_bps INTEGER, -- |disclosed - platform_implied| × 10000, null when one is absent
  divergence_label TEXT;  -- 'buyer_paid_for_upside' | 'conservative_opex' | 'converged' | null
```

**Trigger:** Implied cap computation should run automatically after a comp set is generated or when `line_item_benchmarks` are refreshed. Also callable on-demand via a new `POST /deals/:dealId/comps/compute-implied-caps` endpoint.

---

## 3. F3 Market Sale Comps Section Design

### 3A. Current state of F3 Market Module

`frontend/src/pages/development/MarketIntelligencePage.tsx` (3,063 lines) is the F3 Market Module.

**Tabs by deal mode:**

| Mode | Tabs |
|---|---|
| Development | OVERVIEW · DISCOVERY · DEMAND · **COMPS** · TRENDS · PROGRAM · EVENTS |
| Redevelopment | OVERVIEW · DISCOVERY · POSITIONING · **COMPS** · TRENDS · REPOSITIONING · EVENTS |
| Existing | OVERVIEW · DISCOVERY · POSITIONING · **COMPS** · TRENDS · PROGRAM · EVENTS |

**Current COMPS tab contents:**

The COMPS tab today mixes two distinct data types on a single surface:

1. **Rental comps (UnitMixIntelligence):** `MixMatrix` + `RentSFScatter` + `CompTable` — showing unit mix data, rent/SF scatter, and a comp rental table. These comps are the `COMPS` constant from `UnitMixIntelligence` component (static seed data or API-loaded rental comps from `useUnitMixIntelligence`).

2. **Sale comp transactions:** "SALE COMP TRANSACTIONS" section below the rental comps. Loaded from `/api/v1/deals/:dealId/comps` (the `market_sale_comps` / `sale_comp_sets` data). Columns: PROPERTY | DATE | PRICE | $/UNIT | CAP RATE | DIST. Aggregate KPIs: count, avg $/unit, median $/unit, avg cap rate (disclosed only).

**Gaps in the current COMPS tab:**
- No map view of comp locations alongside the list
- Cap rate column shows disclosed cap only (often "—")
- No platform-implied cap column or distribution panel
- No sort/filter controls (sort by date, distance, $/unit, cap rate)
- No filter by asset class, vintage, buyer type
- No "generate comp set" button in F3 (generation is via M27 routes separately)
- No P25/P50/P75 distribution visualization
- No subject deal positioning relative to comp distribution

**`CompsShellPage.tsx`** is a separate page with two tabs: COMPETITION ANALYSIS and SALE COMPS — this is an older surface that partially duplicates the F3 COMPS tab. It should eventually be consolidated.

### 3B. New Sale Comps section design (within F3 COMPS tab)

**Restructure the COMPS tab into two sub-sections with clear separation:**

**Sub-section 1: RENTAL COMPS (existing, unchanged)**
- MixMatrix, RentSFScatter, CompTable remain as-is

**Sub-section 2: SALE COMP INTELLIGENCE (new design)**

```
┌─ SALE COMP INTELLIGENCE ─────────────────────────── [Generate / Refresh] ──┐
│  N=14 comps · 3mi radius · 24mo window · Class B · 50-500 units            │
├─────────────────────────────────────────────────────────────────────────────┤
│  KPI STRIP                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────────────┐  │
│  │ 14 COMPS │ │ $187K/u  │ │ DISCLOSED    │ │ PLATFORM IMPLIED         │  │
│  │          │ │ median   │ │ P25  P50  P75│ │ P25    P50    P75        │  │
│  │          │ │ $/unit   │ │ 4.8% 5.4% 6.1│ │ 4.9%   5.3%   6.0%      │  │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────────────────┘  │
│                                                                             │
│  SUBJECT POSITIONING                                                        │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │  P10    P25        P50        P75    P90                          │     │
│  │  4.2%   4.8% ──── 5.4% ──── 6.1%   6.8%  (platform implied)     │     │
│  │                ████████████████████                               │     │
│  │                ↑ SUBJECT 5.1% · P38 percentile · CONSERVATIVE    │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  COMP LIST  [Sort: Date ▼] [Filter: Class ▼] [Buyer Type ▼]  [Map View]   │
│  ┌─ PROPERTY ────────────────┬ DATE ──┬ PRICE ──┬ $/UNIT ─┬ CAP (D/I) ┐  │
│  │ 1250 W Peachtree St NW    │ Feb-26 │ $38.2M  │ $191K   │ 5.2% / 5.0% │ │
│  │ 340 Ponce de Leon Ave     │ Nov-25 │ $24.1M  │ $178K   │ — / 5.4%  │  │
│  │ 770 Spring St NW          │ Sep-25 │ $51.6M  │ $210K   │ 4.8% / 5.1% │ │
│  │ ...                       │        │         │         │           │  │
│  └───────────────────────────┴────────┴─────────┴─────────┴───────────┘  │
│  [D = Disclosed, I = Platform Implied]                                      │
│  DIVERGENCE: 3 comps where |D−I| > 100bps — likely value-add premium       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Per-comp detail (expand row):**
- GPR estimate: method used (market_rent_benchmark vs disclosed_cap_backsolve)
- Platform OpEx applied: which bucket matched, total per-unit OpEx used
- Divergence label: buyer_paid_for_upside / conservative_opex / converged / insufficient_data
- Buyer context: buyer_type, grantee_name, arms_length flag

**Map view:** Mapbox integration (already in platform). Subject property as a pin; comps as colored circles (green = within P25-P75 of platform implied; amber = >100bps divergence). Toggle between list and map.

**Sort/filter controls:**
- Sort by: Date (default desc), $/unit, distance, disclosed cap rate, platform implied cap
- Filter by: asset_class, buyer_type, vintage range, distance ≤ N miles

### 3C. Cross-module integration

**F3 → F9 cap rate validation:**
After a comp set has implied caps computed, the EvidencePanel for the going-in cap (`field_path: 'going_in_cap'`) should show a new "Sale Comps" section alongside the archive context:

```
SALE COMPS · P25 / P50 / P75 (implied)
4.9%          5.3%          6.0%
N=14 comps · 3mi · 24mo · Class B
```

This populates Tier 3 (Market Data) in the EvidencePanel for cap rate fields. The `data_points` array in `underwriting_evidence` for cap rate rows should gain a comp-derived data point when a comp set with computed implied caps exists.

**F3 → Agent cap rate derivation:**
The cashflow agent's `fetch_comps` tool currently returns only `median_implied_cap_rate` (the sparse disclosed cap). After implied caps are computed, `fetch_comps` should return both:
- `median_disclosed_cap_rate` (existing)
- `median_platform_implied_cap` (new)
- `implied_cap_p25`, `implied_cap_p50`, `implied_cap_p75`

This gives the agent a real comp-derived distribution to use in cap rate underwriting.

**M22 Post-Close Intelligence:**
`M22` cross-references closed deals against the original underwriting to validate which assumptions were accurate. Sale comp implied caps (at underwriting time) vs actual exit cap at disposition is a high-value cross-reference. Store `implied_cap_at_underwriting` and `n_comps_used` in deal_underwriting_snapshots evidence_map.

---

## 4. Validation Grid Design

### 4A. Per-assumption grid layout

**New surface:** A dedicated "VALIDATION GRID" sub-tab within the F9 Console (ConsoleHubTab), or as a panel accessible from the Pro Forma Summary tab.

Positioning: F9 CONSOLE → new sub-tab `VALIDATION` between INPUTS and UNIT MIX.

**Grid structure:**

```
Rows: ~30 multifamily assumptions (all OperatingStatementRow items + cap rates + growth rates)
Columns: validation methods

┌─ ASSUMPTION ──────┬─ T12 ──┬─ BROKER ┬─ PLATFORM ┬─ SALE COMPS ┬─ ARCHIVE ┬─ RESOLVED ┬─ σ ──┐
│ GPR               │ $2.1M  │ $2.3M   │ $2.0M     │ —           │ P52      │ $2.1M     │ ●    │
│ Vacancy %         │ 6.2%   │ 5.0%    │ 6.8%      │ —           │ P48      │ 6.2%      │ ✓    │
│ Going-in Cap      │ —      │ 5.5%    │ —         │ 5.1% [P38]  │ P42      │ 5.5%      │ ✓    │
│ Exit Cap          │ —      │ 6.0%    │ —         │ —           │ P55      │ 6.0%      │ ✓    │
│ Payroll           │ $1,240 │ $1,100  │ $1,180    │ —           │ P58      │ $1,240    │ ✓    │
│ Insurance         │ $380   │ $420    │ $340      │ —           │ P72      │ $380      │ ⚠    │
│ Real Estate Tax   │ $2,100 │ $2,100  │ —         │ —           │ —        │ $2,100    │ —    │
│ ...               │        │         │           │             │          │           │      │
└───────────────────┴────────┴─────────┴───────────┴─────────────┴──────────┴───────────┴──────┘
```

**Column definitions:**

| Column | Source | Populated when |
|---|---|---|
| T12 | `OperatingStatementRow.t12` | T12 uploaded and parsed |
| BROKER | `OperatingStatementRow.broker` | OM uploaded and parsed |
| PLATFORM | `OperatingStatementRow.platform` | Agent has run |
| SALE COMPS | New: comp set with implied caps | Comp set generated + implied caps computed |
| ARCHIVE | `archive_assumption_benchmarks` P-position label | Benchmarks exist for this assumption |
| RESOLVED | `OperatingStatementRow.resolved` | Always |
| σ (sigma) | `OperatingStatementRow.benchmarkPosition` | Benchmarks exist |

### 4B. Per-cell information

Each cell in the grid shows:
- The numeric value (formatted in the same unit as the row — $/unit/yr, %, $ total)
- A tiny source badge (color-coded: cyan=T12/RR, amber=Broker, purple=Platform, green=Comps, blue=Archive)
- If the method is the resolution source: bold + green underline

**σ column:**

| Value | Display | Color |
|---|---|---|
| 'within' (P25-P75) | ✓ | green |
| 'above' (P75-P90) | ▲ | amber |
| 'below' (P10-P25) | ▼ | amber |
| Above P90 | ▲▲ (flag) | red |
| Below P10 | ▼▼ (flag) | red |
| No benchmark | — | muted |

Clicking the σ cell shows a mini-sparkline of the benchmark distribution with the resolved value marked.

### 4C. Color coding for convergence/divergence

The validation grid's most important design element is the convergence signal:

**Row-level color coding:**

| Condition | Row color | Label |
|---|---|---|
| All available methods within ±5% of resolved | Subtle green background | CONVERGED |
| 1 method deviates > 5% from resolved | No highlight | — |
| 2+ methods deviate > 10% from resolved | Subtle amber background | DIVERGED |
| Any method deviates > 20% and is a Tier 1 source | Red left border | COLLISION |

**SALE COMPS column color coding:**
- Subject within P25-P75: green
- Subject P10-P25 or P75-P90: amber
- Subject below P10 or above P90: red

### 4D. Sigma checks and drill-down

For each row, clicking the σ value (or a ⓘ affordance) opens a mini-panel showing:
- The P10/P25/P50/P75/P90 range
- A horizontal bar with the resolved value positioned
- N samples + as_of date
- The bucket matched (e.g., "Class B · value-add · 2006-2015 · GA")
- If outlier: the `outlier_justification` from the agent's reasoning

This is a lightweight version of what's already in EvidencePanel — extracted to a non-blocking mini-popover so the operator can scan multiple rows without opening/closing a full drawer.

---

## 5. Agent Reasoning Surface Integration

### 5A. Validation grid as the agent's "show your work" surface

The EvidencePanel already shows per-field agent reasoning. The Validation Grid is the macro-level complement: where EvidencePanel shows depth (one field), the Validation Grid shows breadth (all fields at once).

**For each row in the validation grid, the "RESOLVED" cell should:**
1. Show which method was chosen (`resolution` field from `OperatingStatementRow`)
2. A small icon: T1 = document icon / T2 = portfolio icon / T3 = market icon / T4 = broker icon
3. Hover tooltip showing the resolution label (e.g., "T12_preferred · T12 > 12 months, high confidence")
4. Click → full EvidencePanel (existing behavior, just routed from the grid row)

**State-conditional rule visibility:** The `resolution` field today is a short code (e.g., "T12_preferred"). This should be mapped to a human-readable rule description in a lookup table:

| Resolution code | Human label |
|---|---|
| `T12_preferred` | T12 · High-quality trailing data available |
| `broker_only` | Broker OM · No trailing data available |
| `platform_conservative` | Platform · Applied conservative stance |
| `user_override` | User Override · Operator set this value |
| `platform_new_construction` | Platform · New construction — no T12 exists |
| `archive_fallback` | Archive · Insufficient deal-specific data |

This mapping table (`field-labels.ts` or a new `resolution-labels.ts`) is the foundation of the "agent shows its work" surface. No AI needed — pure lookup.

### 5B. Integration with input-mapping (Phase 2 derivation logic)

The Phase 2 cashflow agent derivation logic (per the line-item-matrix prompt `backend/src/agents/prompts/cashflow/line-item-matrix.ts`) selects sources per assumption based on state. The Validation Grid makes these selections visible:

- Agent chose T12 for vacancy → T12 column highlighted as "active"
- Agent used Platform for payroll (no T12) → Platform column highlighted, T12 cell shows "—"
- Agent flagged broker insurance as aggressive → BROKER cell shows ⚠ in amber

**Module context references:** The EvidencePanel already shows module references (M02, M07, M14, etc.) in the reasoning text. The Validation Grid can surface these as micro-badges on the PLATFORM column cell: e.g., [M07] for vacancy (M07 Traffic Engine), [M14] for rent growth (M14 Rent Growth Intelligence).

### 5C. Override and persistence

When an operator overrides a value from the Validation Grid:
1. The override writes to the existing override mechanism (POST assumptions/:fieldPath/override)
2. The RESOLVED column updates to show the new value with "USER" badge
3. The agent's previous reasoning persists in EvidencePanel as "what the agent would have chosen" — accessible via EvidencePanel Reasoning tab
4. The σ column still shows the benchmark position of the overridden value (not the agent's)

**Override impact signal (new):** When an operator overrides a value, show an inline "IMPACT" indicator:
```
Insurance: $380 → $420/unit ↑10.5%  [NOI impact: -$16K/yr · Cap rate: +2bps]
```

This requires a quick NOI sensitivity lookup against the financial model — feasible given the proforma-seeder architecture.

---

## 6. Implementation Phasing Recommendation

### Phase 1 — Platform-implied cap computation (backend only, no UI change)

**Scope:**
1. New `compSet.service.ts` method: `computeImpliedCapRates(compSetId, dealId)` applying `line_item_benchmarks` P50 OpEx norms to each comp
2. New DB columns on `sale_comp_sets` and `sale_comp_set_members` for implied cap fields
3. New endpoint: `POST /deals/:dealId/comps/compute-implied-caps`
4. Update `fetch_comps` agent tool to return implied cap P25/P50/P75
5. Update cashflow agent's cap rate evidence rows to include comp-derived data point

**Risk:** Medium. New math logic, requires market rent benchmarks by MSA/class for Approach A GPR estimation. The `line_item_benchmarks` tool already exists. Market rent benchmarks may need to be sourced (from rent_scrape_targets or a new benchmark table).

**Deliverable:** Backend-only. Agent now has implied cap distribution to use in underwriting. No visible UI change yet.

### Phase 2 — F3 Sale Comps enhanced display

**Scope:**
1. Upgrade the "SALE COMP TRANSACTIONS" section in F3 COMPS tab:
   - Add platform implied cap column alongside disclosed cap: "CAP RATE (D / I)"
   - Add P25/P50/P75 distribution KPI strip for both disclosed and implied
   - Add subject positioning visualization (horizontal distribution bar)
   - Add sort controls: by date/price/dist/cap rate
   - Add filter controls: asset_class / buyer_type
2. Add "Generate Comp Set" button to F3 COMPS tab (today only in M27 via API call)
3. Connect to comp-implied cap computation trigger on generate

**Risk:** Low-Medium. Mostly frontend work. Comp data path already established.

### Phase 3 — Validation Grid in F9 Console

**Scope:**
1. New `validation` sub-tab in `ConsoleHubTab` (7th tab: STANCE · DEAL TERMS · INPUTS · UNIT MIX · OTHER INCOME · VALIDATION · TAX)
2. New `ValidationGridTab.tsx` component rendering the multi-column grid from `OperatingStatementRow` data
3. Convergence/divergence color coding per row
4. σ column with mini-popover distribution view (reuses archive data already fetched)
5. SALE COMPS column populated when comp set has computed implied caps (Phase 1 prerequisite)
6. Resolution code → human label lookup table

**Risk:** Medium. The data already exists in `OperatingStatementRow`; this is primarily a display transformation. The σ mini-popover requires re-using EvidencePanel's archive context — extract that into a shared hook.

### Phase 4 — Override impact signal + agent reasoning surface

**Scope:**
1. `resolution` code → human-readable rule label lookup
2. Module context micro-badges on Platform column cells [M07] / [M14] / etc.
3. Override impact signal (NOI delta + cap rate delta) shown inline after user override
4. "What the agent would have chosen" shown as collapsed accordion in EvidencePanel when user override is active

**Risk:** Low for labels/badges (purely frontend). Medium for override impact signal (requires NOI sensitivity call to the seeder). High if override impact requires live re-computation — consider pre-computing impact at override write time instead.

---

## 7. Open Questions

### Sale Comps / Implied Cap

1. **Market rent source for GPR estimation on comps.** Approach A requires a market rent estimate for each comp by MSA × asset_class × vintage. Where does this come from? Options: (a) `rent_scrape_targets` / market rent benchmarks if already populated; (b) a new `market_rent_benchmarks` table fed by existing rent scraping; (c) manual override per comp. This is the most important design decision for Phase 1.

2. **Geographic coverage gap.** `market_sale_comps` is primarily Georgia county data. For non-Georgia deals, there may be no comps at all. Should the Validation Grid gracefully degrade (show "—" in SALE COMPS column) or should the spec include a plan to ingest other state comp sources?

3. **Disclosure rate of `cap_rate` in `market_sale_comps`.** Georgia county deeds don't require cap disclosure. What percentage of rows have non-null `cap_rate`? This determines how useful the "disclosed vs implied divergence" analysis is in practice. Run: `SELECT COUNT(*) FILTER (WHERE cap_rate IS NOT NULL) * 100.0 / COUNT(*) FROM market_sale_comps` to assess.

4. **`price_per_sqft` as an alternative validation.** The comp data has `price_per_sqft` which doesn't require cap rate reasoning. Should the Validation Grid also surface a price-per-sf positioning (subject $/sf vs comp distribution)? This is simpler and more universally available.

### Validation Grid

5. **Which assumptions to include in the validation grid?** The `OperatingStatementRow` covers ~20 operating statement lines. Cap rates and growth rates are in `deal_assumptions` but not in `OperatingStatementRow`. Should the grid include cap rates, growth rates, and hold period? Confirm the full set of ~30-40 rows intended in the brief.

6. **Performance.** The Validation Grid needs archive benchmark P-positions for every row simultaneously. `fetch_archive_assumption_distribution` is called per-field by the agent at underwrite time. For the grid, all 30 rows need to be fetched at once. Does the current DB query pattern support a batch fetch (single query for multiple assumption_names) or will it require N individual queries? A batch endpoint may be needed.

7. **Validation grid trigger timing.** The `underwriting_evidence` table is only populated when the cashflow agent runs. Before the agent runs, the PLATFORM column and EvidencePanel reasoning are empty. Should the Validation Grid show a "Run Agent to populate platform values" prompt? Or should it gracefully show what it has (T12 + Broker) even without agent output?

### Agent Reasoning

8. **`resolution` code completeness.** The `resolution` field in `OperatingStatementRow` is populated by `financials-composer.service.ts`. What is the full set of resolution codes actually emitted today? The Phase 3 label lookup table must cover all of them. Run: `SELECT DISTINCT resolution FROM proforma_rows` (or equivalent) to enumerate.

9. **Module context micro-badges.** To show [M07] on the vacancy row, the system needs a mapping from `field_path` → `module_id`. Is this mapping explicit somewhere, or would it need to be hand-maintained? A `field_path_module_map.ts` constant (similar to `field-labels.ts`) would suffice.

10. **Override impact signal live vs pre-computed.** Computing NOI impact of an override requires re-running the proforma seeder for that field. The seeder is not designed for single-field hot re-computation today. Options: (a) full re-seeder run after override (slow, but correct); (b) simple linear sensitivity: impact = delta × applicable_multiplier (fast, approximate). Which is acceptable for Phase 4?
