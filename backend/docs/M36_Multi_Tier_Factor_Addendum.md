# Multi-Tier Factor Specification — Submarket Extension to M36

**Module:** M36 Joint Distribution Engine
**Spec relationship:** Addendum to `M36_Joint_Distribution_Engine_Spec.md`. Extends Section 3 (Σ Construction) with a three-tier factor decomposition that supports submarket-level analysis. Composes with the macro-anchored mean addendum already drafted.
**Status:** Implementation-grade

---

## 1. The Gap This Closes

M36 as originally specified estimates a single Σ at the asset-class × geographic-scope level, with scope being either national, MSA, or submarket. The implicit assumption: the same factor structure (B, Σ_F) applies at every scope, just with different parameter values estimated per scope.

This breaks down at the submarket level for three reasons.

**First, data sparsity.** Submarkets have ~8,000–30,000 units each; monthly metrics computed on this sample are noisy. A submarket-specific factor model with 6 factors and 84 monthly observations is borderline-identified at best. Estimating it independently per submarket — with hundreds or thousands of submarkets nationally — produces parameter noise that swamps signal.

**Second, factor heterogeneity within MSAs.** Class A urban submarkets respond to systematic shocks differently than Class C suburban submarkets in the same MSA. Tampa-as-a-whole has a single factor loading on the rate factor, but Westchase (institutional Class A) loads more strongly than East Tampa (local Class C). A flat per-submarket factor estimate misses this; a flat per-MSA estimate averages it away.

**Third, spatial coherence within MSAs.** Westchase and Carrollwood share commute sheds, school districts, employer access. Their behavior co-moves through these shared local conditions, not just through shared factor loadings. The existing spatial kernel handles this in principle but with parameters calibrated for inter-MSA distance — submarket-pair distances are an order of magnitude smaller and need recalibration.

The fix is a three-tier factor decomposition. National factors capture systematic shocks affecting all markets. MSA factors capture metro-specific deviations. Submarket-level structure is a regression of submarket metrics on national factors plus parent-MSA factors plus residual. Each tier is identified at a scope where it has enough data to estimate cleanly.

This is the math foundation that makes everything else — submarket peer ranking, deal-level analog forecasting, submarket-specific plausibility scoring — actually work in practice.

---

## 2. The Three-Tier Decomposition

### 2.1 The Model

For each metric Y at submarket sm and time t:

```
Y_sm,t = α_sm + β_sm · F_national,t + γ_sm · F_MSA(sm),t + ε_sm,t

where:
  Y_sm,t        = metric value in submarket sm at time t (centered, scaled)
  F_national,t  = vector of K_n national factors at time t (existing M36 factors)
  F_MSA(sm),t   = vector of K_m MSA-specific factors for the parent MSA of sm
  β_sm          = K_n-vector of national factor loadings for submarket sm
  γ_sm          = K_m-vector of MSA factor loadings for submarket sm
  α_sm          = submarket-specific mean (with macro anchoring per the macro-anchored mean addendum)
  ε_sm,t        = idiosyncratic residual, ε_sm,t ~ N(0, σ²_sm)
```

National factors F_national are the existing M36 factors: rate environment, national employment, regional migration trends, asset-class beta, supply pressure, sentiment. These don't change.

MSA factors F_MSA are new. Each MSA gets one or two MSA-specific factors that capture metro-level behavior beyond what national factors explain. For Tampa, this might be "Florida insurance/climate exposure" or "Tampa-specific employment composition." Estimated as principal components of the residuals after national factors are projected out at the MSA level.

The decomposition is hierarchical: every variable explained at the most parsimonious tier where it can be explained. Variation that's truly national stays in F_national. Variation that's metro-specific moves to F_MSA. Variation that's submarket-specific stays in ε.

### 2.2 Why Three Tiers, Not Two or Four

