# Submarket Peer Intelligence — Dual-Ranking Feature Spec

**Module:** M39 Submarket Peer Intelligence (new module; thin layer over M36 + M37)
**Status:** Implementation-grade
**Dependencies:** M36 Multi-Tier Factor Addendum (required), M37 Cross-Market Analog Engine (required), M15 Competition (consumes outputs)

---

## 1. The Gap This Closes

After the three-tier factor model lands (M36 Multi-Tier Factor Addendum), the platform has the math to compare any two submarkets. What it doesn't yet have is a **discoverable user-facing surface** that lets an underwriter ask: *"What are the most relevant peer submarkets for this deal?"*

This question has two distinct answers, and the platform should provide both:

**Direct competitors.** Submarkets within the same MSA that this property competes against for tenants. Driven by drive-time proximity, similar asset class, similar rent tier. These are the comps that matter for traffic, occupancy, lease velocity, and concession analysis.

**Structural analogs.** Submarkets in other MSAs that share factor structure and physical/demographic character. These are not competitors — they're *evidence sources*. When forecasting how Westchase will respond to an event, you look at how Plano (Dallas), Cary (Raleigh), and Tempe (Phoenix) responded to similar events. Same archetype, different geography.

Today these collapse together implicitly in M37 analog queries. Surfacing them as distinct rankings — with explicit similarity contributions per dimension — does three things: it makes the underwriting story defensible at the deal level, it makes M37 analog evidence inspectable rather than opaque, and it gives underwriters a tool to *think with* about why this market should behave like those markets.

This is the feature that turns latent infrastructure into discovered capability. The math is in M36. The forecasts are in M37. The peer intelligence surface is what lets users see and use both.

---

## 2. The Feature Surface

### 2.1 Where It Lives

**In the Deal Capsule:** A "Peer Markets" tab or panel showing both rankings for the deal's submarket. Surfaces directly inline with the deal context.

**In the F-key navigation:** F-key shortcut (slot TBD per Bloomberg layout) for the standalone Peer Intelligence screen. Lets users explore peer markets without a deal context.

**In Cashflow Agent rationale:** When the agent justifies an assumption with M37 analog evidence, the rationale links to the peer intelligence view showing exactly which submarkets contributed to the forecast and at what weights.

**In Investment Memo:** Auto-generated section showing the deal's three closest competitors and three closest structural analogs, with a sentence each explaining why.

### 2.2 The Dual-Ranking View

Default view for a subject submarket. Two ranked lists side-by-side or stacked, with explicit similarity decomposition.

```
SUBJECT: Westchase, Tampa, FL — Multifamily Class A
Asset class: multifamily | Tier: Class A | Built: 2010-2020 weighted | Avg unit size: 950 sf

┌─────────────────────────────────────────────────────────────────────┐
│  DIRECT COMPETITORS (within Tampa MSA)                               │
│  Ranked by competitive overlap                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Carrollwood              Similarity 0.87                         │
│     Drive-time: 8 min | Same MSA factor exposure | Similar profile   │
│     [Recent rent growth: 3.4% | Avg occupancy: 94.2%]                │
│                                                                      │
│  2. Citrus Park              Similarity 0.81                         │
│     Drive-time: 12 min | Same MSA factor | Slightly older stock      │
│                                                                      │
│  3. Town N' Country          Similarity 0.79                         │
│     Drive-time: 6 min | Same MSA factor | Mixed asset tier           │
│                                                                      │
│  4. South Tampa              Similarity 0.71                         │
│     Drive-time: 18 min | Same MSA factor | Higher rent tier          │
│                                                                      │
│  5. New Tampa                Similarity 0.68                         │
│     Drive-time: 22 min | Same MSA factor | Lower density             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  STRUCTURAL ANALOGS (other MSAs)                                     │
│  Ranked by factor similarity + character match                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Plano (Dallas)           Similarity 0.82                         │
│     National factors: 0.94 match | Character: 0.88 match              │
│     [Recent rent growth: 3.9% | Avg occupancy: 95.1%]                │
│                                                                      │
│  2. Buckhead Northwest (ATL) Similarity 0.78                         │
│     National factors: 0.91 match | Character: 0.84 match              │
│                                                                      │
│  3. Cary (Raleigh)           Similarity 0.74                         │
│     National factors: 0.88 match | Character: 0.81 match              │
│                                                                      │
│  4. Tempe (Phoenix)          Similarity 0.71                         │
│     National factors: 0.85 match | Character: 0.79 match              │
│                                                                      │
│  5. Round Rock (Austin)      Similarity 0.69                         │
│     National factors: 0.83 match | Character: 0.78 match              │
└─────────────────────────────────────────────────────────────────────┘

[Comparison Mode] [Add to comp set] [View peer dynamics] [Export]
```

