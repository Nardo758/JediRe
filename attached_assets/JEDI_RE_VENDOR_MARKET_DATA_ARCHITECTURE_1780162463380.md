# JEDI RE — VENDOR MARKET DATA ARCHITECTURE

**Purpose:** Name the central thesis that operator-uploaded market data from multiple vendors (CoStar, Yardi Matrix, Berkadia, Apartment Locator, etc.) flows into a unified reconciliation layer that agents consume as research material to author defensible underwriting findings.

**Audience:** Replit, future contributors, anyone making architectural decisions about how external data enters the platform and reaches operator-facing surfaces.

**Status:** Overview document. The four pieces (A, B, C, D) operationalize the architecture this document names.

---

## THE CENTRAL THESIS

Every fact the platform knows about a deal — market vacancy, comparable sale cap rates, submarket rent growth, supply pipeline depth, occupancy trajectory — has multiple potential sources. The platform's job is not to pick one source and treat the others as noise. It is to:

1. **Ingest from many sources** with vendor-aware parsing
2. **Reconcile field-by-field** with documented precedence
3. **Surface divergences as signal**, not as conflict to be resolved silently
4. **Feed the reconciled view to agents** who synthesize it into research findings
5. **Display findings to operators** with provenance, freshness, and confidence visible

This is the architecture underneath every analytical surface in the platform. Without it, the platform is either single-source (brittle and dependent on whichever vendor happens to be wired) or multi-source-without-discipline (data conflicts resolve accidentally based on whichever writer ran most recently).

---

## WHY THIS ARCHITECTURE EXISTS

Three operational realities make the architecture necessary:

**First, no single vendor covers everything.** CoStar excels at metro-level submarket time-series. Yardi Matrix has different submarket boundaries and rent comp methodologies. Apartment Locator surfaces listing-level data not in either. County records have transactions neither captures. The platform that depends on one vendor is structurally limited to that vendor's coverage and methodology.

**Second, vendors disagree, and the disagreement is information.** When CoStar says Atlanta Midtown vacancy is 9.2% and Yardi says 11.4% for the same period, the disagreement tells you something: either the vendors sample differently, one is stale, one is wrong, or the submarket boundary definitions diverge. Silently averaging or picking one loses that signal. The audit-found LTL gap (T12 says 0.35%, lease-level says 13.8%) is the same pattern at the deal level — two methodologies producing different views of the same property.

**Third, operators upload market data because they trust vendors differently for different things.** An operator might trust CoStar for cap rates, Yardi for rent comps, and their own broker network for off-market intel. The platform that doesn't recognize per-vendor trust differentials forces operators to pick one and live with its weaknesses.

The architecture this document describes is built for these realities.

---

## THE FOUR PIECES

The architecture decomposes into four interlocking pieces. Each is its own document.

### Piece A — Vendor Abstraction and Ingestion Layer

A vendor registry where new market data vendors slot in without re-architecting. Each vendor declares its parser, column mappings, freshness profile, license posture, and corpus tier. New vendors (Yardi after CoStar, Berkadia after Yardi) register rather than triggering parallel implementations.

**Solves:** the operational problem that every new vendor currently requires a CoStar-sized dispatch.

### Piece B — Field-Level Reconciliation and Divergence Surfacing

Per-field reconciliation logic that, for any platform field (vacancy, market rent, cap rate, etc.), captures which sources provide values, applies documented precedence, and surfaces material divergences to operators and to the divergence diagnostic. Field-level, not row-level — comp dedup is a different problem.

**Solves:** the architectural problem that the same field today reads from different sources at different surfaces (NOI from Engine A in Pro Forma, NOI from year1.noi in Valuation Grid) producing visible inconsistency.

### Piece C — Agent Synthesis Interface for Multi-Vendor Data

The agents (cashflow agent, research agent) consume the reconciled multi-vendor view as research material and synthesize findings. They author values across both assumptions and calculations, citing which sources supported which claims. Operator override (Layer 1) sits above every agent-authored field.

**Solves:** the architectural confusion about whether agents consume or author market data. The answer is they author by fusing — taking the reconciled multi-vendor inputs and producing narrative findings the operator reads.

### Piece D — Divergence as Quality Signal

Capturing field-level disagreements over time as data about source reliability. When CoStar consistently runs higher than Yardi on Atlanta Midtown vacancy, that's a tracked pattern. Over time, the platform learns which sources are reliable for which submarkets and which metrics. The divergence diagnostic compounds value.