**Two tiers (national + idiosyncratic) is what M36 currently has.** It treats all within-MSA variation as idiosyncratic, which loses the metro-level coherence. A 50bps Tampa-specific employment shock affects all Tampa submarkets in correlated ways, but two-tier treats this as independent submarket-level noise.

**Four tiers (national + region + MSA + idiosyncratic) is appealing but probably over-fits.** Regional structure (e.g., "Sun Belt vs Northeast") could be a fourth tier above MSA, but the data isn't rich enough to identify it cleanly separately from MSA factors. Better to absorb regional structure into the geographic_tier component of the macro-anchored mean's structural premium (per the macro-anchored mean addendum) and keep three tiers in the factor model.

Three is the sweet spot: enough granularity to capture metro-specific variation, parsimonious enough to estimate reliably with available data.

### 2.3 MSA Factor Extraction

For each MSA m, F_MSA(m) is extracted as follows:

```
Step 1: Compute MSA-aggregated metrics.
  Y_m,t = aggregate over submarkets in m of Y_sm,t (sample-size-weighted average)

Step 2: Project out national factors.
  R_m,t = Y_m,t - β̂_m · F_national,t
  
  where β̂_m is the MSA-level loading on national factors, estimated from MSA aggregates.

Step 3: Extract MSA-specific factors via PCA on residuals R_m,t over time.
  Take top 1-2 components by variance explained.
  Constrain to capture > 60% of MSA-level residual variance (else collapse to single factor).

Step 4: F_MSA(m),t = the extracted factor scores.
```

Most MSAs will have one MSA factor; the largest and most heterogeneous (NYC, LA, Chicago, Bay Area) may need two. Smaller MSAs with thinner data may collapse to zero MSA factors — in which case the model degenerates back to two-tier for that MSA, which is appropriate.

### 2.4 Submarket Loadings β_sm and γ_sm

Once F_national and F_MSA(parent) are defined, each submarket's loadings are estimated via OLS regression on the submarket's metric time series:

```
For each submarket sm with parent MSA m:
  Regress Y_sm,t on F_national,t and F_MSA(m),t
  Output: β_sm, γ_sm, σ²_sm
```

This is a small, well-posed regression — typically 5-7 RHS variables, 84 monthly observations. Standard OLS works.

**Regularization for sparse submarkets.** Submarkets with very thin data (< 36 monthly observations) get shrinkage:

```
β_sm = (1 - w_shrink) · β_sm,OLS + w_shrink · β_typical(asset_class, MSA)

where w_shrink = max(0, (36 - n_obs) / 36)
```

Shrinks toward the typical loading for the asset class within the MSA when data is thin. Phases out as data accumulates.

### 2.5 Implied Σ at Submarket Level

The covariance between two submarkets sm_a and sm_b decomposes:

```
Cov(Y_sm_a, Y_sm_b) =
    β_sm_a · Σ_F_national · β_sm_bᵀ                         [shared national exposure]
  + 𝟙[same MSA] · γ_sm_a · Σ_F_MSA · γ_sm_bᵀ                [shared MSA exposure if same MSA]
  + 𝟙[same MSA] · ρ_spatial(sm_a, sm_b) · σ_sm_a · σ_sm_b   [spatial residual coherence within MSA]
```

The third term — spatial residual coherence — applies only within MSA and uses a recalibrated spatial kernel.

### 2.6 Recalibrated Spatial Kernel

The original M36 spatial kernel uses λ_g ≈ 30 minutes drive-time, calibrated for MSA-pair similarity. At the submarket level within an MSA, the relevant length scale is shorter:

```
ρ_spatial(sm_a, sm_b) = exp(-drive_time(sm_a, sm_b) / λ_sm)

λ_sm calibrated per MSA:
  Tier-1 metros (NYC, LA, Chicago, SF): λ_sm = 12 minutes
  Tier-2 metros (Tampa, Charlotte, Phoenix): λ_sm = 18 minutes
  Tier-3 metros (smaller MSAs): λ_sm = 25 minutes
```

