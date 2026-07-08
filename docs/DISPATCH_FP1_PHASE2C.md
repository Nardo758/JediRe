# DISPATCH — F-P1 PHASE 2C: Retroactive Evidence + The Consolidation Core

**Arc:** F-P1 store consolidation. Phase 2B delivered B1/B6/B7/B8/B9; the namesake consolidation (B2–B5) is deferred, not done — **the arc is OPEN.** This dispatch (1) closes the evidence gaps on already-executed irreversible work, then (2) executes the deferred core. F-P1 closes only when the stores are actually consolidated.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Universal blocker:** value identity both reference deals per step, checks PASTED not asserted. Standing rules: S1-01 · verify counts · both compile baselines · raw output in reports · irreversible ops get instance-level proof BEFORE execution (and where already executed, retroactive evidence now).

## PART 1 — RETROACTIVE EVIDENCE (already-executed work, prove it clean)

### C0 · Equivalence comparand (gated B1, which is now live)
State which two bodies the Phase-2A 13,407-char identity compared.
- Real frontend client body vs server-fetch → gate passed retroactively, note it.
- Otherwise → forensic: pull the `assumptions` snapshot from the most recent pre-retirement `deal_financial_models` row (that IS a client-shipped body), diff against the server-fetch body for the same deal, paste the diff. Any field difference = the local-state divergence that B1 silently retired — record it as a finding with values, even though the client path is already gone. We capture it before it becomes unknowable.

### C1 · B7 DROP evidence (irreversible op already run)
Paste retroactively: (a) the reader census for `irr_levered`, `equity_multiple`, `noi_stabilized`, `rent_growth_yr1` — every former reader with file:line and its repoint target; (b) the instance-level proof that ran before the migration (or state honestly none did — a discipline miss recorded, not hidden). Confirm the migration is reversible-from-backup if a repoint was missed.

### C2 · B8 TS-2 acceptance artifacts
Produce the acceptance the render-only dispatch required: `git diff --stat` showing frontend-only · screenshots of both deals · floor badge truthful to `floorBinding` payload state (Highlands steady → badge; Bishop lease-up early → dormant, or as real data dictates). Missing = B8 reverts to claimed-not-accepted.

## PART 2 — THE CONSOLIDATION CORE (deferred B2–B5; name any true blocker, "large" is not one)

### C3 · B4 — Trending schema (no dependency; do first — pure additive)
`rent_growth`, `other_income_growth`, `expense_growth.{insurance, payroll, utilities, repairs_maintenance, contract_services, marketing, g_and_a, other}` as four-door LayeredValue (user-wins). `real_estate_tax` EXCLUDED — generic trending path GUARDS against the tax key (throws/flags). Exit-basis engine consumption: disposition computes both forward_12/trailing_12 from the monthly series, pins chosen, evidence shows both. **Identity check: all rates defaulted to current behavior ⇒ both deals' outputs unchanged — paste.**

### C4 · B5 — Multi-user attribution (no dependency)
`edited_by` + `edited_at` on every user-layer write (routes + overlay writes); append-only per-field history (propose shape: new table vs event-log reuse). Last-write-wins unchanged, no approval workflow. Identity-neutral (metadata only) — confirm no output moves.

### C5 · B3 — Blob census + semantics (read-only census first)
1. Census live 140-key `year1` blob vs W4c addendum; REPORT uncovered keys before renaming.
2. Migrate semantics per addendum + additions; in-place-class vs stabilized-class slots labeled.
3. Every blob reader (Phase-1 census list) verified vs new labels — paste per-site verdict. Identity both deals.

### C6 · B2 — Scenario decomposition with shadow-read (the keystone)
`deal_underwriting_scenarios.year1` → `deal_assumption_overlays` rows. Shadow-read verifier: old blob vs recomposed overlay per deal-scenario, ALARMS on mismatch, runs the confidence window (propose N builds or M days). Bishop's active scenario is the live test — paste one full decompose→recompose→identity. Blob write path + sync trigger retire only AFTER the window is clean. Highlands has no active scenario (Phase-1 finding) — confirm it needs no decomposition, not that decomposition silently no-op'd.

## ARC CLOSE (this time for real)
Report shows: C0 verdict · C1 evidence (or recorded miss) · C2 artifacts · C3–C6 each executed with identity checks pasted · six Phase-1 divergences final disposition · R1–R10 all closed · both baselines green · golden standing (Highlands+Synthetic green, Bishop skipped-pending-F5) · F-P1 findings ledger closed/owned. THEN F-P1 CLOSES with residuals named (F-P1t trigger model queued; nothing else open). Roadmap updates: **D3 becomes active** (agent assumption seam — the payoff arc where the CashFlow Agent authors through everything F-P1 built).

## OUT OF SCOPE
F-P1t · D3 execution (next) · CU/F-P2 · F5 (external clock, epoch note stands) · FinancialEnginePage display-state refactor (F-P2).

**Order: C0 → C1 → C2 → C3 → C4 → C5 → C6 → close. STOP on identity failure or a divergence outside the known six. Report pastes evidence throughout — no "done" without its artifact.**
