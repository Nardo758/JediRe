# DISPATCH — F-P1: ASSUMPTION STORE CONSOLIDATION (Arc Opener)

**Arc:** F-P1 — one canonical assumption store + sparse overlays. The foundation for D3 (agent seam), CU (chat unification), F-P2 (chassis). Biggest ledger of the program; run it with the engine arc's rhythm: Phase 1 read-only audit → STOP → operator rulings → Phase 2 build.
**Executor:** engine-authority agent (bot/Claude Code). Repo `Nardo758/JediRe.git` · backend :4000.
**Standing rules:** S1-01 pasted evidence · verify counts · compile guards (both baselines) green per commit · commit early and often · no `--no-verify` · completion reports paste raw output.
**Universal blocker:** VALUE IDENTITY — Bishop's and Highlands' resolved assumption values and live build/seed outputs must be byte-identical before vs after every migration step. Any drift = STOP, not absorb. (Highlands seed canary: 57.17% / $6,315,308.53 / 2026-04-01. Bishop live five: loan $21,024,006 / equity $39,365,994 / IRR −20.95% / EM 0.3144 / DSCR 1.0424 — note these are epoch-bound to the current enhancement path; if F5 lands mid-arc and moves them legitimately, record the new epoch, don't chase the old.)

## THE LEDGER (everything this arc owns — verify against roadmap `docs/POST_D2_PROGRAM_ROADMAP.md` v8)
- **Four stores → one + overlays:** `deal_assumptions` (canonical), `deal_financial_models` (retires as assumption source; stays as build-output cache), `deal_underwriting_scenarios` (migrates INTO overlay records), `FinancialEnginePage.tsx:579` local-state copy (dies).
- **F-P1-A:** build endpoint requires client-supplied assumptions (`financial-model.routes.ts:512-515`, no server fallback) — server-fetch becomes the ONLY path; client payload retired; the React copy's write path with it.
- **F-P1-B:** provenance lie — actuals-derived `year1.noi.resolved` tagged `platform_fallback`.
- **F-P1-C:** honest absence — owned_import deals (no underwriting row) get `modelNotBuilt: true, reason: 'no_underwriting — owned_import'`, never a default-build.
- **year1 blob semantics:** endpoint-labeled slots (in-place-class vs stabilized-class values currently cohabiting one field); documented in W4c addendum — migrate per its map.
- **Read-site repairs:** the W4b enumeration (50+ sites) — the 4 flagged live issues (roadmap-engine `baseNoi`, excel-export "Year 1 Stabilized" label, dashboard label, `cashflow.postprocess` fallback chain) plus any the fresh audit adds.
- **Serialization gap (new, from TS-1):** `monthlyCashFlow` / `floorBinding` / per-month occupancy are computed but unreachable by any frontend endpoint — serialize a thin monthly projection (month, occupancy, effectiveVacancy, floorBinding, noi) into the latest-model payload. **Unlocks TS-2** (T2 floor badge + T3 grid row, as written in the TS-1 dispatch, gate: monthly fields reachable).
- **Trending schema (operator ruling 2026-07-04):** ALL growth rates become four-door LayeredValue assumptions (CPI/FRED · CE · source-material · owned-asset; user wins) — market rent (done), other income, PER-CATEGORY expense growth (insurance/payroll/utilities separate; no flat default). Schema + resolution here; agent authorship is D3.
- **Tax engine (same ruling, scoped):** VERIFY-AND-STRUCTURE pass — inventory the runner's existing FL machinery (millage, reassessment-on-sale, 10% cap), restructure into jurisdiction ruleset files (no `if (state==='FL')` outside rulesets), implement the trigger model (sale/CO/cycle steps + four-door trend clamped by cap between events, clamp surfaced as provenance). Full multi-jurisdiction coverage is future rulesets, not this arc.
- **Exit-basis (operator ruling 2026-07-06):** `exit_valuation_basis: 'forward_12'|'trailing_12'` LayeredValue (default forward_12); disposition computes BOTH from the monthly series (T12 = Σ m−11..m; fwd = Σ m+1..m+12), pins the chosen basis, evidence states which and shows both.
- **Multi-user attribution:** `edited_by` + timestamp on every user-layer write; last-write-wins with visible attribution; per-field append-only history queryable. Approval workflows NOT in scope.
- **Edit semantics (§3 composition spec):** writes route to the viewed scenario's overlay; explicit promote-to-base; base edits fan out to non-overriding scenarios.

## PHASE 1 — READ-ONLY AUDIT (STOP at end; no writes, no migrations)
1. **Store census:** for each of the four stores — full schema, every WRITER (file:line), every READER (file:line), and which fields are authoritative vs duplicated. This extends the W4b read-site enumeration to write-sites. Deliverable: one table.
2. **Divergence audit:** for both reference deals, dump the same logical assumptions from every store that holds them — where do stores DISAGREE today? Every disagreement is a migration decision for the operator (which value wins), not a silent choice.
3. **Overlay schema proposal:** canonical `deal_assumptions` shape + sparse overlay record design (scenario_id, field-path keys, LayeredValue-compatible, provenance per §composition-spec) + how `deal_underwriting_scenarios` rows map in. Include the trending fields, exit-basis, attribution columns, and the year1 blob's replacement slots in the proposed schema.
4. **Migration map:** ordered steps, each with its value-identity checkpoint and rollback note. Flag every step that touches a live consumer (build route, seeder, agents, exports).
5. **Serialization design:** the thin monthly projection's shape + which endpoint carries it (extend latest-model response — no new endpoint unless impossible; justify if so).
6. **Tax machinery inventory:** what exists in the runner today (file:line per mechanism), what the ruleset restructure moves where.
7. **Report + STOP.** Operator rules on: divergence winners, overlay schema, migration order, serialization shape, tax restructure scope.

## PHASE 2 — BUILD (on rulings; sequence within enforced)
Order: schema + overlays land dark (no readers) → F-P1-A server-fetch path added BESIDE client path, proven equivalent (same deal, both paths, identical output pasted), then client path retired + React copy deleted → store migrations per map with per-step identity checkpoints → blob semantics + provenance repairs (F-P1-B) + F-P1-C honest absence → read-site repairs → trending/exit-basis/attribution schema live → serialization gap closed (then flag TS-2 unblocked) → tax ruleset restructure → full regression: both compile baselines, golden suite (Highlands + Synthetic green, Bishop skipped-pending-F5), value-identity finale on both deals, D1 navigation pass still clean.

## OUT OF SCOPE
D3 agent seam (schema accommodates it; no agent writes here) · CU · F-P2 chassis · TS-2 execution (separate small dispatch once unblocked) · F5 items (external agent's clock — coordinate only if its landing moves the Bishop epoch) · approval workflows · multi-state tax rulesets beyond FL+GA structure.

**Phase 1 first. STOP means STOP. Report with the census tables and the divergence list — the operator's rulings shape Phase 2.**