The tier-dependence reflects the size of submarkets — bigger metros have more granular submarket boundaries, so coherence falls off faster with drive-time. Initial values calibrated by maximum likelihood on submarket residuals; refined annually.

---

## 3. Estimation Pipeline

### 3.1 Order of Operations

The three-tier model is estimated in a specific order, top-down:

**Stage 1: National factor model (existing M36 spec).**
- Estimated on national-aggregate metric time series
- Output: F_national, B_national (loadings on national aggregates), Σ_F_national

**Stage 2: MSA factor extraction.**
- For each MSA m, compute residuals Y_m,t − β̂_m · F_national,t
- PCA on residuals over time
- Output: F_MSA(m) for each MSA m, Σ_F_MSA(m) per MSA

**Stage 3: Submarket loadings.**
- For each submarket sm, OLS regress Y_sm,t on (F_national,t, F_MSA(parent(sm)),t)
- Apply regularization for thin-data submarkets
- Output: β_sm, γ_sm, σ²_sm

**Stage 4: Spatial kernel calibration.**
- For each MSA, fit λ_sm by maximum likelihood on submarket residual cross-correlations
- Output: λ_sm per MSA

**Stage 5: Σ assembly.**
- For any submarket pair, Σ is constructed on demand from the components above using the formula in Section 2.5
- Σ matrices are not stored in full; they are reconstructed per query for efficiency

### 3.2 Refresh Cadence

| Component | Refresh frequency |
|---|---|
| National factors (Stage 1) | Monthly (existing M36 cadence) |
| MSA factor extraction (Stage 2) | Monthly |
| Submarket loadings (Stage 3) | Monthly |
| Spatial kernel λ_sm (Stage 4) | Annually |
| Σ assembly (Stage 5) | On-demand per query, cached per submarket-pair for 24h |

Stages 1-3 run in the same monthly batch. Stage 4 is annual because spatial structure doesn't shift quickly. Stage 5 is per-query.

### 3.3 Quality Gates

Before publishing updated factor loadings each month, automated checks:

- **Identification check:** factor loadings have t-stats > 1.5 for at least 4 of 6 national factors. If not, flag for manual review (data issue or regime shift).
- **Stability check:** loadings haven't shifted more than 2σ from previous month for any submarket. Sudden shifts flagged for investigation.
- **Variance explained check:** residual variance after three-tier decomposition is < 60% of total variance for at least 75% of submarkets. If higher, the decomposition isn't capturing structure that should be modeled.

Failures don't block the refresh; they emit Kafka alerts to the admin dashboard for review. The refresh proceeds with the previous month's values flagged as carrying-forward where new estimates failed gates.

---

## 4. Submarket Definition

The math model assumes well-defined submarket boundaries with stable identifiers. The boundary definition is a separate question that affects everything downstream.

### 4.1 Recommendation: Platform-Defined Polygons + Vernacular Mapping

Two layers:

**Layer 1 (math-internal): Platform-defined polygons.** Uniform across MSAs, computed algorithmically from a combination of:
- Drive-time isochrones (5-minute or 7-minute walking-typical-area)
- Census tract boundaries (for demographic data joining)
- Major physical barriers (rivers, highways) as natural boundaries
- Asset density (ensuring each polygon has > N units of the relevant asset class for statistical power)

The result: ~30-80 submarket polygons per MSA, with stable submarket_id that doesn't change as boundaries are refined (versioned identifiers when boundary updates happen).

**Layer 2 (user-facing): Vernacular names.** Each polygon maps to a named neighborhood in local terms — "Westchase," "Buckhead Northwest," "South Beach." Mapping is many-to-one (a polygon may be entirely within one named neighborhood) or one-to-many (a polygon may span two adjacent named neighborhoods, in which case the name is concatenated or chosen by primary association).

