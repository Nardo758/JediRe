# DISPATCH — One NOI Truth: Model↔Ribbon Reconciliation + Capital-Structure Wiring + Monthly-Model Verification

**Arc:** F9 Underwriter Model. Follows the live-session report (Phases 0–2, halted at step 9). Steps 4, 5, 6 are RE-SCORED TO OPEN per operator review: the exhibit proved model == stored (consistent with D0's LLM-restated-arithmetic finding) but the designed comparison — model vs the deal's live projection story — was never run, and it fails on inspection: Bishop's model says Y1 NOI $2.92M while Bishop's ribbon ramps to $840K/yr. Fixture pinning remains BLOCKED until this resolves.
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Structure:** Phase 1 READ-ONLY reconciliation probe with STOP (the canonical-derivation ruling is the operator's). Phase 2 fixes on approval. Step-9 fix (R3) is mechanical and carries fix authority immediately.
**Standing rule (S1-01):** pasted live values; tags are not values.

## PHASE 1 — READ-ONLY (STOP at end)

### R1 · The three-way NOI disagreement, fully mapped (Bishop first, then Highlands)
1. **Assumption layers:** paste `deal_assumptions.year1.noi` complete — every layer (om, platform, user, agent), `resolved`, `resolution`. Then answer from code (file:line): what produced `resolved: 840,231` when platform=2,675,265 and om=2,999,564? Trace the resolution path that yielded a value matching no layer. If it's derivable (e.g., a ratio, a stale write, a different field's value leaked), name it; if it's corrupt, say so.
2. **Model derivation:** what inputs did `buildModel()` actually use for Bishop's Y1 NOI $2.92M — paste the effective ModelAssumptions (marketRent, units, vacancy, opex) post-enrichment/bridge. Which of those trace to real deal evidence (extraction, comps) vs platform defaults?
3. **Ribbon derivation:** paste Bishop's current `periodic_seed` NOI months m1, m12, m24, m36 with values, zones, source tags. Are they still ramp-shaped (~$19.7K→$70K) or flat ~$243K? This answers whether "ribbon consumption" replaced, coexisted with, or never touched the ramp values.
4. **The verdict table:** one row per NOI story (year1.resolved / model Y1 / ribbon trajectory / capital-structure's deal_data / anything else found) with its derivation basis and evidence quality. NO ruling in this phase — the operator decides which derivation is canonical for a lease-up-era deal (the underwriter-model answer is that they should not be plural: one assumption resolution feeds one engine which feeds both yearly tabs and monthly ribbon; the probe's job is to show exactly where that chain forks today).

### R2 · Is the runner's monthly model real?
1. Paste Bishop's runner monthly NOI for Y1 (all 12) and Y2 (all 12). If constant within each year → the monthly layer is yearly÷12 and step 4's tri-tab identity was vacuous; report it as such.
2. From code (file:line): does `computeMonthOperating()` apply any intra-year dynamics (ramp via `months_to_stabilization`, seasonal vacancy, lease-up occupancy) or divide? Paste the core loop.
3. If divide: state what a real monthly model needs from the already-built ramp machinery (the `ramp(t)` + stabilization chain exists in the seeder/gap-bridge — the migration direction from the roadmap was engine absorbs ramp; confirm whether that absorption happened or was skipped).

### R3 · (FIX AUTHORITY NOW — mechanical) Capital-structure wiring
1. `capital-structure.routes.ts` (~:489) rewired from raw `deals.deal_data` to the built model (`deal_financial_models` latest / Engine C read path), with honest `modelNotBuilt` absence when unbuilt. No fallback to deal_data.
2. Identify every OTHER reader of `deal_data`'s financial fields (loan_amount, purchase_price, noi) repo-wide — list with file:line; migrate only capital-structure in this dispatch, report the rest for F-P1 scope.
3. Live proof: step-9 matrix re-run — capital-structure now agrees with every surface, both deals. Highlands' stale `deal_data.noi = 4.35M` noted as a data-hygiene row (do not edit data).

### R4 · Process finding (report item, no action): last session pushed non-compiling code to master (two syntax corruptions; backend could not start). Propose the minimal guard (pre-push compile check / CI gate) for operator approval — the golden harness CI slot is the natural home.

**STOP after R1/R2/R4 report + R3 proof. The canonical-derivation ruling (R1.4) and monthly-model scope (R2.3) are Phase 2 inputs from the operator.**

## PHASE 2 — (on rulings) sketch, to be confirmed after Phase 1
Expected shape: one assumption resolution feeds the engine; the engine's monthly layer becomes real (ramp-aware via the existing stabilization chain); the seed consumes those months; year1 layers repaired or re-resolved; fixtures pin only after the reconciled numbers pass a re-run of runbook Phases 1–2. Not authorized yet.

## OUT OF SCOPE
Fixture pinning · Excel parity · Phases 3–5 of the runbook (re-queued after Phase 2) · deal_data hygiene edits · F-P1 store consolidation (this probe will feed it).
