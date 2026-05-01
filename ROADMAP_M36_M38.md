# JediRe M36-M38 Roadmap

## Core Insight
The 464 Bishop test revealed: **the model engine produces numbers without formal plausibility**. The agent needs M36 (joint distribution for plausibility + goal-seeking) and M37 (analog engine for evidence-based priors) to produce underwriter-grade output.

**The complete reasoning loop:**
- **M36 Σ** says "is this assumption set plausible given history?" (d² Mahalanobis)
- **M37 Analog** says "what do real analog markets that experienced similar events suggest?"
- **M38 Calibration** says "and how reliable are our claims about all this, based on our historical track record?"

Each without the others is incomplete. Together they form the structural backbone of evidence-based underwriting.

---

## Phase A: Agent Reasoning + Heuristic Σ (NOW — ~3 sessions)

### A1. Cashflow Agent prompt augmentation
Goal: Teach the agent **how** to reason about capital stack, plausibility, and trade-offs.
- Plausibility scoring (d² Mahalanobis)
- Bundle reasoning (HUD vs Agency vs Bridge vs CMBS)
- Pareto frontier thinking ("lowest aggressiveness that hits target")
- Output shape: (assumption set, IRR, d, narrative, bundles_rejected, bundles_selected)

### A2. Heuristic Σ engine
Goal: Stand up the plausibility + goal-seeking solver with hand-calibrated values.
- ~55 variables with initial covariance estimates (from market data range)
- Mahalanobis distance computation
- SLSQP solver (scipy or numpy)
- 4 pre-built debt bundles (HUD, Agency, Bridge, CMBS) with bundle-Σ
- API endpoints:
  - `POST /api/sigma/plausibility` — score an assumption set
  - `POST /api/sigma/goal-seek` — solve for target IRR

### A3. 464 Bishop validation
- Run "solve for 15% IRR over 5 years"
- Agent evaluates 3-4 debt bundles, picks lowest d
- Validate: does the answer make sense? Is the reasoning sound?
- Iterate on agent prompt until it does.

---

## Phase B: Data Foundation (M36 Phases 1-3 — ~6 sessions)

### B1. Historical data aggregation
- Collect historical metric data: rent growth, vacancy, cap rates, GPR, expense ratios, NOI, etc.
- By market, by asset class, by time period
- Sources: existing DB, market reports, user data

### B2. Σ estimation
- Compute empirical covariance matrix over ~55 variables
- Per regime (expansion, late-cycle, contraction)
- Regularization for sparse cells (shrinkage toward pooled mean)
- Decay weighting (recent observations weighted higher)

### B3. Regime classifier (HMM)
- Train hidden Markov model on historical factor data
- 3-4 states covering market regime
- Transition probabilities
- Connected to M35 for event-conditioned regime detection

### B4. Factor analysis
- Estimate loading matrix B (variable → factor)
- ~5-8 factors covering macro, market, deal-specific
- Factor naming and interpretation

---

## Phase C: Integration (M36 Phase 4 → All Consumers — ~3 sessions)

### C1. Replace heuristic Σ with empirical Σ
- Swap hardcoded values for Phase B output
- Calibrate plausibility scores against real outcomes

### C2. Plausibility → UI
- Badge on assumption form: d=0.6 🟢, d=1.8 🟡, d=3.2 🔴
- Per-variable contribution breakdown
- "Accept override" flow for high-d assumptions

### C3. Goal-seeking → Chat UI
- "Solve for 15% IRR" command in chat
- Streams solver output (<3s) then narrative (<8s)
- User can lock variables ("don't touch occupancy")

### C4. Debt bundle config UI
- Browse available debt products
- Add custom bundle (rate, LTV, IO, amort)
- See impact on IRR + plausibility

---

## Phase D: M37 Analog Engine (~8 sessions)

### D1. Similarity service
- Market similarity in factor space (M36 loadings)
- Regime match (M36 regime)  
- Event subtype match (M35)
- Bandwidth calibration (initial defaults)

