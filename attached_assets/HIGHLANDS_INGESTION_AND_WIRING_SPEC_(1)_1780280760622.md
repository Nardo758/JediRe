# Highlands at Sweetwater Creek — Operator Data Ingestion & Engine Wiring Spec

**Asset:** Highlands at Sweetwater Creek (property code `p2122`)
**Ownership entity:** MAG HIGHLANDS JV, LLC (per JV Agreement, Effective Date 2021‑06‑28)
**Units:** 290 · **Square feet:** 268,420 · **Manager:** Bell Partners Inc.
**Classification assumption:** OWNED / CO‑INVESTED → financials treated as **actuals** (M22). If Highlands is a comp/underwriting target rather than a held asset, set `asset_class = 'comp'` and route financials to observed‑comp tables, NOT `deal_monthly_actuals`. Everything else in this spec is unchanged.

This spec is a direct implementation contract for a Replit / Claude Code agent. It maps three operator exports (six tabs) to normalized tables and wires each into the existing engines. It is spec‑first and file:tab:cell‑grounded. No PRs unless requested; develop on a designated branch, commit, push.

---

## 0. Why this asset matters (routing rationale)

The financial package is the easy win: clean monthly P&L→NOI → `deal_monthly_actuals` as a 4th tracked asset alongside Frisco / McKinney / Duluth.

The **strategic** win is the **Weekly tab**: a weekly funnel + occupancy series from 2021‑07 (occ ≈ 83%) climbing to stabilized (≈ 93%). This is a genuine **lease‑up → stabilization trajectory** — the data the existing portfolio lacks entirely (Frisco/McKinney/Duluth are all observed at 94–95% stabilized with no lease‑up curve). It is the first asset capable of populating the `historical_observations` stabilization columns that currently hold **0 rows** and block Correlation Phase 1B. Do not flatten it into a monthly table.

**Two grains, two destinations:**
- Monthly financials → `deal_monthly_actuals` (M22).
- Weekly leasing/traffic + per‑lease trade‑outs → granular staging → M07 Traffic Baseline, Lease Velocity, and a weekly→monthly rollup into `historical_observations`.

---

## 1. Source inventory

| File | Tab | State | Rows | Grain | Period | Use |
|---|---|---|---|---|---|---|
| `Highlands_Weekly_Reports_05_26_26.xlsx` | `Weekly` | visible | 278 (data to last non‑error row) | weekly | 2021‑07‑13 → present | Traffic funnel + occupancy time series |
| ″ | `Renewal & Trade Out` | visible | 1519 data rows | per‑lease | 2020‑11‑20 → 2026‑05‑23 | New/renewal trade‑out, rent change |
| ″ | `New lease trade out` | **hidden** | 41 | per‑lease | 2020 | **STALE — EXCLUDE** (see §6) |
| `ResAnalytics_Rent_Roll_with_Lease_Charges_p2122_p21220426.xlsx` | `Report1` | visible | 2107 | per‑unit (multi‑row) | as‑of 2026‑04‑30 | Current rent roll + charge codes |
| `BPI_Financial_Package_p2122_Accrual_GAAP_p21220426.xlsx` | `budget comparison` | visible | ~140 account rows | monthly + YTD | period ending 2026‑04‑30 | Current month, budget variance, KPIs |
| ″ | `13 month rolling` | visible | ~2004 account rows | monthly ×13 | Apr 2025 → Apr 2026 | Monthly financial time series |

Books basis: **Accrual^GAAP**. All amounts USD.

---

## 2. Target schema (DDL)

Drizzle/PostgreSQL. New tables prefixed to avoid collision; reuse `deal_monthly_actuals` and `historical_observations` if present.