### 2.3 Drill-Down: Per-Peer Detail View

Clicking any peer opens a detail panel showing:
- Side-by-side metrics: rent growth, vacancy, cap rates, transaction volume, demographic profile
- Time series overlay: subject vs peer over the past 60 months for selected metrics
- Factor loading comparison: per-factor side-by-side bars showing where they agree and disagree
- Recent events: M35 events that affected the peer in the last 24 months
- Analog forecast contribution: if this peer is being used as M37 evidence for the subject, show the realized impacts feeding the forecast

### 2.4 Comparison Mode

User selects 2-4 peers (subject + analogs) for direct comparison. Renders aligned charts, metric tables, and factor-loading comparisons. Useful for memo-writing and for vetting whether the system's similarity ranking matches the user's intuition.

### 2.5 Peer Dynamics Mode

Time series of peer rankings — does Westchase's closest analog change over time? When Plano's factor loadings shift (e.g., due to changing institutional capital flows), does it become a closer or more distant analog to Westchase? This is a market intelligence view that surfaces structural change in cross-market relationships.

---

## 3. The Similarity Computation

The peer intelligence feature is mostly a thin wrapper over M36 multi-tier loadings and M37 similarity primitives. Two distinct similarity modes for the two ranking lists.

### 3.1 Direct Competitor Similarity (within MSA)

```
sim_competitor(subject_sm, candidate_sm) =
    sim_geographic(subject_sm, candidate_sm)            # drive-time proximity within MSA
  · sim_msa_factor_exposure(subject_sm, candidate_sm)   # similar γ loadings on shared MSA factors
  · sim_character(subject_sm, candidate_sm)             # asset class, vintage, density, demographics

where:
  sim_geographic = exp(-drive_time / λ_sm)               # uses M36's MSA-specific λ_sm
  sim_msa_factor_exposure = exp(-‖γ_subject - γ_candidate‖ / λ_γ)
  sim_character uses weighted-Euclidean on character vector
  
constraint: candidate_sm.parent_msa_id == subject_sm.parent_msa_id
```

The geographic component dominates within MSA — proximity is a strong predictor of competitive overlap, more so than any other dimension. MSA factor exposure refines the ranking among proximate candidates. Character similarity (Class A vs Class C, low-density vs high-density) further differentiates.

### 3.2 Structural Analog Similarity (cross-MSA)

```
sim_analog(subject_sm, candidate_sm) =
    sim_national_factor_exposure(subject_sm, candidate_sm)    # similar β loadings on national factors
  · sim_character(subject_sm, candidate_sm)                    # same character similarity
  · sim_macro_tier(subject_sm, candidate_sm)                   # same geographic_tier (per macro-anchored mean addendum)

where:
  sim_national_factor_exposure = exp(-‖β_subject - β_candidate‖ / λ_β)
  sim_character as above
  sim_macro_tier = 1.0 if same tier, 0.6 if adjacent tier, 0.2 otherwise
  
constraint: candidate_sm.parent_msa_id != subject_sm.parent_msa_id
constraint: candidate_sm.asset_class compatible with subject_sm.asset_class
```

