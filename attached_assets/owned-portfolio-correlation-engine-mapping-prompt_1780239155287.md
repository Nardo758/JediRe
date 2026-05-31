# JEDI RE — OWNED/PORTFOLIO + CORRELATION ENGINE MAPPING

**Task:** Read-only audit producing a comprehensive map of two architectural assets that the Pro Forma Window architecture (Lifecycle State Machine + Math Spec + Data Flow Spec) depends on. Surface code paths, schema, data state, and gaps. No code changes.

**Status:** Verification step before Pro Forma Window documents are treated as canonical. Phase 1A implementation depends on knowing what exists vs. what needs to be built.

**Reference docs:**
- `JEDI_RE_PROFORMA_WINDOW_MATH_SPEC.md` (assumes owned-portfolio data + correlation engine queries)
- `JEDI_RE_DEAL_LIFECYCLE_STATE_MACHINE.md` (profile detection thresholds may need owned-portfolio validation)
- `JEDI_RE_PROFORMA_WINDOW_DATA_FLOW_SPEC.md` (Phase 1B references correlation engine queries that may not exist yet)

---

## §1 — WHAT TO PRODUCE

A single output document: `docs/operations/OWNED_PORTFOLIO_AND_CORRELATION_ENGINE_MAP.md`

The document maps two assets across three layers each:

**Asset 1: Owned/Portfolio data (the three properties with historical access)**
- Per session memory: Jacksonville (2018+), Atlanta property A (2020+), Atlanta property B (2022+)
- No deal currently owned via JEDI RE; these are the three with direct historical data access

