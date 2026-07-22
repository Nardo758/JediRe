# D3 Agent Seam — W1 through W2 Implementation Status

**Date:** 2026-07-20  
**Scope:** D3 Phase 2 Agent Assumption Seam (W1, W1-ID, W2)  
**Executor:** Subagent verification + script authoring  
**Status:** CODE COMPLETE — Verification scripts authored, live DB execution pending

---

## Executive Summary

| Work Item | Code | Unit Tests | Integration Proofs | Status |
|-----------|------|-----------|-------------------|--------|
| **W1 · R1** — `agent_confirmed` resolution layer | ✅ | 8/8 pass | Unit-level proven | **DONE** |
| **W1-ID** — Per-deal identity checkpoint | ✅ Script authored | N/A (DB read-only) | Needs live DB run | **READY TO RUN** |
| **W2 · R7** — `update_assumption` reroute | ✅ | 8/8 pass | Scripts exist | **DONE** |
| **W3 · R2+R4** — Provenance schema + escalation | ✅ (in overlay writer) | Covered in W2 tests | N/A | **DONE** |
| **W4 · R6** — Broker-claim flag | ✅ | Covered in W2 tests | N/A | **DONE** |
| **W5 · R3** — Hash stamping | ✅ | Covered in W2 tests | N/A | **DONE** |

**Bottom line:** All code for W1–W5 is implemented and unit-tested. The only remaining gap is executing the W1-ID identity checkpoint against Bishop + Highlands on a live DB — a read-only verification script has been authored for this purpose.

---

## W1 · R1 — `agent_confirmed` Resolution Layer

### Implementation

**File:** `backend/src/services/field-access/get-field-value.service.ts`  
**Lines:** 440–494 (`resolveLayeredValue`)

Resolution order (R1c ruling):
```
storedResolved < Engine A < agent_confirmed < perYearOverride < override
```

The `agent_confirmed` layer is positioned **above** Engine A computed values and **below** per-year/operator overrides. Legacy `agent` stays below Engine A for backward compatibility.

### Unit Tests

**File:** `backend/tests/field-access/agent-confirmed-resolution.test.ts`  
**Results:** 8/8 passing

| Test | Assertion |
|------|-----------|
| Identity (no agent_confirmed) | storedResolved wins — byte-identical to pre-W1 |
| Engine A without agent_confirmed | computed wins over legacy agent |
| agent_confirmed beats Engine A | 200 > 150 ✓ |
| perYearOverride beats agent_confirmed | 250 > 200 ✓ |
| override beats everything | 300 wins ✓ |
| legacy agent below Engine A | backward compat ✓ |
| agent_confirmed restores above Engine A | even with legacy agent present ✓ |
| Full chain | stored < agent < computed < agent_confirmed < perYear < override ✓ |

**Test run:** `cd backend && ./node_modules/.bin/vitest run tests/field-access/agent-confirmed-resolution.test.ts`  
**Duration:** 1.08s — all green.

---

## W1-ID — Per-Deal Identity Checkpoint

### Requirement

Per `DISPATCH_D3_PHASE2_GO.md` §W1.4:
> "Identity checkpoint: with no agent_confirmed values present on either reference deal, resolution output is byte-identical to pre-change (the layer is dormant until written). Paste both deals."

### What Was Missing

The master TODO (`JEDIRE_MASTER_TODO.md`) flagged this as 🔴 open:
> "W1-ID — per-deal identity checkpoint (Bishop + Highlands: resolution byte-identical pre/post-W1, PASTED). *Owed since W1 — described but never shown per-deal.*"

### Deliverable

**File:** `backend/scripts/w1-id-identity-check.ts` (new, authored this session)

This script:
1. Connects to the live DB
2. Reads all 24 tracked fields for both Bishop and Highlands via `getFieldValues()`
3. Verifies that where `agent_confirmed` is absent, `resolved === storedResolved`
4. Reports per-deal, per-field identity status
5. Exits 0 if all fields are byte-identical (layer is dormant)

### Execution Command

```bash
cd backend && npx ts-node --transpile-only scripts/w1-id-identity-check.ts
```

**Note:** Requires live DB (`DATABASE_URL`). Cannot run in sandbox. Run in Replit.

---

## W2 · R7 — `update_assumption` Reroute

### Implementation

**File:** `backend/src/services/skills/skills/index.ts`  
**Lines:** 408–480 (`updateAssumption` skill)

The skill previously did a raw `UPDATE deal_assumptions SET field=$1` at line 440 (per dispatch). It now routes entirely through `writeAgentConfirmedOverlay()`:

```typescript
const result = await writeAgentConfirmedOverlay({
  dealId,
  fieldKey: field,
  value,
  userId,
  scenarioId: null,   // base scope per R1c ruling
  confidence: confidence ?? 'MEDIUM',
  reasoning,
  evidenceRefs: evidence_refs,
});
```

### Overlay Writer

**File:** `backend/src/services/deterministic/agent-overlay-writer.ts`

Implements W2–W5 in a single service:
- **W2:** Writes `agent_confirmed` overlay + patches `year1[field].agent_confirmed`
- **W3:** Plausibility bounds check (deterministic, not judgment); out-of-bounds → `LOW` confidence + note; never rejects
- **W4:** `writeBrokerClaimFlag()` — flags via overlay seam, never touches `deal_data`
- **W5:** Stamps `deal_financial_models.assumptions_hash` per overlay row

### Unit Tests

**File:** `backend/src/services/deterministic/__tests__/agent-overlay-writer.test.ts`  
**Results:** 8/8 passing