Geographic component is dropped (irrelevant for cross-MSA analog selection). National factor exposure becomes the primary signal — submarkets that respond similarly to systematic shocks are good analogs regardless of distance. Character similarity ensures we're comparing like to like (Class A urban to Class A urban, not Class A urban to Class B suburban).

### 3.3 Bandwidth Calibration

The λ values (λ_sm, λ_γ, λ_β, character_weights) inherit from M36 multi-tier addendum where applicable. New parameters specific to peer intelligence:

- **λ_β** (national factor distance bandwidth for analog ranking): default 0.8 in standardized loading space. Tighter than M37's analog bandwidth because peer ranking should surface the closest analogs, not aggregate over a broad pool.
- **Character vector and weights:** initial vector includes asset_class (categorical), vintage_decade, density_tier, demographic_income_tier, demographic_age_tier. Weights uniform initially; calibrated empirically once usage data accumulates.

### 3.4 Top-N Selection

Default returns top 5 competitors and top 5 analogs. User can expand to top 10 or top 20. Beyond 20, similarity values are too low to be meaningfully ordered (returns degenerate to noise). Hard cap at 25.

---

## 4. The Combined Peer Set

For consumers that need a single ranked list (M15 comp set construction, M37 forecast aggregation), peer intelligence emits a **combined peer set** that blends competitors and analogs by use case.

### 4.1 Use-Case-Specific Combinations

**For traffic and lease-up analysis (M07):** competitors heavily weighted (these compete for the same demand pool), analogs lightly weighted (analog evidence is marginal here).

**For rent growth / cap rate forecasting (M37, M09):** analogs heavily weighted (cross-MSA evidence is what informs forecasts), competitors lightly weighted (within-MSA peers add limited new information once the MSA factor is captured).

**For comp set construction (M15):** competitors only, no analogs. M15 is fundamentally about competitive set, not analog evidence.

**For investment memo "comparable markets" section:** balanced — top 3 competitors and top 3 analogs, presented separately.

### 4.2 The Combined Score Formula

For consumers requesting a combined set:

```
combined_score(candidate_sm) = w_compete · sim_competitor(subject, candidate)
                             + w_analog · sim_analog(subject, candidate)

w_compete and w_analog set per use case (sum to 1.0)
```

Use-case weights:

| Consumer | w_compete | w_analog |
|---|---|---|
| M07 Traffic | 0.80 | 0.20 |
| M37 Forecasts | 0.20 | 0.80 |
| M15 Comp Set | 1.00 | 0.00 |
| Investment Memo | 0.50 | 0.50 |
| User Default View | shown separately | shown separately |

### 4.3 Note on the Within-MSA Constraint

`sim_competitor` is zero for cross-MSA candidates (constraint: same parent_msa). `sim_analog` is zero for within-MSA candidates (constraint: different parent_msa). So the combined_score is non-zero for any candidate but is dominated by either the competitor term or the analog term, never both. This avoids the architecturally awkward case of a within-MSA submarket being scored on both axes.

---

## 5. Schema Additions

