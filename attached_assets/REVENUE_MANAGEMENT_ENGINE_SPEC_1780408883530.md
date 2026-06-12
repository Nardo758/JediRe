# Revenue Management Engine — Build Dispatch

**Centerpiece:** `revenue-engine.reference.ts` (attached) — the deterministic Pro Forma Beat Engine. It is the algorithm spec; port it into the repo as a service, wired to real inputs. Do not re-derive the logic — wire it.
**Executors:** Claude Code (engine + routes + rankings), Replit (UI wiring).
**Companions:** `ASSET_HUB_REBUILD_SPEC.md`, `CONSOLE_WIRING_AUDIT.md` (when back).
**Property of record:** Highlands — `property_id 7ea31caf-…`, `deal_id eaabeb9f-…`.

---

## 1. The objective (what this engine is)

Revenue Management's goal is **beat the underwritten pro-forma NOI**, not maximize rent. NOI = EGI − OpEx → two levers:

- **Revenue lever** — `repricingSynthesizer()`: capture loss-to-lease, timed to the lease roll, **gated by market signal**, bounded by the annual rank target. Cause/symptom discipline: gain = Expected × (1 − vacancy penalty).
- **Expense lever** — `expenseDiscipline()`: hold **controllable** opex to the underwriting (recover overruns by a realizable fraction); **accept and flag** non-controllable drag (insurance/tax).
- **Orchestrator** — `proFormaBeatEngine()`: composes both into one NOI bridge (current → +revenue → ±expense → projected → vs pro forma → beat/miss) with status BEAT / ON_TRACK / AT_RISK.

This is a **deterministic, market-gated heuristic**, not an ML forecast (Phase 1B stabilization is blocked on empty `historical_observations`). M36 Joint Distribution is the upgrade path — it makes `captureFraction` and `vacancyElasticity` distributions. The engine isolates those in `CONFIG` so M36 drops in without restructuring.

---

## 2. Engine input wiring (port `revenue-engine.reference.ts`)

Create `backend/src/services/revenue/revenue-engine.service.ts` from the reference module. Wire each input from its real source; `assetMode = 'owned'` (actuals are ground truth, not OM):

