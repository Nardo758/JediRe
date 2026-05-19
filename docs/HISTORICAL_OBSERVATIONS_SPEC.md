# Historical Observations — Empirical Calibration Substrate Spec

**Status:** Draft architecture spec — implementation contract for sequenced build sessions
**Owner:** Leon / JEDI RE
**Pairs with:** `DEAL_JOURNEY_FRAMEWORK.md`, `TRAFFIC_ENGINE_STATE_AUDIT.md`, `Causal_Discipline_Addendum.md`, `ROADMAP_M36_M38.md`, `M09_PROFORMA_SPEC.md`, M22 Post-Close pipeline spec (forthcoming)
**Window covered:** 2018 → present, with full multi-signal coverage from 2020 forward

---

## 1. Purpose

The platform's predictive infrastructure (M07 traffic, M09 ProForma, M35 events, M14 risk, M25 JEDI score) currently runs on **synthetic priors** — BASELINE_COEFFICIENTS chosen heuristically, M35 playbooks seeded from external research (BLS QCEW, NBER, CoStar publications), Bayesian update rules that fold in subject-specific evidence but anchor against literature-derived means.

This spec defines the **empirical calibration substrate** that replaces synthetic priors with observed reality. The substrate is a platform-wide `historical_observations` corpus stacking inputs (mobility, events, MSA macro, submarket micro, property performance) against outputs (rent change, occupancy change, concession change, signing velocity, cap rate movement) at common geography × time keys. Consuming modules read from the corpus to derive their coefficients empirically rather than reading from hand-set constants.

The spec also defines the **reminder prompt** that surfaces data gaps to operators — without consistent uploads of property performance data, the corpus has holes and the empirical fit degrades.

### 1.1 What this spec covers vs. what lives elsewhere

This spec is the **historical / empirical** infrastructure: rows in the corpus represent things that *happened*, and consuming modules use them to derive better priors going forward. Three adjacent concerns live in different specs and are explicitly NOT in this one:

