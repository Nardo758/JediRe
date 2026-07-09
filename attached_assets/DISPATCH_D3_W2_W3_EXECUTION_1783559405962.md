# DISPATCH — D3-W2/W3: The Agent Writes Through the Seam

**The arc:** the agent stops describing the model and starts authoring it. Assumption writes land in overlays via the `agent_confirmed` slot with full provenance, plausibility escalation, and evidence refs. This is what F-P1, CREATE-1, W1, and the entire firewall arc were built to make safe.
**Gates: BOTH CLEAR.** F-P1 confidence window closed 10/10 (2026-07-08). CREATE-1 closed (fresh deals materialize writable rows). CoStar firewall complete across every existing surface.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000. Requires real DB.
**Reference:** `DISPATCH_D3_PHASE2_GO.md` (full R1–R8 rulings) · `docs/audits/D3_PHASE1_AUDIT.md`.
**Standing rules:** S1-01 pasted live output · value identity both reference deals · both baselines green · verify counts · **the empty sibling hides the populated one** (check every table in a family) · **a deletion path that only cleans what it recomputes can't clean what it can't see** · **migrations fail loudly.**

## PRE-ENCODED RULINGS (do not re-litigate)
- **R1(c):** resolution order is exactly `storedResolved < Engine A < agent_confirmed < perYearOverride < override`. Legacy `agent` stays below Engine A. (W1, done, ratified.)
- **Overlay prune:** NO auto-prune ships. Superseded rows are the attribution/undo trail. Retain most-recent-superseded per field indefinitely; deeper-tail prune is a future policy item. Build nothing that assumes pruning.
- **No-active-scenario write contract:** agent writes go to a **deal-level overlay, `scenario_id = NULL` (base scope)**. The agent NEVER auto-creates a scenario — creating one is a user-visible workspace act (tabs, working-set count), and agents use the same doors as humans. Base values fan out to non-overriding scenarios per F-P1 edit semantics. If schema requires `scenario_id NOT NULL`, that's a one-line migration in W3.

## W0 · Scope/flag consistency (carry-over, do first — small)
Bishop's restricted `metric_time_series` rows carry `scope_id = 'GLOBAL'` **and** `redistribution_restricted = true` — two contradictory truths in one row.
1. Grep every reader of `metric_time_series` / `historical_observations`: does each check `redistribution_restricted`, or do any rely on `scope_id = 'GLOBAL'` as the safety boundary? Paste the reader census with per-site verdict.
2. **Ruling: re-scope Bishop's input rows to `deal:3f32276f-aacd-4da3-b306-317c5109b403`** so scope and flag agree. A row owned by one deal must not wear GLOBAL scope. Migration + re-verify: Bishop's deal-scoped sweep still finds its inputs (270 pairs reproduce), GLOBAL sweep still excludes them, non-Bishop query still gets nothing.
3. If any reader was safe-by-flag-only or safe-by-scope-only, note it — after the re-scope both must hold.

## W2 · R7 — `update_assumption` reroute (the live-defect closure)
1. Kill the raw `UPDATE deal_assumptions SET field=$1` at `skills/index.ts:440` and its 9 hardcoded scalar columns.
2. Same skill name/signature (CU adjacency: exactly ONE write-action skill). Routes through the overlay write API into the `agent_confirmed` slot, `scenario_id = NULL` base scope by default; if a scenario is active and the user is viewing it, the write scopes to that overlay per F-P1 §3 edit semantics.
3. **Proofs, all pasted:**
   - a) Agent writes a value → it lands in an overlay row (not `deal_assumptions` scalars).
   - b) **The write survives a subsequent build** — this is the defect W1 diagnosed and nothing has yet proven fixed end-to-end. Write → build → read back → value held.
   - c) Same on a **fresh CREATE-1 deal** (no scenario, no prior overlays) — write lands in the materialized row, retrievable, not staged-invisible.
   - d) A `perYearOverride` on the same field beats the agent value (resolution order holds).
   - e) `agent_confirmed` absent ⇒ resolution byte-identical to pre-W2 on Bishop + Highlands (value identity).