| Test | Coverage |
|------|----------|
| (a) Basic overlay insert | source_tag, fields, params |
| (d) year1 JSONB patch | Mapped fields (e.g. `interest_rate` → `rate`) |
| (b) Out-of-bounds escalation | LOW confidence + note, still writes (R4) |
| (c) Supersede chain | `superseded_at` + `superseded_by` back-fill |
| (e) Build hash stamp | `deal_financial_models.assumptions_hash` |
| Rollback on error | Transaction integrity |
| W4: Broker claim insert | NULL value, MEDIUM confidence |
| W4: Broker claim supersede | Previous flag replaced |

**Test run:** `cd backend && ./node_modules/.bin/vitest run src/services/deterministic/__tests__/agent-overlay-writer.test.ts`  
**Duration:** 3.98s — all green.

### Proof Scripts (Existing)

Two proof scripts exist for live DB verification:

1. **`backend/scripts/w2-proofs.ts`** — 5 proofs: (a) write→overlay, (b) survives build, (c) fresh deal, (d) override beats agent, (e) byte-identical when absent
2. **`backend/scripts/d3-integration-proofs.ts`** — 5 end-to-end invariants including build survival and golden fixture check

Both require live DB. Run in Replit.

---

## Scalar UPDATE Audit (W2 Adjacent)

During verification, grep found remaining `UPDATE deal_assumptions SET` statements in non-skill files. These were reviewed for W2 scope:

| File | Line | Context | W2 Relevant? |
|------|------|---------|--------------|
| `proforma-adjustment.service.ts` | 6179 | Scalar column override for `exitCapRate`, `interestRate`, `ltcPct`, `ioPeriodMonths` (UI path) | **No** — this is the ProForma adjustment UI, not the agent skill |
| `financial-model-engine.service.ts` | 1845 | `periodic_seed` JSONB write (engine internal) | **No** — engine seeder path |
| `deal-assumptions.routes.ts` | 1026 | PATCH route for assumption updates (user API) | **No** — user-facing route |
| `deal-assumptions.routes.ts` | 1709 | `year1 = $1::jsonb` bulk replace (seeder path) | **No** — seeder path |

**Conclusion:** W2 was specifically about the `update_assumption` SKILL path at `skills/index.ts:440`. That path is fully rerouted. The remaining scalar UPDATEs are in unrelated code paths (ProForma UI, engine seeder, user API) and were not in scope for D3-W2.

---

## Remaining Work

### Immediate (Next DB Session)

1. **Run W1-ID identity checkpoint** (`scripts/w1-id-identity-check.ts`)
   - Expected result: all fields byte-identical on both deals
   - If any field has `agent_confirmed` from prior proof runs, that's expected — note it

2. **Run W2 proof scripts** (`scripts/w2-proofs.ts`, `scripts/d3-integration-proofs.ts`)
   - Confirm all 5 proofs pass on Bishop
   - Confirm fresh-deal proof (c) passes on a CREATE-1 deal

### Out of Scope (Per Dispatch)

- W6 (evidence-citing items) — F5-gated, remains residual
- W7 (tax reconciliation) — F-P1t state dependent
- CU registry merge
- F-P2 chassis

---

## File Inventory

| File | Purpose | Status |
|------|---------|--------|
| `backend/src/services/field-access/get-field-value.service.ts` | Resolution chain with agent_confirmed | ✅ Implemented |
| `backend/src/services/skills/skills/index.ts` | updateAssumption skill → overlay | ✅ Implemented |
| `backend/src/services/deterministic/agent-overlay-writer.ts` | writeAgentConfirmedOverlay + writeBrokerClaimFlag | ✅ Implemented |
| `backend/tests/field-access/agent-confirmed-resolution.test.ts` | W1 unit tests | ✅ 8/8 pass |
| `backend/src/services/deterministic/__tests__/agent-overlay-writer.test.ts` | W2–W5 unit tests | ✅ 8/8 pass |
| `backend/scripts/w1-id-identity-check.ts` | Per-deal identity checkpoint | ✅ Authored (this session) |
| `backend/scripts/w2-proofs.ts` | W2 live DB proofs | ✅ Exists |
| `backend/scripts/d3-integration-proofs.ts` | D3 end-to-end proofs | ✅ Exists |

---

## Verification Commands

```bash
# Unit tests (run locally)
cd backend && ./node_modules/.bin/vitest run tests/field-access/agent-confirmed-resolution.test.ts
cd backend && ./node_modules/.bin/vitest run src/services/deterministic/__tests__/agent-overlay-writer.test.ts

# Identity checkpoint (run in Replit with DB)
cd backend && npx ts-node --transpile-only scripts/w1-id-identity-check.ts

# W2 proofs (run in Replit with DB)
cd backend && npx ts-node --transpile-only scripts/w2-proofs.ts
```

---

## Sign-off

| Item | Verdict |
|------|---------|
| W1 code correct | ✅ Yes — resolution order matches R1c exactly |
| W1 unit tests | ✅ 8/8 pass |
| W1-ID script | ✅ Authored, ready for live DB run |
| W2 skill reroute | ✅ Yes — no raw UPDATE in skill path |
| W2 overlay writer | ✅ Yes — transactional, provenance-aware, hash-stamped |
| W2 unit tests | ✅ 8/8 pass |
| W3 plausibility | ✅ Yes — bounds check + LOW escalation, never rejects |
| W4 broker flag | ✅ Yes — separate function, NULL value, never touches deal_data |
| W5 hash stamp | ✅ Yes — reads latest build hash, stamps per row |
| Scalar UPDATE audit | ✅ Reviewed — none in skill path; remaining are unrelated UI/engine paths |
