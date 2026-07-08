# SPEC — F9 Underwriter Model: Agent-Authored Assumptions, Deterministic Computation, One NOI Truth

**Status:** Draft for operator ratification · 2026-07-02
**Supersedes:** the implicit current architecture in which `financial-model-engine.service.ts` sends assumptions to an LLM that produces financial figures.
**Related:** `M09_PROFORMA_SPEC.md`, `PROFORMA_TIMELINE_MODEL_SPEC.md`, `LIFECYCLE_ORIGIN_VINTAGE_ADDENDUM.md`, `CORRELATION_ENGINE_LOOKBACK_SPEC.md`, cadence audit (C0–C4), token audit (A1–A5).

---

## 1. The model in one sentence
**The agent is the underwriter; the ProForma engine is Excel; the ribbon is the chart in the workbook.** The agent reads deal materials, platform market data, the data library, assets-owned comparables, and Correlation Engine historical outputs — and from that judgment authors and revises ASSUMPTIONS. Deterministic engines compute every number from those assumptions. The LLM never performs arithmetic; the engines never exercise judgment.

## 2. Layer responsibilities (binding)
| Layer | Owns | Never does |
|---|---|---|
| **Agent (underwriter)** | Reading context (deal docs, Deal Details market material, data library, owned-asset comps, CE signal outputs); formulating/revising assumptions; attaching a rationale to every assumption it writes | Arithmetic; producing any financial figure; writing outside the agent assumption layer |
| **ProForma engine (deterministic)** | assumptions → yearly + monthly financials via `ramp(t)`; all zone values (gap, projection); returns/IRR/sale math | Consulting an LLM; inventing inputs; silent fallbacks |
| **Periodic seed / ribbon** | Rendering the engine's monthly output + actuals + boundary + gap; zero authorship | Computing its own projection (current ramp logic MIGRATES into the engine; seeder becomes a reader) |
| **Resolution chain (LayeredValue)** | Per-assumption precedence `user > agent > engine-derived (e.g. traffic_engine) > platform_default`, full provenance | Letting agent values bypass `resolve()`/FIELD_PRIORITIES (the currently-disconnected seam — closing it is the point) |
| **Narrative/commentary (LLM)** | Explaining numbers and rationale; monthly market narrative | Producing numbers |

## 3. Assumption provenance contract
Every agent-authored assumption writes: `{field, value, layer:'agent', rationale (short text), evidence_refs (doc ids / CE signal ids / data-library rows), model, template_version, authored_at, input_snapshot_hash}`. User override always wins and is never silently reverted by a later agent pass (agent proposes a CHANGE against a user layer; it does not overwrite it). This is the demo-able surface: "exit cap 5.4% — agent, per COR-14 trend + 3 comp sales" with a one-tap override.

## 4. The two build events (cost + billing semantics)
| Event | What happens | Cost | Trigger | Billing |
|---|---|---|---|---|
| **Underwriting pass** | Agent reads full context (incl. CE outputs + current-period market artifacts) → writes/revises agent-layer assumptions with rationale | LLM (the expensive event) | Explicit user action ("Underwrite" / "Re-underwrite"), or input-change events (new doc uploaded, new market snapshot) — NEVER navigation | **Billable with tier markup** — this is the product |
| **Computation** | resolve() all assumptions → engine computes yearly + monthly → seed/ribbon/tabs refresh | Deterministic, ~free, instant | Any assumption mutation; safe on every render | Never billed |
A provider outage (402) can therefore never block numbers — only new underwriting judgment.

## 5. CE feed
The Correlation Engine's signal outputs (COR-01..30 current values + relevant lookback series for the deal's geography) become a typed section of the underwriting context. CE remains a consumer of snapshots and a producer of signals; the agent consumes signals as evidence — CE never writes assumptions itself. (Consistent with CE scope: market intelligence, not deal prediction.)

## 6. Tri-tab reconciliation — by construction
ProForma endpoints, Projections ramp, Assumptions curves, and the ribbon's projection zone are ONE engine computation at different resolutions/aggregations. Reconciliation ceases to be a test and becomes an identity. Acceptance for the migration is therefore: yearly figure == sum of that year's monthly figures, for every year, both deals, exact.

## 7. Migration notes
- `ramp(t)`, `months_to_stabilization` (+ its `user > agent > traffic_engine > platform_default` chain) migrate from seeder to engine unchanged in logic.
- `deal_financial_models` LLM-output path is retired AFTER a read-only probe of what the current LLM build emits: assumption-shaped content gets a home in the agent layer; re-stated arithmetic is deleted.
- Vintage pinning (lifecycle addendum) pins the assumption set + hashes; the materialized vintage series is the ENGINE's output at pin time — cleanly compatible.
- Seeder retains: actuals ingest (hybrid ≤60mo), boundary derivation, gap tagging, `analysis_date`. It loses: value authorship for gap/projection months (engine supplies).

## 8. Out of scope
Multi-scenario underwriting passes; agent negotiation between conflicting evidence sources (v2); S-curves; automatic re-underwrite cadence policy (needs usage data first).
