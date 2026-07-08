# DISPATCH — D3 PHASE 2 GO: Agent Assumption Seam (Rulings R1–R8 Encoded)

**Arc:** D3 — the agent authors assumptions through the consolidated store. Phase 1 audit accepted, rulings stamped (`docs/audits/D3_PHASE1_AUDIT.md`). This builds the seam.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Live defect this arc fixes:** agent-written values currently resolve BELOW Engine A — any model build silently overwrites them. The seam doesn't actually author today. R1 is the keystone fix.
**Standing rules:** S1-01 live evidence per item · value identity both reference deals · both compile baselines green per commit · commit early/often · raw output in reports.

## GATES (fenced — respect both)
- **F-P1 confidence window** (closes build-10 / day-7 from 2026-07-08): items touching the overlay WRITE-PATH — **W2 (R7 reroute), W3 (R2/R4 schema)** — WAIT until window clears (confirm state at arc start; if open, do W1 first, then hold W2/W3 until clear, then resume). Items NOT touching the write-path proceed regardless.
- **F5** (external clock): evidence-CITING items — anything writing `evidence_refs` that point at `inPlaceNOI`-class evidence — gate behind F5's Finding-V fix (dedupe/missing entries). A ref to a duplicated evidence row fails R2's referential-integrity requirement. Non-citing structural work is NOT F5-gated.

## RULINGS ENCODED
R1 (c) agent_confirmed flag · R2 (a) real reasoning+evidence_refs columns · R3 (b) reuse build-level assumptions_hash per row · R4 (a) confidence=low+note escalation · R5 (a) tax-recon in F-P1t acceptance, (b) Inngest cron as interim if F-P1t not landed · R6 (c) broker flag via overlay seam · R7 (a) replace update_assumption in-place · R8 evidence-citing items F5-gated, structural items not.

## BUILD SEQUENCE (numbered; order enforced)

### W1 · R1 — resolution-order fix (NO window contact; go immediately)
1. Add `agent_confirmed` layer to the LayeredValue type (`layered-value.ts`).
2. `resolveLayeredValue()` produces EXACTLY: `storedResolved < Engine A < agent_confirmed < perYearOverride < override`. agent_confirmed beats Engine-A defaults, yields to any user-year edit. (Do NOT implement as `agent_confirmed < Engine A` — the audit's flagged trap.)
3. `get-field-value.service.ts` consumes the new order.
4. **Identity checkpoint:** with no agent_confirmed values present on either reference deal, resolution output is byte-identical to pre-change (the layer is dormant until written). Paste both deals.
5. Unit test: a field with an agent_confirmed value resolves to it over Engine A; a perYearOverride on the same field wins over agent_confirmed. Paste.

### W2 · R7 — update_assumption in-place reroute (WINDOW-GATED)
Kill the raw `UPDATE deal_assumptions SET field=$1` at `skills/index.ts:440` (+ its 9 hardcoded scalar columns). Same skill name/signature; routes through the overlay write API into the agent_confirmed slot. All callers (chat, orchestrator, UI) get the overlay path — one write-action skill (CU adjacency). Identity: an agent write now lands in an overlay row, survives a subsequent build (the live-defect proof — write, build, confirm the value held). Paste.

### W3 · R2 + R4 — provenance schema (WINDOW-GATED)
Migration on `deal_assumption_overlays`: `reasoning TEXT`, `evidence_refs JSONB`, and confidence already present (F-P1 attribution cols reused where they fit). R4: `confidence='low'` + note is the escalation surface; a write-time deterministic plausibility bound (bounds-check, not judgment) sets it. Implausible agent value writes WITH the flag, surfaces in the F9 assumption audit trail, never drops/blocks. Migration + write-path wiring + one escalation test (out-of-bounds agent value → flagged, written, surfaced).

### W4 · R6 — broker-claim flag via overlay seam (post-W3 schema)
Agent flags a field (e.g. `real_estate_tax.broker_flag`) through the overlay seam — never touches `deal_data` directly. The OM-vs-post-reassessment divergence the agent detects lands as a provenance'd flag on the overlaid field.

### W5 · R3 — hash stamping (post-W3)
Every overlay row written during a build run stamps `deal_financial_models.assumptions_hash` for that run. Reuses existing machinery; no new hash computation.

### W6 · [F5 GATE] — evidence-citing items
Only after F5's Finding-V fix lands: wire `evidence_refs` referential integrity (a ref must point at a real, de-duplicated evidence row — CE signal, extracted-doc row, comp — dangling ref fails the write). Enumerate citable sources. If F5 hasn't landed when the arc reaches here: STOP W6, report F5-blocked, close the rest of D3 with W6 as the named residual.

### W7 · [F-P1t STATE CHECK] — R5 tax reconciliation
If F-P1t has landed: layer-(a) deterministic reconciliation (engine tax vs ATTOM `tax_amt`) lives in the tax-engine acceptance. If not: ship layer-(b) standalone Inngest cron as interim, marked for migration into (a) on F-P1t landing. Layer-(b) agent judgment (OM-tax vs post-reassessment, flag via W4's broker-flag path) proceeds either way.

## ARC CLOSE
Report shows: W1 resolution order live + identity + the live-defect PROVEN fixed (agent write survives a build) · W2–W5 executed with evidence · W6 done or F5-residual named · W7 (a)-or-(b) per F-P1t state · both baselines green · golden standing · value identity finale both deals. D3 CLOSES with residuals named (W6 if F5-blocked; R5 migration to (a) if shipped as (b)). Roadmap: next chain item becomes active (CU or F-P2 per operator).

## OUT OF SCOPE
CU registry merge (D3 leaves ONE write-action skill for it) · F-P2 chassis · F-P1t build · touching overlay write-path while window open (W2/W3 gated).

**Order: W1 now → [window clear] → W2 → W3 → W4 → W5 → [F5 gate] W6 → [F-P1t check] W7 → close. STOP on identity failure, window/F5 violation, or divergence. Evidence pasted throughout.**