```sql
-- Per-submarket character vector (relatively stable; refreshed quarterly)
CREATE TABLE submarket_characters (
  character_id           UUID PRIMARY KEY,
  submarket_id           VARCHAR(50) NOT NULL REFERENCES submarkets(submarket_id),
  asset_class            VARCHAR(20) NOT NULL,
  vintage_decade         VARCHAR(10),                  -- '2010s' | '2000s' | etc.
  density_tier           VARCHAR(20),                  -- 'urban_high' | 'urban_low' | 'suburban' | ...
  demographic_income_tier VARCHAR(20),                 -- 'top_quintile' | 'q4' | ...
  demographic_age_tier   VARCHAR(20),
  unit_count_estimate    INT,
  avg_rent_psf_current   FLOAT,
  estimation_date        TIMESTAMPTZ NOT NULL,
  is_active              BOOLEAN DEFAULT true,
  
  UNIQUE (submarket_id, asset_class, is_active) WHERE is_active = true
);

-- Cached peer rankings (refreshed weekly or on factor refresh)
CREATE TABLE peer_rankings (
  ranking_id             UUID PRIMARY KEY,
  subject_submarket_id   VARCHAR(50) NOT NULL,
  asset_class            VARCHAR(20) NOT NULL,
  ranking_type           VARCHAR(20) NOT NULL,        -- 'competitor' | 'analog' | 'combined_traffic' | ...
  candidate_submarket_id VARCHAR(50) NOT NULL,
  rank                   INT NOT NULL,
  similarity_score       FLOAT NOT NULL,
  similarity_breakdown   JSONB,                        -- {geographic, factor, character, ...}
  computed_at            TIMESTAMPTZ DEFAULT now(),
  expires_at             TIMESTAMPTZ NOT NULL,
  
  UNIQUE (subject_submarket_id, asset_class, ranking_type, candidate_submarket_id, computed_at)
);

CREATE INDEX idx_peer_rankings_subject ON peer_rankings(subject_submarket_id, asset_class, ranking_type, rank);

-- Peer dynamics history (rank changes over time)
CREATE TABLE peer_ranking_history (
  history_id             UUID PRIMARY KEY,
  subject_submarket_id   VARCHAR(50) NOT NULL,
  asset_class            VARCHAR(20) NOT NULL,
  ranking_type           VARCHAR(20) NOT NULL,
  candidate_submarket_id VARCHAR(50) NOT NULL,
  observation_date       DATE NOT NULL,
  rank                   INT NOT NULL,
  similarity_score       FLOAT NOT NULL,
  
  UNIQUE (subject_submarket_id, asset_class, ranking_type, candidate_submarket_id, observation_date)
);

-- User-defined peer overrides (when underwriter knows better than the model)
CREATE TABLE user_peer_overrides (
  override_id            UUID PRIMARY KEY,
  user_id                UUID,
  deal_id                UUID,
  subject_submarket_id   VARCHAR(50) NOT NULL,
  ranking_type           VARCHAR(20) NOT NULL,
  candidate_submarket_id VARCHAR(50) NOT NULL,
  override_action        VARCHAR(20) NOT NULL,        -- 'pin_top' | 'remove' | 'demote'
  rationale              TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  expires_at             TIMESTAMPTZ                   -- nullable; permanent if not set
);
```

---

## 6. API Endpoints

```
# Default dual ranking
GET /api/peers/:subject_submarket_id?asset_class=&top_n=
    → DualRanking {
        competitors: [{submarket, sim, breakdown}, ...],
        analogs: [{submarket, sim, breakdown}, ...]
      }

# Single ranking type
GET /api/peers/:subject_submarket_id/competitors?asset_class=&top_n=
    → CompetitorRanking[]

GET /api/peers/:subject_submarket_id/analogs?asset_class=&top_n=
    → AnalogRanking[]

# Combined ranking for specific use case
GET /api/peers/:subject_submarket_id/combined?use_case=&asset_class=&top_n=
    → CombinedRanking[]

# Peer detail
GET /api/peers/:subject_submarket_id/detail/:peer_submarket_id
    → PeerDetail {
        metrics_comparison, time_series_overlay,
        factor_loading_comparison, recent_events,
        m37_analog_contribution
      }

# Peer dynamics over time
GET /api/peers/:subject_submarket_id/dynamics?ranking_type=&from=&to=
    → PeerDynamics {
        rank_changes: [{candidate, dates, ranks, similarities}]
      }

# Comparison mode
POST /api/peers/comparison
     body: { subject_submarket_id, peer_submarket_ids: [...], metrics: [...] }
     → ComparisonView { aligned_metrics_table, time_series, factor_comparison }

# User overrides
POST /api/peers/:subject_submarket_id/override
     body: { ranking_type, candidate_submarket_id, action, rationale }
     → confirms override applied

DELETE /api/peers/:subject_submarket_id/override/:override_id
       → override removed
```