```sql
-- 2.1 Weekly leasing funnel + occupancy (NEW) — feeds M07 Baseline + Correlation
CREATE TABLE leasing_weekly_observations (
  id              BIGSERIAL PRIMARY KEY,
  property_code   TEXT NOT NULL,              -- 'p2122'
  week_ending     DATE NOT NULL,
  total_units     INT,
  traffic         INT,                        -- prospect traffic
  tours_inperson  INT,
  apps            INT,
  cancellations   INT,
  denials         INT,
  net_leases      INT,                        -- can be negative
  closing_ratio   NUMERIC(6,4),               -- net_leases / traffic; null when traffic=0
  beg_occ_units   INT,
  move_ins        INT,
  move_outs       INT,
  transfers       INT,
  end_occ_units   INT,
  notice_rented   INT,
  notice_unrented INT,
  total_notice    INT,
  occ_pct         NUMERIC(6,4),               -- physical occupancy, normalized 0..1
  leased_pct      NUMERIC(6,4),               -- normalized 0..1
  avail_pct       NUMERIC(6,4),               -- normalized 0..1
  avg_market_rent NUMERIC(12,2),
  gross_market_rent NUMERIC(14,2),
  gross_rent_psf  NUMERIC(8,4),
  effective_rent  NUMERIC(12,2),
  effective_rent_psf NUMERIC(8,4),
  source_file     TEXT,
  ingested_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (property_code, week_ending)
);

-- 2.2 Per-lease trade-out events (NEW) — feeds Lease Velocity + concession engine
CREATE TABLE lease_tradeout_events (
  id                  BIGSERIAL PRIMARY KEY,
  property_code       TEXT NOT NULL,
  unit                TEXT NOT NULL,
  unit_type           TEXT,
  sqft                INT,
  event_type          TEXT NOT NULL,          -- 'new' | 'renewal' (trimmed/lowercased)
  lease_start_date    DATE NOT NULL,          -- = signing-date proxy (architectural invariant)
  market_rent_at_exec NUMERIC(12,2),
  prior_rent          NUMERIC(12,2),          -- prior LER
  new_rent            NUMERIC(12,2),          -- new LER
  tradeout_delta      NUMERIC(12,2),          -- new_rent - prior_rent
  tradeout_pct        NUMERIC(8,4),           -- delta / prior_rent
  loss_to_lease       NUMERIC(12,2),          -- new_rent - market_rent_at_exec (neg = below market)
  prior_rent_psf      NUMERIC(8,4),
  new_rent_psf        NUMERIC(8,4),
  source_file         TEXT,
  ingested_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (property_code, unit, lease_start_date, event_type)
);

-- 2.3 Rent roll snapshot — per-unit header (NEW)
CREATE TABLE rent_roll_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  property_code   TEXT NOT NULL,
  as_of_date      DATE NOT NULL,
  unit            TEXT NOT NULL,
  unit_type       TEXT,
  unit_sqft       INT,
  resident_id     TEXT,                       -- 'VACANT' when empty
  resident_name   TEXT,
  market_rent     NUMERIC(12,2),
  resident_deposit NUMERIC(12,2),
  other_deposit   NUMERIC(12,2),
  move_in_date    DATE,
  lease_expiration DATE,
  move_out_date   DATE,
  balance         NUMERIC(12,2),
  total_charges   NUMERIC(12,2),              -- sum of charge lines
  status          TEXT,                       -- 'current' | 'notice' | 'vacant'
  source_file     TEXT,
  UNIQUE (property_code, as_of_date, unit)
);

-- 2.4 Rent roll charge lines — one row per charge code per unit (NEW)
CREATE TABLE rent_roll_charges (
  id              BIGSERIAL PRIMARY KEY,
  snapshot_id     BIGINT REFERENCES rent_roll_snapshots(id) ON DELETE CASCADE,
  charge_code     TEXT NOT NULL,              -- rent, trash, pest, w/d, conc/mis, petrent, parking, ...
  amount          NUMERIC(12,2)
);

-- 2.5 Monthly financial actuals → REUSE deal_monthly_actuals (M22).
--     Add Highlands as an asset; load 13 months from '13 month rolling'.
--     If account-line granularity is not yet modeled there, add a child table:
CREATE TABLE deal_monthly_actuals_lines (
  id              BIGSERIAL PRIMARY KEY,
  property_code   TEXT NOT NULL,
  period_month    DATE NOT NULL,              -- first of month
  account_label   TEXT NOT NULL,              -- 'Gross Potential Rent', 'NOI', ...
  gl_range        TEXT,                        -- e.g. '43000000..43199999'
  amount          NUMERIC(16,2),
  books           TEXT DEFAULT 'Accrual^GAAP',
  source_file     TEXT,
  UNIQUE (property_code, period_month, account_label)
);
```

