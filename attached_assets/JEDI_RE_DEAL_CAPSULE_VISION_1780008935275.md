# JEDI RE — DEAL CAPSULE ARCHITECTURE VISION

**Purpose:** Communicate the architectural vision of the Deal Capsule to Replit so it understands the *goal* the work is building toward, not just the next dispatch. The other planning documents say *what to build*. This one says *what the pieces are building into* — so engineering decisions on individual features can be made in service of the whole.

**Audience:** Replit's implementation agent, future contributors, anyone making architectural decisions on the platform.

**Status:** Vision document. Several elements reference infrastructure that may itself need scoping (flagged inline). Per CLAUDE.md P8, state-verify before treating any "currently exists" claim as confirmed.

---

## THE VISION IN ONE PARAGRAPH

The Deal Capsule is the **complete, self-contained unit of one real estate deal**. It is both (1) a live underwriting workspace where the operator, the agents, and the user collaborate across four data layers — platform-derived data, deal-specific document library, market data, and the operator's owned-portfolio actuals — to build a defensible F9 ProForma, and (2) a portable artifact that can be shared with partners, IC committees, lenders, and equity partners with specific pieces frozen at the moment of share, confidential evidence redacted, and the underlying reasoning preserved. Every closed deal feeds back into the platform's evidence corpus, becoming Tier 2 ground-truth that improves the next capsule's underwriting. The capsule is the platform's primary unit of work, the operator's primary deliverable, and the loop that makes the platform learn.

---

## THE GOVERNING PRINCIPLES

Three commitments shape every capsule design decision:

1. **Self-contained.** Everything needed to understand the deal lives in (or is referenced by) the capsule. A recipient should not need access to JEDI's broader platform state to evaluate the underwriting.
2. **Defensible.** Every assumption traces to evidence; every calculation traces to a formula; every override is logged. The capsule's audit trail is the product, not a side effect.
3. **Bidirectional with the platform.** The capsule *consumes* platform intelligence (research agent, owned-portfolio actuals, market data) on the way in. It *produces* evidence (closed deal becomes Tier 2 for future deals via M22) on the way out. It is not a one-way export.

---

## PART 1 — THE FOUR DATA LAYERS

Every capsule merges four data sources. Each has different ownership, confidentiality, and lifecycle properties.

### Layer 1 — Platform-derived data
**Source:** Research agent pulls from public/licensed sources (county records, ArcGIS, Municode, RentCast, FRED, BLS, Google Places, etc.) keyed off the deal's address.
**Ownership:** Platform-owned, shared across all operators (with operator-specific configuration possible).
**Confidentiality on share:** Generally open — sourced from public/licensed data; defensible to expose.
**Lifecycle:** Refreshes per the research agent's caching/scheduling rules; has implicit as-of dates that matter for backtesting and freshness indicators.

### Layer 2 — Deal-specific document library
**Source:** Operator uploads to the deal's data library — OM, T12, rent roll, broker package, PSA, tax bills, appraisal, environmental reports, etc.
**Ownership:** Operator-owned, scoped to this capsule.
**Confidentiality on share:** Generally shareable with recipients (it's what you'd send anyway in a deal package); operator should be able to choose which documents accompany a shared capsule.
**Lifecycle:** Persistent; users need full CRUD (upload, view, download, delete). **Currently broken — see Part 8.**
**Critical role:** This is Tier 1 evidence — the actual deal data the agent reasons against as its highest-authority source. Without functional CRUD, operators can't curate what feeds their underwriting.

### Layer 3 — Market data (deal-adjacent, operator-uploaded)
**Source:** Operator uploads CoStar exports, broker market reports, submarket performance pulls, sale/rent comp packages — *deal-relevant market context that the platform doesn't have natively*.
**Ownership:** Operator-uploaded, ingested into shared platform tables (`market_sale_comps`, `market_rent_comps`, etc.) with provenance preserved.
**Confidentiality on share:** Generally shareable — it's market context, not proprietary; CoStar licensing terms may impose constraints worth verifying.
**Lifecycle:** Ingested via parser (D-COSTAR-2), deduped against platform comps (D-COSTAR-3), stays in the comp inventory. Once ingested, benefits future capsules in the same market.
**Critical role:** This is the P10 Layer 2 gap-fill — operator-uploaded data filling platform coverage holes until research agent integrations mature.

