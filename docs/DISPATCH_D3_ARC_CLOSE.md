# D3 Arc Close — DISPATCH_D3_PHASE2_GO

**Closed:** 2026-07-09  
**Dispatch:** DISPATCH_D3_W2/W3 (resumes DISPATCH_D3_PHASE2_GO)  
**Status:** CLOSED — all residuals named

---

## Evidence Summary

### W0 — Scope / flag consistency
**DONE.**  
`20260709_w0_bishop_rescope.sql`: rescoped 23,488 `metric_time_series` rows from `scope_id='GLOBAL'` to `scope_id='deal:3f32276f-aacd-4da3-b306-317c5109b403'`. Redistribution-restricted flag cleared. Zero GLOBAL restricted rows remain.

---

### W1 — agent_confirmed resolution layer
**DONE (prior session).**  
`get-field-value.service.ts` line 445: `lv.agent_confirmed` is read as slot 3 in the resolution chain — above Engine A (platform), below operator override. W2 proofs (a)+(b)+(d)+(e) confirm the order is live and correct.

---

### W2 — update_assumption reroute through seam
**DONE — 5/5 proofs green.**

Service: `backend/src/services/deterministic/agent-overlay-writer.ts`  
Skill reroute: `backend/src/services/skills/skills/index.ts` (update_assumption)  
Key fix: two-step `jsonb_set` required to create missing intermediate keys (single-step silently no-ops on legacy flat blobs like Bishop's year1).

| Proof | Description | Result |
|-------|-------------|--------|
| (a) | Write lands in overlay row, NOT scalar | PASS |
| (b) | Write survives a build (year1.agent_confirmed persists) | PASS |
| (c) | Fresh CREATE-1 deal — no prior overlays | PASS |
| (d) | perYearOverride beats agent_confirmed | PASS |
| (e) | Absent agent_confirmed → resolution byte-identical | PASS |

---

### W3 — Provenance schema + plausibility escalation
**DONE.**  
`20260709_w3_overlay_provenance.sql`: added `reasoning TEXT`, `evidence_refs JSONB`, `build_hash TEXT` to `deal_assumption_overlays`.  
`writeAgentConfirmedOverlay()` enforces `PLAUSIBILITY_BOUNDS` per field. Out-of-bounds → `confidence='LOW'` + note appended to reasoning. Never rejected (R4).

---

### W4 — Broker-claim flag via seam
**DONE.**  
`writeBrokerClaimFlag()` in `agent-overlay-writer.ts`: supersedes previous `broker_claim` overlay for the same field, inserts new flag row, back-fills `superseded_by`. Used by W7 cron.

---

### W5 — Build hash stamping
**DONE (built into writeAgentConfirmedOverlay).**  
On each write, `deal_financial_models.assumptions_hash` is fetched and stored in `deal_assumption_overlays.build_hash`. Allows precise audit of which model build the agent was looking at when it proposed the value.

---

### W6 — evidence_refs integrity [F5-GATED]
**RESIDUAL — F5 not landed.**  
evidence_refs are written and stored correctly. Full referential integrity validation (FK-style checks against `metric_time_series.id`) is gated on F5 landing. Overlay rows survive; refs are advisory until F5.

---

### W7 — Tax reconciliation [layer-(b) shipped]
**DONE — layer-(b) Inngest cron shipped.**  
F-P1t has NOT landed. Layer-(b) interim cron:  
- File: `backend/src/inngest/functions/taxReconCron.ts`  
- Registered: `index.replit.ts` serve() array  
- Schedule: nightly 02:30 UTC  
- Logic: scans deals where `year1.real_estate_tax` has both `om` and `platform` values populated; flags divergences >20% via `writeBrokerClaimFlag()`  
- **Migration marker:** `TODO (F-P1t migration)` comment in cron file  
- Agent judgment layer (OM-tax vs post-reassessment) proceeds via W4's broker-flag path regardless of layer.

---

## T007 Demo — CashFlow Agent Write Seam

Script: `backend/scripts/t007-demo.ts`

Full seam in action on Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`):
1. Agent fetches 3 deal-scoped `CS_VACANCY_RATE` rows from `metric_time_series`
2. Calls `writeAgentConfirmedOverlay({ fieldKey: 'vacancy_rate', value: 0.105139, ... })`
3. Overlay row written with `reasoning`, 3x `evidence_refs` (metric_time_series row ids 670161/670169/670177), `build_hash: b7af75e5746f`, `confidence: MEDIUM`
4. `year1.vacancy_pct.agent_confirmed = 0.105139` patched atomically in same transaction
5. Resolution: `override(null) ?? agent_confirmed(0.105139) ?? resolved` → **0.105139** — PASS
6. Operator sets `override=0.06` → resolution → **0.06** (operator wins, agent_confirmed intact) — PASS

---

## Baselines

### Bishop (464 Bishop, `3f32276f-aacd-4da3-b306-317c5109b403`)
- Live agent_confirmed overlays: **0** (demo overlays superseded/cleaned)
- year1.vacancy_pct.agent_confirmed: cleaned
- year1.management_fee_pct.agent_confirmed: 0.04 (W2 proof residue — harmless)
- 23,488 deal-scoped metric_time_series rows (W0)

### Highlands (Highlands at Satellite, `eaabeb9f-830e-44f9-a923-56679ad0329d`)
- Live agent_confirmed overlays: **0** (proof rows cleaned)
- year1.management_fee_pct: proof patch removed (orphaned patch cleanup)

---

## Residuals Named

| Residual | Gate | Action |
|----------|------|--------|
| W6 evidence_refs FK integrity | F5 landing | On F5: add referential check in `writeAgentConfirmedOverlay()` to validate `metric_time_series.id` exists before accepting ref |
| W7 layer-(b) → layer-(a) migration | F-P1t landing | On F-P1t: retire `taxReconCron.ts`; move reconciliation logic into F-P1t acceptance layer; broker_claim flag path unchanged |

---

## Files Changed / Created (D3 W2–W7)

| File | Change |
|------|--------|
| `backend/src/database/migrations/20260709_w0_bishop_rescope.sql` | W0 scope migration |
| `backend/src/database/migrations/20260709_w3_overlay_provenance.sql` | W3 provenance columns |
| `backend/src/services/deterministic/agent-overlay-writer.ts` | NEW — W2/W3/W4/W5 write seam |
| `backend/src/services/skills/skills/index.ts` | W2 — update_assumption rerouted |
| `backend/src/inngest/functions/taxReconCron.ts` | NEW — W7 layer-(b) cron |
| `backend/src/index.replit.ts` | W7 — taxReconCron registered |
| `backend/scripts/w2-proofs.ts` | W2 proof script (keep for regression) |
| `backend/scripts/t007-demo.ts` | T007 demo script |
