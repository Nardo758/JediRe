# DISPATCH — D3: AGENT ASSUMPTION SEAM (Phase 1 Audit, Read-Only)

**Arc:** D3 — the agent authors assumptions through the consolidated store (F-P1's payoff). The CashFlow Agent stops describing the model and starts writing to it: assumptions land in overlays via `resolve()`/`FIELD_PRIORITIES` with full provenance, plausibility gates, and tax-verification duties. This is the "underwriter you supervise" arc.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. Same rhythm that closed the engine arc and F-P1: **Phase 1 read-only audit → STOP → operator rulings → Phase 2 build.** No writes, no migrations, no agent-behavior changes in this phase.
**Standing rules:** S1-01 file:line evidence · verify counts · report pastes raw findings.

## FENCES (do not cross in Phase 1, and note for Phase 2)
- **F-P1 confidence window may still be OPEN** — the overlay write-path + `trg_sync_underwriting_scenario` are under shadow-read validation. Phase 1 is read-only so it's safe now; Phase 2 must NOT retire, rewrite, or race the overlay write-path while the window runs. Confirm window state in the audit.
- **F5 soft dependency:** D3 writes evidence (rationale, evidence_refs); F5 fixes evidence-integrity defects (Finding V: duplicate/missing `inPlaceNOI` entries) + the effective-assumptions capture. Audit must REPORT F5's landing state and flag every D3 build item that depends on evidence integrity, so Phase 2 sequences behind F5 where needed.

## A1 · The seam today — what writes assumptions, and how
1. **`resolve()` / `FIELD_PRIORITIES`:** map the resolution function(s) — file:line, the priority order (user > agent > platform, or as actually coded), and how a LayeredValue's layers are chosen. Is there an `agent` layer slot today, or only user/platform? Paste the type + the resolver.
2. **Every current agent-write path:** the `update_assumption` skill (its raw `deal_assumptions` write — file:line, the exact defect F-P1 flagged), agent-chat write sites, Opus-panel writes, any tool that mutates assumptions. For each: what it writes, where, with what (if any) provenance today.
3. **The overlay write API (post-F-P1):** what's the sanctioned way to write an overlay row now? The seam should route agent writes through THAT, not raw table writes. Map the gap between how agents write today vs the overlay API.

## A2 · The provenance contract — real state vs required
Required (from F9_UNDERWRITER_MODEL_SPEC): every agent-authored value carries `rationale`, `evidence_refs` (with referential integrity — refs point at real evidence rows/signals), `input_snapshot_hash`. Audit what EXISTS today:
1. Does the LayeredValue/overlay schema have fields for these? (F-P1 added attribution `edited_by`/`edited_at` — is that the whole provenance story or a subset?)
2. `evidence_refs` referential integrity: is there any table/mechanism an agent ref would point AT (CE signals, extracted-doc rows, comps)? Enumerate the evidence sources a ref could cite.
3. `input_snapshot_hash`: does anything hash the assumption/data snapshot today (F-P1's version-inputs work, the vintage machinery)? Reusable for this?

## A3 · Plausibility gates — escalate-don't-reject
1. What validation exists on assumption writes today (deterministic bounds, sanity checks)? file:line.
2. The ruling is escalate-don't-reject: an implausible agent value doesn't get silently dropped or hard-blocked — it surfaces for human review. Map where that gate would live in the write path and what surfaces it (evidence flag? a review queue? the resolution showing the flagged value with a warning?).
3. INV/integrity interplay: do the engine's existing integrity checks (INV-*, plausibility warnings like LOW_CONFIDENCE) already provide the escalation surface, or is new machinery needed?

## A4 · Tax verification duties (from the 2026-07-04 ruling)
Two layers already ruled: (a) deterministic reconciliation — engine tax output vs actual county bill (ATTOM/county GIS), auto-flag, no LLM; (b) CashFlow Agent judgment — investigates the flag, checks OM-claimed taxes vs post-reassessment projection, proposes ruleset/assumption correction through the seam or flags `broker_claims`.
1. Does the county-bill data exist to reconcile against (the ATTOM/GIS integration state)?
2. Where would layer (a)'s deterministic reconciliation check live — inside the tax engine's acceptance (post F-P1t extract), or standalone?
3. What does the agent need to perform layer (b) — is `broker_claims` writable by the seam, and does the OM-tax figure land somewhere the agent can read?

## A5 · Skill/coordinator interaction (CU adjacency — map, don't merge)
D3 reroutes `update_assumption`; CU (chat unification) later merges the whole skill registry. Map the boundary: which skills write assumptions (D3's scope) vs which are read/analysis (CU's later scope)? Flag anything where D3's reroute would collide with CU's planned registry merge, so they sequence cleanly.

## DELIVERABLE + STOP
`docs/audits/D3_PHASE1_AUDIT.md`: the seam map (A1), provenance gap table (A2), plausibility/escalation design surface (A3), tax-verification readiness (A4), skill boundary (A5). End with the RULINGS REQUIRED list — every operator decision Phase 2 needs (agent-layer resolution semantics, provenance schema additions, escalation surface choice, tax-reconciliation home, F5-sequencing dependencies). **STOP. No Phase 2 work.**

## OUT OF SCOPE (Phase 1)
Any write/migration · agent-behavior changes · CU registry merge · F-P1t · F-P2 · touching the overlay write-path while the confidence window runs.

**Read-only. Report with file:line throughout. The rulings shape Phase 2.**