### Layer 4 — Owned-portfolio actuals (operator-private)
**Source:** Operator's own portfolio performance — TTM, TTM-24, per-line-item OpEx ratios, achieved rents, vacancy patterns. Sourced via M22 Post-Close from operator's closed deals plus any direct portfolio import.
**Ownership:** **Operator-private.** This is the operator's competitive edge — actuals from properties they actually operate that no third-party tool can match.
**Confidentiality on share:** **Must redact on external share.** Internal recipients (operator's own IC, partners under NDA) may see; external recipients (lenders, equity partners, third parties) see the *result* of Tier 2 reasoning, never the underlying portfolio data.
**Lifecycle:** Continuously accumulating as deals close; M22 ingests `deal_monthly_actuals`; aggregation produces TTM rollups per asset; comparability scoring matches owned assets to subject deals.
**Critical role:** This is what makes JEDI's underwriting structurally better than generic tools. The cashflow agent already has `fetch_owned_asset_actuals` / `fetch_owned_asset_opex_ratios` per the agent spec. The capsule must make this layer first-class.

### The precedence rule
When the four layers disagree on the same field (a common case for OpEx — tax bill in library, owned-portfolio average, platform default), the cashflow agent's tier authority applies:
- **Tier 1 (deal documents)** wins on this deal — T12, rent roll, tax bill are ground truth for this specific property
- **Tier 2 (owned-portfolio)** wins on assumptions where this property has no actuals — operator's own actuals on comparable assets beat market averages
- **Tier 3 (platform-derived + market)** is the fallback when neither Tier 1 nor Tier 2 has data
- **Tier 4 (broker OM)** is collision-detection only, never authoritative

The Validation Grid must surface the precedence visibly: operators need to see *that* T12 won over platform default for property tax, not just see the resulting number.

---

## PART 2 — THE AGENT-USER COLLABORATION MODEL

The capsule is where agents and users meet. The model needs to be explicit so the same logic governs every surface.

### Authority over assumptions
- **Agents reason first.** The cashflow agent produces an initial set of assumptions with LayeredValue source provenance, evidence trail, and alternatives_considered per the agent spec.
- **Users override second.** Any agent-produced assumption can be overridden by the operator; overrides are persisted as `source: override` with optional reason.
- **Agent re-runs preserve overrides.** Per Mandate v1.3, when the agent re-runs, user overrides survive — the agent re-derives only the fields the user hasn't touched (or re-derives all and the override layer wins on display).
- **The Reset-to-Agent affordance must always be available.** Operators must be able to revert an override back to the agent's value with one action.

### Authority over calculations
- Per the calc-vs-assumption boundary (`JEDI_RE_F9_CALCULATIONS_VS_ASSUMPTIONS.md`), users override *assumptions*, not calculations. Calculations recompute from current assumptions.
- The capsule must enforce this: if a user attempts to write to a calculated field directly, the UI should redirect them to overriding the underlying assumption(s).

### Authority over documents
- Users own the data library — full CRUD (upload, view, download, delete) is non-negotiable.
- Agents *read* the data library via parsers (T12, rent roll, tax bill, OM). Agents do not modify documents.
- Document deletions should be soft (recoverable) for audit trail integrity, with explicit hard-delete option.

### Authority over the capsule's state
- Users own state transitions (draft → reviewed → shareable → archived).
- Agents propose state-related actions (e.g., "all required documents now present, ready for review") but cannot transition state autonomously.

---

## PART 3 — DEAL-TYPE VARIANTS

The capsule's contents vary by deal type. `resolveProjectType(deal)` routes the variant at intake; the variant determines which surfaces are primary content vs absent.

| Deal Type | Primary Content | Tier 1 Inputs | Special Considerations |
|---|---|---|---|
| **Existing / Stabilized Acquisition** | F9 ProForma anchored to trailing actuals | T12, rent roll, tax bill | Cap×NOI is dominant valuation method; renovation surfaces absent |
| **Value-Add (subtype of Existing)** | F9 ProForma + renovation program model | T12, rent roll, tax bill, **rent-ceiling-gap comp set** | Two comp sets surfaced — current-condition + renovated; story is the gap |
| **Lease-Up** | F9 ProForma + absorption curve from M07 | Construction budget, unit mix, delivery schedule | No T12; ground truth is construction basis; transitions to Existing post-stabilization |
| **Ground-Up Development** | **F9 ProForma + 3D massing model (primary content, not viewer)** | Zoning entitlement, construction cost basis, land basis | M02→M03→M08→M09 Keystone cascade is visible in capsule; massing IS the capacity assumption |
| **Redevelopment** | F9 ProForma (phased) + 3D massing + transition plan | Partial T12, redevelopment scope budget | Hybrid; phased capsule shows current ops + repositioning + stabilized states |

### The 3D massing as primary content (development & redevelopment)

For ground-up development and redevelopment capsules, the 3D massing model is **not a visualization attached to the side** — it is the capacity model that produces the assumptions feeding the ProForma. Buildable SF, unit count, parking ratios, FAR/height envelope compliance are *F9 assumptions* whose values come from the Three.js solver running against zoning constraints from M02.

Architectural implication:
- The 3D massing must be a first-class capsule surface for these deal types.
- The Keystone cascade (M02 zoning → M03 dev capacity → M08 strategy → M09 proforma) must be visible *as a cascade* — the operator should see that this proforma rests on this massing rests on this zoning interpretation.
- When zoning interpretation changes, the cascade re-fires; the capsule shows the chain of consequences.
- When the capsule is shared, the resolved massing solution travels with it (see Part 5 for what "travels" means for an interactive 3D scene).

### What's NOT in the capsule per deal type
Existing acquisitions don't carry 3D massing or zoning-entitlement surfaces. Ground-up developments don't carry T12 or rent roll (the property doesn't exist yet). The capsule's content is *deal-type-shaped* — same conceptual structure, different surfaces populated.

---

## PART 4 — THE STATE MODEL

A capsule isn't just "data" — it's data in a particular state of underwriting. The state model:

| State | Meaning | Who can mutate | Shareable? |
|---|---|---|---|
| **Draft** | Just created; data being assembled; agent may or may not have run yet | Operator, agents | No (or only as draft, with explicit warning) |
| **Agent-reasoned** | Agent has produced initial assumptions; user hasn't yet reviewed | Operator | No (not yet operator-validated) |
| **Under Review** | Operator is reviewing/overriding agent output | Operator | No |
| **Operator-Approved** | Operator has signed off on the underwriting | Operator (can revert to Under Review) | **Yes — primary share state** |
| **Shared (Active)** | Capsule has been shared with at least one external recipient | Operator (with notification to recipients on changes) | Already shared |
| **Closed** | Deal has been acquired/funded | Operator (limited — overrides post-close for record-keeping) | Yes — historical record |
| **Archived** | Deal not pursued or closed > N months ago | None (read-only) | Yes — historical record |

### State transitions
- **Forward transitions are operator-driven.** Agents propose ("all required documents present, ready for Operator Review") but never transition autonomously.
- **Backward transitions are allowed but logged.** Operator can move Operator-Approved → Under Review if something needs revisiting; the transition is in the audit log and any active shared recipients should be notified.
- **Closed → Archived is automatic** after configurable inactivity threshold.
- **Closed triggers M22 Post-Close pipeline** — the capsule transitions to being a source of Tier 2 evidence for future capsules (see Part 7).

---

## PART 5 — PORTABILITY: THE FREEZE-ON-SHARE RULE

When a capsule is shared, **specific elements freeze at share-time** while others remain live. This resolves the workspace/artifact tension: the recipient sees a defensible snapshot of the underwriting at the moment of share, with optional live overlays where useful.

### The freeze-on-share classification

| Element | Freeze on share? | Rationale |
|---|---|---|
| **ProForma version (assumptions + calculations)** | **FROZEN** | Recipient must see exactly what was sent; silent drift after share is unacceptable |
| **Valuation Grid output** | **FROZEN** | Method values, reconciliation, recommended Purchase Price |
| **Validation Grid evidence trail** | **FROZEN** | Per-assumption source, tier, confidence as of share |
| **Agent reasoning / commentary narrative** | **FROZEN** | The "why" matches the "what" |
| **Documents in the data library** | **FROZEN** | Recipient sees the document set as it existed at share — adding/removing documents post-share creates a new version |
| **3D massing model (resolved geometry)** | **FROZEN** | Massing is part of the underwriting — must match the proforma it produced |
| **3D interactive view** | **CONDITIONAL** | Static rendered image always; interactive view if recipient has JEDI account (see implementation note below) |
| **Owned-portfolio Tier 2 evidence (raw data)** | **REDACTED on external share** | Confidentiality — see Part 1 Layer 4 |
| **Owned-portfolio Tier 2 evidence (summarized result)** | **FROZEN as result-only** | Recipient sees "operator-verified high confidence" without the underlying portfolio breakdown |
| **Platform-derived market data (FRED rates, cap rates, etc.)** | **FROZEN** as-of share date | Recipient sees the rate environment that informed the underwriting |
| **Staleness indicators / "as of" markers** | **LIVE OVERLAY** | Shows recipient how much the platform has drifted since share (informational, not changing the underwriting) |
| **Comments / discussion / annotations** | **LIVE** | Recipient adds notes after receiving; operator sees them in real time |
| **Recipient's view of the capsule's current platform-side state** (if granted) | **LIVE** | If operator chooses, recipient can see "current platform state" alongside the frozen snapshot |
| **Capsule state (Operator-Approved, etc.)** | **FROZEN at share** | The state at share-time is what's shared; if operator subsequently moves it back to Under Review, the shared version remains a snapshot of the approved state |

### What "frozen" means technically
- A new immutable snapshot is created at share-time, containing all frozen elements.
- The recipient's view reads from the snapshot, never from the live capsule.
- The live capsule continues evolving; the snapshot does not.
- The operator can issue a *new* share (creating a new snapshot) if they want to update the recipient.

### What "redacted" means technically
- For external recipients, evidence panels that would expose owned-portfolio data show result-only summaries: confidence rating, tier authority used, but not the underlying assets or numbers.
- The redaction rule is per-recipient-class: internal (operator's own org) sees more than partners under NDA, who see more than external recipients (lenders, equity partners).

### Implementation note on 3D
Three.js scenes don't trivially serialize for external recipients. The pragmatic approach:
- **Always capture:** rendered image (PNG/SVG) of the massing solution at primary view angles, plus the geometric solution data (vertices, parameters) as JSON
- **For internal recipients:** the captured solution data can rehydrate an interactive Three.js view if the recipient has JEDI account access
- **For external recipients:** static images + downloadable PDF of the massing solution suffices; do not attempt to ship a live Three.js scene to an arbitrary recipient browser

---

## PART 6 — THE VERSIONING MODEL

Every state of a capsule must be recoverable. Underwriting changes — operator overrides an assumption, agent re-runs with new data, broker sends updated OM — and each change is a new version.

### What versioning provides
- **History** — every prior state of the capsule is reachable
- **Diff** — compare two versions to see exactly what changed (assumption deltas, document additions, calculation re-runs)
- **Revert** — operator can roll back to a prior version if a change was unintended
- **Audit trail** — for any version, who/what changed it (operator action, agent run, document upload) is logged

### What gets versioned
- Assumption values (per `LayeredValue` field)
- Calculation outputs (re-computed; the version captures the inputs that produced them)
- Document set (additions, deletions tracked)
- Capsule state transitions
- Agent runs (each run is a version-creation event)

### What doesn't need versioning
- Live overlays on shared capsules (recipient comments, staleness indicators)
- Platform-derived data that's globally cached (FRED time series — referenced, not embedded)

### Relationship to shared snapshots
A shared snapshot (Part 5) is a *frozen version*. Snapshots and versions are the same primitive — a snapshot is a version that has been shared externally. Recipients see a specific version; the capsule's history continues evolving past it.

---

## PART 7 — THE CAPSULE BOUNDARY (what's in, what's referenced)

Defining what's IN the capsule is half the work. Without a boundary, scope expands until the capsule is unprintable, unshareable, and unbounded.

### Embedded in the capsule
- The deal record (id, address, project_type, status)
- The subject property record (units, sqft, year built, geocode, building class)
- The four data layers' deal-specific data (documents, ingested market data for this deal, owned-portfolio comparables matched to this deal)
- The agent's reasoning output (assumptions, evidence, commentary, alternatives)
- The F9 ProForma (assumptions + calculations + bridge decomposition)
- The Valuation Grid + Validation Grid output
- The 3D massing (for development/redevelopment variants)
- Version history (assumptions, documents, state transitions)
- Operator notes / deal-specific judgment context

### Referenced but not embedded
- **Globally-cached platform data** (FRED time series, BLS indicators, MSA aggregates) — referenced by ID + as-of date; can be re-fetched if needed; not duplicated per capsule
- **Comp inventory** — the capsule references the comp set used; the comps themselves live in `market_sale_comps` / `market_rent_comps`. The capsule freezes "comps used at share time" so subsequent comp changes don't affect the snapshot.
- **The operator's broader portfolio** — only the *matched comparables* relevant to this deal are referenced; the full portfolio doesn't travel
- **The agent's prompt versions** — referenced by version ID for audit purposes; the prompt content itself is in `prompt_versions` table
- **Module services** — the capsule consumes M02/M03/M07/M11/etc. but doesn't embed them; references the version of each service that ran

### Excluded entirely
- Other deals
- Other operators' data
- Platform-wide derived statistics not specific to this deal
- The agent's internal chain-of-thought beyond what's captured in the structured evidence

### The export/import integrity test
A capsule is genuinely self-contained only if export → import in a fresh JEDI environment produces an identical capsule. If the import depends on platform state that didn't travel (e.g., the comp inventory the snapshot referenced isn't available in the target environment), the capsule isn't truly portable.

**Acceptance criterion:** export a Closed capsule, import into a clean environment, verify all frozen elements display identically to the source. If anything is missing or different, that element was incorrectly classified as "referenced" when it should have been "embedded."

---

## PART 8 — THE POST-CLOSE LOOP

The capsule is not a one-way artifact. After a deal closes, it becomes Tier 2 evidence that improves the operator's future underwriting via M22 Post-Close Intelligence.

### What happens on Close transition
1. Capsule state moves to **Closed**.
2. **M22 ingestion begins** — operator starts uploading `deal_monthly_actuals` (or the platform pulls from operator's accounting system if integrated).
3. **Underwriting snapshot is locked** — the assumptions at-close become the baseline against which actuals are compared.
4. **Achievement-vs-assumption tracking begins** — month over month, actuals are compared to underwriting (rent achievement, OpEx variance, lease-up vs absorption forecast).

### What this produces over time
- **Per-deal performance ledger** — how this property is actually performing vs how it was underwritten
- **Operator-level pattern recognition** — across closed deals, which assumption classes does this operator systematically over/under-estimate? (e.g., "this operator consistently underwrites R&M 8% low on Class B 1990s vintage")
- **Tier 2 corpus for future capsules** — these actuals are what `fetch_owned_asset_actuals` queries on new deals

### How this changes future capsules
- A new capsule's agent, reasoning over assumptions, finds matching comparables in the operator's closed deals
- Tier 2 evidence cites specific properties: "operator's similar Class B 1990s asset in same submarket runs R&M at $X/unit; this assumption derived from that ground truth"
- Confidence ratings improve as the corpus grows
- The platform's value compounds — every closed deal makes the next one's underwriting sharper

### What this requires (infrastructure, much of it not yet built)
- M22 Post-Close engine — `deal_monthly_actuals` table exists per CLAUDE.md; engine "unbuilt"
- Comparability scoring — matching owned assets to subject deals (referenced in cashflow agent spec as an open decision: "Tier 2 comparability scoring")
- Confidentiality scoping per operator — Tier 2 must be scoped to the operator who owns it; no cross-operator leakage
- The capsule UI must surface Tier 2 evidence appropriately (visible to operator, redacted on external share)

This is significant infrastructure. Worth flagging that "the post-close loop" is the longest-lead-time part of the vision — much of the underwriting work this session targets will reach production before the Tier 2 corpus is meaningfully populated.

---

## PART 9 — CURRENT STATE GAPS THAT BLOCK THE VISION

The following are not polish bugs. They are foundational blockers to the capsule functioning as designed. Each must be resolved as a prerequisite, not as a side cleanup.

### Critical foundational blockers
1. **Data library missing download + delete (Layer 2 CRUD incomplete)** — Operators cannot curate the documents that feed Tier 1 evidence. A stale OM cannot be removed; uploaded files cannot be retrieved. This makes the data library non-functional as a load-bearing layer. **Fix required before the capsule's data layer functions as designed.**

2. **Market document upload UI present but ingestion path unclear (Layer 3 incomplete)** — The UI offers to accept CoStar uploads, but the path from uploaded file → ingested rows in `market_sale_comps` / `market_rent_comps` is not fully wired (per D-COSTAR-1/2 in the master plan). Operators uploading market data may believe they've populated the comp inventory when they've only attached a file.

3. **`properties ↔ deals` join empty across all deals (subject record missing)** — Per the data-flow surface report, no deal has subject characteristics populated. Without units/sqft/year-built on the subject, every Valuation Grid method except Operator Override returns INSUFFICIENT, and Sales Comp PPU/PSF cannot compute. The capsule's primary output is blocked.

4. **EC3 / `mv_market_rent_benchmarks` does not exist** — Reported "shipped" but database confirms absence. Market rent assumptions (Batch 6) and revenue calculations dependent on this view cannot fire correctly.

### Significant gaps to resolve before vision is achievable
5. **Comp inventory empty (`sale_comp_sets` has 0 rows)** — Demonstrated empirically by the backtest. Three of five Valuation Grid methods return INSUFFICIENT. Research agent activation (current dispatch) plus operator upload path are both needed.

6. **AI compute may be doing derivation's job** — Per the AI-Compute Audit instrument, the cashflow agent's output schema may include NOI, IRR, and other calculated fields that should be deterministic engine outputs. Non-determinism here breaks the capsule's defensibility (same deal could produce different numbers across runs).

7. **M22 Post-Close engine unbuilt** — The post-close loop (Part 8) requires M22 to be functional. The table exists; the engine does not. Tier 2 corpus cannot grow without it.

8. **Reconciliation engine not deal-type-aware** — Backtest showed Replacement Cost poisoning reconciliation when other methods absent. The capsule's recommended Purchase Price will be unreliable until method weighting respects deal type.

### Vision-enabling work that follows
9. **Sale/rent comp profile schema** (master plan Commit 3) — Required for ingestion to produce queryable, dedup-able comp data
10. **3D massing portability** (Part 5 implementation note) — Required for development/redevelopment capsule sharing
11. **Snapshot/version system** (Part 6) — Required for capsule history and shared snapshots
12. **Per-recipient-class redaction logic** (Part 5) — Required for owned-portfolio confidentiality on external share
13. **State machine for capsule states** (Part 4) — Required for managed transitions and share-readiness gating
14. **M22 ingestion pipeline + comparability scoring** (Part 8) — Required for the post-close loop

---

## PART 10 — ACCEPTANCE CRITERIA

The vision is realized when:

1. **Four data layers functional:** Platform, data library (full CRUD), market data (ingestion path live), owned-portfolio Tier 2 (M22-fed) all merge with visible precedence in the Validation Grid.
2. **Deal-type variants surface correctly:** A ground-up development capsule shows 3D massing as primary content; an existing acquisition does not. `resolveProjectType` routes consistently.
3. **State model enforced:** Capsules cannot be shared from Draft state; state transitions are logged; backward transitions notify active recipients.
4. **Freeze-on-share works:** Shared capsule's recipient sees frozen ProForma + Valuation Grid + Validation Grid + documents + massing (per Part 5 table); live elements (comments, staleness indicators) update post-share without disturbing the snapshot.
5. **Confidentiality preserved on share:** External recipients see Tier 2 evidence as result-only summaries; raw owned-portfolio data does not leak.
6. **Versioning provides recovery:** Any prior state of any capsule is reachable; diff between versions shows what changed; revert restores prior state.
7. **Export/import roundtrip integrity:** Capsule exported and reimported into clean environment produces identical capsule state.
8. **Post-close loop functions:** Closed capsules feed Tier 2 corpus via M22; next-capsule agent runs cite specific closed-deal comparables in Tier 2 evidence.

When all eight hold for a real deal (462 Bishop + the three S1 backtest deals + a development variant + a shared capsule with an external recipient), the vision is realized.

---

## A NOTE TO REPLIT

This document is the *why*. The other documents (`JEDI_RE_MASTER_PLAN_FOR_REPLIT.md`, `JEDI_RE_F9_CALCULATIONS_VS_ASSUMPTIONS.md`, `JEDI_RE_VERIFICATION_PROTOCOL.md`, `JEDI_RE_BACKTEST_HARNESS_SPEC.md`, `JEDI_RE_AI_COMPUTE_DERIVATION_AUDIT.md`) are the *what* and *how*.

When deciding how to implement any individual dispatch, consult this document for the architectural direction it supports. When the master plan's dispatches conflict with this vision, the vision is canonical — surface the conflict for resolution rather than silently choosing one direction.

When deciding what work is foundational vs polish, consult Part 9. Items listed there as blockers are not optional cleanups — they gate the vision.

Per CLAUDE.md P8: every claim in this document about "currently exists" or "already builds" should be state-verified against the live codebase/database before being treated as confirmed. Where this document and live state diverge, live state is authoritative.
