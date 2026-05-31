# JEDI RE — PRO FORMA WINDOW ARCHITECTURE CORRECTIONS

**Produced:** 2026-05-31
**Trigger:** Owned/Portfolio + Correlation Engine Map audit (2026-05-31) surfaced verified-vs-inferred claims in the four Pro Forma Window architecture documents drafted earlier this session.

**Scope:** Redlines to four documents based on grounded SQL/grep findings. Not a rewrite — corrections only. Each correction names: (a) what the document claimed, (b) what the audit verified, (c) what the corrected framing is.

**P11 compliance:** Every correction below is grounded in the audit's verified findings. Where uncertainty remains, claims are labeled INFERRED-NOT-VERIFIED.

---

## §1 — CORRECTIONS TO MATH SPEC

### Correction 1.1 — Worked 464 Bishop example, owned-portfolio comparable reference

**What the Math Spec claimed (§6 worked example):**
The worked example referenced "owned portfolio Atlanta comparables" as a source for Class B Atlanta stabilized OpEx benchmarking — specifically implying that an "Atlanta Property A" owned-portfolio asset provided same-submarket data.

**What the audit verified:**
Owned portfolio has no Atlanta Midtown asset. The nearest Georgia comparable is Duluth GA (2789 Satellite Blvd, suburban Gwinnett County, ~25 miles north of Midtown). Duluth GA's data is Yardi-sourced Dec 2021-Dec 2022 (13 months) at 95.0% occupancy.

**Corrected framing:**
The worked 464 Bishop example's OpEx benchmarking should be described as:

- Primary cross-check: Duluth GA owned property (suburban Atlanta, Yardi data, 2021-2022) — provides directional OpEx benchmarks for Atlanta-region Class B but is NOT a same-submarket comparable
- Atlanta Midtown specifics: require external comps or operator-supplied data
- Honest framing: "the example uses suburban Atlanta data as a regional cross-check; same-submarket Midtown OpEx benchmarking requires data the platform does not currently have"

### Correction 1.2 — Market rent source for Atlanta Midtown

**What the Math Spec claimed:**
Market rent for the worked example was framed as sourced from "platform comps" with implied submarket-specific granularity.

**What the audit verified:**
- `apartment_market_snapshots` has 34 rows for Atlanta, GA (Feb-May 2026) — **city-level only, not Midtown-specific**
- `historical_observations` has 18 rows for `msa_id='atlanta-msa'` — MSA-level, no `submarket_id` set
- Two rows exist for "Midtown, GA" and "Buckhead, GA" in `apartment_market_snapshots` (1 row each, March 2026) — extremely sparse

**Corrected framing:**
Market rent for Atlanta Midtown should be sourced as:

- Primary: `apartment_market_snapshots` for Atlanta, GA (city-level, 34 rows of recent data)
- Submarket granularity: not reliably available; the 1 Midtown row in apartment_market_snapshots is too sparse to anchor underwriting
- Honest framing: market rent at city-level is the platform's current ceiling for granularity in Atlanta; Midtown-specific reasoning requires operator input or external comps

### Correction 1.3 — Phase 1B correlation engine framing

**What the Math Spec claimed (Phase 1B references):**
"Phase 1B uses the correlation engine to query the empirical relationship between concession depth and signing velocity in the target submarket."

**What the audit verified:**
- The correlation engine (`CorrelationEngineService`, 3,488 lines) is a **market-signal engine** producing 30 city-level signals (COR-01..30)
- It does NOT have query functions for concession-depth-to-signing-velocity in a submarket
- These query functions would need to be built (1-2 days each following existing patterns), but they cannot return useful results because:
  - `historical_observations.property_concession_per_unit`: 0/475 rows populated
  - `historical_observations.property_asking_rent`: 1/475 rows populated
  - `historical_observations.property_signing_velocity`: 38/475 rows populated (8%)
  - `realized_occupancy_change_t12`: 0/475 rows populated
  - `realized_signing_velocity_t12`: 0/475 rows populated

**Corrected framing:**
Phase 1B is **data-blocked, not code-blocked**. The corrected dependency chain:

1. **Data infrastructure prerequisite** (weeks to months): populate `historical_observations.property_concession_per_unit`, `property_asking_rent`, `property_signing_velocity`, and the `realized_*_t12` outcome columns from vendor feeds (CoStar pipeline exists via Task #1476 with 36 sample rows; needs scaling)
2. **Stabilization outcome tracking** (new schema): add `stabilization_achieved_date` column or new `deal_outcomes` table to record actual stabilization timing as deals close out — currently no table tracks this
3. **Code build** (1-2 weeks once data exists): three new functions following `computePairCorrelation` pattern in `correlationEngine.service.ts`:
   - `computeStabilizationCorrelation(submarket, startingOccupancy)`
   - `computeConcessionVelocityCorrelation(submarket)`
   - `computeRentPositioningVelocityCorrelation(submarket)`

**Important architectural reframing:**
Stabilization-underwriting correlation queries are a **NEW analytical capability** for the correlation engine, not a refinement of its existing scope. The current engine answers "what is the market doing"; the Phase 1B queries answer "what will this deal do" — these are different problems. The Math Spec should describe Phase 1B as extending the engine into deal-outcome prediction, not as wiring up queries against existing engine infrastructure.

### Correction 1.4 — Renovation premium framing

**What the Math Spec claimed (VALUE-ADD profile section):**
"Renovation premium per unit grounded in platform track record of similar value-add deals."

**What the audit verified:**
- No renovation premium history exists in any table
- `fetch_owned_asset_actuals` with `value_add_programs_only=true` returns `renovation_capture_summary` with **`capture_rate_source: 'archive_default', recommended_capture_rate: 0.80`** as a fallback
- The fallback is the archive P50 (median of broker-OM-claimed capture rates across the archive — currently 298 archive rows in `data_library_assets`)
- No owned-portfolio property has a tracked value-add program with before/after data

**Corrected framing:**
Renovation premium for VALUE-ADD deals is currently sourced as:

- Primary: operator-supplied renovation premium assumption (Layer 1 in CONSOLE > INPUTS)
- Secondary: archive P50 fallback = 0.80 (when operator hasn't supplied; agent uses this with low confidence)
- NOT: empirical renovation premium history from owned portfolio (this data doesn't exist)
- Future: as deals close and outcomes are tracked, the platform builds a renovation premium history that can replace the archive P50 fallback

### Correction 1.5 — Stabilization year detection algorithm context

**What the Math Spec claimed (§4 detection algorithm):**
The algorithm operates on a projection vacancy trajectory produced by profile-specific pre-stab formulas, with the implicit assumption that the agent reasons about the trajectory using market signals.

**What the audit verified — useful confirmation:**
- The CashFlow Agent already has access to `fetch_owned_asset_actuals` (Tier 2 evidence)
- The agent already produces year-by-year vacancy via existing reasoning
- Phase 1A tasks #1640, #1644, #1645 have shipped (per audit's mention)
- The algorithm runs on existing infrastructure

**Corrected framing — no change needed to the algorithm itself, but add provenance:**
The Math Spec's stabilization-year detection algorithm operates on:
- Year-by-year vacancy projections from the existing F9 agent reasoning (input)
- The operator's stabilization threshold from CONSOLE > INPUTS (input)
- Hold period from `deal_assumptions.hold_period_years` (input)

No new agent infrastructure is required for Phase 1A. The algorithm is wiring, not a new analytical capability.

---

## §2 — CORRECTIONS TO LIFECYCLE STATE MACHINE

### Correction 2.1 — Profile detection threshold provenance

**What the Lifecycle State Machine claimed (§3 detection rules):**
The profile detection rules (DISTRESSED < 80%, VALUE-ADD when renovation budget > $10K/unit OR > 25% units, STABILIZED ≥ 92%, DEVELOPMENT when construction_months > 0) were presented as platform defaults without explicit provenance.

**What the audit verified:**
- All three owned portfolio properties are observed at stabilized occupancy: 94.7%, 94.6%, 95.0%
- No lease-up trajectory data exists for any owned property
- The Duluth GA property's 2021-2022 observation window predates any visible lease-up phase
- The thresholds cannot be validated against any empirical owned-portfolio data

**Corrected framing — label the thresholds as professional judgment:**
The profile detection thresholds in §3 are **based on industry conventions and professional judgment**, not empirical validation from platform-tracked deal outcomes. Specifically:

- DISTRESSED < 80% — industry convention for "operating distress"; not validated
- VALUE-ADD renovation triggers — judgment-based; not validated
- STABILIZED ≥ 92% — industry convention (lender stabilization definitions vary 85-95%); not validated
- DEVELOPMENT construction-active — definitional; not requiring validation

The document should add a §3.5 note: "These thresholds are professional judgment, not platform-empirical. Validation requires owned portfolio properties with tracked lease-up trajectories. Until such data exists, these thresholds may be adjusted based on operator feedback and deal-by-deal outcomes."

### Correction 2.2 — Profile mapping to existing `deal_mode` field

**What the Lifecycle State Machine claimed (§6 integration):**
"`deals.deal_mode` (existing field: STABILIZED, LEASE_UP, REDEVELOPMENT) is informative but not authoritative."

**What the audit verified:**
- The audit didn't specifically verify the current `deal_mode` field values across the deals table
- INFERRED-NOT-VERIFIED: the document's claim about deal_mode values is from earlier session memory, not from this audit

**Corrected framing:**
The relationship between the four canonical lifecycle profiles and the existing `deal_mode` field requires its own verification. Replit should grep `deal_mode` column usage and report:
- What values currently exist in `deals.deal_mode`
- How they're used today (which services read them, which UIs display them)
- Whether the four-profile classifier should reuse `deal_mode` or write to a new field

This is a small follow-up audit, not a blocker for Phase 1A.

---

## §3 — CORRECTIONS TO DATA FLOW SPEC

### Correction 3.1 — Correlation engine path framing

**What the Data Flow Spec claimed (§5 critical dependencies):**
Phase 1B's data flow depends on "correlation engine queries against historical_observations for empirical concession-velocity reasoning."

**What the audit verified:**
- The correlation engine queries `apartment_market_snapshots`, `apartment_trends`, `metric_time_series` — NOT `historical_observations`
- The connection from correlation engine → historical_observations does not exist in code
- Building stabilization queries against historical_observations is a NEW pattern, not an extension of existing queries

**Corrected framing:**
Phase 1B's data flow is described accurately as:

1. **New correlation engine queries** (3 functions, 1-2 days each) extend the engine into deal-outcome prediction
2. **historical_observations populated at scale** (vendor feed expansion — current 36 CoStar rows need to grow to 200+ Atlanta property-quarters)
3. **Stabilization outcome tracking schema** (new column/table — currently nothing tracks actual stabilization dates)
4. The data flow: agent triggers → new correlation function → queries populated historical_observations → returns coefficient → agent uses in trajectory reasoning

Each prerequisite is independent; all three must complete before Phase 1B's value materializes.

### Correction 3.2 — Field-level read map for new Phase 1A fields

**What the Data Flow Spec claimed (§5 §6):**
The three new Phase 1A fields (`stabilization_threshold_pct`, `stabilization_year`, `lifecycle_profile`) were described as living in `deal_assumptions` with specific read/write paths.

**What the audit verified — confirmation, with one addition:**
Tasks #1640, #1644, #1645 have shipped (per audit's mention). The field-level read/write paths described in the Data Flow Spec are consistent with what's been built.

**Addition:** The Data Flow Spec should reference the actual table/column names from the shipped tasks. If Replit can share the merged task PRs or commit references, the Data Flow Spec can be annotated with verified-against-implementation marks rather than treating the field names as target-state.

### Correction 3.3 — Owned-portfolio data flow into the CashFlow Agent

**What the Data Flow Spec implied (Phase 1B):**
Owned-portfolio data feeding the CashFlow Agent's stabilization reasoning was framed as a Phase 1B enhancement.

**What the audit verified:**
The owned-portfolio → CashFlow Agent path already exists and is functional today:
- `fetch_owned_asset_actuals` tool wired to agent
- `fetch_owned_asset_opex_ratios` tool wired to agent
- Queries `deal_monthly_actuals` for Tier 2 evidence
- Comparability scoring (submarket/asset class/vintage/units) operational
- `value_add_programs_only=true` mode wired with archive P50 fallback

**Corrected framing:**
The owned-portfolio data flow is **Phase 0** (already in place), not Phase 1B. Phase 1B enhancement is specifically about adding empirical concession-velocity reasoning via correlation engine queries — separate from the existing TTM comparable lookup the agent already does.

The Data Flow Spec should distinguish:
- **Phase 0 (existing):** TTM comparable lookup from owned portfolio — works today, gaps in submarket matching (see §4 of corrections)
- **Phase 1A (shipped):** stabilization-year computation from existing agent reasoning
- **Phase 1B (future):** empirical correlation-engine reasoning against populated historical_observations

---

## §4 — CORRECTIONS TO SURFACE MAP

### Correction 4.1 — Submarket equilibrium context source

**What the Surface Map claimed (CONSOLE > INPUTS, submarket equilibrium context):**
The submarket equilibrium context display alongside the stabilization threshold input was described as sourced from `costar_submarket_stats` or `apartment_market_snapshots`.

**What the audit verified:**
- `apartment_market_snapshots` has city-level Atlanta data (34 rows, Feb-May 2026) but submarket-level data is extremely sparse (1 row each for Midtown and Buckhead)
- `costar_submarket_stats` was not specifically verified in the audit — INFERRED-NOT-VERIFIED whether this table exists or has data
- `costar_market_metrics` (different table) has 0 rows

**Corrected framing:**
The submarket equilibrium context display source needs its own verification:
- Replit should grep for `costar_submarket_stats` and report whether it exists, schema, and current row count
- If it exists and has data: use it
- If it doesn't exist or has no data: fall back to displaying "Submarket equilibrium: insufficient data" rather than misleading the operator with city-level numbers labeled as submarket equilibrium

This is a small verification step that should happen during Phase 1A's submarket-context-in-Phase-1 implementation if not already addressed.

### Correction 4.2 — Header display for stabilization year

**What the Surface Map claimed (CONSOLE > PRO FORMA header):**
The header should display "Stabilized: Year N (annual approximation; monthly precision in Phase 2)" or similar.

**What the audit verified:**
Per Phase 1A task #1640 shipping, this header treatment is presumably implemented. The audit didn't verify the exact phrasing used.

**Corrected framing — no architectural change needed:**
The Surface Map's header display intent is correct. Verification step: Replit should confirm the actual header phrasing matches the architectural intent, and surface any divergence. Minor wording adjustments are operator preference, not architectural concerns.

---

## §5 — NEAR-TERM TACTICAL FIXES FROM AUDIT §4.1

The audit identified two near-term build items that are independent of Phase 1A and Phase 1B but worth surfacing as tactical fixes:

### Fix A — Submarket-matching gap in `fetch_owned_asset_actuals`

**Problem:** The tool's comparability scorer credits 40 points for submarket match, but the query uses `NULL::text AS submarket` on line 218. Submarket matching always falls back to the non-submarket case (full 40 pts credited to ALL assets when no submarket is specified). This silently inflates comparability scores across all comparisons.

**Resolution options:**
1. Add a `submarket` column to `deal_monthly_actuals` (populated when actuals are uploaded)
2. Join `properties` to a submarket lookup table at query time
3. Both (column on deal_monthly_actuals for historical accuracy + lookup for current properties)

**Priority:** Medium. The current behavior produces misleading comparability scores but doesn't crash. Worth fixing before Phase 1B, since Phase 1B's correlation queries will also need submarket alignment.

### Fix B — Deduplicate owned-portfolio identification

**Problem:** Two parallel mechanisms exist:
- `property_operating_data.is_owned BOOLEAN` (schema-defined, 0 rows populated) — NOT used by agent tooling
- `deal_monthly_actuals.deal_id IS NULL` + implicit UUID convention (`a1000001-...`) — actively used

**Resolution options:**
1. Adopt `deal_id IS NULL` + add `is_portfolio_asset BOOLEAN` to `deal_monthly_actuals` as the canonical mechanism
2. Use `property_operating_data.is_owned` consistently (requires migrating data and updating agent tooling)
3. Document the current convention explicitly and deprecate the unused mechanism

**Priority:** Low. Doesn't block any in-flight work, but the dual mechanism creates confusion and risks divergence over time.

---

## §6 — DATA INFRASTRUCTURE COMMITMENTS (Phase 1B preconditions)

The audit §4.3 named four data infrastructure items that are prerequisites for Phase 1B's correlation queries to produce useful results. These require operator decisions, not pure engineering:

### Item D.1 — `historical_observations` vendor feed at scale

**Current state:** 36 CoStar rows exist (from Task #1476 infrastructure). Vendor pipeline works but hasn't been fed at scale.

**Required for Phase 1B usefulness:** ~200+ property-quarters of Atlanta concession/signing data populated in `historical_observations`.

**Operator decision required:** vendor contract scope (CoStar coverage expansion, additional vendors, scraper infrastructure). Engineering can wire the pipeline; the data acquisition is business/contracting.

### Item D.2 — Stabilization outcome tracking schema

**Current state:** No table or column tracks actual stabilization dates per deal.

**Required for Phase 1B:** `stabilization_achieved_date` column on a deal-related table, OR a new `deal_outcomes` table with stabilization-relevant fields. Backfill of historical deals where outcomes are known.

**Operator decision required:** whether to commit to outcome tracking as a platform discipline. This is a schema commitment that has implications beyond Phase 1B (post-close intelligence, exit timing, realized-vs-underwritten variance tracking, etc.).

### Item D.3 — Owned portfolio expansion (geography coverage)

**Current state:** 2 DFW Texas + 1 suburban Atlanta property. No Atlanta Midtown or other urban Atlanta comparables.

**Required for Phase 1B:** 2-3 Atlanta urban comparables (manual upload or Yardi feed) to materially improve Tier 2 evidence for 464 Bishop-type deals.

**Operator decision required:** whether to actively pursue owned-portfolio expansion in target submarkets, or accept that platform reasoning will fall back to archive P50 for those geographies until organic deal flow fills the gap.

### Item D.4 — `costar_market_metrics` population

**Current state:** Table exists, has 0 rows. COR-22 always returns `confidence: 'insufficient'`.

**Required:** Populate with CoStar market-level data (rent, vacancy, absorption) for Sun Belt metros. Activates COR-22, improves multiple downstream signals.

**Operator decision required:** CoStar contract scope — does the platform's CoStar subscription include market metrics access? If yes, engineering can wire the import. If no, contract expansion is the gate.

---

## §7 — RECONCILIATION DOCUMENT UPDATES

The reconciliation document (target: `docs/architecture/ARCHITECTURE_RECONCILIATION.md`) should be updated with:

### New §6 entries

**Entry 6.X — Owned portfolio composition corrected (2026-05-31)**

Prior session memory described three owned properties (Jacksonville 2018+, Atlanta A 2020+, Atlanta B 2022+). Live SQL audit verified actual portfolio is:
- Frisco TX (4800 Spring Creek Pkwy, manual data, Jul 2024-Dec 2025, 94.7% occ)
- McKinney TX (1200 Eldorado Pkwy, manual data, Jul 2024-Dec 2025, 94.6% occ)
- Duluth GA (2789 Satellite Blvd, suburban Gwinnett, Yardi data, Dec 2021-Dec 2022, 95.0% occ)

All three observed at stabilized occupancy. No lease-up trajectory data for any owned property. No Jacksonville. No Atlanta Midtown.

**Entry 6.X — Correlation engine actual scope (2026-05-31)**

`CorrelationEngineService` (3,488 lines) computes 30 market-intelligence signals (COR-01..30) from `apartment_market_snapshots`, `apartment_trends`, `metric_time_series`. Answers "what is the market doing" — NOT "when will this deal stabilize."

Stabilization-underwriting correlation queries are a NEW analytical capability for the correlation engine, not refinement of its existing scope. Phase 1B requires both new query functions (1-2 days each) AND new data infrastructure (vendor feed scaling + stabilization outcome tracking schema).

### New §4 entry — Open architectural decision

**Decision Item F — Stabilization outcome tracking schema commitment**

Phase 1B's empirical reasoning requires `stabilization_achieved_date` per deal. No table currently tracks this. Three options:
1. Add column to existing `deals` or `deal_assumptions` table
2. New `deal_outcomes` table tracking stabilization, exit, realized returns, etc.
3. Defer until Phase 1B is closer (currently data-blocked)

Recommendation: Option 2 (new `deal_outcomes` table) — outcome tracking has implications beyond stabilization (exit timing, realized returns, post-close intelligence) and deserves dedicated schema. But this is an operator decision.

---

## §8 — WHAT THIS DOCUMENT IS NOT

- **Not a rewrite of the four Pro Forma Window documents.** The original documents stand; this document specifies redlines.
- **Not a new task batch.** Replit's task planning is informed by these corrections, not pre-empted.
- **Not exhaustive.** The audit found additional details (chart-of-accounts mapping, agent tool patterns, frontend consumer paths) that this corrections document doesn't address — those are reference material in the audit itself, not corrections to architectural framing.
- **Not a substitute for Replit's grep verification.** Where the audit didn't verify a specific claim (e.g., `costar_submarket_stats` existence, exact phrasing of shipped Phase 1A header), this document flags the need for verification rather than asserting an answer.

---

## §9 — FOLLOW-UP ACTIONS

After this corrections document is reviewed:

1. **Apply redlines to the four original documents.** Either inline (modify the source documents) or as a paired corrections-companion document.
2. **Reconciliation document update** per §7 above.
3. **Decision Item F** (stabilization outcome tracking) added to the open architectural decisions list.
4. **Submarket-matching gap (Fix A)** and **duplicate ownership identification (Fix B)** become tactical tasks for Replit's queue.
5. **Data infrastructure commitments (Items D.1-D.4)** surface as operator decisions, not engineering tasks.

The corpus moves from "target architecture with assumed substrate" to "target architecture with known substrate, explicit gaps named." That's the architectural discipline the audit produced.