**Kafka topics:**
- `peer.rankings_updated` — emitted when rankings refresh (M07, M37, M15 invalidate caches)
- `peer.override_applied` — user override applied (audit trail)

---

## 7. Integration With Existing Modules

### 7.1 With M36 (Multi-Tier Factor Addendum)

Peer Intelligence is the primary user-facing surface for M36's three-tier loadings. Reads β_sm, γ_sm directly. The math is in M36; the discovery and presentation is in this spec.

### 7.2 With M37 Cross-Market Analog Engine

When M37 produces an analog forecast, it returns a list of contributing analog events with their similarity weights. Peer Intelligence inverts this view: given a subject submarket, show the analog submarkets that *would* contribute to forecasts. This is M37's similarity computation surfaced as a discoverable feature rather than an internal detail.

When a user clicks "View peer dynamics" on an analog, they see how M37 has been using that analog over time — which forecasts referenced it, what it contributed, whether its contribution accuracy (per M38) is high or low.

### 7.3 With M15 Competition

M15 currently constructs comp sets through some combination of manual and heuristic matching. With Peer Intelligence, M15's comp set construction calls `/api/peers/:subject/combined?use_case=comp_set` and gets a structured starting point. User can then refine — accept, remove, or pin specific candidates with rationale. The user_peer_overrides table captures these refinements.

This is a meaningful upgrade to M15 from "manual comp set assembly" to "AI-suggested comp set with user validation." The user remains in control; the system does the cognitive heavy lifting.

### 7.4 With Cashflow Agent

Agent's rationale for any analog-driven assumption now links to the peer intelligence view:

```
Rationale: "Rent growth assumption of 4.0% reflects average of 12 analog markets 
weighted by similarity. Top contributing analogs: Plano (Dallas, 0.82), 
Buckhead NW (Atlanta, 0.78), Cary (Raleigh, 0.74). [View Peers]"
```

The [View Peers] link opens the Peer Intelligence drill-down for inspection. This is what makes the agent's rationale defensible at the deal level — the user can verify the analog set rather than trusting the agent's aggregation.

### 7.5 With M07 Traffic Engine

M07 reads competitor peers (use_case=traffic) when computing traffic projections. Competitor concession trends, occupancy, and lease-up velocity feed into M07's covariate inputs. This wiring exists in DC-04 conceptually; the Peer Intelligence service makes the competitor selection explicit and inspectable.

### 7.6 With Investment Memo

Auto-generated memo section:

> "**Comparable Markets**
> 
> The closest within-Tampa competitors for this property are Carrollwood (8min drive, similar Class A profile), Citrus Park, and Town N' Country. The closest structural analogs in other MSAs are Plano (Dallas), Buckhead Northwest (Atlanta), and Cary (Raleigh) — all suburban Class A submarkets with similar factor exposure profiles. Rent growth in these analog submarkets has averaged 4.1% over the trailing 24 months, supporting an underwritten assumption of 3.8-4.2%."

This is the kind of LP-quality memo content that comes out of the system automatically rather than being hand-written.

---

## 8. Implementation Sequence

**Phase 1 — Core ranking service (2 sessions)**
1. Schema for peer_rankings, peer_ranking_history, submarket_characters
2. Similarity computation service (calls M36 multi-tier API, computes both rankings)

**Phase 2 — APIs and caching (2 sessions)**
3. Public API endpoints with caching layer
4. Cache invalidation wiring on M36 factor refresh

**Phase 3 — UI surfaces (3 sessions)**
5. Dual-ranking view in Deal Capsule + standalone F-key screen
6. Per-peer detail view with metric comparison and time series
7. Comparison mode UI