UI surfaces vernacular names. Math operates on polygon IDs. Translation happens at the API boundary.

### 4.2 Why Not Just ZIPs

ZIPs are administrative artifacts of mail delivery. They cross neighborhood boundaries, vary wildly in size, and don't align with how either residents or institutional buyers think about markets. Using them for a math model means modeling artifacts of the postal service rather than the real estate market.

### 4.3 Why Not Just Named Neighborhoods

Names are inconsistent across MSAs. "Downtown" means something different in every city. Some neighborhoods are well-defined; others have fuzzy boundaries that locals disagree on. Using them as the math layer means modeling marketing categories rather than economic units.

### 4.4 Boundary Stability

The platform-defined polygons get refined annually as data improves, but boundary changes happen with versioning:

```sql
ALTER TABLE submarkets ADD COLUMN boundary_version INT NOT NULL;
ALTER TABLE submarkets ADD COLUMN active_from DATE NOT NULL;
ALTER TABLE submarkets ADD COLUMN active_until DATE;
```

When boundaries change, old polygons are deactivated (active_until set), new ones activated (active_from set). All historical predictions and realizations stay tagged with the polygon version under which they were recorded. Cross-version analysis applies polygon-mapping translation.

---

## 5. Schema Additions

```sql
-- Platform-defined submarket polygons
CREATE TABLE submarkets (
  submarket_id          VARCHAR(50) PRIMARY KEY,
  parent_msa_id         VARCHAR(20) NOT NULL,
  vernacular_name       VARCHAR(100),                 -- 'Westchase', 'Buckhead Northwest'
  polygon_geom          GEOGRAPHY(POLYGON, 4326),     -- PostGIS
  centroid_lat          FLOAT NOT NULL,
  centroid_lng          FLOAT NOT NULL,
  asset_density         JSONB,                        -- {multifamily_units, office_sqft, ...}
  boundary_version      INT NOT NULL,
  active_from           DATE NOT NULL,
  active_until          DATE,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_submarket_msa ON submarkets(parent_msa_id) WHERE active_until IS NULL;
CREATE INDEX idx_submarket_geom ON submarkets USING GIST(polygon_geom);

-- MSA factors
CREATE TABLE msa_factors (
  factor_id             VARCHAR(50) PRIMARY KEY,
  msa_id                VARCHAR(20) NOT NULL,
  factor_index          INT NOT NULL,                 -- 1, 2 per MSA
  factor_name           VARCHAR(100),                 -- 'tampa_climate_exposure'
  description           TEXT,
  primary_indicators    JSONB,                        -- which residual variables load most
  variance_explained_pct FLOAT,
  estimation_date       TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  
  UNIQUE (msa_id, factor_index, is_active) WHERE is_active = true
);

-- MSA factor scores over time
CREATE TABLE msa_factor_scores (
  score_id              UUID PRIMARY KEY,
  msa_id                VARCHAR(20) NOT NULL,
  factor_index          INT NOT NULL,
  observation_date      DATE NOT NULL,
  factor_score          FLOAT NOT NULL,
  
  UNIQUE (msa_id, factor_index, observation_date)
);

-- Submarket loadings (β_sm and γ_sm)
CREATE TABLE submarket_loadings (
  loading_id            UUID PRIMARY KEY,
  submarket_id          VARCHAR(50) NOT NULL REFERENCES submarkets(submarket_id),
  metric                VARCHAR(50) NOT NULL,
  factor_tier           VARCHAR(10) NOT NULL,        -- 'national' | 'msa'
  factor_id             VARCHAR(50) NOT NULL,
  loading_value         FLOAT NOT NULL,
  std_error             FLOAT,
  t_stat                FLOAT,
  shrinkage_weight      FLOAT,                        -- 0 if no shrinkage applied
  estimation_date       TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  
  UNIQUE (submarket_id, metric, factor_tier, factor_id, is_active) WHERE is_active = true
);

CREATE INDEX idx_loadings_submarket ON submarket_loadings(submarket_id, metric) WHERE is_active = true;

-- Submarket idiosyncratic variance
CREATE TABLE submarket_residual_variance (
  variance_id           UUID PRIMARY KEY,
  submarket_id          VARCHAR(50) NOT NULL,
  metric                VARCHAR(50) NOT NULL,
  residual_variance     FLOAT NOT NULL,
  estimation_date       TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  
  UNIQUE (submarket_id, metric, is_active) WHERE is_active = true
);

-- Spatial kernel parameters per MSA
CREATE TABLE msa_spatial_kernels (
  kernel_id             UUID PRIMARY KEY,
  msa_id                VARCHAR(20) NOT NULL,
  metric                VARCHAR(50),                  -- nullable; metric-specific override
  lambda_minutes        FLOAT NOT NULL,
  estimation_date       TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  
  UNIQUE (msa_id, metric, is_active) WHERE is_active = true
);

-- Submarket pairwise distances (cached; expensive to compute)
CREATE TABLE submarket_distances (
  pair_id               UUID PRIMARY KEY,
  submarket_a_id        VARCHAR(50) NOT NULL,
  submarket_b_id        VARCHAR(50) NOT NULL,
  drive_time_minutes    FLOAT,                        -- nullable for cross-MSA pairs
  euclidean_miles       FLOAT NOT NULL,
  same_msa              BOOLEAN NOT NULL,
  computed_at           TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (submarket_a_id, submarket_b_id),
  CHECK (submarket_a_id < submarket_b_id)            -- canonical ordering, no duplicates
);

CREATE INDEX idx_distances_a ON submarket_distances(submarket_a_id);
CREATE INDEX idx_distances_b ON submarket_distances(submarket_b_id);
```

