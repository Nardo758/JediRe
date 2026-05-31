# JEDI RE — INVESTOR RETURNS CAPABILITY MAPPING AUDIT

**Task:** Read-only audit producing a comprehensive map of the platform's existing investor-returns capability across the full chain: ingestion → debt service → distributable cash → waterfall → per-investor distributions → reporting surfaces. Surface what exists in code, what works, what's broken, what's missing. No code changes.

**Status:** Verification step before any new investor-returns architecture is drafted. Operator framing: "Most of the architecture is in place, just needs refinement." This audit grounds that claim — surfaces what exists so refinement plans target real code, not assumed code.

**Companion to:** The recently-completed Owned/Portfolio + Correlation Engine Map (2026-05-31), which applied the same discipline to those two assets and surfaced significant corrections to prior architectural claims.

**Reference docs:**
- BPI Financial Package sample (Bell Partners, Portiva p1842, Dec 2021 — analyzed in session for chart-of-accounts structure)
- Pro Forma Window architecture documents (Surface Map, Lifecycle State Machine, Math Spec, Data Flow Spec) — these describe Phase 1A scope; investor returns is downstream of stabilization underwriting
- Pieces A-D vendor architecture documents — capital structure references throughout

---

## §1 — WHAT TO PRODUCE

A single output document: `docs/operations/INVESTOR_RETURNS_CAPABILITY_MAP.md`

The document maps seven layers of the investor-returns capability across three concerns each:

**Layer 1 — Property operating data ingestion (BPI / Yardi / RealPage / AppFolio / manual)**
**Layer 2 — Loan data and debt service**
**Layer 3 — Operating agreement and waterfall structure**
**Layer 4 — Capital accounts (LP/GP contributions, distributions, accrued preferred return)**
**Layer 5 — Cash flow computation chain (NOI → debt service → working capital → distributable cash)**
**Layer 6 — Waterfall execution (distributable cash + waterfall config + capital account state → per-investor distributions)**
**Layer 7 — Reporting surfaces (F6 Returns, per-investor views, capital account statements, distribution history)**

For each layer, document:

**Concern A — Where the data/code lives**
- Tables, columns, schema (Layer 1-4)
- Services, route handlers, agent tools (Layers 5-6)
- Frontend components, page paths (Layer 7)
- Existing function signatures and what they currently do

**Concern B — Current data state**
- Row counts where relevant
- Population status of key columns
- Verified examples (e.g., does any deal currently have a complete end-to-end investor-returns computation?)

**Concern C — Gaps and broken paths**
- What's schema-defined but unpopulated
- What's coded but unmounted (per audit pattern that found `investor-capital.routes.ts` unmounted earlier this session)
- What's partially wired (UI write path missing, API endpoint exists but no consumer, etc.)
- What's missing entirely

---

## §2 — SPECIFIC QUESTIONS PER LAYER

### Layer 1 — Property operating data ingestion