| Engine input | Source | Status (per audit) |
|---|---|---|
| `ProFormaTargets` | M09 stabilized pro forma — `GET /operations/:dealId/projected-vs-actual` (`operations.routes.ts:631`) | WIRED |
| `ActualsSnapshot` (TTM run-rate) | `deal_monthly_actuals` (53 rows Highlands), M22 derived fields | WIRED |
| `LeaseCohort[]` | `rent-roll-derivations.service.ts`: `expiration_waterfall` + `unit_type_breakdown` (renewal rate, concession). Trade-out spread per cohort ← **new** `tradeout-events` route (§3.1) | UNWIRED + NEW ROUTE |
| `MarketSignalSet` | `correlations/property/:id` (`correlation.routes.ts:59`; COR-04 runway, COR-06 pipeline, COR-15 concession) + M07 traffic velocity | UNWIRED (traffic needs prediction run; `submarket_id` NULL degrades — Task #1685) |
| `ExpenseLine[]` (controllable vs non-) | `deal_monthly_actuals_lines` (1,653 GL rows) mapped to UW opex lines; category per M09 taxonomy (controllable: R&M, contract svc, landscaping, personnel, marketing, admin, turnover; non-: utilities, insurance, tax, mgmt fee) | UNWIRED |
| `RankTarget` | rankings service (§3.3), set annually in Rank & Comps drawer | NEW |

Calibration (`CONFIG`): ship the reference defaults; open a follow-up to learn signal weights, capture fractions, vacancy elasticity, and controllable-recovery fractions from the **archive flywheel** (`archive_assumption_benchmarks`) + owned actuals. Leave `// TODO(calibrate from archive)`.

---

## 3. Supporting build contracts (the five pieces)

### 3.1 Route — trade-out events  *(Tier-2 unblock)*
```
GET /api/v1/operations/:dealId/tradeout-events
→ [{ unit_type, event_type:'new'|'renewal', prior_rent, new_rent, spread_pct, effective_date }]
```
Reads `lease_tradeout_events` (1,492 rows, no route today). Feeds LEASE ROLL trade-out column and validates `LeaseCohort` market spreads.

### 3.2 Route — leasing observations  *(Tier-2 unblock)*
```
GET /api/v1/operations/:dealId/leasing-observations
→ [{ week, traffic, tours, applications, leases, net_absorption }]
```
Reads `leasing_weekly_observations` (276 rows, no route today). Feeds M07 traffic baselines and the weekly traffic view.

### 3.3 Rankings service
```
GET  /api/v1/rankings/:propertyId
→ { current_rank, current_pcs, set_size, set_label,
    comps:[{ name, rank, pcs, rent, occ, src:'platform'|'user' }] }
POST /api/v1/rankings/:propertyId/target
  body { overall:int, byType:bool, perType?:{ '1BR':int, ... } }   // annual set-and-forget
```
Powers COMP SET & RANK (subject inserted at its rank) and supplies `RankTarget` to the engine. Comp set seed from `GET /lifecycle/:dealId/comp-set`; persist user edits + target.

### 3.4 Route — beat plan (wraps the engine)
```
GET /api/v1/revenue/:dealId/beat-plan?targetRank=2&byType=false
→ BeatPlan        // exact shape exported by revenue-engine.reference.ts
```
Assembles the six engine inputs (§2), calls `proFormaBeatEngine()`, returns `BeatPlan`. Honors DealContext 24h cache. **Supersedes** the earlier `/revenue/:dealId/course` contract — the course is now `BeatPlan.revenue`; the NOI bridge and expense findings come with it.

### 3.5 Frontend wiring (Replit)
- **REPRICING COURSE** panel ← `BeatPlan.revenue` (cohort recommendations); the JEDI SIGNAL chip ← per-cohort/portfolio action.
- **New PRO FORMA BEAT band** on REVENUE (above the course): render `BeatPlan.bridge` as the NOI bridge (current → +revenue → ±expense → projected → vs pro forma → beat/miss) with the BEAT/ON_TRACK/AT_RISK status chip and the `beatAnnual` headline. This is the surface that makes "beat the pro forma" visible.
- **Expense findings** ← `BeatPlan.expense`; surface flagged lines (controllable recovery vs accepted drag) — reuse the PERFORMANCE line-item-variance table styling.
- Rank target control in the Rank & Comps drawer drives `targetRank` / `byType` on the beat-plan request.

---

## 4. QA gates

**Phase A — Engine** *(STOP)*
- [ ] `revenue-engine.service.ts` ported from reference; `__example()` reproduces the validated output (ON_TRACK, projected ≈ $3.86M vs $3.92M pro forma on the sample).
- [ ] Unit tests: tailwind cohort → PUSH; headwind (pipeline + concession) → HOLD/CONCEDE; push-above-market triggers vacancy penalty; controllable overrun recovers, non-controllable accepted+flagged; bridge components sum to projected NOI.

**Phase B — Routes** *(STOP)*
- [ ] §3.1–3.4 routes mounted in `index.replit.ts`, returning live Highlands data; trade-out + leasing-observations no longer orphaned.
- [ ] `/revenue/:dealId/beat-plan` returns a real `BeatPlan` for Highlands.

**Phase C — UI** *(STOP)*
- [ ] PRO FORMA BEAT band + REPRICING COURSE + expense findings render from the live beat-plan; rank control re-requests.

**Global**
- [ ] No fabricated numbers presented as live where traffic predictions are unrun / `submarket_id` NULL — surface the caveats from `BeatPlan.caveats`.
- [ ] Engine stays deterministic & pure (no I/O inside the engine functions; the service does the fetching).

---

## 5. Sequence & dependencies

1. Port engine + tests (Phase A) — no external deps; usable immediately with stubbed inputs.
2. Land §3.1/§3.2 routes + the expense-line mapping + correlation wiring (unblocks real engine inputs).
3. Run `POST /api/v1/traffic/predict/7ea31caf` and populate `submarket_id` (Task #1685) so the throttle uses live traffic + submarket signals rather than HOLD-defaults.
4. Rankings service (§3.3) → real `RankTarget`.
5. Beat-plan route (§3.4) → Replit wires the surface (§3.5).

---

## 6. Caveats to preserve (do not present as certainty)

- Heuristic, not forecast — `BeatPlan.caveats` carries this; surface it in the UI.
- `CONFIG` values are defaults pending archive calibration.
- Until traffic predictions run and `submarket_id` is set, the revenue lever under-fires (defaults toward HOLD) — the beat will read conservative, not wrong.
- Per-unit-type market rent (the `LeaseCohort.marketRent` input) still depends on the comp-feed decision (v1 aggregate vs v1.1 per-type) — the open product call.