---

## 6. API Additions

```
# Submarket lookup
GET /api/submarkets/:submarket_id
    → Submarket { id, msa, vernacular_name, polygon, centroid, ... }

GET /api/submarkets/by-location?lat=&lng=
    → Submarket containing the point

GET /api/submarkets/by-msa?msa_id=
    → Submarket[] within the MSA

# Factor loadings
GET /api/sigma/loadings/submarket/:submarket_id?metric=
    → SubmarketLoadings { national_loadings, msa_loadings, residual_variance }

GET /api/sigma/factors/msa/:msa_id
    → MSAFactor[] with current scores

# Σ at submarket level (constructed on demand)
POST /api/sigma/submarket-pair
     body: { submarket_a, submarket_b, metrics? }
     → CovarianceSubmatrix (assembled from three-tier components)

POST /api/sigma/submarket-set
     body: { submarket_ids, metrics? }
     → CovarianceMatrix (full Σ across the set)

# Updated existing endpoint with submarket scope
GET /api/sigma/current?regime=&asset_class=&scope=submarket:SM_4521
    → CovarianceMatrix scoped to submarket
```

---

## 7. Integration With Existing Specs

### 7.1 With M36 Macro-Anchored Mean Addendum

The macro-anchored mean addendum defines μ as a blend of empirical and macro-anchored components. In the three-tier setting:

```
α_sm (submarket-specific mean) = w_empirical · α_sm,empirical + (1 - w_empirical) · α_sm,macro

where:
  α_sm,macro = macro_series + structural_premium(asset_class, geographic_tier of sm)
  α_sm,empirical = local rolling-window mean of submarket sm
```

Geographic tier per submarket inherits from the parent MSA's tier classification. Tampa multifamily Class A submarkets all share the "Florida coastal multifamily Class A" structural premium. Within-MSA differentiation comes from the empirical α component, not the macro anchor.

This means a Westchase deal and a Carrollwood deal share the same macro-anchored center but diverge in their empirical center and in their factor loadings. That's the right architecture — macro coherence shouldn't differ between adjacent submarkets, but factor exposure can.