### D2. Forward mode
- `POST /api/analogs/forecast/forward`
- Weighted forecast aggregation
- t-distribution CIs
- Kish effective sample size
- Variance decomposition (within-analog × between-analog)

### D3. Agent prompt integration
- Per-assumption M37 query for event-influenced metrics
- Output shape: (point, CI, n_eff, analogs)
- Fallback when n_eff < 3 → M35 playbook

### D4. Counterfactual + backward modes
- Hypothetical event forecasting
- Market response profiles
- Used by M10 scenario generation

---

## Phase E: M38 Calibration Ledger (~14 sessions)

### E1. Schema + ingestion (2 sessions)
- `predictions`, `realizations`, `pairings`, `reliability_stats` tables
- Prediction emission API + client SDK
- Every module emits Prediction records on every output

### E2. Backfill from M35 (1 session)
- Migrate existing M35 event impact records into unified schema
- Validates schema generalizes

### E3. Realization streams (2 sessions)
- M22 actuals → Realizations pipeline (requires deal_monthly_actuals migration)
- External data streams (RentCast, FRED, BLS) → Realizations

### E4. Pairing engine + reliability (2 sessions)
- Nightly pairing batch
- Reliability statistics computation per 5D stratum

### E5. Calibration factors + drift (2 sessions)
- CI widening factor derivation
- Bias correction
- Drift detection per stratum
- Kafka: `calibration.drift_alert`

### E6. Consumer integration (3 sessions)
- Cashflow Agent CalibrationProfile fetch + prompt augmentation (DC-14)
- M14 CI multiplier application
- M37 bandwidth recalibration trigger

### E7. UI + feedback (2 sessions)
- Confidence badges throughout deal capsule
- Admin drift dashboard
- User feedback flow ("flag this prediction")

---

## Phase F: M35 Event Engine Integration (~5 sessions)

### F1. Event taxonomy + playbook library
### F2. M35 → M06/M04 cascades (DC-08, DC-09)
### F3. M35 → M09 event-driven proforma updates
### F4. M35 → M36/M37 event-conditioned priors

---

## Priority Order (What Unlocks What)

```
Phase A (NOW) — Agent reasoning + heuristic Σ
  │  └── Unlocks: 464 Bishop test, validates prompt design
  ▼
Phase B — Empirical data foundation
  │  └── Unlocks: calibrated Σ, regime classifier
  ▼
Phase C — Integration & UI
  │  └── Unlocks: user-facing plausibility + goal-seeking
  ▼
Phase D — M37 Analog Engine
  │  └── Unlocks: evidence-based assumption priors, CI + rationale
  ▼
Phase E — M38 Calibration
  │  └── Unlocks: demonstrably accurate CIs, drift detection, feedback
  ▼
Phase F — M35 wiring
     └── Unlocks: full event-driven underwriting loop
```

---

## Session Budget (Total ~40 sessions)

| Phase | Sessions | Key Deliverable |
|-------|----------|----------------|
| **A** (Agent + heuristic Σ) | 3 | Working goal-seeking with 464 Bishop |
| **B** (Data foundation) | 6 | Empirical Σ, HMM, factor model |
| **C** (Integration) | 3 | Plausibility UI, goal-seeking chat |
| **D** (M37 Analog) | 8 | Forward/backward/counterfactual APIs |
| **E** (M38 Calibration) | 14 | Prediction ledger, drift, feedback |
| **F** (M35 Wiring) | 5 | Full event → underwriting cascade |
| **Buffer** | 3 | Unknown unknowns |

---

## IMMEDIATE NEXT STEPS

1. Build agent prompt for capital stack reasoning + plausibility
2. Build heuristic Σ with 55 variables + 4 debt bundles
3. Build `POST /api/sigma/plausibility` and `POST /api/sigma/goal-seek`
4. Test 464 Bishop: solve for 15% IRR
5. Iterate agent prompt until reasoning is sound
6. Then begin Phase B data foundation

**Priority: Agent reasoning > heuristic math > data precision**