| Concern | Lives in |
|---|---|
| **M07 traffic predictions flowing to downstream modules (M09 / M25 / M08 / M14)** at runtime | `TRAFFIC_ENGINE_STATE_AUDIT.md` §11 Fix #4 (orphaned bridge wiring); audit's TE-04/05/06/07 findings |
| **Per-deal prediction-realization pairing** (the predictions ledger that M38 reliability depends on) | Future M38 spec |
| **Live M07 calibration cron + Kafka subscriber** | `TRAFFIC_ENGINE_STATE_AUDIT.md` §11 Fix #1, #2 (FIX-1, FIX-2) |
| **Real-time event impact pushed to assumptions** | Event Propagation Audit (#715) Phase 1 fixes |

The corpus stores observed mobility and observed signing velocity. It does NOT generate traffic predictions, nor does it route M07's predicted outputs to downstream modules. Those are the audit's territory. What the corpus *does* enable is **validation**: M07 emits a prediction for property X at time T; the corpus eventually carries the realized signing velocity at property X at T+12; M38's pairing service joins them and computes accuracy. The corpus is the realization side of the pairing.

When the Traffic Engine State Audit's FIX-4 lands, M07 outputs flow to M09 ProForma / M25 JEDI / M08 Strategy / M14 Risk at deal evaluation time. When this spec's Phase 4 ingestion lands, those same M07 outputs become part of the historical record for empirical refitting. The two work streams are complementary — current-state flow (audit) plus historical accumulation (this spec) — not duplicative.

### 1.2 M38 reliability — documented constraint

M38 (Calibration Ledger) pairs platform predictions against realized outcomes to compute per-stratum reliability. The corpus carries the realized side; M38 (when built) provides the prediction side via a predictions_ledger table.

**Operational constraint:** M38 reliability statistics require predictions the platform actually emitted, paired against realized outcomes for those same deals. For a deal Leon has data access on but the platform never underwrote, the realized rows exist in the corpus but no paired predictions exist. Such deals contribute to **empirical pattern fitting** (M35 playbook re-derivation, M07 BASELINE_COEFFICIENTS empirical calibration, M36 Σ Phase B) — all of which work on observed input-output pairs without requiring a prediction record — but they do NOT contribute to M38 reliability stats.

In practice, until the platform underwrites a deal and that deal completes a realization window (T+12 or T+24), M38 has no paired data to compute reliability over. The empirical refit chapter (Section 10) ships meaningfully on existing corpus rows alone. M38 waits for an underwritten-and-held cycle.

This is a documented design constraint, not a flaw. The corpus accumulates empirically grounded patterns from day one. M38 reliability comes online incrementally as the platform's underwriting activity creates predictions whose realization windows eventually close.

---

## 2. The Empirical Thesis

Today the platform predicts a 300-unit `multifamily_delivery` will lift vacancy by +1.2pp at T+12mo with confidence 0.65. That number came from a literature aggregation; it's a prior. Across N historical deliveries in the platform's actual coverage area, the realized vacancy change was *some empirical distribution* — possibly with very different median, possibly with asymmetric tails, possibly with regime dependencies (worse during 2022 surge, better during 2024 normalization).

With a historical_observations corpus stacking inputs and outputs at common time × geography keys, the empirical distribution becomes computable. Every M35 playbook entry, every M07 coefficient, every M36 covariance term can be re-derived from observation rather than carried from literature.

**The thesis in one line:** the platform should learn its response functions from data, not import them from research.

**What changes for the user:** predictions land with empirically-grounded confidence intervals rather than literature-derived ones. When the platform says "rent growth Y1 projected at 4.2% ± 1.1pp," the ± comes from observed variance across analog markets and time periods, not from a synthetic halfSpread.

**What changes for the platform:** M35 playbooks become learnable rather than seeded. M07's BASELINE_COEFFICIENTS become regime-conditional. M36's Σ becomes empirical. M37's analog distances become evidence-weighted. M38's reliability becomes meaningful because there's an actual prediction-realization pairing to compute reliability against.

---

## 3. The Corpus Shape

The core table:

```sql
CREATE TABLE historical_observations (
  -- Primary key
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geography (sparse — at least one must be present)
  msa_id                      VARCHAR(20),                -- e.g., 'MSA_12060' Atlanta
  submarket_id                VARCHAR(40),                -- e.g., 'ATL_midtown'
  parcel_id                   VARCHAR(80),                -- when row is property-specific
  latitude                    NUMERIC(10,7),              -- when row is point-specific
  longitude                   NUMERIC(10,7),
  geography_level             VARCHAR(20) NOT NULL,       -- msa | submarket | parcel | point

  -- Time
  observation_date            DATE NOT NULL,              -- the month being observed (use 1st of month)
  observation_window          VARCHAR(20) NOT NULL,       -- monthly | quarterly | annual

  -- ─── INPUTS (the X's) ──────────────────────────────────────────────────────

  -- Mobility (LODES / Veraset / Placer / Advan)
  commute_shed_workers        INTEGER,                    -- LODES workers in 10mi radius
  commute_shed_wage_pct       NUMERIC(6,4),               -- LODES wage-weighted vs MSA median
  mobility_visits_monthly     INTEGER,                    -- Veraset / Placer visit count
  mobility_unique_visitors    INTEGER,
  mobility_visits_psf         NUMERIC(8,4),               -- normalized for venue size

  -- Events (key_events table — denormalized for corpus convenience)
  active_event_count          INTEGER,                    -- M35 events active in window
  event_employer_jobs_added   INTEGER,
  event_employer_jobs_lost    INTEGER,
  event_supply_units_delivered INTEGER,
  event_supply_units_announced INTEGER,
  event_subtypes              TEXT[],                     -- which subtypes were active

  -- MSA macro
  msa_employment_total        INTEGER,                    -- QCEW total employment
  msa_employment_growth_yoy   NUMERIC(6,4),
  msa_avg_wage                NUMERIC(10,2),              -- QCEW average wage
  msa_wage_growth_yoy         NUMERIC(6,4),
  msa_unemployment_rate       NUMERIC(5,3),               -- BLS
  msa_population              INTEGER,                    -- Census
  msa_household_growth_yoy    NUMERIC(6,4),
  msa_in_migration_net        INTEGER,
  msa_treasury_10y            NUMERIC(6,4),               -- FRED
  msa_fed_funds_rate          NUMERIC(6,4),

  -- Submarket
  submarket_avg_asking_rent   NUMERIC(10,2),
  submarket_avg_effective_rent NUMERIC(10,2),
  submarket_vacancy_rate      NUMERIC(5,3),
  submarket_concession_pct    NUMERIC(5,3),
  submarket_under_construction INTEGER,
  submarket_pipeline_units_24mo INTEGER,
  submarket_class_a_share     NUMERIC(5,3),

  -- Property state (when geography_level = parcel)
  property_occupancy          NUMERIC(5,3),
  property_avg_rent           NUMERIC(10,2),
  property_concession_per_unit NUMERIC(10,2),
  property_unit_count         INTEGER,
  property_year_built         INTEGER,
  property_class              VARCHAR(2),                 -- 'A' | 'B' | 'C'
  property_asking_rent        NUMERIC(10,2),              -- when comp data available without effective
  property_signing_velocity   NUMERIC(8,3),               -- units/month, when leasing data present

  -- Capital events (sparse — only populated for months events occurred)
  capital_event_type          TEXT,                       -- refi | partial_disp | major_capex | acquisition | renovation
  capital_event_amount        NUMERIC(14,2),
  capital_event_metadata      JSONB,                      -- structured details per event type

  -- CoStar / market survey overlays (parallel to apartment_market_snapshots, possibly higher fidelity)
  costar_submarket_rent       NUMERIC(10,2),
  costar_submarket_vacancy    NUMERIC(5,3),
  costar_submarket_absorption INTEGER,
  costar_submarket_concession_pct NUMERIC(5,3),
  costar_submarket_new_supply INTEGER,
  market_survey_source        VARCHAR(40),                -- 'berkadia' | 'jll' | 'cbre' | 'mm' | 'yardi_matrix' | ...
  market_survey_snapshot      JSONB,                      -- raw survey field/values as published

  -- ─── OUTPUTS (the Y's) — realized changes ────────────────────────────────

  -- These are the response variables — measured changes from this row's
  -- observation_date forward to T+window.

  realized_rent_change_t3     NUMERIC(6,4),               -- rent change over next 3 months
  realized_rent_change_t12    NUMERIC(6,4),
  realized_rent_change_t24    NUMERIC(6,4),
  realized_occupancy_change_t3 NUMERIC(5,3),              -- pp change
  realized_occupancy_change_t12 NUMERIC(5,3),
  realized_concession_change_t12 NUMERIC(5,3),
  realized_signing_velocity_t3 NUMERIC(8,3),              -- units/month
  realized_signing_velocity_t12 NUMERIC(8,3),
  realized_cap_rate_change_t12_bps INTEGER,
  realized_cap_rate_change_t24_bps INTEGER,
  realized_walkins_psf_t12    NUMERIC(8,4),               -- (when mobility data present at T+12)

  -- ─── METADATA ────────────────────────────────────────────────────────────

  source_signals              TEXT[] NOT NULL,            -- which sources contributed
  signal_freshness_days       JSONB,                      -- per-signal staleness at obs date
  is_subject_property         BOOLEAN DEFAULT FALSE,      -- TRUE for the labeled core
  data_quality_tier           VARCHAR(20),                -- see §4.3 tier taxonomy
  realization_complete        BOOLEAN DEFAULT FALSE,      -- TRUE once all output windows closed
  realization_complete_date   DATE,
  data_quality_flags          TEXT[],                     -- known issues with this row
  created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Indexes
  UNIQUE (geography_level, COALESCE(parcel_id, submarket_id, msa_id), observation_date, observation_window)
);

CREATE INDEX idx_hist_obs_msa_date ON historical_observations(msa_id, observation_date);
CREATE INDEX idx_hist_obs_submarket_date ON historical_observations(submarket_id, observation_date);
CREATE INDEX idx_hist_obs_parcel_date ON historical_observations(parcel_id, observation_date);
CREATE INDEX idx_hist_obs_subject ON historical_observations(is_subject_property, observation_date)
  WHERE is_subject_property = TRUE;
CREATE INDEX idx_hist_obs_realization ON historical_observations(realization_complete, observation_date)
  WHERE realization_complete = TRUE;
```

**Key design decisions:**

- **One row = one geography-time observation.** A 2022-Q3 observation for ATL_midtown submarket is one row. A 2022-09 monthly observation for a specific parcel is another row. They coexist because they answer different questions; consuming modules query by geography_level.
- **Sparse columns are expected.** Not every signal exists at every geography × time. NULL is acceptable and meaningful. `source_signals` tracks what actually populated the row.
- **Outputs are forward-looking from the observation date.** A row dated 2022-09 carries realized_rent_change_t12 = the actual rent change from 2022-09 to 2023-09 at the same geography. This makes the row directly usable for supervised learning: given the inputs as of 2022-09, predict the outputs by 2023-09; compare to realized.
- **`realization_complete` flag.** Rows from 24+ months ago have all output windows closed. Rows from the past 12 months have partial closure. Rows from the past 3 months have no closure. Consuming modules filter on this for training-grade vs. recent rows.

---

## 4. Data Taxonomy

The inputs and outputs catalogued at the level the corpus operates on.

### 4.1 Inputs

| Category | Specific signal | Source | Cadence | Geography | Back-data |
|---|---|---|---|---|---|
| **Mobility** | Commute-shed workers | LODES | annual | block / tract / MSA | 2002+ |
| | Commute-shed wages | LODES + QCEW | annual + quarterly | block / county | 2002+ / 1990+ |
| | Daily/monthly visits | Veraset | daily | POI | (vendor-dependent) |
| | Address visits | Placer / Advan | daily | POI | (vendor-dependent) |
| **Events** | Employer move/expansion | M35 key_events | as posted | point + MSA | platform-internal |
| | Supply delivery / announcement | M35 key_events | as posted | submarket | platform-internal |
| | Transit opening | M35 key_events | as posted | submarket | platform-internal |
| | Other M35 subtypes | M35 key_events | as posted | submarket | platform-internal |
| **MSA macro** | Employment / wages | BLS QCEW | quarterly | county / MSA | 1990+ |
| | Unemployment | BLS LAUS | monthly | MSA | 1990+ |
| | Population / households | Census ACS | annual | tract / MSA | 2000+ |
| | Treasury / Fed funds | FRED | daily | national | 1953+ |
| **Submarket** | Asking + effective rent | apartment_market_snapshots | monthly | submarket | platform-internal |
| | Vacancy + concessions | apartment_market_snapshots | monthly | submarket | platform-internal |
| | Under construction / pipeline | apartment_market_snapshots | monthly | submarket | platform-internal |
| **Submarket (CoStar)** | Asking rent / effective rent | CoStar Multifamily CSV exports | monthly | CoStar submarket | typically 2010+ |
| | Vacancy / absorption / concessions | CoStar | monthly | CoStar submarket | typically 2010+ |
| | New supply / under construction | CoStar | monthly | CoStar submarket | typically 2010+ |
| **Market surveys** | Submarket rent / vacancy / concession snapshots | Broker reports (Berkadia, JLL, CBRE, M&M, Yardi Matrix) | quarterly / episodic | submarket | varies; often 2015+ |
| **Comp performance** | Asking rent / occupancy / concession at comp properties | Broker exchanges, REIT 10-Ks, Yardi Matrix, operator networks | quarterly / monthly | parcel | varies; often 2-5 yrs |
| **Property state** | Occupancy / avg rent | property monthly P&L | monthly | parcel | per-deal |
| | Unit count / class / vintage | property record | annual | parcel | per-deal |
| | Capital event records | refi / disposition / major capex tracking | as occurred | parcel | per-deal |

### 4.2 Outputs (realized response variables)

Output rows are filled in by **backfill jobs** that compute, for each historical_observations row, the realized change at T+3 / T+12 / T+24 from the same geography's subsequent observations. The job runs on every new observation insertion and on a nightly schedule to backfill rows that just hit their T+N anniversary.

| Output | Source | Computed how |
|---|---|---|
| `realized_rent_change_t*` | submarket_avg_effective_rent (submarket level) or property_avg_rent (parcel level) | Compare same-geography observation at T+N |
| `realized_occupancy_change_t*` | submarket_vacancy_rate or property_occupancy | Same |
| `realized_concession_change_t12` | submarket_concession_pct or property_concession_per_unit | Same |
| `realized_signing_velocity_t*` | property leases/month (parcel only) | Same |
| `realized_cap_rate_change_t*_bps` | sale comps in same submarket | Compute median cap rate at T and T+N from sale_comps_normalized |
| `realized_walkins_psf_t12` | mobility data (when present at T+12) | Same |

### 4.3 Quality Tier Taxonomy

Rows in the corpus vary widely in data richness and reliability. The `data_quality_tier` column makes this explicit so consuming modules can weight evidence appropriately. Five tiers, ordered by reliability:

| Tier | Definition | Example | Typical sample weight |
|---|---|---|---|
| **S1 — Subject (full)** | Subject property with monthly P&L + rent roll + capital records | Atlanta deal #1 monthly observation | 1.0 |
| **S2 — Subject (partial)** | Subject property with rent roll or P&L only, missing the other | Jacksonville deal pre-2018 (rent roll only) | 0.7 |
| **C1 — Comp (structured)** | Non-subject property with monthly or quarterly performance from a paid source (Yardi Matrix, REIT 10-K, broker exchange) | Camden REIT property monthly data | 0.6 |
| **C2 — Comp (sparse)** | Non-subject property with episodic data from market surveys, broker emails, occasional snapshots | Berkadia survey covering a comp property | 0.3 |
| **M1 — Submarket (CoStar)** | Submarket-level monthly aggregate from CoStar | ATL_midtown 2023-06 CoStar export | 0.9 (for submarket-level claims) |
| **M2 — Submarket (survey)** | Submarket-level snapshot from quarterly broker survey | JLL Q3 2024 Atlanta multifamily survey | 0.5 (for submarket-level claims) |
| **X — External only** | Row populated only from external macro signals (LODES, QCEW, FRED, M35 events); no property or submarket performance | A 2022-03 MSA-level row with only employment + wages + events | 1.0 (for the macro signals it carries) |

**Tier-weighted querying.** The CorpusQueryService applies tier weights when computing aggregates. For example, computing the empirical median rent growth for a (submarket × event subtype) cohort uses an inverse-variance-weighted aggregation where S1/C1 rows count more than C2 rows. Consuming modules can override the default weights via `CorpusQuery.tierWeights`.

**Promotion semantics.** A C2 row that later receives a higher-quality data backfill (e.g., the comp property's actual rent roll lands via a broker exchange) gets promoted to C1 in place. The `updated_at` reflects the promotion; the original `created_at` is preserved.

---

## 5. The Labeled Core — Three Subject Properties + Comp + Submarket Tiers

Per the data inventory, the labeled corpus has multiple density tiers, not just subject properties:

### 5.1 S1 / S2 — Subject properties (the validation anchor)

- **Jacksonville deal:** 2018 → present, ~84 monthly S1 rows (full P&L + rent roll + capital records)
- **Atlanta deal #1:** 2020 → present, ~60 monthly S1 rows
- **Atlanta deal #2:** 2022 → present, ~36 monthly S1 rows

Combined: **~180 S1 rows** — the irreplaceable validation core. These are the only rows where the platform can pair its predictions against ground truth. M38 reliability statistics ultimately derive from this set (plus future subject acquisitions).

### 5.2 C1 / C2 — Comp performance (the labeled cohort extension)

Individual comp performance data covers properties in the same submarkets as the subject properties, plus comparable properties Leon has visibility into elsewhere. Sources include broker exchanges, REIT 10-K filings, Yardi Matrix subscriptions, market reports.

**Typical density (estimated):**
- **Atlanta submarkets:** 30–60 comp properties with quarterly-or-better data, possibly 5–15 years of history each → ~3,000–10,000 C1/C2 rows
- **Jacksonville submarkets:** 15–30 comp properties → ~1,500–5,000 C1/C2 rows
- **FL / DAL submarkets without subject properties:** comp coverage depends on broker network depth

Comp rows differ from subject rows in three ways:
- **Coverage is partial.** Often only asking rent, occupancy, and concessions — no P&L line items.
- **Cadence is irregular.** Quarterly snapshots are common; monthly is rare.
- **Quality varies.** A REIT-filed quarterly is C1; a single broker email mention is C2.

**Why comp rows matter:** they dramatically increase statistical power for empirical fitting *within the markets where subject properties exist*. The Atlanta dense core isn't 60 + 36 = 96 monthly rows; it's potentially 96 + thousands of comp rows. Empirical M35 playbook re-derivation, M07 BASELINE_COEFFICIENTS fitting, and M36 Σ estimation for Atlanta become tractable at population scale rather than n=2.

### 5.3 M1 / M2 — Submarket data (the macro context)

CoStar submarket performance (M1) and market survey snapshots (M2) provide submarket-level aggregates that cover everywhere — not just where subject or comp properties exist.

**Typical density:**
- **CoStar coverage areas:** monthly rows back to ~2010 for every CoStar submarket. For Atlanta, Jacksonville, and the broader FL/DAL coverage area, that's potentially **1,500–3,000 M1 rows per major MSA**.
- **Market surveys:** quarterly or annual snapshots, narrower geography, varied formats. Lower volume but useful for cross-validating CoStar's submarket aggregates.

M1/M2 rows are the *external context* that explains what was happening submarket-wide at any given time. Subject and comp rows situated within these submarket trajectories become much more informative — a property's 5% rent decline reads differently when the submarket fell 8% (subject outperformed) vs. when the submarket rose 3% (subject underperformed).

### 5.4 X — External-only rows (the unlabeled background)

LODES + QCEW + FRED + Census macro rows at MSA / county / national granularity. Wide coverage geographically, useful as features but never validated against property realizations directly.

### 5.5 Total estimated corpus density (when fully ingested)

Order of magnitude for the markets you cover:

| Tier | Estimated row count | Time | Geographic coverage |
|---|---:|---|---|
| S1 / S2 (subject) | ~180 | 2018-2025 | 2 MSAs, 3 parcels |
| C1 / C2 (comp) | ~5,000–15,000 | 2015-2025 | ATL + JAX submarkets, partial FL/DAL |
| M1 (CoStar) | ~10,000–20,000 | 2010-2025 | ATL + JAX + FL/DAL submarkets |
| M2 (survey) | ~500–2,000 | 2015-2025 | Major submarkets, episodic |
| X (external) | ~5,000–10,000 | 2002-2025 | All MSAs in coverage |

**Total corpus density: roughly 20,000–45,000 rows when fully ingested.** That's a working empirical corpus at the scale needed for the refits in Section 10 to be statistically meaningful — not just for Atlanta and Jacksonville (where validation is possible) but for the FL and DAL markets where the platform projects from observed patterns.

The 180 S1 rows remain the most important — they're the only rows where the platform can validate itself. The other tiers extend pattern coverage; only S1 closes the empirical loop.

### 5.6 Regime variation across the labeled window

The combined 2018–2025 window covers four distinct market regimes, all represented in the subject + comp labeled set:

| Regime | Window | Characterization |
|---|---|---|
| **Pre-COVID equilibrium** | 2018-01 → 2020-02 | Steady rent growth ~3-4% YoY, normal vacancy, low concessions |
| **COVID disruption** | 2020-03 → 2021-03 | Lease velocity disruption, urban submarket softening, concession surge |
| **Post-COVID rent surge** | 2021-04 → 2023-02 | Rent acceleration to 15–20% YoY in many submarkets, vacancy compression |
| **Normalization** | 2023-03 → 2025-present | Deceleration, supply absorption, concession re-emergence in some submarkets |

M36 Phase B's regime-conditional Σ work requires regime variation in the labeled corpus to estimate; these four regimes are exactly what makes that empirical fit tractable. A corpus that covered only 2018–2019 would have one regime, and Σ estimation would be meaningless. The platform's calibration window is well-chosen by accident.

---

## 6. Ingestion Architecture

Each source has its own ingestion job. All target the same `historical_observations` table; each fills different columns.

### 6.1 LODES ingestion

- **Source:** Census LEHD Origin-Destination Employment Statistics
- **Endpoint:** public CSV downloads per vintage
- **Cadence:** annual; check for new vintage each January
- **Job shape:** Inngest function, manual trigger + annual cron
- **Target rows:** every submarket and MSA in coverage area gets one row per LODES vintage year
- **Backfill:** load 2018→latest on first run (full back-fill); incremental thereafter

### 6.2 QCEW ingestion

- **Source:** BLS Quarterly Census of Employment and Wages
- **Endpoint:** public API
- **Cadence:** quarterly; ~6-month lag from observation
- **Job shape:** Inngest function, quarterly cron
- **Target rows:** every MSA gets one row per quarter; backfill 2018-Q1→latest

### 6.3 FRED / Census / BLS macro ingestion

- **Source:** existing platform integrations (per `data_sources` config)
- **Cadence:** monthly (FRED), annual (ACS), monthly (BLS LAUS)
- **Job shape:** Inngest cron per source
- **Target rows:** national-level macro joins to every row at write time; alternatively store as wide rows at the MSA level

### 6.4 M35 events ingestion

- **Source:** existing `key_events` table
- **Cadence:** on-write (event row insertion triggers historical_observations update)
- **Job shape:** Kafka consumer subscribed to `m35.events.*` topics
- **Target rows:** the submarket and MSA where the event lands gets its `active_event_count`, `event_employer_jobs_added`, etc. updated for the affected month

### 6.5 Submarket data ingestion

- **Source:** existing `apartment_market_snapshots` table
- **Cadence:** monthly (existing ingestion)
- **Job shape:** ETL from `apartment_market_snapshots` → `historical_observations` submarket rows
- **Target rows:** every (submarket × month) snapshot becomes one historical_observations row

### 6.6 Veraset / Placer / Advan mobility ingestion

- **Source:** vendor APIs / Snowflake Marketplace (Veraset)
- **Cadence:** daily or weekly (aggregated to monthly for corpus)
- **Job shape:** Inngest cron per vendor
- **Target rows:** parcel-level rows get mobility_* columns populated; submarket-level rows get aggregated mobility metrics
- **Vendor-specific:** confirm back-data depth before commitment (see open question 12.4)

### 6.7 Property performance ingestion (the subject core)

This is the **most important ingestion path** because it's the only source for S1 labeled rows. It's also the most operator-dependent — these uploads come from human users, not from external APIs.

- **Source:** monthly T-12 / monthly rent roll uploads (already supported by existing parsers — `t12-parser.ts:40374 lines`, `rent-roll-parser.ts:42590 lines`)
- **Cadence:** monthly per property (operator-driven)
- **Job shape:** triggered on document upload; runs the existing parser; transforms parsed result into historical_observations row
- **Target rows:** one row per (parcel × month) per upload, classified as S1 if both P&L and rent roll uploaded for the month, S2 if only one

The cadence is the problem. Property performance only enters the corpus when operators upload. Without consistent uploads, the dense labeled core has gaps — which is what the reminder prompt (Section 9) addresses.

### 6.8 CoStar submarket performance ingestion

- **Source:** CoStar Multifamily CSV exports (operator-downloaded, manually uploaded; eventually API integration when subscription includes it)
- **Cadence:** monthly per submarket; CoStar updates its historical files with each release
- **Job shape:** parser detects CoStar CSV format → maps columns to corpus fields → writes M1 rows
- **Target rows:** one M1 row per (CoStar submarket × month) per upload; for Atlanta + Jacksonville + FL/DAL coverage, that's potentially 10,000–20,000 rows per backfill
- **Format note:** CoStar's submarket boundaries don't always match the platform's submarket_id mapping. The ingestion includes a reconciliation step — CoStar submarket → platform submarket_id via lookup table; rows where reconciliation fails get flagged in `data_quality_flags` rather than dropped
- **Backfill:** dedicated session to load full 2010+ history once subscription confirmed; incremental monthly thereafter

### 6.9 Market survey ingestion

- **Source:** broker reports (Berkadia, JLL, CBRE, Marcus & Millichap, Yardi Matrix) — typically PDF or Excel
- **Cadence:** quarterly or episodic; varied by source
- **Job shape:** new parser per survey format (PDFs requiring extraction; Excel exports requiring sheet mapping)
- **Target rows:** M2 rows per (submarket × snapshot_date) per survey, with `market_survey_source` and `market_survey_snapshot` JSONB carrying raw fields
- **Backfill:** opportunistic — load surveys as they're collected; not a single bulk operation
- **Reconciliation:** when survey and CoStar disagree on the same submarket × month, both rows persist; tier weights (M1 > M2) determine which contributes more to aggregates

### 6.10 Comp performance ingestion

The most heterogeneous source. Different comp data comes in different shapes:

- **REIT 10-K data:** standardized quarterly financials for publicly-traded REIT-owned properties. Parser per filer (Camden, AvalonBay, Mid-America, etc.) extracts property-level rent, occupancy, concessions. C1 tier.
- **Yardi Matrix subscriptions:** monthly property-level snapshots when subscription includes it. Standardized format per Yardi's API. C1 tier.
- **Broker exchanges:** unstructured emails, occasional Excel attachments, sometimes verbal data passed in person. Manual entry into a `comp_observations_staging` table; operator UI for entering one-off data points. C2 tier.
- **CoStar property-level:** when subscription includes property-level data, monthly snapshots. C1 tier; ingestion path parallel to 6.8 but at parcel grain.

**Operator UI for manual comp entry:** a single-page form that captures `parcel_id (or address) × observation_date × rent / occupancy / concession / source / source_url`. Each entry becomes one C2 row.

**Backfill:** opportunistic per source. REIT 10-Ks can be backfilled programmatically going back several years. Yardi historical depends on subscription. Broker-exchange data is what it is; no backfill possible beyond what's been collected.

### 6.11 Capital event ingestion

- **Source:** operator-entered records for the three subject properties (refi dates, partial dispositions, major capex)
- **Cadence:** event-driven (entry happens when the event occurs or is being documented retroactively)
- **Job shape:** operator UI form per event type → writes to the parcel's S1/S2 row for the month the event occurred; populates `capital_event_type`, `capital_event_amount`, `capital_event_metadata`
- **Special case:** acquisitions backfill the property's monthly rows from acquisition date forward (creates the initial S1 row for the property)

---

## 7. Property Performance Ingestion Path

This subsection details the property performance flow because it's operator-dependent and most likely to fail silently. The architecture distinguishes between two lifecycle stages:

- **Pre-decision (Pipeline):** documents uploaded to a deal page for evaluation. The deal sits in Pipeline while under active consideration.
- **Post-decision (Portfolio or Archive):** when a deal is committed-to (Portfolio) or removed from Pipeline (Archive). Portfolio deals continue receiving operational uploads; Archive deals preserve their document history but don't accumulate new files.

The platform already has Pipeline, Portfolio, and the `deals.status` machinery. What's missing is the per-deal folder structure in the Data Library and the corpus-write hook downstream of upload.

### 7.1 Lifecycle: Deal → Portfolio → Data Library Deal Folder

The `deals` table already has a `status` field. `backend/src/api/rest/portfolio.routes.ts` already queries for `status IN ('owned', 'closed', 'portfolio')` to surface the Portfolio view. This is the lifecycle marker — when a deal transitions out of Pipeline, its status updates, and the Portfolio (or Archive) surface picks it up.

Three automations fire at the status transition into Portfolio:

1. **Add to Portfolio.** Already automatic — Portfolio queries by status; no code change.
2. **Create Data Library Deal Folder.** A `data_library_files.deal_id` foreign key (new) groups files per deal. The folder view in Data Library renders one expandable section per deal, with files inside.
3. **Initialize corpus baseline.** A bootstrap historical_observations row at the transition date with whatever subject-state data exists from documents already uploaded.

**Archive transition.** When an operator removes a deal from Pipeline (decided not to pursue, or aged out), `deals.status` transitions to `'archived'` and `archived_at` populates (this already happens per `backend/src/deals/deals.service.ts`). The Data Library Deal Folder persists with all its files; the folder gets an "Archived" badge derived from `deals.status`. No file migration, no folder restructure — same underlying storage, different visual badge.

**For existing deals already in Portfolio** (Jacksonville + 2 Atlanta): they enter Portfolio directly via the "Add Existing Property" flow; the three automations fire immediately. Historical performance uploads (per Section 7.7) populate the corpus retroactively.

### 7.2 The two upload surfaces for Portfolio deals

**Surface A — Portfolio property page upload zone.** Each Portfolio deal has its own page (already a UI pattern in `frontend/src/components/portfolio/`). The page surfaces a monthly performance upload zone with intentional context: "Upload {month_name} performance for {property_name}." Single-property focus; the operator is in the context of one specific asset.

**Surface B — Data Library Deal Folder upload zone.** Each Portfolio deal has a dedicated folder in the Data Library (created at the lifecycle transition). The folder accepts the same document types as Surface A. Multi-property workflow; the operator might be batch-uploading across several properties or organizing historical archives.

Both surfaces route through the same backend infrastructure. The difference is purely operator-context — same downstream behavior, same parsers, same corpus write. **All file types route through this same path:** monthly P&L, rent rolls, capital event documents, CoStar exports, market surveys, REIT 10-K excerpts, comp performance data. Document type classification (extended `classifyDocument()` in `extraction-pipeline.ts`) routes each to the appropriate corpus row shape and tier.

### 7.3 Document type classification — unified routing

The classifier needs to recognize every document type the platform ingests, not just the original underwriting set. The existing `classifyDocument()` returns a `DocumentType` enum that needs extension:

| New DocumentType | Triggers parser | Routes to corpus as |
|---|---|---|
| `COSTAR_SUBMARKET_EXPORT` | new `parseCoStarSubmarket()` | M1-tier submarket rows |
| `COSTAR_PROPERTY_EXPORT` | new `parseCoStarProperty()` | C1-tier comp rows |
| `MARKET_SURVEY_BERKADIA` / `_JLL` / `_CBRE` / `_MM` / `_YARDI_MATRIX` | source-specific parsers | M2-tier submarket rows |
| `REIT_10K` | new `parseREIT10K()` (parses standardized REIT property tables) | C1-tier rows per filing |
| `COMP_BROKER_NOTE` | minimal parser (one-off Excel sheets) | C2-tier comp rows |
| `CAPITAL_EVENT_RECORD` | minimal parser | populates sparse capital_event_* fields on existing parcel row |

Classification operates on file format + column-header detection. CoStar exports have recognizable submarket-named header rows. REIT 10-K extracts have standard property table formats. Operator can override classification at upload time if auto-detection fails.

### 7.4 License-restricted data handling

Some sources prohibit redistribution to other operators or external parties (CoStar terms, Yardi Matrix terms, some broker surveys). For these:

- The corpus row sets `redistribution_restricted = TRUE`
- Any consumer module that exposes data downstream (multi-tenant comp displays, shared analytics surfaces) MUST filter out `redistribution_restricted = TRUE` rows
- The empirical refit logic (M35 playbook re-derivation, M07 calibration) CAN use these rows because the output is the platform's derived priors, not the underlying licensed data

The flag is set at ingestion time based on the document source. CoStar → restricted. Yardi Matrix → restricted. Berkadia public survey → not restricted. Operator's own property performance → not restricted.

This flag is invariant 4 in Section 7.9 (added to the existing three).

### 7.5 The ingestion pipeline (existing infrastructure + corpus bridge)

```
Surface A (Portfolio upload)  ─┐
                                │
Surface B (Data Library upload)─┤
                                │
Pre-decision deal upload       ─┤
                                │
                                ▼
backend/src/services/document-extraction/extraction-pipeline.ts
  processDocument(filePath, filename, dealId, uploadedBy, ...)
    │
    ├─ classifyDocument()            → DocumentType (now extended)
    ├─ getParser(docType)             → parseT12 / parseRentRoll /
    │                                   parseCoStarSubmarket /
    │                                   parseREIT10K / ...
    ├─ result = parser(buffer, filename)
    └─ routeExtractionResult(pool, dealId, result, ...)
         │
         (in data-router.ts:82)
         │
         ├─ case 'T12':       → routeT12()                    (line ~241)
         │                       └─ existing writes
         │                       └─ NEW: writeT12ToCorpus()
         │
         ├─ case 'RENT_ROLL': → routeRentRoll()               (line ~312)
         │                       └─ existing writes
         │                       └─ NEW: writeRentRollToCorpus()
         │
         ├─ case 'COSTAR_*':  → routeCoStar()                 (NEW)
         │                       └─ writeCoStarToCorpus()
         │
         ├─ case 'REIT_10K':  → routeREIT10K()                (NEW)
         │                       └─ writeREIT10KToCorpus()
         │
         ├─ ...
         │
         └─ updateDealCapsule()                               (line ~1057)
```

The corpus write is **inline transactional**, not Kafka-event-driven. The whole chain — parse, route, deal capsule update, corpus write — is one transaction. Atomic success or rollback. Per the prior architectural decision: events-without-subscribers is a known failure mode (audit TE-03), so inline coupling is preferred for the bridge.

### 7.6 Per-parser corpus output

Several parsers write to **two destinations** in the same transaction: the existing canonical table that consumer modules expect (e.g., `deal_t12_rows`, `costar_market_metrics`) AND `historical_observations` for empirical corpus consumers. This dual-write pattern keeps existing consumer logic unchanged while making the same data available to the corpus.

| Parser | Existing canonical table | Corpus columns populated | Tier | Restricted |
|---|---|---|---|---|
| `parseT12` | `deal_t12_rows` (existing) | `property_avg_rent`, expense ratios | S1 if rent roll also present for same month; S2 otherwise | No |
| `parseRentRoll` | `deal_rent_roll_units` (existing) | `property_occupancy`, `property_avg_rent`, `property_concession_per_unit`, `property_signing_velocity` | S1 if T12 also present; S2 otherwise | No |
| `parseBoxScore` | `deal_box_score_*` (existing) | Submarket-level fields if multi-comp; parcel-level if single | Varies | No |
| `parseTaxBill` | `deal_tax_bills` (existing) | `capital_event_type='tax_assessment'`, `capital_event_amount`, metadata | S1 | No |
| `parseOM` | `deal_om_extractions` (existing) | Bootstrap row at deal creation: `parcel_id`, `property_unit_count`, `property_year_built`, `property_class` | S1 baseline | No |
| `parseCoStarSubmarket` | **`costar_market_metrics`** (currently empty placeholder) | `costar_submarket_rent`, `costar_submarket_vacancy`, `costar_submarket_absorption`, `costar_submarket_concession_pct`, `costar_submarket_new_supply` | M1 | **Yes** |
| `parseCoStarProperty` | New: `costar_property_metrics` (parallel to `costar_market_metrics` but at parcel grain) | property_* fields at parcel grain | C1 | **Yes** |
| `parseREIT10K` | New: `reit_property_observations` | property_* fields for each property in the filing | C1 | No (public filing) |
| `parseMarketSurvey*` | New: `market_survey_snapshots` (varies by source) | submarket-level fields per source; `market_survey_source`, `market_survey_snapshot` JSONB | M2 | Varies by source |
| `parseCompBrokerNote` | None (data is sparse enough to live only in corpus) | property_* fields, sparse | C2 | No |

**Activation effect of the `parseCoStarSubmarket` writer:** Today `costar_market_metrics` has the schema, indexes, and consumers wired (per `20260424_013_costar_market_metrics.sql` migration; consumers in `snapshot-capture.service.ts:172` and `correlationEngine.service.ts:1676,1741`) but **no writer**. The current state forces snapshot-capture to fall back to `apartment_locator_properties` proximity data, and correlation engine COR-04/COR-13/COR-22 emit "missingData" warnings about `costar_market_metrics.effective_rent` not being populated. Activating this writer through the document pipeline solves both problems with one work stream: corpus gets fed AND existing consumers move from fallback paths to canonical CoStar data.

### 7.7 Backfill for historical uploads (the three Portfolio deals)

The three Portfolio properties need their historical performance loaded — 7 years for Jacksonville, 5 for Atlanta #1, 3 for Atlanta #2. Since these are being onboarded fresh (no prior platform history), this is a one-time upload effort, not a re-trigger of existing data.

**One-sprint dedicated session.** A Replit agent walks through each month per property, uploading historical T12s and rent rolls through either the Portfolio property page or the Data Library Deal Folder. The new transformer fires per upload; corpus rows accumulate. Estimated effort: 1 sprint dedicated to backfill, parallel to Phase 2 build.

Per-property breakdown:
- **Jacksonville (2018-01 → present):** ~84 months × (1 T12 + 1 rent roll) = ~168 documents
- **Atlanta #1 (2020-01 → present):** ~60 months × 2 = ~120 documents
- **Atlanta #2 (2022-01 → present):** ~36 months × 2 = ~72 documents

Total: ~360 documents across the three properties. Manageable in a focused sprint with parser automation handling the document-by-document loop.

### 7.8 Required new code

**Backend:**
- `backend/src/services/historical-observations/document-to-corpus.ts` — per-parser-type transformers
- `backend/src/services/historical-observations/realized-outputs.service.ts` — backfill realized_* outputs as future months close
- `backend/src/services/data-library/deal-folder.service.ts` — creates/manages deal folders, queries files by deal_id with status badge
- `backend/src/services/portfolio/lifecycle-transition.service.ts` — orchestrates the three automations on status change
- `backend/src/inngest/functions/historicalObservationsBackfill.ts` — weekly cron for delayed realization closure
- New parsers: `parseCoStarSubmarket`, `parseCoStarProperty`, `parseREIT10K`, `parseMarketSurvey*`, `parseCompBrokerNote`
- Edits to `backend/src/services/document-extraction/classifier.ts`: extend DocumentType detection
- Edits to `backend/src/services/document-extraction/data-router.ts`: add corpus write calls for all new document types
- Edits to `backend/src/api/rest/portfolio.routes.ts`: add property-page upload endpoint
- Edits to `backend/src/api/rest/data-library.routes.ts`: support deal-folder-scoped uploads and queries
- Schema migration: add `deal_id` foreign key on `data_library_files`, add `redistribution_restricted` boolean column

**Frontend:**
- `frontend/src/components/portfolio/PropertyPerformanceUploadZone.tsx` — monthly upload widget on Portfolio property page
- `frontend/src/components/data-library/DealFolderView.tsx` — per-deal folder view with flat file list, status badge from `deals.status`, upload zone
- `frontend/src/components/portfolio/AddExistingPropertyForm.tsx` — direct entry of already-owned properties (skips Pipeline)
- Edits to existing Portfolio property page layout to surface upload zone prominently
- Edits to `frontend/src/pages/DataLibraryPage.tsx`: render folder tree (active Portfolio + archived deals + unaffiliated files)

### 7.9 Lifecycle invariants

Four rules the implementation must enforce:

1. **No corpus row without a deal.** Every `historical_observations` row with `geography_level='parcel'` joins to a `deals.id`. There's no orphan property data.
2. **Status transitions are recorded.** When a deal moves from `lead/evaluating` → `owned/portfolio` → `archived`, a `deal_lifecycle_events` row captures each transition timestamp. The corpus uses this to distinguish pre-decision (broker-supplied, lower confidence) vs. post-decision (operator-supplied, higher confidence) months.
3. **Documents are accessible from both surfaces.** A T12 uploaded to the Portfolio property page is visible in the Data Library Deal Folder, and vice versa. The Data Library is the storage layer; Portfolio is one view of it.
4. **License restrictions are honored.** Rows with `redistribution_restricted = TRUE` never appear in multi-tenant data surfaces (comp displays in other accounts' deal pages, shared analytics, public reports). The platform may use them for derived priors (empirical refits) because the output is platform-derived, not the licensed data itself.

---

## 8. Platform-Wide Query Surface

Consuming modules read the corpus through a service layer, not by direct SQL.

```typescript
// backend/src/services/historical-observations/query.service.ts (NEW)

export interface CorpusQuery {
  geography: {
    msa_id?: string;
    submarket_id?: string;
    parcel_id?: string;
    radius?: { lat: number; lng: number; miles: number };
  };
  timeRange: { start: Date; end: Date };
  observationWindow?: 'monthly' | 'quarterly' | 'annual';
  requireFields?: Array<keyof HistoricalObservationRow>;  // only return rows where these are non-null
  requireRealization?: '3mo' | '12mo' | '24mo';            // only return rows past this realization window
  isSubjectOnly?: boolean;
  isUnlabeledOnly?: boolean;
}

export class CorpusQueryService {
  async query(q: CorpusQuery): Promise<HistoricalObservationRow[]> { /* ... */ }
  async summary(q: CorpusQuery): Promise<CorpusSummary> { /* ... */ }
  async coverage(geography: CorpusQuery['geography']): Promise<CoverageReport> { /* ... */ }
}
```

**Consumers:**

- **M35 empirical playbook re-derivation** — queries for rows with specific `event_subtypes` active, computes empirical median/p25/p75 of `realized_rent_change_t12` (etc.) across those rows. Replaces the synthetic playbook seed for that subtype.
- **M07 coefficient empirical fitting** — queries for rows with property-level data, fits conversion-chain coefficients against realized signing velocity. Feeds the Platform layer Bayesian prior.
- **M36 Σ Phase B (empirical)** — queries for cross-variable variance across the corpus; computes empirical covariance per regime. Replaces hand-set heuristic Σ.
- **M37 analog distances** — given a new deal's features, queries for nearest historical_observations rows in feature space; weights by recency and similarity.
- **M38 reliability ledger** — for each historical prediction, joins to the corresponding historical_observation row to get the realized outcome; computes per-stratum reliability.
- **Correlation Engine (COR-04, COR-13, COR-22, etc.)** — replaces snapshot reads with corpus aggregates for affordability ratios, wage-to-rent ceilings, employment trends.
- **Deal Journey Framework** — `levers.perLeverEvidence` becomes empirical: each lever's `sourceConfidence` comes from the corpus density at the deal's geography × class × vintage.

---

## 9. The Reminder Prompt — Surfacing Data Gaps

Without consistent property performance uploads, the dense labeled core decays. Each month an operator doesn't upload is a month of missing labeled rows for that property. Compounded across three properties × multiple operators, the gaps quickly accumulate.

The reminder prompt is the platform's mechanism for keeping the corpus current. It runs on the existing notification infrastructure (`NotificationType` enum at `backend/src/types/notification.types.ts:11-32`).

### 9.1 New NotificationType values

```typescript
// Extension to existing NotificationType enum
DATA_CORPUS_UPLOAD_REQUIRED = 'data_corpus_upload_required',
DATA_CORPUS_GAP_DETECTED   = 'data_corpus_gap_detected',
DATA_CORPUS_REALIZATION_PENDING = 'data_corpus_realization_pending',
```

### 9.2 Trigger conditions

The reminder system runs as an Inngest cron (`backend/src/inngest/functions/dataCorpusReminderCron.ts`) **weekly on Monday at 09:00 local-time**, with secondary triggers per deal page load. Monday morning aligns with the operator's typical week-start rhythm and matches the cadence of the M07 calibration cron (FIX-1), so the platform's data hygiene and calibration housekeeping happen on the same operational beat.

**Trigger 1 — Missing monthly performance row.**
- **Condition:** Subject property exists, last successful upload was >35 days ago, current month's row is missing.
- **Message:** "Upload {property_name}'s {month_name} performance — needed to keep predictions calibrated. Last upload: {last_upload_date} ({days_ago} days ago)."
- **Priority:** MEDIUM (escalates to HIGH at 60+ days, URGENT at 90+ days).
- **Action URL:** deep link to the deal's upload surface with month pre-selected.

**Trigger 1a — Missing CoStar submarket refresh.**
- **Condition:** Subject property's submarket has CoStar M1 rows that are >60 days stale (CoStar publishes monthly; staleness > 60d means an update was missed).
- **Message:** "CoStar data for {submarket} hasn't refreshed in {days_ago} days. Upload the latest CoStar export to keep submarket context current."
- **Priority:** LOW–MEDIUM (CoStar staleness degrades context, not direct predictions).

**Trigger 1b — Comp performance gap.**
- **Condition:** A comp property tracked in the same submarket as a subject property has no observation in >180 days.
- **Message:** "Comp set for {submarket} hasn't been refreshed recently. Last update for {n} tracked comps: {oldest_update_date}."
- **Priority:** LOW (comps degrade the empirical fit slowly; reminder is informational rather than urgent).

**Trigger 2 — Realization window closing soon.**
- **Condition:** Subject property has a row dated 11 months ago that needs its T+12 realization filled — but the current month's data isn't uploaded yet. The realized_rent_change_t12 can't compute until the current month's row exists.
- **Message:** "Your {property_name} 11-month-ago prediction is about to expire. Upload {current_month} to close the realization window for {row_date}'s prediction."
- **Priority:** HIGH — this is the moment empirical reliability gets measured; missing it means M38 loses a data point permanently.

**Trigger 3 — Predicted vs. realized comparison ready.**
- **Condition:** A row has hit T+12 closure (or T+24). The platform can now compare its prediction vs. realized.
- **Message:** "We have {N} months of realized data for {property_name}. The platform predicted {predicted_rent_growth}; you realized {actual_rent_growth}. Variance: {delta}pp."
- **Priority:** LOW (informational; surfaces the empirical loop closing).

**Trigger 4 — Corpus coverage gap at deal page load.**
- **Condition:** Operator loads a deal page; the deal's submarket has <12 months of recent historical_observations rows.
- **Message inline on deal page:** "Limited recent comp data for {submarket}. Predictions may have wider confidence bands. {Show data coverage}"
- **Priority:** Not a notification — UI banner.

### 9.3 Per-deal Data Coverage Panel

Distinct from notifications, every deal page surfaces a **Data Coverage Panel** showing the state of the corpus for that deal's specific geography. Three sections:

```
┌─ Data Coverage for {Property Name} ──────────────────────────────┐
│                                                                  │
│  Subject Property Performance  ✓ Up to date (last: 2026-04)      │
│  ├─ Monthly P&L                ✓ 2018-01 through 2026-04         │
│  ├─ Rent Roll                  ✓ 2018-01 through 2026-04         │
│  └─ Capital Events             ⚠ 2 missing entries               │
│                                                                  │
│  Submarket Context (CoStar)    ✓ Strong (174 months of data)     │
│  ├─ Rent + vacancy + supply    ✓ 2010-2026                       │
│  └─ Last CoStar refresh        ⚠ 47 days ago                     │
│                                                                  │
│  Market Surveys                ⚠ Sparse                          │
│  ├─ Berkadia                   ✓ Through Q4 2025                 │
│  ├─ JLL                        ⚠ Last: Q1 2024                   │
│  └─ Yardi Matrix               ✗ Not subscribed                  │
│                                                                  │
│  Comp Performance Tracking     ⚠ 12 of 18 comps current          │
│  ├─ REIT 10-Ks                 ✓ 6 properties                    │
│  ├─ Yardi Matrix               ✓ 6 properties                    │
│  └─ Broker exchanges           ⚠ 6 stale comps (>180d)           │
│                                                                  │
│  External Signals              ✓ Most current                    │
│  ├─ LODES (commute-shed)       ✓ Through 2022                    │
│  ├─ QCEW (employment)          ✓ Through 2024-Q4                 │
│  ├─ FRED (rates)               ✓ Daily through today             │
│  ├─ Veraset mobility           ⚠ Awaiting subscription           │
│  └─ M35 events                 ✓ 14 active in radius             │
│                                                                  │
│  Prediction Confidence         MEDIUM                            │
│  (Bands widen pre-2020 due to limited external coverage)         │
│                                                                  │
│  [Upload Latest Performance]    [View Coverage Detail]           │
└──────────────────────────────────────────────────────────────────┘
```

The panel is the operator's window into why the platform's predictions have the confidence they have for this specific deal. When confidence is MEDIUM, the panel explains why — and what data uploads would lift it to HIGH.

### 9.4 Aggregate platform digest

A weekly email (also surfaced as in-app notification) summarizes corpus health:

```
JEDI RE — Weekly Data Health Digest
─────────────────────────────────────────────

Subject portfolio: 3 properties

  ✓ {Jacksonville property}     — current through 2026-04
  ⚠ {Atlanta property #1}       — last upload 2026-03 (45 days)
  ⚠ {Atlanta property #2}       — last upload 2026-02 (78 days)

Realization windows pending:
  • {Atlanta property #1}: 1 prediction awaiting T+12 closure (May 2026 data needed)

Recommended uploads this week:
  • {Atlanta property #1} April 2026 P&L + rent roll
  • {Atlanta property #2} March + April 2026 P&L + rent roll

[Upload Performance Data]   [View Full Coverage Report]
```

The digest is intentionally short and action-oriented. No corpus statistics, no projection commentary — just "here's what's missing and here's how to fix it."

### 9.5 Acceptance criteria for the reminder system

- Operators receive the monthly reminder on the 1st business day of the month.
- Per-deal Data Coverage Panel renders on every deal page load with current state.
- Realization-window notifications fire exactly once per (deal, prediction) pair when T+12 or T+24 is reached.
- Uploaded data closes the relevant notifications within 5 minutes (Inngest event subscription on upload).
- Weekly digest renders both as in-app notification and as email (existing notification infrastructure handles delivery channels).

---

## 10. The Empirical Calibration Arc

How synthetic priors become empirical posteriors over time.

### 10.1 M35 playbook re-derivation

Today (synthetic):
```
playbook(MAJOR_EMPLOYER_ARRIVAL, rent_growth_yoy, 12mo) = {
  median: 0.018,  halfSpread: 0.012,  confidence: 0.74,
  source: 'BLS QCEW + NBER aggregation'
}
```

After corpus accumulation (empirical):
```typescript
async function reDerivePlaybook(subtype: string, metric: string, window: number) {
  // Query corpus for rows where event_subtypes contains subtype
  const rows = await corpus.query({
    requireFields: ['event_subtypes', metric_to_realized_field(metric, window)],
    eventSubtype: subtype,
    requireRealization: `${window}mo`,
  });

  const realized = rows.map(r => r[metric_to_realized_field(metric, window)]).filter(notNull);

  return {
    median: percentile(realized, 0.5),
    p25: percentile(realized, 0.25),
    p75: percentile(realized, 0.75),
    p10: percentile(realized, 0.10),
    p90: percentile(realized, 0.90),
    instanceCount: realized.length,
    confidence: confidenceFromSampleSize(realized.length),
    source: 'empirical_corpus',
    asOf: new Date(),
  };
}
```

The shape is identical to today's playbook; only the derivation changes. Consuming modules see no API difference.

### 10.2 M07 BASELINE_COEFFICIENTS empirical fitting

The hardcoded baselines (`visibility_capture_rate: 0.04`, etc.) get an empirical version computed per (msa × class × vintage_band). The Platform layer Bayesian prior shifts from "literature value" to "empirical bucket median, weighted by sample size."

This is gated on having enough rent-roll-rich subject rows in each bucket — likely workable for Atlanta and Jacksonville after Phase 1, more limited elsewhere.

### 10.3 M36 Phase B empirical Σ

The heuristic Σ values (Phase A) get replaced by empirical covariance computed from the corpus. The 2020–2025 regime variation makes this tractable: COVID/post-COVID/normalization regimes each have enough observations to estimate regime-conditional Σ.

### 10.4 M37 analog matching

Today an analog match is "find historical events with similar metadata." With the corpus, an analog match becomes "find historical_observations rows with similar input vectors, weighted by realized-outcome similarity." That's a real nearest-neighbor problem solvable with the corpus.

### 10.5 M38 reliability per stratum

For every (asset_class, regime, market_tier) stratum, M38 can compute: out of N predictions the platform made for this stratum, what fraction had realizations within the predicted CI? That's reliability. It's directly computable from the corpus once predictions_ledger is wired (per the broader M22 / M38 work).

---

## 11. Phased Build Plan

| Phase | What ships | Dependencies | Effort |
|---|---|---|---|
| **0 — Spec** | This document committed | None | 1 day |
| **1 — Schema** | `historical_observations` table + indexes; CorpusQueryService skeleton with stub implementations; types module | None | 1 sprint |
| **2 — Property performance → corpus** | Transformer from existing parser output → corpus rows; backfill historical uploads for the three subject properties (Jacksonville 2018+, Atlanta #1 2020+, Atlanta #2 2022+) | Phase 1 schema | 1 sprint |
| **3 — Reminder system** | All four notification triggers wired; Data Coverage Panel renders on deal page; weekly digest cron | Phase 2 (need at least one ingestion path to test against) | 1 sprint |
| **4 — Existing-source ingestion** | M35 events, apartment_market_snapshots → corpus rows; FRED / Census / BLS macro joins; LODES bulk load 2018+; QCEW backfill 2018+ | Phase 1 schema | 1.5 sprints |
| **5 — First empirical refit** | M35 playbook re-derivation against corpus; comparison report (synthetic vs empirical median for each playbook entry) | Phase 4 minimum corpus density | 1 sprint |
| **6 — Veraset / mobility ingestion** | After vendor selected based on back-data depth | Phase 4; vendor contract signed | 1 sprint |
| **7 — M07 empirical baseline fitting** | Replace BASELINE_COEFFICIENTS with bucket-specific empirical priors | Phase 6 mobility data | 1.5 sprints |
| **8 — M36 Phase B empirical Σ** | Per-regime empirical covariance | Phase 5 + minimum 24 months of corpus | 1 sprint |
| **9 — M38 reliability ledger** | Prediction-realization pairing; per-stratum reliability stats | M22 pipeline + Phase 5 | 2 sprints |
| **10 — M37 analog matching** | Nearest-neighbor matching over corpus | Phase 5 + Phase 8 | 1.5 sprints |

**Phase 1-3 are the foundation.** Until those three ship, nothing else can be tested. Phase 4 is the first that produces real platform value — the moment the corpus has enough data to attempt the first empirical refit.

**Phases 5 onward are sequential by data dependency, not by team capacity.** Each phase needs the prior phase's data accumulated to a minimum threshold before the empirical fit is statistically meaningful.

---

## 12. Open Questions

1. **Realization output windows beyond T+24?** Some predictions (cap rate movement, multi-year rent growth) want T+36 or T+60. Storage cost is bounded but query complexity grows. Recommend stopping at T+24 for Phase 1; revisit if M38 stratum reliability is significantly stronger at longer windows.

2. **Submarket boundaries for FL coverage.** Florida has many MSAs with overlapping submarkets in some regions. The corpus needs canonical submarket IDs; if those aren't established for FL today, ingestion has to wait or use coarser geography.

3. **Capital event ingestion shape.** Refis, dispositions, major capex are non-monthly events. Should they get their own table joined to historical_observations, or sparse columns on the parcel-level rows for the months they occur? Recommend sparse columns; reduces join complexity.

4. **Veraset / Placer / Advan back-data depth.** Vendor pre-check required before Phase 6 sequencing — whichever has the deepest back-data wins regardless of monthly cost (per prior message). Specifically: what's the earliest visit data available at the spatial granularity the corpus needs?

5. **Subject property identification.** `is_subject_property = TRUE` is set per parcel. What about properties the user is *evaluating* but doesn't own (deal pipeline)? Those should probably contribute non-labeled rows from underwriting Pro Forma inputs but NOT labeled rows (no realized outcomes). Confirm: deal-stage properties get parcel rows with `is_subject_property = FALSE` until acquired.

6. **Backfill cost for the three subject properties.** Jacksonville 2018→present = ~84 months × monthly P&L + rent roll. If these are stored as PDFs / Excel files, the parsing-and-loading effort is non-trivial. Recommend: scope a one-time backfill session with a Replit agent walking through each month's documents, using the existing parsers. Estimated effort: 1 sprint dedicated to backfill, parallel to Phase 2 build.

7. **Privacy and tenant-mix data.** Property performance ingestion captures unit-level rent roll data including (potentially) tenant names. The historical_observations corpus should not retain PII. Confirm: the transformer aggregates rent roll to property-level metrics, never persists individual tenant identifiers. Add explicit PII scrubbing step to the transformer.

8. **MSA-level data join semantics.** A submarket row dated 2022-09 in Atlanta should reference the Atlanta MSA's 2022-09 macro state. But MSA-level QCEW data has 6-month lag. Should the join use the latest available MSA data as of 2022-09 (so 2022-Q1 data, not 2022-Q3), or stamp the row with whatever was current at the time of the historical write? Recommend: stamp with what was available as of the observation date, not what was eventually published — this matches what the platform would have known in real-time and is the correct training signal.

9. **Data Coverage Panel UX location.** Embedded in deal page header, or its own F-tab, or both? Recommend: header summary widget with click-through to detail page. Doesn't take F-tab real estate that's already full.

10. **Reminder notification fatigue.** Three notifications per month per property, three properties = 9 notifications/month minimum. Could feel like nagging. Recommend: digest-first delivery (weekly summary), with individual notifications only for HIGH/URGENT priority gaps. Operator-configurable per their preference.

11. **Schema versioning for column additions.** As new signals get added (e.g., when Placer onboards, add `placer_visits_*` columns), the schema grows. Recommend: use a `signals_extension JSONB` column for new signals during their first 90 days, then promote to dedicated columns once stable. Avoids early-stage schema churn.

12. **Subject vs. non-subject distinction at query time.** Many consuming modules want "rows where the platform can validate accuracy" — that's `is_subject_property = TRUE`. Others want "all rows for empirical pattern detection." The query API needs both modes; `CorpusQuery.isSubjectOnly` and `.isUnlabeledOnly` cover this.

---

## 13. Out of Scope

- **Cross-platform data sharing.** This corpus is platform-internal. Operators see only their own subject rows + aggregate signals. The corpus does NOT expose other operators' subject performance.
- **External API for the corpus.** No third-party access. Internal modules only.
- **Real-time streaming.** The corpus is built around monthly observations. Real-time signal feeds (daily mobility, daily news) get aggregated to monthly before insertion.
- **Predictive modeling itself.** The corpus is the *substrate* that modules fit against. The fitting logic lives in each module's own service (M35 playbook service, M07 calibration job, etc.). The corpus query service returns rows; consuming modules do the math.
- **Historical event back-fill.** M35 events were spec'd assuming forward operation. Whether to back-fill historical events (2018–2024) from news archives or other sources is a separate question. Recommend: not in scope for Phase 1; rely on what's been ingested into `key_events` to date.
- **Operator dashboards / analytics.** This spec covers the data substrate, not the analytics surface. UI for "show me how my Atlanta property's predictions have performed historically" is a downstream M22 / M38 product surface.
- **Cross-MSA broker comp ingestion.** Bringing in performance data from properties you don't own (broker dataset, market reports) would extend the dense labeled core dramatically. Worth doing eventually; out of scope for Phase 1.

---

## 14. Implementation Contract

When Phase 1-3 ship:

- `backend/src/db/migrations/YYYYMMDD_historical_observations.sql` — schema
- `backend/src/services/historical-observations/types.ts` — Row + Query type definitions
- `backend/src/services/historical-observations/query.service.ts` — CorpusQueryService implementation
- `backend/src/services/historical-observations/property-performance-to-corpus.ts` — transformer
- `backend/src/services/historical-observations/realized-outputs.service.ts` — backfill realized_* outputs
- `backend/src/inngest/functions/historicalObservationsBackfill.ts` — nightly cron
- `backend/src/inngest/functions/dataCorpusReminderCron.ts` — monthly reminder cron
- `backend/src/types/notification.types.ts` — extended with 3 new NotificationType values
- `backend/src/api/rest/historical-observations.routes.ts` — REST endpoints for the Data Coverage Panel
- `frontend/src/components/deal/DataCoveragePanel.tsx` — Data Coverage Panel UI
- `frontend/src/components/notifications/DataCorpusNotification.tsx` — notification renderer for new types
- Tests: corpus query semantics; transformer correctness for the three subject properties; reminder trigger logic at expected timing thresholds

Phase 4-10 are sequenced as separate implementation contracts.

---

## 15. Why This Matters

Every spec document in the platform — M07, M09, M14, M25, M35, M36, M37, M38 — eventually depends on empirical data to be trusted. The synthetic priors that bootstrap each module are explicitly placeholders; the architecture assumes they get replaced as evidence accumulates.

Without the historical_observations corpus, "evidence accumulates" doesn't have a place to live. Each module would have to build its own per-module historical store, leading to duplicated infrastructure and inconsistent reasoning (M35's idea of what happened in Atlanta in 2022 might differ from M07's idea of the same).

The corpus is the platform's single source of historical truth — the substrate that every empirical refit reads from and every realization writes into. Once it exists and has minimum density (Phase 4 milestone), the entire predictive infrastructure stops being heuristic and starts being grounded.

The three subject properties in Jacksonville and Atlanta are the ground truth that makes this real. They're the only data points where the platform can validate itself against reality. Every other row in the corpus is an unlabeled pattern; the subject rows are the labels that make the patterns meaningful.

That's the architecture, and the reminder prompt is the mechanism that keeps it operationally honest. A platform that learns from data only does so if the data keeps arriving. The reminder system is small in code but load-bearing in operations: without it, the corpus decays, the empirical fits drift, and the platform regresses toward its synthetic priors over time.