### 7.2 With M37 Cross-Market Analog Engine

M37's `sim_market` component currently uses MSA-level factor loadings:

```
sim_market = exp(-d_factor/λ_f) · exp(-d_geo/λ_g) · exp(-d_chars/λ_c)

where d_factor was based on MSA-level B
```

With three-tier loadings, sim_market becomes:

```
sim_market_submarket(sm_a, sm_b) =
    sim_national_factors(β_a, β_b)         # do submarkets respond similarly to national shocks?
  · sim_msa_loading(γ_a, γ_b)              # similar relationship to their respective MSAs?
  · sim_chars(chars_a, chars_b)             # physical/demographic similarity
  · 𝟙[same_MSA] · sim_geographic(sm_a, sm_b)  # gated to within-MSA only
```

The geographic factor is gated because it only makes sense for within-MSA pairs. A Westchase-vs-Plano comparison should not be discounted for being 1,200 miles apart; they're being compared as *types*, not as proximate markets.

This generalization is what makes M37 work at the deal level: forward queries can specify a submarket target and get analog forecasts from comparable submarkets in other MSAs (not just from MSA-level analogs).

### 7.3 With M07 Traffic Engine

M07 already accepts submarket_id in its DC-06 contract (sigma_overlay scope). With three-tier loadings, the σ_local that M07 reads is genuinely submarket-level — no longer a fall-back to MSA-level.

The expected_demand_strength and expected_supply_pressure outputs (per the Causal Discipline addendum) become genuinely deal-specific rather than MSA-specific. This is a meaningful upgrade in M07's accuracy at the deal level.

### 7.4 With M14 Risk

Factor variance attribution at the deal level decomposes more granularly:

```
Var(IRR for deal in submarket sm) =
    s · (β_sm Σ_F_national β_smᵀ) · sᵀ      [national factor variance]
  + s · (γ_sm Σ_F_MSA γ_smᵀ) · sᵀ           [MSA factor variance]
  + s · (σ²_sm) · sᵀ                         [idiosyncratic submarket variance]
```

The user-facing decomposition becomes: "Your IRR variance is 38% national rate exposure, 22% Florida-specific climate/insurance exposure, 25% submarket-specific factors, 15% idiosyncratic." That's substantially more useful than the current MSA-level attribution.

### 7.5 With M08 Strategy Builder

The Cause/Symptom invariant (per Causal Discipline addendum) operates at submarket level naturally — expected_demand_strength is now submarket-specific, observed symptoms are aggregated over submarket-relevant metrics. No structural change needed; the existing architecture supports submarket scope as soon as M07 starts emitting submarket-grained outputs.

### 7.6 With M38 Calibration Ledger

Predictions now carry submarket_id (already in the M38 schema). Reliability stratification adds submarket as an optional dimension — though sample sizes will often be too thin for submarket-specific calibration. Default behavior: stratify at MSA × asset_class × regime, with submarket-level surfaced when sufficient pairings accumulate.

---

## 8. Implementation Sequence

**Phase 1 — Submarket boundary definition (3 sessions)**
1. Polygon generation algorithm (drive-time isochrones, census joins, density gates)
2. Vernacular name mapping (manual + automated cross-reference)
3. Boundary versioning and migration paths

**Phase 2 — MSA factor extraction (2 sessions)**
4. Stage 2 of the estimation pipeline: residualization and PCA per MSA
5. Quality gates and admin dashboard for MSA factors

**Phase 3 — Submarket loadings (2 sessions)**
6. Stage 3: per-submarket OLS regression
7. Regularization for sparse submarkets

**Phase 4 — Spatial kernel calibration (1 session)**
8. Stage 4: per-MSA λ_sm fitting

**Phase 5 — Σ assembly + API (2 sessions)**
9. On-demand Σ assembly from three-tier components
10. API endpoints for submarket-scoped queries