**Phase 4 — Integration with consumers (3 sessions)**
8. M15 Comp Set integration (peer-suggested with user refinement)
9. Cashflow Agent rationale linking
10. Investment Memo auto-generation

**Phase 5 — Advanced features (2 sessions)**
11. Peer dynamics view (rank changes over time)
12. User override mechanism + audit trail

**Total: ~12 sessions.**

Phase 1 is the critical-path core; once rankings are produced, all downstream features depend on it but can be built in parallel. Phases 3-5 can be parallelized across UI and backend tracks.

---

## 9. Open Design Questions

**Q1. Top-N default.** 5 competitors + 5 analogs is a reasonable default but may be too many or too few depending on screen real estate. Recommendation: start with 5 each; allow user to expand to 10 or 20 inline. UI should handle the expansion gracefully (collapsing detail views as more peers are added).

**Q2. Vintage / asset-class strictness.** When ranking peers, how strict should the matching be? A 2018-built Class A peer for a 2015-built Class A subject seems fine; a 1995-built Class B peer probably is not. Recommendation: hard filter on asset class; soft penalty (factored into character similarity) on vintage decade.

**Q3. Peer ranking refresh cadence.** Daily, weekly, monthly? Recommendation: weekly. Factor loadings refresh monthly per M36 multi-tier addendum, but observed peer metrics (recent rent growth, occupancy) change weekly and that affects the displayed comparison context.

**Q4. User override propagation.** When a user pins a specific peer for a deal, does that propagate to portfolio-level views? To other users in the same firm? Recommendation: deal-scoped by default. Portfolio or firm-wide overrides are a v2 feature.

**Q5. Peer ranking explanations.** Should the system explain in natural language why each peer ranks where it does, or just show the similarity breakdown numerically? Recommendation: hybrid — numerical breakdown is the default; one-line natural-language hover-tooltips ("Same MSA factor exposure, similar Class A urban character, 8-minute drive") appear on the most prominent dimensions.

**Q6. Analog ranking with sparse-data target submarkets.** A submarket with limited history (e.g., recently developed area) has noisy β loadings. Does it get ranked against analogs reliably? Recommendation: surface a confidence indicator on rankings derived from sparse-data subjects; consider falling back to MSA-level analog ranking when submarket-level confidence is too low.

**Q7. Cross-asset-class peer rankings.** A multifamily Class A subject — should the peer ranking ever surface industrial or office submarkets? Recommendation: no for v1. Same asset class only. Multi-asset comparison creates more confusion than insight at the discovery surface.

---

## 10. Why This Matters

The math foundation in M36 multi-tier addendum is necessary infrastructure. Peer Intelligence is what turns that infrastructure into a **discoverable capability** — something users find, click on, learn from, and use to make better decisions.

Without this surface, the three-tier factor loadings exist as latent data. M37 uses them internally; M07 uses them internally; M14 uses them internally. The user never sees them. The fact that Westchase is structurally most similar to Plano, Buckhead NW, and Cary is computed and used in forecasts but not surfaced.

With Peer Intelligence, this becomes a primary feature of the platform's market intelligence. An underwriter looking at a Tampa deal can see in 30 seconds which markets they should be tracking as comparables, which markets the system thinks behave like theirs, and which events in those markets they should be paying attention to. That's a genuine intelligence advantage over platforms that show only single-market data.

For institutional positioning, this is the kind of capability that distinguishes "AI-powered analysis" from "structured market intelligence." It's not pattern-matching from training data; it's principled cross-market analysis built on a defensible factor model and exposed as a tool the user can think with.

It's also the surface where the JEDI Triangulated method becomes most visible to the user. When the agent says "based on 12 analog markets" and the user can click through to see exactly which 12, weighted how, with what confidence — the abstract math becomes concrete trust. That's the moment where users go from "I'm using an AI tool" to "I'm using a system that knows what it's talking about."

---