## W3 · R2 + R4 — provenance schema + escalation surface
1. **Migration** on `deal_assumption_overlays`: `reasoning TEXT`, `evidence_refs JSONB`. (Attribution `edited_by`/`edited_at` already present from F-P1 B5; `confidence` present.) If `scenario_id` is NOT NULL-constrained, relax it for base-scope agent writes.
2. **R4 escalation, zero-migration:** implausible agent value writes WITH `confidence='low'` + a note; surfaces in the F9 assumption audit trail. **Escalate, never reject; never silently drop.**
3. **Write-time plausibility bound:** deterministic bounds-check (not judgment) sets the flag. Distinct from the engine's INV-* output checks — those stay where they are.
4. **Proof:** an out-of-bounds agent value → written, flagged low-confidence, note attached, visible in the audit trail. Paste the row + the surface.

## W4 · R6 — broker-claim flag via the seam (post-W3)
Agent flags a field (e.g. `real_estate_tax.broker_flag`) through the overlay seam. **Never writes `deal_data` directly.** The OM-vs-post-reassessment divergence lands as a provenance'd flag on the overlaid field.

## W5 · R3 — hash stamping (post-W3)
Every overlay row written during a build run stamps that run's `deal_financial_models.assumptions_hash`. Reuse existing machinery; compute nothing new.

## W6 · [F5-GATED] evidence_refs integrity
Only after F5's Finding-V fix (duplicate/missing `inPlaceNOI` evidence entries) lands: `evidence_refs` must point at real, de-duplicated evidence rows — CE signal, extracted-doc row, comp, **or a deal-scoped correlation (Bishop's 270 are now legitimate citable evidence)**. Dangling ref fails the write. **Per X3: every ref carries `data_kind: actual | forecast`** — a correlation against a vendor's 2031 projection is different evidence than one against realized series, and an agent citing forecast-derived evidence must say so in `reasoning`.
If F5 hasn't landed when the arc reaches here: **close D3 with W6 as a named residual.** Do not ship dangling refs.

## W7 · [F-P1t STATE CHECK] tax reconciliation
F-P1t landed → layer-(a) deterministic reconciliation (engine tax vs ATTOM `tax_amt`) lives in tax-engine acceptance. Not landed → ship layer-(b) standalone Inngest cron as interim, marked for migration. Agent judgment layer (OM-tax vs post-reassessment → W4's flag path) proceeds either way.

## THE DEMO (acceptance-adjacent, do it — this is the point of the arc)
Using X1's four EVIDENCE-AVAILABLE gap fields on Bishop: have the CashFlow agent **propose one assumption value**, citing a deal-scoped CoStar-derived correlation as `evidence_refs`, with `reasoning`, landing as `agent_confirmed` + `confidence`. Paste: the overlay row, the resolved value, the evidence chain, and the fact that the operator can override it. **This is the first time the platform proposes a number and waits.** (If W6 is F5-blocked, run the demo with a non-`inPlaceNOI`-class evidence ref so the integrity gate isn't the blocker.)

## ARC CLOSE
W0 consistency · W2 five proofs · W3 escalation proof · W4/W5 executed · W6 done-or-residual · W7 (a)-or-(b) · the demo pasted · both baselines green · golden standing (Highlands+Synthetic green, Bishop skipped-pending-F5) · value identity both deals. **D3 CLOSES with residuals named.** Roadmap: CU or F-P2 next per operator (F-P2 is Tier-5, design-gated).

## OUT OF SCOPE
CU registry merge (D3 leaves ONE write-action skill for it) · F-P2 chassis · F-P1t build · TS-2 · deleting any row · auto-creating scenarios · auto-pruning overlays.

**Order: W0 → W2 → W3 → W4 → W5 → [F5] W6 → [check] W7 → demo → close. STOP on: identity failure, an agent write not surviving a build, or a scenario auto-created.**