---

## 3. Source → target field maps

### 3.1 `Weekly` tab → `leasing_weekly_observations`

Header is two rows: group labels row 1, field labels row 2. Data starts **row 3**.

| Col | Row‑2 label | Target field | Transform |
|---|---|---|---|
| A | Week Ending | `week_ending` | date |
| B | Total Units | `total_units` | int |
| C | Traffic | `traffic` | int |
| D | In‑Person Tours | `tours_inperson` | int |
| E | Apps | `apps` | int |
| F | Canc. | `cancellations` | int |
| G | Deny | `denials` | int |
| H | Net Leases | `net_leases` | int (allow negative) |
| I | Closing Ratio % | `closing_ratio` | if `#DIV/0!` or traffic=0 → NULL; else as‑is |
| J | Beg Occ # | `beg_occ_units` | int |
| K | Move Ins | `move_ins` | int |
| L | Move Outs | `move_outs` | int |
| M | Transfers | `transfers` | int |
| N | End Occ # | `end_occ_units` | int |
| P | Rented (notice) | `notice_rented` | int |
| Q | Unrented | `notice_unrented` | int |
| U | Total Notice | `total_notice` | int |
| Y | Occ | `occ_pct` | **normalize** (see §6.2) |
| Z | Leased | `leased_pct` | **normalize** |
| AA | Avail | `avail_pct` | **normalize** |
| AB | Avg Mkt Rent | `avg_market_rent` | numeric |
| AC | Gross Market Rent | `gross_market_rent` | numeric |
| AD | Gross Rent PSF | `gross_rent_psf` | numeric |
| AE | Effective Rent | `effective_rent` | numeric |
| AF | Effective Rent PSF | `effective_rent_psf` | numeric |

(Cols O = "Model Unit" flag, R/S/T = notice sub‑breakdown, V/W/X = notice by bedroom — ingest into a JSON `extras` column if you want full fidelity; not required for engine feeds.)

**Row cutoff:** stop at the last row where `traffic IS NOT NULL OR end_occ_units changes`. Trailing rows (dates into late 2026) are pre‑filled formula rows showing `#DIV/0!` with frozen occupancy — DROP them.

### 3.2 `Renewal & Trade Out` tab → `lease_tradeout_events`

Header row 1, data from **row 2**.

| Col | Label | Target | Transform |
|---|---|---|---|
| A | Unit | `unit` | text |
| B | Unit Type | `unit_type` | text |
| C | SqFt | `sqft` | int |
| D | Renewal/Trade Out | `event_type` | **trim + lowercase**; `'New'/'New '` → `new`, `'Renewal'/'Renewal '` → `renewal` |
| E | Lease Start Dates | `lease_start_date` | date (= signing proxy) |
| F | Market Rent at Lease Execution | `market_rent_at_exec` | numeric |
| G | Prior Rent LER | `prior_rent` | numeric |
| H | New LER | `new_rent` | numeric |
| I | Prior Rent LER SqFt | `prior_rent_psf` | numeric |
| K | Renewed LER SqFt | `new_rent_psf` | numeric |

