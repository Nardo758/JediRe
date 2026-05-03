# JEDI RE — Rent Roll Analytics Framework

> The single source of truth for what is computable from rent roll data, how the platform extracts and stores it, how quality is gated so parser failures surface as failures (not as plausible numbers), and where every derived metric flows downstream.
>
> Companion to:
> - [`traffic_engine_v2_leasing_prediction.md`](./traffic_engine_v2_leasing_prediction.md) — M07 traffic-engine inputs (the `lease_events` schema referenced throughout lives there)
> - [`f9-proforma-spec.md`](./f9-proforma-spec.md) — M09 ProForma consumption of derived rent-roll metrics
> - [`deal-capsule-blueprint.md`](./deal-capsule-blueprint.md) — Deal Capsule shape consumed by all downstream modules
> - [`module_wiring_map.md`](./module_wiring_map.md) — full module-to-module data flow
> - `TRAFFIC_ENGINE_CALIBRATION_SPEC.md` *(referenced but not yet authored — see [`RENT_ROLL_FRAMEWORK_GAP_ANALYSIS.md`](./RENT_ROLL_FRAMEWORK_GAP_ANALYSIS.md))*
> - `CASHFLOW_AGENT_UNDERWRITING_SPEC.md` *(referenced but not yet authored)*
> - `AGENT_PLATFORM_SPEC.md` *(referenced but not yet authored)*
>
> Implementation status of every section in this doc is tracked in [`RENT_ROLL_FRAMEWORK_GAP_ANALYSIS.md`](./RENT_ROLL_FRAMEWORK_GAP_ANALYSIS.md). All future rent-roll work (parsers, quality gating, derivations, diff metrics, F6 floor-plan UI, M07/M09/M22/M25 consumption) must cite this framework + the gap analysis as the planning baseline.
>
> Scope: this framework owns the analytics layer that sits between the rent roll parser and every consumer module. It does not own the parser implementation (that's `rent-roll-parser.ts` + variants) or the per-module presentation (each module owns its own UI). It owns the contract between them.

---

## 0. Why This Exists

Rent roll is the single richest deal-level data source on the platform. It contains the operating reality of the asset — pricing, occupancy, concession economics, tenant profile, lease term distribution, renewal behavior, expiration risk — and yet most of the platform currently consumes it as a flat unit count. The analytical surface area is an order of magnitude larger than what's wired today.

This framework defines that surface area. It also defines the quality discipline: a partially-extracted rent roll must render as partially extracted, not as a clean-looking table with quietly broken numbers. The 464 Bishop deal — where every lease expiration date dropped to null and every unit got bucketed as MTM, producing a "100% MTM" stabilized property visualization — is the failure mode this framework prevents structurally.

---

## 1. The Five-Layer Pipeline

```
┌─────────────────────────────────────────────────────────┐
│  Upload (PDF / XLSX / CSV)                              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 1 — EXTRACTION                                   │
│  format_detector → variant_detector → field_mapper      │
│  → parser → normalized rows in lease_events             │
│  + charge_lines (RRwLC variant)                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 2 — QUALITY GATING                               │
│  per-field extraction_status → critical-field guards    │
│  → snapshot_quality verdict (OK / PARTIAL / FAILED)     │
│  → upload-time preview before commit                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 3 — SINGLE-SNAPSHOT DERIVATIONS                  │
│  Property / Floor Plan / Floor / Tenant / Risk /        │
│  Pricing — every dimension × every lens                 │
│  Cached in rent_roll_derived per snapshot               │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼ (when 2+ snapshots exist for property)
┌─────────────────────────────────────────────────────────┐
│  Layer 4 — DIFF EXTRACTOR ANALYTICS                     │
│  trade-out, true renewal rate, actual downtime,         │
│  net absorption, pricing velocity, trend tracking       │
│  Cached in rent_roll_diffs per snapshot pair            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 5 — PRESENTATION STATE MACHINE                   │
│  Each rendered metric carries OK / PARTIAL / FAILED     │
│  state. UI never renders extraction failure as a value. │
└─────────────────────────────────────────────────────────┘
```

Each layer has a clean contract with the next. A consumer module never reaches past Layer 5 to inspect raw rows. Layer 5 never renders without consulting the Layer 2 quality verdict.

---

## 2. Layer 1 — Extraction

### 2.1 Format detection

The first decision in the pipeline is which extractor to invoke. This is not a single classifier — it's a two-step cascade:

**Step 1: Source PMS detection.** From file metadata, header signatures, and column-name fingerprints, classify into: `YARDI`, `REALPAGE_ONESITE`, `ENTRATA`, `APPFOLIO`, `RESMAN`, `GENERIC_CSV`, `UNKNOWN`. Each PMS has characteristic patterns (Yardi's property-prefixed unit codes like `bs-a1`, RealPage's specific column ordering, Entrata's nested rent breakdown).

**Step 2: Variant detection.** Within Yardi specifically (and increasingly within RealPage), there are multiple export shapes that look similar at a glance but parse very differently:

- `STANDARD` — one row per unit, all values flat in columns
- `RRWLC` (Rent Roll with Lease Charges) — one unit row + nested charge sub-rows below it; rent and ancillary charges live in the sub-block
- `OCCUPANCY_ONLY` — unit + status + occupant, no rent column at all (some Yardi exports are scoped this way)
- `WIDE` — unit row with all charges spread across columns (parking_charge, pet_charge, RUBS_charge as separate columns rather than nested rows)

Variant detection runs by inspecting the first 20 data rows for sub-row structure (indented unit numbers? duplicate unit numbers with different charge codes?). It must report its variant choice with a confidence score. **Confidence < 0.85 must surface to the user before parsing commits** — see Layer 2.

### 2.2 The parser variant matrix

| PMS | Variant | Parser file | Status |
|---|---|---|---|
| Yardi | STANDARD | `rent-roll-parser.ts` | exists |
| Yardi | RRWLC | `rrwlc-parser.ts` | exists per memory |
| Yardi | OCCUPANCY_ONLY | `rent-roll-parser.ts` (graceful degradation) | partial — flag rent fields as N/A, not 0 |
| RealPage | STANDARD | `realpage-parser.ts` | needed |
| Entrata | STANDARD | `entrata-parser.ts` | needed |
| AppFolio | STANDARD | `appfolio-parser.ts` | needed |
| ResMan | STANDARD | `resman-parser.ts` | needed |
| Generic CSV | mapped via `field_mapper` | `generic-csv-parser.ts` | needed |

Generic CSV is the long tail — operators export from less-common PMS systems or hand-build sheets. The field_mapper uses fuzzy column matching with synonym tables (`rent`, `Rent`, `Mkt Rent`, `Asking Rent`, `Rate`, `Monthly Rent` → `market_rent`). When fuzzy-match confidence falls below threshold, the user is shown a column-mapping UI to confirm or correct mappings before parsing commits.

### 2.3 Normalized output schema

The extractor outputs to three tables, regardless of source format:

**`rent_roll_snapshots`** — one row per uploaded file
```sql
CREATE TABLE rent_roll_snapshots (
  id                    UUID PRIMARY KEY,
  deal_id               UUID NOT NULL REFERENCES deals(id),
  property_id           UUID REFERENCES properties(id),
  uploaded_at           TIMESTAMPTZ NOT NULL,
  uploaded_by           UUID REFERENCES users(id),
  source_filename       TEXT,
  source_s3_key         TEXT NOT NULL,        -- original file always preserved
  detected_pms          pms_enum,
  detected_variant      variant_enum,
  detection_confidence  DECIMAL(3,2),
  parser_version        TEXT,
  as_of_date            DATE NOT NULL,        -- the rent roll's reference date, not upload date
  unit_count_extracted  INT,
  unit_count_expected   INT,                  -- from OM or prior snapshot, for cross-check
  quality_verdict       quality_verdict_enum, -- OK / PARTIAL / FAILED (Layer 2)
  notes                 TEXT
);
```

**`lease_events`** — one row per unit per snapshot (full schema in `TRAFFIC_ENGINE_CALIBRATION_SPEC.md` §5.1)

**`charge_lines`** — one row per charge component per unit per snapshot (RRwLC variant only)
```sql
CREATE TABLE charge_lines (
  id              UUID PRIMARY KEY,
  snapshot_id     UUID NOT NULL REFERENCES rent_roll_snapshots(id),
  lease_event_id  UUID NOT NULL REFERENCES lease_events(id),
  charge_code     TEXT NOT NULL,    -- RENT, PARKING, PET, RUBS_W, RUBS_S, CONCESSION, ADMIN, etc.
  charge_amount   DECIMAL(10,2),
  charge_basis    charge_basis_enum, -- MONTHLY / ONE_TIME / AMORTIZED
  effective_from  DATE,
  effective_to    DATE
);
```

The `charge_lines` table is critical. RRwLC files only make sense if you preserve the charge breakdown — collapsing them to a single rent number on the unit row destroys the ancillary income detail that the platform needs for accurate GPR/EGI modeling.

### 2.4 Per-row extraction confidence

Every `lease_events` row carries:
```ts
{
  extraction_confidence: 0.0 - 1.0,
  extraction_method: "structured" | "ocr" | "fuzzy",
  human_review_needed: bool,
  original_row_ref: "page_3_row_47",   // for back-pointing during disputes
  field_status: {
    unit_number:        "ok",
    unit_type:          "ok",
    sqft:               "ok",
    market_rent:        "ok" | "missing" | "low_confidence" | "out_of_range",
    effective_rent:     "ok" | "missing" | "low_confidence" | "out_of_range",
    lease_start_date:   "ok" | "missing" | "low_confidence",
    lease_end_date:     "ok" | "missing" | "low_confidence",
    status:             "ok" | "missing"
    // ... per critical field
  }
}
```

Field-level status is what powers Layer 2 quality gating and Layer 5 presentation states.

---

## 3. Layer 2 — Quality Gating

### 3.1 Field criticality classes

Not every field carries equal weight. The framework defines four classes:

**Class A — Identity (hard fail if missing).** Without these, the row is uninterpretable.
- `unit_number`, `status`

**Class B — Critical (hard fail if missing on >X% of rows).** Without these, primary analytics are broken.
- `market_rent`, `effective_rent`, `lease_end_date`, `unit_type`
- Threshold: hard fail if missing on **>10% of occupied units**

**Class C — Important (partial accept with explicit warning).** Analytics degrade but framework remains functional.
- `lease_start_date`, `move_in_date`, `sqft`
- Threshold: PARTIAL verdict if missing on **>20% of rows**, but pipeline still ingests

**Class C-X — Cross-Document Reconcilable (missing on rent roll is acceptable IF resolvable from another source).**
- `concession_amount` and `concession_term_months` — see §3.5 for the reconciliation rule
- Future additions likely: ancillary income (sometimes broken out only on T12), bad debt (T12-only)
- Threshold: PARTIAL only if missing on rent roll AND unresolvable from T12. If T12 supplies a property-level value, the metric is OK at property level and `unattributed` at unit level.

**Class D — Optional (graceful degradation).** Analytics adapt to absence.
- `prior_lease_rent`, `pet_rent`, `parking_fee`, `utility_reimbursement`, `lease_term_months`
- Missing values flagged but never block ingestion

### 3.2 Snapshot-level quality verdict

After parsing, before commit, compute:
```ts
function assessQuality(snapshot): QualityVerdict {
  const classA_failures = countRowsMissing(snapshot, CLASS_A_FIELDS);
  const classB_missing_pct = pctOccupiedMissing(snapshot, CLASS_B_FIELDS);
  const classC_missing_pct = pctRowsMissing(snapshot, CLASS_C_FIELDS);
  
  if (classA_failures > 0)              return "FAILED";
  if (classB_missing_pct > 0.10)        return "FAILED";
  if (classC_missing_pct > 0.20)        return "PARTIAL";
  return "OK";
}
```

The verdict is stored on `rent_roll_snapshots.quality_verdict` and referenced by every downstream consumer.

### 3.3 Upload-time quality preview

This is the new piece that prevents 464-Bishop-class failures.

When a user uploads, **before any commit to the lease_events table**, the parser runs in dry-run mode and the user sees:

```
┌──────────────────────────────────────────────────────────────┐
│  RENT ROLL UPLOAD — QUALITY PREVIEW                          │
│  464_bishop_rentroll_2026Q1.xlsx                             │
├──────────────────────────────────────────────────────────────┤
│  Detected as:    Yardi RRwLC      Confidence: 0.62  ⚠       │
│                                                              │
│  Extraction summary:                                         │
│    Units detected:           232 of expected 232    ✓       │
│    Floor plans:              11                     ✓       │
│    Status field:             100% mapped            ✓       │
│    Square footage:           100% mapped            ✓       │
│    Market rent:              0% mapped              ✗ FAIL  │
│    Effective rent:           0% mapped              ✗ FAIL  │
│    Lease expiration date:    0% mapped              ✗ FAIL  │
│    Charge breakdown:         not extracted          ✗ FAIL  │
│                                                              │
│  Verdict: FAILED                                             │
│                                                              │
│  Likely cause: Variant misdetection. The file appears to    │
│  contain nested charge sub-rows (RRwLC format) but the      │
│  standard parser was selected. Try:                         │
│                                                              │
│   [ Re-parse as Yardi RRwLC ]   [ Manual column mapping ]   │
│   [ Re-export with charge details ]   [ Cancel upload ]     │
└──────────────────────────────────────────────────────────────┘
```

The user explicitly accepts the verdict (or fixes it) before any data lands in `lease_events`. A `FAILED` verdict cannot be force-accepted — the user must either re-parse with a different variant, manually map columns, or re-upload a different file. A `PARTIAL` verdict can be accepted with explicit confirmation, and the resulting analytics will render with PARTIAL state per Layer 5.

### 3.4 Why this beats post-hoc detection

Catching parser failures at upload time rather than three screens deep means the user is in the right cognitive context to fix it (they have the file, they remember which export option they chose, they can re-export immediately). It also prevents downstream consumers — JEDI Score, ProForma, M22 variance tracking — from training on or projecting bad data and producing confidently wrong outputs.

### 3.5 Cross-document reconciliation — the concession rule

Concessions are the canonical cross-document field: present on the rent roll for some operators, present only on the T12 for others, occasionally split across both. The framework treats this as a reconciliation hierarchy, not a single-source extraction.

**Source priority (highest to lowest fidelity):**

| Source | Granularity | Use when |
|---|---|---|
| Rent roll (RRwLC charge_lines with `CONCESSION` code) | Per-unit, per-lease, with term + amount | Available — preferred |
| Rent roll standalone `concession_amount` column | Per-unit, single-period | Available, no charge breakdown |
| T12 concession line item | Property-level, monthly | Rent roll has no concession data |
| T12 implied (NRI − GPR computed back into concession bucket) | Property-level, residual | Last resort, flagged low-confidence |

**Reconciliation rule.** At property level, the framework computes `concessions_monthly` as:

```
if rent_roll has concession data:
    rr_concessions = sum(charge_lines.CONCESSION amortized to monthly)
                     OR sum(lease_events.concession_amount amortized)
    
    if t12 has concession_line_item:
        # Cross-validate: should be within 20% of each other
        delta_pct = abs(rr_concessions - t12_concessions) / max(rr, t12)
        if delta_pct > 0.20:
            flag = "CONCESSION_MISMATCH"
            # Use T12 as authority for trailing realized; use RR for forward
        property_concessions_monthly = t12_concessions  # T12 = realized, audit-grade
        property_concessions_forward = rr_concessions   # RR = current/forward state
    else:
        property_concessions_monthly = rr_concessions
        property_concessions_forward = rr_concessions

elif t12 has concession_line_item:
    property_concessions_monthly = t12_concessions
    property_concessions_forward = t12_concessions  # carry trailing forward as best estimate
    flag = "CONCESSIONS_FROM_T12_ONLY"  # downstream knows: no per-unit attribution

else:
    # Last resort: implied from NRI vs GPR delta
    implied = max(0, gpr_monthly - net_rental_income_monthly - vacancy_loss_monthly)
    property_concessions_monthly = implied
    flag = "CONCESSIONS_IMPLIED"
    extraction_status = "PARTIAL"  # downstream warned
```

**Per-unit attribution rule.** When concessions come from T12 only, per-unit fields stay null and per-unit analytics (concession by floor plan, concession by tenure cohort) render as FAILED state at the unit-type level — not zero, FAILED. The property-level concession_intensity_pct still renders as OK because the property-level number is real. **The framework propagates this asymmetry honestly: property-level OK, unit-level FAILED, both true at once.**

**T12 dependency declaration.** This means concession metrics carry an additional `requires_t12: bool` flag in their derivation metadata. If the deal has a rent roll but no T12, concession-dependent metrics that fall back to T12 render as FAILED with the message "T12 needed to resolve concessions for this rent roll format." This becomes a structured prompt to upload the missing document — the same upload-time discipline as Layer 2, but cross-document.

**Generalize this pattern.** Concessions are the first cross-document reconciliation, but several other fields follow the same pattern:

| Field | Rent roll source | T12 source | Reconciliation |
|---|---|---|---|
| Concessions | charge_lines / column | concession line item | T12 trailing, RR forward |
| Bad debt | rare | bad_debt line item | T12 authority |
| Other income (parking, pet, RUBS) | RRwLC charge_lines | other_income line items | Sum-cross-check; T12 authority for trailing |
| Vacancy loss | computed from status | vacancy_loss line item | T12 = realized economic vacancy; RR = current physical vacancy (different concepts, both useful) |
| Effective rent / NRI | sum across units | net_rental_income line | Cross-validation flag if >5% delta |

Each of these gets its own reconciliation rule following the concession template. The framework treats the rent roll + T12 as a **paired data contract** for any deal in Existing or Value-Add mode, not two independent uploads.

---

## 4. Layer 3 — Single-Snapshot Analytical Taxonomy

This is the analytical surface. Organized by **dimension × lens**.

### 4.1 The dimensions

Every metric is computable along one or more of:
- **Property** (rolled up to the asset)
- **Floor plan** (`unit_type` group: bs-a1, bs-a2, bs-b1, etc.)
- **Floor / building** (vertical slice)
- **Tenant cohort** (lease vintage, tenure band, lease term band)
- **Unit** (the atomic level — every metric is reducible to a unit)

### 4.2 The lenses

- **Occupancy** — physical, economic, leased-not-occupied, notice
- **Pricing** — market vs effective, LTL, concession intensity, ancillary mix
- **Risk** — expiration concentration, vacancy aging, tenant concentration
- **Velocity** — signing pace, turnover pace, lease-up trajectory
- **Quality** — tenure profile, renewal flag distribution, lease term mix
- **Premium** — floor premium, view premium, end-unit premium, renovated premium

### 4.3 The metric matrix

The matrix below shows what's computable. Each cell is a derived metric stored in `rent_roll_derived`.

|  | Property | Floor Plan | Floor | Tenant | Unit |
|---|---|---|---|---|---|
| **Occupancy** | physical occ, economic occ, leased %, notice % | occ by floor plan, vacancy days median by FP | occ by floor | tenure-cohort occ | binary |
| **Pricing** | avg market rent, avg effective rent, LTL, concession intensity, GPR, EGI | rent by FP, $/SF by FP, premium vs lowest FP | floor premium curve | rent by tenure | unit-level rent vs FP avg |
| **Risk** | expiration waterfall (24mo), concentration index, vacancy aging | expiration by FP, churn risk by FP | floor risk | cohort expiration concentration | days since last action |
| **Velocity** | signings/mo (TTM), move-ins/mo, move-outs/mo | signings by FP, days-to-lease by FP | – | – | – |
| **Quality** | avg tenure, lease term mix, renewal share | tenure by FP, term mix by FP | – | cohort retention | individual tenure |
| **Premium** | – | premium ladder across FPs | floor premium $/unit, $/SF | – | unit premium vs FP norm |

### 4.4 Property-level metrics (the always-on set)

These render on every Deal Capsule rent roll summary:

```ts
type PropertyMetrics = {
  // Occupancy
  unit_count_total: number,
  unit_count_occupied: number,
  unit_count_vacant_ready: number,
  unit_count_vacant_not_ready: number,
  unit_count_notice: number,
  unit_count_excluded: number,         // model, employee, courtesy, down
  physical_occupancy: number,
  economic_occupancy: number,
  leased_pct: number,                  // includes notice as leased
  
  // Pricing — base
  avg_market_rent: LayeredValue<number>,
  avg_effective_rent: LayeredValue<number>,
  avg_market_rent_psf: LayeredValue<number>,
  avg_effective_rent_psf: LayeredValue<number>,
  
  // Pricing — derived
  loss_to_lease_pct: number,            // (mkt - eff) / mkt across occupied
  loss_to_lease_dollars_monthly: number,
  concession_intensity_pct: LayeredValue<number>,  // sources: rent_roll | t12 | reconciled
  concession_source_flag: "RR" | "T12" | "RECONCILED" | "RR_T12_MISMATCH" | "IMPLIED",
  concessions_monthly_trailing: number,            // T12-authority when available
  concessions_monthly_forward: number,             // RR-authority when available
  
  // Revenue stack (RRwLC required for full breakdown)
  gpr_monthly: number,                  // gross potential rent at market
  in_place_rent_monthly: number,        // what's actually billed
  ancillary_monthly: {
    parking: number,
    pet: number,
    rubs: number,
    storage: number,
    other: number
  },
  concessions_monthly: number,
  egi_monthly_estimate: number,
  
  // Risk
  expiration_waterfall: number[24],    // units expiring per month, +24 mo
  expiration_concentration_index: number, // Herfindahl across 24 monthly buckets
  mtm_count: number,                   // true MTM, NOT extraction-failed nulls
  vacancy_aging_p50: number,           // median days vacant for vacant units
  vacancy_aging_p90: number,
  
  // Velocity
  signings_ttm: number,
  signings_per_month_ttm: number,
  signings_per_month_pytm: number,     // prior trailing 12 for YoY
  signings_yoy_change_pct: number,
  
  // Quality
  avg_tenure_months: number,
  lease_term_mix: { "6mo": number, "12mo": number, "13-15mo": number, "other": number },
  renewal_share_in_place: number       // % of in-place leases that are renewals (proxy)
}
```

### 4.5 Floor plan / unit type metrics

Per-floor-plan, the same lens applied:
```ts
type FloorPlanMetrics = {
  floor_plan_id: string,           // bs-a1
  unit_count: number,
  occupied_count: number,
  vacant_ready: number,
  vacant_not_ready: number,
  notice: number,
  
  occupancy_pct: number,
  avg_sqft: number,
  
  avg_market_rent: number,
  avg_effective_rent: number,
  avg_market_rent_psf: number,
  loss_to_lease_pct: number,
  
  premium_vs_lowest_fp_pct: number,    // vs the cheapest FP in the property
  
  expiration_curve: {                  // see §6.2 for state handling
    mtm: number,                       // true MTM only
    bucket_0_3mo: number,
    bucket_3_6mo: number,
    bucket_6_12mo: number,
    bucket_12plus: number,
    unknown: number,                   // extraction failed, the lesson learned
    extraction_status: "OK" | "PARTIAL" | "FAILED"
  },
  
  signing_velocity_ttm: number,        // signings on this FP in TTM
  days_vacant_median: number,
  concession_intensity_pct: number,    // FAILED state if concessions are T12-only (no per-FP attribution)
  
  rent_growth_yoy_pct: number,         // requires Layer 4 (diff)
  retention_rate: number               // requires Layer 4 (diff)
}
```

This is the table that backs the F6 Floor Plan Breakdown view. Every column on screen maps 1:1 to a field here, with explicit extraction_status flags.

### 4.6 Floor / building metrics

For mid-rise and high-rise assets, vertical slicing reveals view premiums and floor premiums that floor-plan averaging hides:
```ts
type FloorMetrics = {
  floor_number: number,
  unit_count: number,
  avg_effective_rent_psf: number,
  premium_vs_floor_2_psf: number,      // premium curve from a baseline floor
  occupancy_pct: number
}
```

The platform should auto-detect when floor data is rich enough to be useful (typically 4+ floors with 3+ units per floor). When useful, render a small floor-premium-curve sparkline. When not, suppress.

### 4.7 Tenant profile metrics

Group leases by signing date or tenure band:
```ts
type TenantCohortMetrics = {
  cohort: "0-6mo" | "6-12mo" | "12-24mo" | "24mo+",
  unit_count: number,
  avg_effective_rent: number,
  avg_lease_term_remaining: number,
  expiration_concentration: number     // % of cohort expiring next 6mo
}
```

This surfaces vintage effects — leases signed during the 2024 rent peak vs leases signed in the soft 2025 first half — and informs whether trade-out is recovering or compressing.

### 4.8 Risk metrics

```ts
type RiskMetrics = {
  expiration_concentration_index: number,   // 0–1, higher = riskier
  largest_monthly_expiration_pct: number,   // worst single month in next 24
  expiring_next_quarter_pct: number,
  expiring_next_6mo_pct: number,
  
  vacancy_aging: {
    under_30_days: number,
    days_30_60: number,
    days_60_90: number,
    over_90_days: number                    // chronic vacancy — tag as down units?
  },
  
  notice_concentration_pct: number,         // % of total units in notice now
  
  // Tenant concentration (commercial / mixed-use only)
  largest_tenant_pct_of_gpr: number,
  top_5_tenants_pct_of_gpr: number
}
```

### 4.9 Pricing metrics

```ts
type PricingMetrics = {
  // Position within the property
  rent_dispersion_within_fp: { p25: number, p50: number, p75: number, p90: number },
  fp_with_widest_dispersion: string,        // suggests pricing inefficiency
  
  // Concession economics
  concession_units_count: number,
  concession_avg_term_months: number,
  concession_avg_value: number,
  concession_share_of_gpr_pct: number,
  
  // Ancillary economics (RRwLC required)
  parking_attach_rate: number,              // % of units with parking charge
  pet_attach_rate: number,
  rubs_attach_rate: number,
  ancillary_pct_of_revenue: number,
  
  // Pricing efficiency
  loss_to_lease_decomp: {
    from_concessions: number,
    from_below_market_renewals: number,
    from_legacy_long_leases: number
  }
}
```

---

## 5. Layer 4 — Diff Extractor Analytics

### 5.1 Activation rules

Diff metrics activate **only** when two or more snapshots exist for the same property and they are at least 30 days apart. The framework progressively lights up metrics as more snapshots arrive:

| Snapshots | Metrics unlocked |
|---|---|
| 1 | All Layer 3 metrics |
| 2, 30+ days apart | Trade-out, true renewal rate, actual downtime, net absorption |
| 4+, spanning 12+ months | Trend detection, pricing velocity, seasonality calibration |
| 12+ monthly | Full T-07 trajectory contribution, M22 variance ground-truth |

### 5.2 Diff metrics

Each metric is computed pairwise (snapshot_n vs snapshot_n-1) and stored in `rent_roll_diffs`:

```sql
CREATE TABLE rent_roll_diffs (
  id                  UUID PRIMARY KEY,
  property_id         UUID NOT NULL,
  from_snapshot_id    UUID NOT NULL,
  to_snapshot_id      UUID NOT NULL,
  delta_days          INT NOT NULL,
  
  -- Trade-out
  units_with_trade_out  INT,
  avg_trade_out_pct     DECIMAL(5,2),
  avg_trade_out_dollars DECIMAL(10,2),
  trade_out_by_fp       JSONB,           -- per-FP breakout
  
  -- True renewal rate
  leases_expired_in_window     INT,
  leases_renewed_in_window     INT,
  renewal_rate_true            DECIMAL(5,4),
  renewal_rate_by_fp           JSONB,
  
  -- Actual downtime
  units_turned_in_window       INT,
  avg_downtime_days            DECIMAL(6,2),
  downtime_by_fp               JSONB,
  
  -- Net absorption
  move_ins                     INT,
  move_outs                    INT,
  net_absorption               INT,
  
  -- Pricing velocity (how often did mgmt change market rents)
  market_rent_changes_count    INT,
  avg_market_rent_delta_pct    DECIMAL(5,2)
);
```

### 5.3 Trend metrics (4+ snapshots)

Once you have a time series of snapshots, every Layer 3 metric becomes trendable. The framework caches:
- Slope (months of data + linear regression coefficient)
- YoY delta (snapshot_today vs snapshot_~365_days_ago)
- Volatility (std dev around trend)
- Inflection detection (changepoint in the series)

These feed M07's T-07 (Property Trajectory) signal and M22's variance tracking.

---

## 6. Layer 5 — Presentation State Machine

### 6.1 Three states per rendered metric

Every metric carries an `extraction_status` propagated from Layer 2:

| State | Meaning | Render |
|---|---|---|
| `OK` | All source fields successfully extracted, derivation complete | Normal — value with full visual treatment |
| `PARTIAL` | Some source rows missing data, derivation computed on subset | Value with hatched/striped marker, hover shows "X of Y units missing data" |
| `FAILED` | Critical source field missing on too many rows, derivation skipped | Em-dash `—` in secondary text token, hover shows root cause |

### 6.2 The UNKNOWN bucket pattern (generalize from the LTL fix)

Any metric that buckets values must include an `unknown` bucket for null/missing source data — never fold nulls into an existing bucket where they can masquerade as a real signal.

Apply universally:

| Metric | Buckets | UNKNOWN treatment |
|---|---|---|
| Lease expiration | mtm, 0-3mo, 3-6mo, 6-12mo, 12+mo | hatched grey segment, separate count |
| Vacancy aging | <30d, 30-60d, 60-90d, 90+d | hatched grey, "X units no move-out date" |
| Tenure cohort | 0-6mo, 6-12mo, 12-24mo, 24mo+ | hatched grey, "X units no lease start date" |
| Rent dispersion | quartiles | exclude from quartile calc, show count of excluded units |

When `unknown_count / occupied_count > 0.5`, the metric drops to FAILED state and renders as em-dash regardless of remaining values.

### 6.3 Field-level extraction surfacing

Beyond metric-level state, every numerical cell on the rent roll detail view should support a hover that traces back to source:

```
Avg Market Rent: $1,582
  ├ Source: rent roll snapshot 2026-Q1 ($filename$)
  ├ Extracted from: column "Mkt Rent" (auto-mapped, 0.94 confidence)
  ├ Computed across: 27 units (100% of bs-a1 floor plan)
  └ Last updated: 2026-04-15
```

This is the auditable evidence chain that lets the user dispute or trust any value, in keeping with the CashFlow Agent reasoning trail philosophy from `CASHFLOW_AGENT_UNDERWRITING_SPEC.md`.

### 6.4 Upload-time preview (recap)

The §3.3 upload-time quality screen is the first instance of Layer 5 — failure presented as failure, before commit. The same pattern applies after commit, for any metric that a downstream module asks for.

---

## 7. Cross-Module Consumption Map

This is the single most important table in this doc — it tells you which metrics need to be production-quality first because they have the most consumers.

| Metric | Consumed By | Purpose |
|---|---|---|
| `physical_occupancy` | M09 ProForma, M25 JEDI Score, M22 Post-Close | Vacancy assumption, occupancy score, variance |
| `economic_occupancy` | M09, M25 | EGI calc, operating efficiency signal |
| `loss_to_lease_pct` | M09, M25, M08 (Value-Add detection) | Upside identification, pricing inefficiency signal |
| `concession_intensity_pct` | M09, M07, M25 | EGI adjustment, traffic competitiveness, market position |
| `expiration_waterfall` | M07 (Stabilized Mode), M09, M14 Risk | Churn projection, vacancy ramp, concentration risk score |
| `signing_velocity_ttm` | M07, M22 | Calibration ground truth, post-close benchmark |
| `signings_yoy_change_pct` | M07 (T-07 Trajectory), M25 | Momentum signal |
| `renewal_rate_true` (diff) | M09, M07, M22 | Vacancy projection, churn replacement need |
| `trade_out_pct` (diff) | M09 (rent growth Y1), M25 | Realized rent growth, market position |
| `actual_downtime_days` (diff) | M07, M09 | Vacancy days assumption |
| `floor_plan.rent_growth_yoy_pct` | M09 unit-type underwriting, M03 Dev Capacity | Granular growth assumption per FP |
| `expiration_concentration_index` | M14, M25 | Risk score, JEDI Risk signal |
| `vacancy_aging_p90` | M25, M14 | Chronic vacancy = potential down-unit / structural issue |
| `tenant_cohort.expiration_concentration` | M14 | Cohort cliff risk |
| `ancillary_pct_of_revenue` | M09, M15 Comp Engine | Other Income line, peer comparison |
| `parking_attach_rate` | M09 (Other Income build), M15 | Revenue program benchmarking |

Each consumer is responsible for handling `PARTIAL` and `FAILED` states gracefully. The framework's contract: every consumed metric carries its `extraction_status`, and consumers must propagate that into their own derived outputs (a JEDI Score component computed on PARTIAL inputs is itself PARTIAL).

---

## 8. Storage Architecture

Five tables, two cache tables:

```
rent_roll_snapshots       -- one per upload
  ├── lease_events        -- one per unit per snapshot
  └── charge_lines        -- one per charge component (RRwLC)

rent_roll_quality         -- per-field extraction status per snapshot
                          -- (denormalized from lease_events.field_status for fast lookup)

rent_roll_derived         -- cached Layer 3 metrics per snapshot
                          -- recomputed on snapshot ingest, never stale

rent_roll_diffs           -- cached Layer 4 metrics per snapshot pair
                          -- recomputed on each new snapshot ingest
```

The `rent_roll_derived` and `rent_roll_diffs` tables are **append-only caches**. Recomputation on ingest is cheap (single-property scope, deterministic). Never serve stale derivations to consumers.

---

## 9. Event Flow

```
upload (S3 + DB row in rent_roll_snapshots, status=PENDING)
  ↓
parse + validate (dry run)
  ↓
quality preview UI (user accept / fix / cancel)
  ↓
on accept: commit rows to lease_events + charge_lines
  ↓
emit Kafka: rent_roll.ingested
  ↓
fan-out subscribers:
  ├ rent_roll_derivation_worker  → populate rent_roll_derived
  ├ rent_roll_diff_worker         → populate rent_roll_diffs (if 2+ snapshots)
  ├ traffic_calibration_worker    → recompute deal-specific traffic coefficients (M07)
  ├ proforma_seeder_worker        → seed M09 assumptions from new ground truth
  ├ jedi_score_recalc_worker      → recompute JEDI Score components
  ├ m22_post_close_worker         → if owned asset, update variance tracking
  └ deal_store_invalidator        → invalidate dealStore caches for this deal
```

Two additional events for state transitions:
- `rent_roll.partially_extracted` — quality verdict was PARTIAL on accept; consumers should propagate state
- `rent_roll.failed` — user cancelled after FAILED preview; nothing committed; no consumers fire

---

## 10. Build Sequence

Ordered to deliver value progressively, each session shippable.

**Session 1 — Storage + Quality Foundation (4 hrs).** Migrations for `rent_roll_quality`, `rent_roll_derived`, `rent_roll_diffs`. Add `quality_verdict`, `detection_confidence`, `detected_variant` columns to `rent_roll_snapshots`. Add `field_status` JSONB to `lease_events`.

**Session 2 — Quality Gating Layer (5 hrs).** Implement `assessQuality()` per §3.2. Wire into existing parser flow. Build dry-run mode that returns quality assessment without committing rows. Define field criticality classes per §3.1 in a versioned config table.

**Session 3 — Upload-Time Preview UI (4 hrs).** The §3.3 quality preview screen. Modal triggered after parse, before commit. Three CTAs: re-parse with different variant, manual column mapping, accept. FAILED verdict cannot be force-accepted — user must fix.

**Session 4 — Variant Detection (4 hrs).** Implement two-step PMS + variant detection per §2.1. Train RRwLC vs Standard heuristic on a labeled set of files (start with the 464 Bishop file as a positive RRwLC example). Surface confidence; below 0.85 forces user confirmation.

**Session 5 — Manual Column Mapping UI (4 hrs).** When format detector returns UNKNOWN or low-confidence, present the user with detected columns + allow them to map each to canonical fields. Save mappings as a user-specific override the parser learns from.

**Session 6 — Layer 3 Property Metrics (5 hrs).** Implement the §4.4 property-level metric set. Cache to `rent_roll_derived`. Wire derivation worker to `rent_roll.ingested` Kafka event.

**Session 6.5 — Cross-Document Reconciliation (4 hrs).** Per §3.5. Build the concession reconciliation rule first (it's the canonical case). Wire T12 parser output into the same derivation worker so concession source priority resolves at derivation time. Generalize to bad debt, other income, vacancy loss, NRI cross-checks. Each reconciled metric carries its `source_flag` and `requires_t12` metadata into Layer 5.

**Session 7 — Layer 3 Floor Plan Metrics (4 hrs).** §4.5 floor plan metrics. The F6 Floor Plan Breakdown UI consumes from this set. Apply the §6.2 UNKNOWN bucket pattern to `expiration_curve` — fixes 464 Bishop class of failure structurally.

**Session 8 — Layer 5 Presentation State (3 hrs).** OK/PARTIAL/FAILED rendering for every metric column. Hatched-fill SVG pattern for PARTIAL. Em-dash + hover for FAILED. Apply universally across F6 and any other view consuming derived metrics.

**Session 9 — Layer 4 Diff Extractors (5 hrs).** Trade-out, true renewal rate, actual downtime, net absorption. Activation logic per §5.1. Cache to `rent_roll_diffs`. Wire to second-snapshot ingest.

**Session 10 — Cross-Module Wiring (6 hrs).** Per §7 consumption map. Wire `rent_roll_derived` into M09 ProForma seeder, M07 traffic calibration, M25 JEDI Score, M22 Post-Close variance. Each consumer reads `extraction_status` and propagates state.

**Session 11 — Risk + Pricing Metrics (4 hrs).** §4.8 and §4.9. These are second-order analytics that depend on Sessions 6–7 being live. Drive M14 Risk and M25 Position score.

**Session 12 — Tenant Cohort + Floor Premium (3 hrs).** §4.6 and §4.7. Lower priority; light up when 4+ floors detected or sufficient lease vintage spread.

**Session 13 — Field-Level Source Tracing UI (3 hrs).** §6.3 hover-to-source on every numerical cell. The auditable evidence chain.

---

## 11. The Failure Mode This Framework Eliminates

The 464 Bishop case — where a Yardi RRwLC export was parsed by the standard parser, lost rent and expiration data silently, and surfaced as a clean-looking floor plan table with $0 rents and a 100% MTM expiration bar — is structurally impossible under this framework:

1. **Variant detection** would flag confidence < 0.85 and surface a "Detected as Yardi STANDARD — confirm or re-parse as RRwLC?" prompt before any parsing commits.
2. **Quality gating** would catch `market_rent missing on 100% of occupied units` as Class B failure → FAILED verdict → blocking upload-time preview.
3. **The user would be in the right cognitive context** (file open, export options remembered) to either re-parse with a different variant or re-export with charge details, immediately.
4. **The UNKNOWN bucket pattern** would prevent the 100% MTM bar even if some path led to commit — null expiration dates become visually distinct hatched segments, never solid red.
5. **The Layer 5 rendering rules** would show em-dashes on every rent column, with hovers explaining "rent column not mapped from this file format," rather than a clean $0 that looks like a real number.

Five independent guards, any one of which catches the failure. The framework wins by defense in depth.

---

## 12. Open Questions / Future Extensions

- **Lease-charge audit trail.** When charge codes change between snapshots (e.g., RUBS bills shift mid-year), how should we attribute the change — operational decision, billing reset, parser inconsistency? Likely needs a Layer 4 charge-code-diff metric.
- **Multi-property portfolios.** When a user uploads a portfolio rent roll spanning 5 properties, how do we shard into 5 snapshots cleanly? Property identifier detection logic needs spec.
- **Schema drift over time.** As Yardi/RealPage update their export formats, parsers will drift. Need a scheduled job that re-runs detection on a sample of recent uploads and flags drift in detection confidence.
- **Tenant ledger uploads.** Some operators have a separate "tenant ledger" that includes payment history and delinquency. This is adjacent to rent roll but not the same — likely a sibling framework, not an extension of this one.