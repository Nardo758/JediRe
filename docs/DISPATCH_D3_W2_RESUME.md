# DISPATCH — D3-W2+ : Agent Seam Resume (Reroute + Provenance + Tax)

**#4 of 6. GATE: CREATE-1 done (materialized deal-state exists) AND F-P1 confidence window clear (build-10/day-7). BOTH required — do not start until both confirmed. Type: build.**
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Context:** D3 W1 (agent_confirmed resolution layer) is DONE and correct. This resumes W2–W7 from `DISPATCH_D3_PHASE2_GO.md`, now that CREATE-1 gives fresh deals a writable row and the window has freed the overlay write-path. Rulings R1–R8 already encoded there — this dispatch executes them; re-read that file for the per-item detail. This is a pointer + gate-confirmation dispatch.

## GATE CONFIRMATION (paste at start)
1. F-P1 confidence window: shadow-read alarm-free through build-10 or day-7; blob write-path + trigger retired. Paste the window-close evidence.
2. CREATE-1: a fresh deal materializes a writable `deal_assumptions` row + the D3-readiness proof (agent write lands, not staged-invisible). Paste.
If either gate is not clear: STOP, report which, do not proceed.

## EXECUTE (per DISPATCH_D3_PHASE2_GO.md, rulings encoded)
- **W2 (R7):** kill raw `UPDATE deal_assumptions` at `skills/index.ts:440`; reroute `update_assumption` in-place through the overlay write API into the `agent_confirmed` slot. Prove: agent write survives a subsequent build (the live-defect closure) — AND now also on a fresh CREATE-1 deal (write lands in the materialized row).
- **W3 (R2+R4):** migration — `reasoning TEXT`, `evidence_refs JSONB` on `deal_assumption_overlays`; `confidence='low'`+note escalation; write-time deterministic plausibility bound sets the flag; escalate-don't-reject. Escalation test pasted.
- **W4 (R6):** broker-claim flag via overlay seam (`real_estate_tax.broker_flag`-style), never `deal_data` directly.
- **W5 (R3):** stamp `assumptions_hash` per overlay row written during a run.
- **W6 [F5 GATE]:** evidence-citing items (evidence_refs referential integrity) only after F5's Finding-V fix lands. If F5 not landed: close D3 with W6 as named residual, don't ship dangling refs.
- **W7 [F-P1t CHECK]:** tax reconciliation — (a) in F-P1t acceptance if landed, else (b) Inngest cron interim; agent judgment layer (OM-tax vs post-reassessment via W4's flag path) proceeds either way.

## ACCEPTANCE
W2–W5 executed with evidence · W6 done or F5-residual named · W7 (a)-or-(b) per F-P1t state · agent write survives build on BOTH an existing deal AND a fresh CREATE-1 deal · both baselines green · golden standing · value identity both reference deals. D3 CLOSES with residuals named.

## OUT OF SCOPE
CU registry merge (D3 leaves ONE write-action skill) · F-P2 · OM/history specs · re-doing W1.
