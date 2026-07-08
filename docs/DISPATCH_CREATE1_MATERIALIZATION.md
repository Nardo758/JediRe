# DISPATCH — CREATE-1: Create-Path Materialization

**#3 of 6. GATE: QW-2 done (origin_class column exists). Type: build arc.**
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Finding source:** both audits P1/P2/P5 + Part A. Fresh deals are hollow: no `properties` link (`autoLinkDeal` stub), DealContext assembly stubbed (only Census geocode fires), `deal_assumptions` deferred to first proforma-GET, no `deal_underwriting_scenarios` pre-build, origin not assigned. Result: **agent writes are invisible on fresh deals** (D3's premise broken). This arc materializes a real, writable deal-state at create.
**Standing rules:** S1-01 live evidence per hop · value identity on Bishop/Highlands (their create-path is historical — this must not alter their existing state) · both compile baselines · honest-absence over fabrication throughout.

## Build (each hop with a live create-trace)
1. **Origin assignment:** create-flow sets `origin_class = 'platform_underwritten'` on fresh address-created deals (chat surface `messageRouter.ts:53`, web `deals.service.ts:21`). Uses QW-2's column.
2. **Property link (fix `autoLinkDeal` stub):** create resolves address → `properties` row (find-or-create) via the real resolver (RentCast/ATTOM/Google Places/county GIS — use what's wired; report what isn't). The deal links to a real property, not nothing.
3. **DealContext assembly — make it real, honestly scoped:** the Research Agent assembly should fire on create beyond Census geocode. Scope to what's ACTUALLY wired (report which sources fire vs still-TODO — don't fake sources). The goal is a populated DealContext where data exists, honest-absence where it doesn't — NOT a fabricated full context.
4. **Materialize `deal_assumptions` at create (the keystone):** create writes a `deal_assumptions` row immediately — populated from DealContext where available, honest-absence (null + reason) where not. NO fabricated underwriting (platform_underwritten origin = no actuals, `modelNotBuilt` until first build). This is the row the agent seam needs to exist.
5. **Scenario/overlay readiness:** confirm the materialized state gives the D3 overlay write-path a target — either a default scenario/overlay exists at create, or the write-path handles the pre-scenario state gracefully. Flag which, so D3-W2 knows the contract.

## Acceptance
1. **Create a fresh deal from a real address, live** — paste the full trace: origin_class set, properties row linked (id), DealContext sources that fired, deal_assumptions row materialized with honest-absence where data is missing.
2. **Honest-absence proof:** the fresh deal reports `modelNotBuilt: true` and fabricates no actuals/underwriting — pasted.
3. **D3-readiness proof (the point of the arc):** stage an agent_confirmed write on the fresh deal → it lands in a real row and is retrievable (not staged-invisible). This is what P5 said was broken; prove it fixed.
4. **Bishop/Highlands unchanged:** their existing state and outputs identical (create-path change must not touch already-created deals) — value identity pasted.
5. Both baselines green.

## OUT OF SCOPE
D3-W2+ agent-behavior work (this makes the state D3 writes into; the reroute itself is #4) · OM/history extraction (specs #5/#6) · new-source integration beyond wiring what exists · touching Bishop/Highlands create history.