**Asset 2: Correlation Engine**
- Per session: correlation engine exists (referenced in `correlation-metrics-engine.jsx`, M36/M37/M38 in the JEDI methodology)
- Query layer against `historical_observations` for stabilization-underwriting questions does not yet exist (per Replit's confirmation)

For each asset, document:

**Layer 1 — Where the data lives**
- Actual table names
- Column names (especially the ones relevant to stabilization underwriting: occupancy over time, concession depth, asking rent vs. market rent, signing velocity, lease-roll data)
- Schema migrations that produced these tables
- Any relevant indexes or query-performance considerations

**Layer 2 — Where the read/write code lives**
- Service files that query these tables
- Route handlers that expose them via API
- Frontend components that consume the data
- Existing query functions and their signatures

**Layer 3 — What's actually in the data right now**
- For owned/portfolio: row counts per property, date range coverage, completeness of relevant columns for the three properties
- For correlation engine: which correlation queries currently work, which return empty, which fail; what historical_observations data density actually supports

---

## §2 — SPECIFIC QUESTIONS PER ASSET

### Asset 1 — Owned/Portfolio mapping

**Q1.1:** Where are the three owned/portfolio properties stored?
- Are they in the same `deals` / `properties` tables as other deals, distinguished by an ownership flag?
- Or in a separate owned-portfolio schema?
- What identifies them as "owned with historical access" vs. "deal records the platform processes"?

**Q1.2:** For each of the three properties (Jacksonville 2018+, Atlanta A 2020+, Atlanta B 2022+), what historical data exists?
- Month-by-month occupancy (column source, row count, date range)
- Month-by-month asking rent (column source, row count, date range)
- Month-by-month effective rent and concessions (column source, row count, date range)
- Lease-by-lease data with signing dates, lease terms, in-place rents
- Renovation history (when units were renovated, premium captured)
- Operating expense history (OpEx by line by month)
- Vendor/source attribution per data point

**Q1.3:** How does owned/portfolio data flow into the Cashflow Agent's reasoning today?
- Does the agent read owned-portfolio data when reasoning about deals in the same submarket?
- Is there a "comparable owned property" lookup the agent uses?
- If not, what's the path from owned-portfolio data → agent reasoning?

**Q1.4:** For validating the Lifecycle State Machine's profile detection thresholds:
- Across the three owned properties, what did their lease-up trajectories actually look like?
- Did Atlanta A's lease-up match what the platform would have predicted under VALUE-ADD profile defaults?
- Did Jacksonville's stabilization timing match what DEVELOPMENT or STABILIZED profile predictions would have produced?
- Use this data to validate or surface needed adjustments to the universal thresholds in the Lifecycle doc §3.

**Q1.5:** For the Math Spec's worked 464 Bishop example to be replaced with verified inputs:
- What's the canonical source of `market_rent_per_unit` for Atlanta Midtown right now?
- What's the canonical source of stabilized OpEx per unit for similar Class B properties in Atlanta?
- What's the source for `renovation_premium_per_unit_monthly` assumptions?
- Where does Atlanta A's actual renovation premium history live, if anywhere?

### Asset 2 — Correlation Engine mapping

**Q2.1:** What does the correlation engine actually compute today?
- File path of the correlation engine implementation
- Function signatures of the existing correlation computations
- What tables does it currently query? (Per earlier confirmation: `market_snapshots`, `costar_market_metrics`, `deal_traffic_snapshots`. Verify and add any others.)
- What outputs does it produce — what's the shape of a correlation result?

**Q2.2:** What's missing for stabilization-underwriting questions?
- The specific query "what concession depth correlates with what signing velocity in submarket X" — does the function exist? What would need to be built?
- The query "what's the time-to-stabilization for value-add deals at starting occupancy Y in submarket Z" — exists? Needs build?
- The query "what's the empirical relationship between rent positioning and lease velocity in submarket W" — exists? Needs build?

**Q2.3:** What's `historical_observations` actually populated with?
- Row count overall
- Row count for the three owned properties specifically
- Row count for Atlanta Midtown submarket (which would be 464 Bishop's market)
- Date range coverage
- Which columns are well-populated (>80% of rows have non-null values) vs. sparse
- Specifically: `property_concession_per_unit`, `property_asking_rent`, `property_signing_velocity`, `realized_occupancy_change_t12`, `realized_signing_velocity_t12` — how many rows have these values?

**Q2.4:** For the correlation engine's Phase 1B build cost:
- Roughly how complex is building the missing query functions for stabilization underwriting? (Days vs. weeks vs. month-scale)
- What's blocking it beyond just "write the query"? (Data density? Submarket boundary alignment? Coefficient interpretation logic?)
- Are there existing patterns in the correlation engine for similar query types that the new queries can follow, or would they need new infrastructure?

**Q2.5:** Statistical significance threshold:
- What sample size makes a correlation coefficient meaningful for the platform's purposes?
- How does the correlation engine currently handle low-sample correlations? (Suppress? Flag low confidence? Display anyway with caveat?)
- For Phase 1B's "wait for historical_observations to reach data density" precondition — what's the actual threshold?

---

## §3 — OUTPUT STRUCTURE

The deliverable document should have this structure:

```
# OWNED/PORTFOLIO + CORRELATION ENGINE MAP

## §1 — Asset 1: Owned/Portfolio
  §1.1 Where the data lives (Layer 1)
       - Tables and columns
       - Schema migrations
  §1.2 Where the code lives (Layer 2)
       - Services and routes
       - Frontend consumers
  §1.3 Data state (Layer 3)
       - Per-property row counts and date ranges
       - Per-property completeness assessment
  §1.4 Answers to Q1.1 through Q1.5

## §2 — Asset 2: Correlation Engine
  §2.1 Where the data lives (Layer 1)
       - historical_observations schema (relevant columns)
       - Other tables the engine queries
  §2.2 Where the code lives (Layer 2)
       - correlation-metrics-engine.jsx
       - computeCorrelations function and its callers
       - Frontend consumers
  §2.3 Data state (Layer 3)
       - historical_observations row counts and coverage
       - Per-submarket coverage for stabilization-relevant questions
  §2.4 Answers to Q2.1 through Q2.5

## §3 — Implications for Pro Forma Window architecture documents
  §3.1 Which claims in the Math Spec need updating based on actual asset state
  §3.2 Which claims in the Lifecycle State Machine need profile-threshold adjustment
  §3.3 Which claims in the Data Flow Spec need correlation-engine path adjustment
  §3.4 Phase 1A vs Phase 1B scope confirmation based on what actually exists

## §4 — Recommended follow-up work
  §4.1 Build items needed for Phase 1A (probably small)
  §4.2 Build items needed for Phase 1B (correlation engine queries)
  §4.3 Data infrastructure items (historical_observations population)
  §4.4 Surfacing items (owned-portfolio data → agent reasoning paths)
```

---

## §4 — WHAT THIS IS NOT

- **Not implementing anything.** Read-only audit.
- **Not refactoring the existing assets.** Mapping only.
- **Not exhaustive across all platform data.** Specifically scoped to owned/portfolio and correlation engine.
- **Not a corpus rewrite.** Findings inform document corrections; this audit doesn't rewrite the four Pro Forma Window documents directly.

---

## §5 — TIMELINE

This is a focused mapping audit. Realistic timeline: 2-3 days for thorough investigation + writeup.

If scope expands materially (e.g., owned-portfolio data turns out to live across more places than expected, or the correlation engine has significantly more or less infrastructure than memory suggests), surface the expansion rather than truncating.

Per CLAUDE.md P8 and P11: state-verify every claim against live code and live data. Names, section headings, design specs, and prior conversation are not evidence of implementation. A claim about current behavior that cannot be grounded in a specific code reference should be reframed as inferred-not-verified.

---

## §6 — WHY THIS AUDIT MATTERS

Three reasons:

**First, the Pro Forma Window documents make claims about both assets** that need verification before treating as canonical. The Math Spec's worked example uses placeholder owned-portfolio data; the Phase 1B references to correlation engine queries assume infrastructure that may or may not exist. Verification turns the documents from "target architecture with assumed substrate" into "target architecture with known substrate."

**Second, the Cashflow Agent's reasoning quality depends on these assets.** The agent's stabilization-year computation and lifecycle profile classification benefit from owned-portfolio comparables and correlation-derived coefficients. Without knowing what's actually queryable, agent reasoning falls back to platform defaults rather than empirical anchoring — which is the analytical depth the Bloomberg Terminal positioning depends on.

**Third, the next phase of work has to land on solid ground.** Phase 1A ships against Phase 1A assumptions; Phase 1B's correlation-engine work depends on the engine's actual state. Sequencing those phases requires knowing what's actually available now.

The audit's output is the foundation for both task drafting and architectural document correction.