**Solves:** the long-term problem that today every conflict is treated as a one-time resolution. Tracking the pattern produces analytical intelligence beyond any single deal.

---

## NON-NEGOTIABLE COMMITMENTS

Six architectural commitments that bind all four pieces.

### Commitment 1 — LayeredValue is the universal mechanism

Every multi-source field in the platform is a `LayeredValue<T>`. The resolution chain is:

| Layer | Source | Priority |
|---|---|---|
| **Layer 1** | Operator override | Highest |
| **Layer 2** | Agent / platform / computed | Second |
| **Layer 3** | Broker / vendor / document | Third |

Higher layer number = lower authority. Layer 1 wins because the human said so explicitly. This applies to fields from any source — CoStar, Yardi, Berkadia, county records, T12 extractions, OM extractions — all flow through the same chain.

### Commitment 2 — Snapshot-at-ingestion preserves architectural simplicity

The audit established that Engine A reads from `deal_assumptions.year1` (a snapshot produced at ingestion time), not from live `deal_lease_transactions` at query time. This snapshot-at-ingestion pattern is preserved across the architecture. Vendor data ingests into the snapshot; the snapshot is the read path; consumers don't re-query raw vendor data at every surface.

**What snapshot-at-ingestion means in this architecture:**
- Vendor uploads trigger ingestion that updates the snapshot
- The snapshot stores LayeredValue per field with all source contributions visible
- Consumers (Engine A, Valuation Grid, F-key modules, agents) read from the snapshot, not from raw vendor tables
- Re-seeding triggers when new data arrives or the operator explicitly requests a refresh

The architecture is *not* "every consumer re-iterates raw vendor data live." That would be unbounded complexity. The architecture is "vendor data enriches the snapshot; consumers read the snapshot."

### Commitment 3 — Trajectory math for fields that vary across hold years

Hold-year assumptions (GPR, LTL, other income, vacancy) are not flat constants. They are trajectories produced from trajectory inputs (rent growth, mark-to-market rate, lease roll velocity, M07 absorption). The current per_year_overrides infrastructure supports this; the math behind trajectory derivation is the gap.

Specifically, **LTL is a forward projection from T12 baseline + mark-to-market rate + lease roll velocity, not a flat percentage held constant across hold years.** The audit found Engine A reads LTL once outside the projection loop; this is the principal lease-roll-related fix beyond what Task #1521 addressed.

### Commitment 4 — Cross-surface read consistency

For any logical value the platform displays, there is one canonical read path. If NOI is displayed in Pro Forma, Valuation Grid, Returns, and Decision tabs, all four read from the same source and produce the same value. The architecture forbids the pattern where different surfaces read different layers of the same field and disagree.

When operator override (Layer 1) is applied, every consumer sees the override. When the agent writes to Layer 2, every consumer sees the agent's value (unless override is set). The LayeredValue resolution is computed once per field per query; all consumers receive the same `resolved` value.

### Commitment 5 — Operator override (Layer 1) must be wired for every agent-authored field

For every field the agent authors (which is every assumption and most calculations), the UI surfaces an override affordance, a PATCH endpoint exists to write Layer 1, and the resolution chain selects override above agent. The audit's CF-01 (NOI showing $840K in Valuation Grid while Pro Forma shows correct NOI) was a manifestation of override not being wired — Task #1520 is closing the wiring for NOI; the discipline applies to every field.

### Commitment 6 — Deal completeness is a first-class status

Some analytical signals are required for full underwriting confidence. M07 must have produced a `traffic_projections` row. The Cashflow Agent must have run against the most recent extraction. The Validation Grid's evidence triangulation must have resolved. When required signals are missing, the deal is in an *incomplete* state and the UI signals this to operators clearly — not as a silent fallback but as an explicit "this deal is missing X." Piece A through D each contribute to this framework.

---

## WHAT THIS ARCHITECTURE IS NOT

Worth being explicit about scope boundaries:

- **Not a comp dedup replacement.** Task #1407/#1410 built a 3-tier dedup pipeline (parcel, address, geocode) for comp records. That stays. Field-level reconciliation operates on the deal/submarket/property *fields* after comps have been deduped at the record level.
- **Not an attempt to replace the property plumbing refactor.** Property identity unification (Decisions 1-6 of the refactor) is a foundational layer this architecture rests on. Vendor data lands in `properties`, `property_characteristics`, `property_operating_data`, and `property_sales` once the refactor lands; in the interim, vendor data lands in current tables with explicit forward-compatibility notes.
- **Not a deferred substitute for fixing the audit's critical findings.** CF-01 through CF-10 are bugs and gaps that need to be addressed regardless of this architecture. The architecture provides the framework for those fixes to cohere; it doesn't replace the fixes.
- **Not specific to CoStar.** CoStar is the first vendor wired through Task #1407 + the recent three-doctype dispatch, but the architecture is vendor-agnostic. Yardi Matrix, Berkadia, RealPage, ALN, Apartment Locator, and any future vendor slot in through Piece A.

---

## THE WORK SEQUENCE

The four pieces (A, B, C, D) and the audit-found bug fixes interleave. Sequencing:

**Phase 1 — Foundation bug fixes (in parallel with property refactor Phase 1-2)**
The audit's 10 critical findings (NOI broken, monthly actuals empty, JEDI score not computed, etc.) need to be addressed regardless of architecture. Task #1520 (NOI override) is in flight. The other findings have their own dispatches.

**Phase 2 — Piece A (vendor abstraction)**
The CoStar three-doctype work is the worked example. Piece A generalizes the pattern into a vendor registry. Next vendor onboarded (likely Yardi Matrix) tests whether the abstraction holds.

**Phase 3 — Piece B (field-level reconciliation)**
Builds on the vendor registry. Surfaces divergences. Wires Layer 1 override universally. Connects to deal-completeness framework.

**Phase 4 — Piece C (agent synthesis interface)**
Agents now consume Piece B's reconciled view as research material. Synthesizes findings with provenance. This is where the platform's analytical surfaces become defensible across multiple vendors.

**Phase 5 — Piece D (divergence as quality signal)**
The compounding play. Tracks field-level divergences over time. Produces source-reliability intelligence the platform uses to weight future reconciliations.

The phases are sequential by dependency, but the property refactor and Phase 1 bug fixes run in parallel underneath. Total estimated calendar: 6-12 months from Piece A start, depending on how aggressively Pieces C and D are scoped.

---

## RELATIONSHIP TO OTHER DOCUMENTS

| Document | How this architecture relates |
|---|---|
| `JEDI_RE_F9_CALCULATIONS_VS_ASSUMPTIONS_REVISED.md` | The LayeredValue framing here is consistent with the revised calc-vs-assumption doc. Layer 1 override wiring is Commitment 5. |
| `DEAL_DETAILS_DATA_AUDIT.md` | The 10 critical findings inform Phase 1 bug fix scope. The 42% POPULATED / 34% EMPTY split is what this architecture is designed to improve over time. |
| `JEDI_RE_PROPERTY_PLUMBING_REFACTOR.md` | The refactor is the foundation this architecture rests on. Vendor data lands in the unified property model post-refactor. |
| `JEDI_RE_DEAL_CAPSULE_VISION.md` | The capsule is where this architecture is most visible to operators. Pieces B, C, D shape what the capsule displays. |
| `JEDI_RE_STRATEGY_AWARE_MODULES.md` | Strategy-aware framing reads from Piece C's agent-authored findings. The default-with-override pattern is Commitment 5 applied to strategy modules. |
| Engine A + M07 lease-roll audit | The "snapshot-at-ingestion is deliberate, not accidental" finding is Commitment 2. The LTL trajectory and M07 completeness findings inform Commitments 3 and 6. |

---

## NOTE TO REPLIT

This document names the architecture. The four pieces (A, B, C, D) operationalize it. Read in this order:

1. This overview (you're here)
2. Piece A — Vendor Abstraction and Ingestion
3. Piece B — Field-Level Reconciliation and Divergence Surfacing
4. Piece C — Agent Synthesis Interface
5. Piece D — Divergence as Quality Signal

Each piece is its own dispatch. They share the six commitments above and the snapshot-at-ingestion architecture established by the audit. Where any piece's specification conflicts with the commitments, the commitments win.

Per CLAUDE.md P8: this document makes architectural claims grounded in the audit findings and operator clarifications. Where specific implementation details (table names, service signatures, exact LayeredValue priority semantics) are referenced, state-verify against live code before implementing.