**Q1.1:** What ingestion paths currently exist for property operating data?
- Manual entry to `deal_monthly_actuals` (audit confirmed this works for the two DFW TX properties)
- Yardi-sourced ingestion (audit confirmed Duluth GA has `data_source='yardi'`) — how does this work? Is there an active Yardi connector or one-time import script?
- BPI Financial Package ingestion (Bell Partners' Yardi-style format) — does the platform currently ingest BPI files? If so, where does the parsing happen, what's the chart-of-accounts mapping, and what tables receive the data?
- RealPage / AppFolio / other property management formats — do any ingestion paths exist?

**Q1.2:** Chart-of-accounts mapping
- Bell Partners uses Yardi-style 4-digit account codes (43101000 Market Rent, 53000000-series controllable expenses, 60000000-series non-controllable, 70000000-series capital items)
- Does a chart-of-accounts mapping layer exist? If yes, what does it map from/to?
- Is the mapping property-management-platform-specific (Yardi vs. RealPage vs. AppFolio) or generalized?
- What canonical platform fields are the source-side accounts mapped to?

**Q1.3:** Time-series granularity for ingestion
- BPI's "13 Month Rolling" sheet provides month-by-month data for every line item
- Does the platform currently ingest this granularity, or aggregate to monthly summaries at ingestion?
- If aggregated: what's lost? If monthly: where is it stored?

### Layer 2 — Loan data and debt service

**Q2.1:** Loan data schema
- Grep for `deal_debt_schedule`, `loan`, `debt`, `amortization`, `mortgage` in schema files
- Report what tables exist for loan data, what columns, what's the relationship to deals/properties
- Verify: does `deal_debt_schedule` exist? Earlier audit found it exists but rows are empty for 464 Bishop

**Q2.2:** Amortization schedule handling
- For new acquisitions (operator-entered loan terms): does the platform compute an amortization schedule programmatically? Where?
- For owned/closed deals (uploaded loan amortization schedule): is there an upload path?
- How is monthly P&I split computed and stored?
- Is interest expense readable from the schedule for P&L purposes, or is it derived from a different source?

**Q2.3:** Multi-tranche debt and refinance events
- Can the platform handle multiple debt tranches (senior + mezz, A-note + B-note, multiple loan generations)?
- Does any deal currently have multiple debt instruments?
- How are refinance events handled (loan replacement mid-hold)?

**Q2.4:** Debt service in P&L flow
- BPI shows Interest Expense ($1,816,315.56 YTD for Portiva) under "Other Income & Expenses"
- BPI's "Adjustments to Cash Flow" shows "Less: Mortgage Principal" but with zeros (Bell Partners apparently tracks principal at entity level)
- How does the platform's cash flow chain compute debt service? Does it read from BPI-style ingestion, from `deal_debt_schedule`, or from a derived schedule?

### Layer 3 — Operating agreement and waterfall structure

**Q3.1:** Waterfall configuration storage
- Grep for `waterfall`, `tier`, `preferred_return`, `promote`, `catch_up`, `lp_share`, `gp_share`
- Report what tables/columns store waterfall structure
- Is there a `deal_waterfall_config` table? What's its schema?
- The `waterfall_distributions` JSONB pattern was referenced earlier — what does it actually contain and where is it stored?

**Q3.2:** Operator-entered waterfall (new acquisitions)
- For new acquisitions, can the operator configure a waterfall through the UI? Where?
- What waterfall structures are supported (simple LP preferred + promote, multi-tier with catch-up, IRR-based, etc.)?
- Are there default waterfall templates, or every deal configures from scratch?

**Q3.3:** Operating agreement extraction (owned/closed deals)
- For deals where the operating agreement exists as a PDF, is there extraction infrastructure?
- Does any deal currently have a waterfall configuration sourced from an operating agreement?
- If extraction infrastructure doesn't exist, what's the current manual workflow (operator reads OA, types into UI, etc.)?

**Q3.4:** LP/GP wiring on the model side
- Tasks #1522, #1523, #1525 were merged on the model side per session memory
- Verify: what do these tasks actually do? What does the LP/GP wiring look like in code?
- Does the model side produce LP-specific and GP-specific cash flows, or does it produce aggregate cash flow with LP/GP split as a separate step?

### Layer 4 — Capital accounts

**Q4.1:** Capital account schema
- Grep for `capital_account`, `capital_contribution`, `capital_call`, `accrued_preferred`, `unreturned_capital`, `lp_capital`, `gp_capital`
- Report what tables/columns exist for capital account tracking
- Is there a `capital_accounts` table? What's its schema?
- Does any deal currently have a populated capital account history?

**Q4.2:** Contribution and distribution ledger
- How are LP and GP contributions tracked (initial + capital calls)?
- How are distributions per investor tracked over time?
- Is there a transaction-level ledger or only summary balances?

**Q4.3:** Accrued preferred return tracking
- How is accrued preferred return computed and stored?
- Compounding vs. simple? Annual vs. monthly accrual?
- Where does the rate come from (waterfall config? per-tier basis?)?

**Q4.4:** Historical capital account migration
- For owned/closed deals with historical capital account records (you confirmed these are available for owned-portfolio properties), is there an import path?
- Or is this currently a manual workflow?

### Layer 5 — Cash flow computation chain

**Q5.1:** Cash flow computation service
- Grep for services that compute cash flow from operating data
- Specifically: what service produces the NOI → debt service → distributable cash chain?
- Is this `buildProjectionsForExport`, a separate service, or distributed across multiple services?

**Q5.2:** Working capital adjustments
- BPI Balance Sheet provides AR aging, AP aging, security deposits, prepaid rent
- Does the platform's cash flow chain currently adjust accrual NOI to cash basis using working capital changes?
- If yes, what's the source for working capital data? If no, is the platform's cash flow effectively accrual-basis distributable cash?

**Q5.3:** Capital expenditures handling
- BPI shows "Less: Capital Expenditures" in the Adjustments to Cash Flow section (-$72K YTD for Portiva)
- How does the platform handle capex in the cash flow chain? Same flow as BPI (subtract from net income to get distributable cash)?
- Where do recurring capex vs. one-time capex distinctions live?

**Q5.4:** End-to-end computation verification
- For any deal in the platform, does the full chain currently compute end-to-end?
- Specifically: pick one deal where capital structure data is most complete (likely 464 Bishop given the audit traffic in this session). Walk through the chain from NOI to "distributable cash available to investors" and report whether each step has a working computation or a gap.

### Layer 6 — Waterfall execution

**Q6.1:** Waterfall execution service
- Grep for services or functions that execute the waterfall (compute per-investor distribution given distributable cash + waterfall config + capital account state)
- Does this exist as a dedicated service, or is it inline in `buildProjectionsForExport` or similar?
- What's the function signature, what inputs does it require, what does it return?

**Q6.2:** Waterfall execution per period
- Does the execution run period-by-period (each month/year, updating capital account state), or does it compute aggregate returns over the hold period?
- How does it handle in-period vs. end-of-period accrual?

**Q6.3:** Realized vs. projected waterfall
- For owned/closed deals, can the platform reconcile the waterfall against actual historical distributions?
- For new acquisitions, the waterfall is projected forward — but is the projection consistent with how it would execute against realized cash flows?

**Q6.4:** Multi-tier complexity
- What waterfall structures does the execution engine currently support?
- Simple two-tier (preferred + promote)?
- Multi-tier with GP catch-up?
- IRR-based hurdles?
- Are there waterfall structures the engine can't handle?

### Layer 7 — Reporting surfaces

**Q7.1:** F6 Returns current state
- What does the F6 Returns surface currently display?
- IRR, EM, cash-on-cash — at what granularity (aggregate, LP-only, GP-only, per-investor)?
- Where does F6 read its data from?

**Q7.2:** Per-investor views
- Does any surface currently display per-investor distributions or per-investor returns?
- If yes, where (page paths, components)?
- If no, what's the current operator workflow for per-investor reporting?

**Q7.3:** Capital account statements
- Does any surface display capital account statements (contributions, distributions, accrued preferred, unreturned capital balance)?
- If yes, where? If no, what's the gap?

**Q7.4:** Distribution history
- Is there a surface showing historical distributions with waterfall provenance (Tier 1: preferred return paid, Tier 2: return of capital, Tier 3: promote captured)?
- If yes, where? If no, this is a Layer 7 gap to surface.

**Q7.5:** `investor-capital.routes.ts` status
- Per earlier audit, this file was found to be unmounted
- What's in the file? What endpoints does it expose?
- Why was it never mounted? Is it complete-but-disconnected, partial, or stale?
- Should it be mounted, or should something else?

---

## §3 — CROSS-LAYER QUESTIONS

### Q-X.1 — Three-deal-type readiness

The architecture serves three deal-type profiles:
1. Owned-portfolio (historical BPI + loan amortization + operating agreement + capital accounts all available)
2. New acquisitions (operator-entered underwriting; platform projects forward)
3. Closed third-party in-place operating (operator has data but in various formats)

For each deal-type, walk through the seven layers and report:
- Which layers currently work end-to-end
- Which layers have partial support
- Which layers don't work at all
- What's the highest-leverage gap to close per deal-type

### Q-X.2 — Existing investor-returns end-to-end examples

Pick the deal in the platform with the most complete capital structure and walk through the full investor-returns chain. Report:
- Starting input: NOI from `deal_monthly_actuals` or projection
- Debt service: where it comes from, whether interest+principal both available
- Distributable cash: computation correct?
- Waterfall config: present? accurate?
- Capital account state: present? accurate?
- Per-investor distribution: computable?
- Reported in any UI?

This walkthrough surfaces the actual operational gaps better than feature-by-feature inventory.

### Q-X.3 — Comparison to the Pro Forma Window architecture

The Pro Forma Window architecture (Surface Map, Lifecycle State Machine, Math Spec, Data Flow Spec) covers stabilization underwriting — which is the *operating performance* side. Investor returns is the *capital structure* side.

How do the two architectures relate in code today?
- Does the stabilization-year computation flow into the investor-returns chain (correct stabilized NOI → correct cap-rate valuation → correct exit proceeds → correct waterfall input)?
- Or are they architecturally disconnected?
- If disconnected, what would connection look like?

---

## §4 — OUTPUT STRUCTURE

The deliverable document should have this structure:

```
# INVESTOR RETURNS CAPABILITY MAP

## §1 — Layer 1: Property Operating Data Ingestion
  §1.1 Where the data/code lives
  §1.2 Current data state
  §1.3 Gaps and broken paths
  §1.4 Answers to Q1.1 through Q1.3

## §2 — Layer 2: Loan Data and Debt Service
  [same three-concern structure]
  Answers to Q2.1 through Q2.4

## §3 — Layer 3: Operating Agreement and Waterfall Structure
  Answers to Q3.1 through Q3.4

## §4 — Layer 4: Capital Accounts
  Answers to Q4.1 through Q4.4

## §5 — Layer 5: Cash Flow Computation Chain
  Answers to Q5.1 through Q5.4

## §6 — Layer 6: Waterfall Execution
  Answers to Q6.1 through Q6.4

## §7 — Layer 7: Reporting Surfaces
  Answers to Q7.1 through Q7.5

## §8 — Cross-Layer Findings
  §8.1 Three-deal-type readiness matrix
  §8.2 End-to-end walkthrough on most-complete deal
  §8.3 Relationship to Pro Forma Window architecture

## §9 — Recommended Refinement Work
  §9.1 Tactical fixes (unmount-and-fix items, schema cleanups, UI write paths)
  §9.2 New build items (only what's genuinely missing, not what's broken)
  §9.3 Data infrastructure items (operator decisions, not engineering)
  §9.4 Architectural commitments needed (e.g., schema decisions, multi-tier waterfall support)
```

---

## §5 — TIMELINE

This is a substantial mapping audit covering seven layers across the platform. Realistic timeline: **4-6 days** for thorough investigation + writeup, given the scope is roughly equivalent to two of the earlier audits (Deal Details UI/Backend audit + Owned-Portfolio + Correlation Engine audit) combined.

If scope expands materially during investigation (e.g., investor-capital.routes.ts turns out to be substantially more or less complete than expected, or waterfall execution exists in unexpected places), surface the expansion rather than truncating.

Per CLAUDE.md P8 and P11: state-verify every claim against live code and live SQL queries. Names, section headings, and prior conversation are not evidence of implementation. Claims that cannot be verified should be flagged INFERRED-NOT-VERIFIED.

---

## §6 — WHY THIS AUDIT MATTERS

Three reasons it deserves the scope:

**First, the operator framing was "most of the architecture is in place, just needs refinement."** This audit grounds that claim. If refinement is the right framing, the audit produces the gap analysis that targets specific refinements. If it turns out more is missing than expected, the audit surfaces that honestly.

**Second, investor returns is the platform's terminal value proposition.** All the upstream work (operating data, underwriting, stabilization reasoning, capital structure) culminates in investor-specific return projections. Operators evaluate deals based on these numbers. Without solid end-to-end investor-returns capability, the upstream work doesn't deliver its value.

**Third, the eight-document architectural plan was held pending this audit.** The decision to NOT draft 100-150 pages of greenfield architecture for investor returns was made specifically because the platform may already have most of what's needed. This audit determines whether refinement plans or new architecture is the right artifact.

The audit's output IS the artifact that determines what gets built next. It's the highest-leverage discovery work in front of the operator right now.

---

## §7 — WHAT THIS AUDIT IS NOT

- **Not implementing anything.** Read-only audit.
- **Not redesigning the capability.** Mapping only.
- **Not exhaustive across all platform features.** Specifically scoped to investor-returns capability.
- **Not a substitute for the corrections document on Pro Forma Window architecture.** That corrections work runs in parallel as document updates; this audit produces the next phase of grounded architecture work.

---

## §8 — SEQUENCING

This audit informs but doesn't block:

- Tactical fixes from the prior Owned/Portfolio audit (submarket-matching gap, duplicate ownership identification) can ship in parallel
- Pro Forma Window architecture corrections (separate document) apply to the existing four documents independently
- Phase 1B preconditions (vendor feed scaling, stabilization outcome tracking schema) progress independently
- Any in-flight Replit work (Phase 1A follow-ups, vendor architecture tasks, conflation tasks) is independent

This audit is the foundation for the next architectural workstream (investor-returns refinement plan), but it doesn't gate work already in motion.