Derived: `tradeout_delta = new_rent - prior_rent`; `tradeout_pct = tradeout_delta / NULLIF(prior_rent,0)`; `loss_to_lease = new_rent - market_rent_at_exec`. (Col J `$/mo` and L `$ psf/mo` in the sheet are pre‑computed renewal deltas — recompute server‑side; do not trust the sheet's zeros on `new` rows.)

### 3.3 `Report1` (rent roll) → `rent_roll_snapshots` + `rent_roll_charges`

Multi‑row‑per‑unit. `as_of_date` = 2026‑04‑30 (parse from A3 `"As Of = 04/30/2026"`). Header at rows 5–6; data from **row 8**.

Parser logic (grouped):
1. A unit **header row** has a value in col A that is a unit number (numeric‑ish) and a value in col B (unit type). Capture: A=`unit`, B=`unit_type`, C=`unit_sqft`, D=`resident_id` (`'VACANT'` → status `vacant`), E=`resident_name`, F=`market_rent`, G/H = first charge line, I=`resident_deposit`, J=`other_deposit`, K=`move_in_date`, L=`lease_expiration`, M=`move_out_date`, N=`balance`.
2. **Charge rows** follow: col G = `charge_code`, col H = `amount`, until a row where G=`'Total'` (H = `total_charges` for that unit).
3. Section header rows ("Current/Notice/Vacant Residents", row 7) are skipped. `status`: vacant if resident_id='VACANT', else notice if move_out_date present, else current.
4. **Charge‑code summary block** (rows ~2090–2107, "Summary of Charges by Charge Code"): parse into a separate `rent_roll_charge_summary` keyed by as_of_date for a reconciliation check — total should tie to `461,011.00` (row 2107). Use as an ingestion QA gate, not a primary feed.

### 3.4 `13 month rolling` → `deal_monthly_actuals_lines` (+ roll up to `deal_monthly_actuals`)

Month columns mapped from header **row 15**: C=Apr 2025, D=May 2025, E=Jun 2025, F=Jul 2025, G=Aug 2025, H=Sep 2025, I=Oct 2025, J=Nov 2025, K=Dec 2025, L=Jan 2026, M=Feb 2026, N=Mar 2026, **O=Apr 2026**. Col Q = "Total" (skip — recompute). Account label = col B; GL range = col A. Data account rows begin ~row 20.

For each account row × each month column: insert `(p2122, period_month, account_label, gl_range, amount)`. Then populate the parent `deal_monthly_actuals` row per month from the canonical lines:
- `gross_potential_rent` ← "Gross Potential Rent"
- `concessions`, `vacancy_loss`, `other_rent_losses`
- `total_rental_income`, `total_other_income`, `total_income`
- `total_controllable_expenses`, `total_non_controllable_expenses`, `total_operating_expenses`
- **`noi`** ← "Net Operating Income (NOI)" (rolling tab row 73)
- `net_income`

### 3.5 `budget comparison` → current‑month enrichment

Same account taxonomy, single current month (Apr 2026) + budget + PY + YTD. Use to populate **budget variance** fields on the current month's `deal_monthly_actuals` row (cols: C Actual, D Budget, E $Var, F %Var, G Same‑Mo‑PY, K/L YTD Actual/Budget, S Annual Budget). Also load the **Performance Statistics** block (rows 105–123: Effective Rent/Unit, Financial & Economic Occupancy, Controllable Expense Ratio, Operating Margin, recovery rates) into a `deal_kpi_snapshots` table or JSON column for M22 dashboards. These are pre‑computed — store, don't recompute.

---

## 4. Engine wiring

### 4.1 M07 Traffic Engine — Baseline layer
`leasing_weekly_observations` → M07 single‑snapshot extractor. Per the existing invariant (lease start = signing proxy), weekly traffic/tours/apps/closing‑ratio/net‑leases produce Traffic **Baseline** values immediately on ingestion. Aggregate weekly → monthly for the Baseline; the Platform and Deal layers continue to override per the three‑layer Bayesian resolution. No new event channel — Traffic stays M07‑routed.

### 4.2 Lease Velocity Engine
`lease_tradeout_events` → Lease Velocity. Highlands is a **STABILIZED_MAINTENANCE** asset today, but its full history covers **LEASE_UP_NEW_CONSTRUCTION** (the 2021 ramp visible in the Weekly occupancy climb). Feed both: trade‑out deltas (`renewal`) drive stabilized rent‑growth velocity; `new` trade‑outs drive new‑lease pricing velocity. Pair with the concession signal from rent‑roll `conc/mis` charge code and Weekly `Concessions`‑adjacent fields → Concession Environment Sub‑Engine.

### 4.3 Correlation Engine — Phase 1B unblock (the strategic feed)
Roll `leasing_weekly_observations` up to a monthly occupancy/leased trajectory and write the lease‑up→stabilization curve into the **`historical_observations` stabilization columns** that are currently empty (0 rows = Phase 1B blocker). This converts "what is the market doing" (COR‑01..30 on market snapshots) toward the NEW stabilization‑outcome capability: Highlands gives one full observed lease‑up‑to‑stabilization outcome with weekly resolution. Note in the calibration ledger (M38) that this is n=1 — directional, not yet a fitted prior.

### 4.4 M22 Post‑Close Intelligence
`deal_monthly_actuals` (+ `_lines`) → M22 upload flow, comp engine, proforma comparison. Highlands becomes the 4th asset and the only one with both lease‑up trajectory and stabilized actuals, enabling a proforma‑vs‑actual comparison across the full hold.

### 4.5 Rent roll → forward pipeline
`rent_roll_snapshots.lease_expiration` → forward renewal/expiration schedule (Forward Supply WS‑3 input candidate); `unit_type` distribution → unit‑mix; in‑place `total_charges` minus `rent` → ancillary/other‑income build‑up.

---

## 5. Ingestion sequence

1. Parse `13 month rolling` → `deal_monthly_actuals_lines` → roll up `deal_monthly_actuals` (13 months). **QA gate:** NOI per month must reconcile to rolling‑tab row 73.
2. Parse `budget comparison` → current‑month variance fields + `deal_kpi_snapshots`.
3. Parse `Weekly` (with row cutoff + occupancy normalization) → `leasing_weekly_observations`. **QA gate:** `end_occ_units` continuity (each week's beg = prior week's end ± transfers).
4. Roll weekly → monthly trajectory → `historical_observations` stabilization columns.
5. Parse `Renewal & Trade Out` (trim event_type) → `lease_tradeout_events`. **QA gate:** event_type ∈ {new, renewal} after trim; expect ~943 new / ~570 renewal.
6. Parse `Report1` rent roll (grouped) → `rent_roll_snapshots` + `rent_roll_charges`. **QA gate:** charge total ties to summary block (461,011.00).
7. Skip hidden `New lease trade out` (see §6.1).

Idempotency: all tables carry natural unique keys; use upsert on `(property_code, …)`.

---

## 6. Data‑quality gates & known issues

**6.1 Hidden tab is stale — EXCLUDE.** `New lease trade out` is for a **different property** ("Solis Keltonwood at Berewick", O1) with 2020 dates and manual reviewer annotations ("You have these rents inverted…"). It is leftover template content, not Highlands. Do not ingest. Add an explicit guard so a future re‑save that un‑hides it can't leak in: skip any tab whose property header ≠ Highlands/p2122.

**6.2 Weekly occupancy columns use mixed encoding.** Cols Y/Z/AA are mostly fractional (e.g. `0.8344`) but some rows carry whole‑number percentages (`97.6`, `98.6`) and small whole numbers (`1.4`, `2.42`). Normalize: `pct = v/100 if abs(v) > 1.5 else v`. Validate result ∈ [0, 1.05]; log out‑of‑range. Recompute `closing_ratio` and occupancy server‑side where a clean denominator exists rather than trusting the cell.

**6.3 Trailing formula rows in Weekly.** Rows past the last real week are pre‑populated with `#DIV/0!` and a frozen occupancy. Detect by `traffic IS NULL AND closing_ratio == '#DIV/0!'` and stop ingestion at that boundary.

**6.4 Trailing‑space variants in event_type.** Raw distinct values: `New` (943), `Renewal` (570), `New ` (3), `Renewal ` (2). Always `TRIM()`.

**6.5 Renewal sheet pre‑computed deltas unreliable on new rows.** Cols J/L are 0 on `new` rows. Recompute all deltas/PSF server‑side from F/G/H/C.

**6.6 Books basis.** All financials are `Accrual^GAAP`. Tag every financial row with `books` so a future Cash‑basis package can't silently merge.

---

## 7. Open questions for Leon (do not block ingestion)

1. **Ownership classification** — confirm Highlands is owned/co‑invested (→ `deal_monthly_actuals`) vs comp (→ observed‑comp tables). Spec assumes owned.
2. **Weekly history depth** — the Weekly tab starts 2021‑07 but Renewal trade‑outs start 2020‑11. Confirm 2021‑07 is the true ops start for traffic (pre‑opening period may simply lack a funnel).
3. **`historical_observations` schema** — confirm the exact stabilization columns to write (per `HISTORICAL_OBSERVATIONS_SPEC.md`); §4.3 assumes occupancy/leased monthly trajectory + a stabilization‑reached flag.
4. **Refresh cadence** — these are weekly/monthly operator exports. Decide a standing ingestion path (watch folder / upload endpoint) vs one‑time backfill.