**Phase 6 — Integration (3 sessions)**
11. M37 integration (submarket-level analog queries)
12. M07/M14 integration (submarket-grained outputs)
13. M38 stratification update

**Total: ~13 sessions.**

Phase 1 is critical-path and conceptually heaviest — once submarket boundaries are stable, the math layers compose cleanly. Phases 2-5 are mostly mechanical given the existing M36 infrastructure. Phase 6 unlocks the user-facing capabilities.

---

## 9. Open Design Questions

**Q1. How many MSA factors per MSA?** Default 1; up to 2 for largest MSAs based on variance-explained threshold. Recommendation: start with 1 universally, allow up to 2 if a quality gate triggers (residual variance > threshold even with 1 MSA factor).

**Q2. Polygon generation algorithm tuning.** Drive-time isochrones from what centroids? Recommendation: from population-weighted centroids of census tracts, gridded at ~5-minute drive intervals, then merged based on asset density gates.

**Q3. Cross-asset-class polygons.** Should submarket boundaries be the same for multifamily, office, industrial? Recommendation: yes for v1. Same polygons across asset classes simplifies the data model and the user's mental model. If asset classes need different boundaries (e.g., industrial submarkets aligned with logistics corridors rather than residential neighborhoods), revisit in v2.

**Q4. Submarket-level macro anchoring.** Per Section 7.1, structural premium is inherited from parent MSA tier. Should sub-MSA tiering exist (Tampa Class A urban vs Tampa Class C suburban)? Recommendation: defer. Keep tier at MSA-level for v1; if calibration data shows systematic within-MSA tier variation, add as v2 refinement.

**Q5. Residual covariance structure within idiosyncratic ε.** Section 2.5 implies ε terms have spatial correlation within MSA but are uncorrelated across MSAs. Is this right? Recommendation: yes for v1. Cross-MSA residual correlation, if it exists, is small and can be ignored without material accuracy loss.

**Q6. Boundary version migration during a deal lifecycle.** A deal underwritten under polygon version 3 is then evaluated against version 4 polygons after a refresh. How is the deal's submarket_id mapped? Recommendation: the deal's submarket_id is frozen at underwriting time. Comparisons across versions use a polygon-mapping translation table.

**Q7. Performance optimization for Σ assembly.** Constructing Σ on-demand per query has compute cost. Recommendation: cache assembled Σ submatrices for 24h per query signature. Common submarket-pair queries get warm cache; rare queries pay the construction cost.

---

## 10. Why This Matters

The MSA-level factor model is correct as a starting point but doesn't operate at the level where deals actually exist. Underwriting happens at submarket level. Comp sets are submarket-bounded. Traffic patterns are submarket-specific. Investment theses target submarket characteristics, not MSA averages.

Without three-tier factors, M36's submarket-level outputs are forced into one of two failures: either inheriting the parent MSA's factor loadings (smuggling a homogeneity assumption that's wrong, especially for class-of-property comparisons), or estimating per-submarket factor models on data that's too thin to identify them (producing parameter noise).

The three-tier decomposition is the right structure. National factors live at national scope where they have rich data. MSA factors live at MSA scope where they have rich data. Submarket-specific structure is what's left over after national and MSA effects are projected out — the sample-size demands at this layer are modest because most variance has already been explained higher up.

For the user-facing capability, this is what makes "submarket peer ranking" actually meaningful. Without three-tier factors, the similarity between Westchase and Plano is undefined — you could compute it from MSA-level loadings (treating both as their parent MSA, which collapses the distinction) or from per-submarket loadings (which are too noisy to compare). With three-tier factors, the similarity decomposes cleanly: do they share national factor exposure, do they have similar relationships to their respective MSAs, are they similar in physical/demographic character.

That's the math foundation. Everything that consumes submarket peer ranking — comp set construction, deal-level analog forecasting, plausibility scoring at the deal level, factor variance attribution at the deal level — depends on this layer being correct.

---
