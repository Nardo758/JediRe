# DISPATCH — DEAL-CREATION PIPELINE AUDIT (Read-Only, Both Surfaces, Surface-1 Priority)

**Purpose:** Every arc so far ran on two hand-verified deals (Bishop archive_import, Highlands owned_import). The **platform_underwritten origin path** — a fresh deal from an address, seeded from live sources into the capsule/Deal Details — has never been audited end-to-end. D3's agent is about to start WRITING into this pipeline; confirm it works before building on it. Read-only: map, verdict, STOP.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Standing rules:** S1-01 file:line evidence · verify counts · per-hop verdict is WORKS / STUB / MOCK-INTERCEPTED / BROKEN, each with proof (a live trace or the file:line that makes it so). No fixes.

## Scope
Two create surfaces, **Surface 1 prioritized** (chat/address-driven — Telegram; the revenue launch path):
- **Surface 1:** address in → deal out, via the chat/coordinator flow.
- **Surface 2:** Bloomberg web-app create flow.
Audit both; if time-boxed, Surface 1 gets full depth, Surface 2 gets the entry-point + divergence map.

## P1 · Create-flow entry points
1. Where does "create a deal" begin on each surface? Route/handler/command — file:line. Surface 1: the chat intent → deal-creation handler. Surface 2: the UI action → endpoint.
2. What's the minimum input each requires (address only? address + strategy? more)?
3. What origin_class does a fresh create assign — `platform_underwritten`? Confirm it's set, where, file:line.

## P2 · The assembly chain (the heart of it)
Trace address → seeded deal, hop by hop, each with a WORKS/STUB/MOCK/BROKEN verdict:
1. **Property resolution:** address → property record. Which source (RentCast/ATTOM/Google Places/county GIS)? Does it create/find the `properties` row? Live-trace one real address if possible.
2. **Research Agent / DealContext assembly:** does the universal data-assembly layer actually run on create, producing the typed DealContext? Or is it stubbed/bypassed? This is the canonical "Research Agent connects to ALL platform APIs" claim — verify it's real, file:line, and list which sources actually fire vs which are TODO.
3. **Seed into `deal_assumptions`:** does DealContext → `deal_assumptions` seed happen? Which fields populate, which stay null/default? Is the `year1` blob built here? Origin-class honest-absence respected (no fabricated underwriting)?
4. **Capsule / Deal Details render:** does the seeded deal render in the capsule and Deal Details? What reads from live seed vs what's hardcoded.

## P3 · Mock-data interception sweep (the recurring bug class)
`frontend/src/data/` and any mock fixtures have historically intercepted live data flow (documented recurring pattern). For the create → render path: grep for mock/fixture imports on every component the new deal touches; per hit, is the live path actually wired or does mock data shadow it? This is the single highest-value check — a create flow that "works" against mock data is the classic false-green.

## P4 · Origin-class + Lane integrity on create
1. A platform_underwritten deal: does it correctly get NO fabricated actuals (that's owned_import's data), and NO archive backfill? Clean origin assignment.
2. Lane B boundary: user-provided data on create (uploads) stays deal-scoped; platform data (comps, market) is global. Confirm the create path doesn't cross-contaminate.
3. Does a fresh deal correctly report `modelNotBuilt` until first build (F-P1-C honest-absence), or does create auto-fabricate a model?

## P5 · The gap for D3
D3's agent will write assumptions into this pipeline. Flag: does the create flow produce a deal-state the agent seam (W1's agent_confirmed layer, the overlay write-path) can write into cleanly? Any create-path assumption that lands somewhere the overlay seam can't reach is a D3 blocker — name it.

## DELIVERABLE + STOP
`docs/audits/DEAL_CREATION_PIPELINE_AUDIT.md`: per-surface entry map, the P2 assembly chain with per-hop verdicts, the P3 mock-interception findings (the money section), origin/Lane integrity, and the D3-readiness flag. End with a FINDINGS list (works / stubbed / mock-shadowed / broken) and a RULINGS/BUILD-NEEDED list — what's a five-minute confirm vs what's a real build arc. **STOP. No fixes, no wiring.**

## OUT OF SCOPE
Any fix/wiring · the F-P1 confidence-window builds (separate, trivial, operator runs them in normal use) · D3 W2–W7 · new-source integration.

**Read-only. file:line throughout. The findings tell us whether 'ensure the plumbing' is a confirm or an arc.**
