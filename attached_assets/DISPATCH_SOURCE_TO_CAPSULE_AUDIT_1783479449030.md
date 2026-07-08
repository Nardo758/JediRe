# DISPATCH — DEAL-CREATION + UPLOAD/EXTRACTION PIPELINE AUDIT (Read-Only)

**Purpose:** The capsule is only as trustworthy as its source material, and it's shareable + agent-operable — so extraction fidelity IS the product's trust boundary. Audit the full source→capsule pipeline: create-flow (platform_underwritten origin), upload/extraction (F11 + create-time), OM handling (the hard case), and multi-year history capture (the Periodic Timeline needs up to 60 months of actuals, not just a T-12). Read-only: map, verdict, STOP. D3's agent is about to write INTO this pipeline — confirm the foundation first.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Standing rules:** S1-01 file:line evidence · verify counts · per-hop verdict WORKS / STUB / MOCK-INTERCEPTED / BROKEN with proof. No fixes.

## PART A — CREATE FLOW (platform_underwritten origin)
Surface 1 (chat/address, revenue path) prioritized; Surface 2 (Bloomberg web) entry + divergence.
1. **Entry points** per surface — route/handler/command, file:line; minimum input; origin_class assignment (confirm `platform_underwritten` is set, where).
2. **Assembly chain, per-hop verdict:** address → property resolution (which source; creates/finds `properties` row) → **Research Agent / DealContext assembly** (does it actually run on create, or stub? which platform APIs fire vs TODO) → seed into `deal_assumptions` (which fields populate; `year1` blob built here?; honest-absence respected) → capsule/Deal Details render (live-seed vs hardcoded).
3. **Origin/Lane integrity:** platform_underwritten gets NO fabricated actuals, NO archive backfill; `modelNotBuilt` until first build (F-P1-C); Lane B (uploads) deal-scoped vs platform data global.

## PART B — UPLOAD / EXTRACTION PIPELINE (F11 + create-time)
This is the parallel seed path — uploads carry deal-specific truth live sources can't.
1. **Upload surfaces:** where do uploads land? F11 (document uploads) — route, storage, file:line. Create-time attach — is there one, or is upload only post-create? Map both.
2. **Extraction chain, per-hop verdict:** uploaded file → OCR/parse → structured extraction → mapped values → `deal_assumptions` (and `deal_monthly_actuals` for history — see Part D). Which extractor per doc type (rent roll, T-12, OM, P&L)? What's LLM vs deterministic vs regex?
3. **Provenance:** does every extracted value land with `document` provenance + source ref (which file, ideally which page)? The `column_basis` discipline — is a value tagged with which OM column/section it came from?
4. **`broker_claims` boundary (critical invariant):** OM projections and broker pro-forma figures must populate `broker_claims`, NEVER satisfy a real actuals/T1-document field. Audit: does the current extraction respect this, or can an OM's projected NOI land in an actuals field? This is the single most important correctness check in Part B — a shareable capsule that presents broker projections as verified actuals is a trust failure.

## PART C — OM HANDLING (the hard case; current-state assessment)
OMs run 20+ pages with ~3 pages of signal. Audit what EXISTS today — do NOT design the fix here (that's the follow-on spec):
1. **Current path:** when an OM uploads, what happens? Whole-document OCR-and-dump to an LLM? Page selection? Nothing (manual)? file:line.
2. **Cost/accuracy shape:** if it's whole-document, estimate tokens per 20-page OM and note the signal-dilution risk.
3. **Page provenance:** can the current path say WHICH page a number came from? (Needed for evidence_refs + broker_claims routing.)
4. **Verdict:** is OM extraction WORKS / WEAK / MANUAL / ABSENT? This scopes the follow-on OM Extraction spec (classify→locate→extract architecture) — the audit's job is to establish the starting point, not build it.

## PART D — MULTI-YEAR HISTORY CAPTURE (the Periodic Timeline requirement)
The ribbon's actual-zone consumes UP TO 60 MONTHS of history (Highlands = 53 months; hybrid-actuals ≤60mo merge rule). Extraction must capture temporal DEPTH, not just current-period figures.
1. **Does any extraction path capture multi-year monthly history?** A T-12 gives 12 months; historical operating statements / trailing P&Ls / OM financial appendices can carry 2–5 years. Does the pipeline extract the series, or only the summary T-12?
2. **`deal_monthly_actuals` landing:** does extracted history land month-keyed in `deal_monthly_actuals` (the unlock for the whole owned-portfolio intelligence system), correctly origin-tagged, with the right months? Or does history get flattened to a single period?
3. **The silent-drop risk:** flag explicitly — an extraction that grabs the OM's summary T-12 but ignores 3 years of monthly detail in the appendix leaves the ribbon with no actual-zone. Does the current path have this failure?

## PART E — MOCK-INTERCEPTION SWEEP (the recurring false-green)
`frontend/src/data/` + fixtures have historically shadowed live data. For the ENTIRE create→upload→extract→render path: grep mock/fixture imports on every touched component/service; per hit, is the live path wired or mock-shadowed? Highest-value check — a pipeline that "works" against mocks is the classic false-green.

## DELIVERABLE + STOP
`docs/audits/SOURCE_TO_CAPSULE_PIPELINE_AUDIT.md`: Part A create-chain verdicts · Part B extraction chain + the `broker_claims` boundary finding · Part C OM current-state verdict (scopes the follow-on spec) · Part D multi-year-history capture verdict (the silent-drop check) · Part E mock findings. End with:
- FINDINGS list (works / stubbed / mock-shadowed / broken) across all parts.
- A CONFIRM-vs-BUILD split: what's already solid vs what needs an arc.
- The OM spec scope (from Part C) and the multi-year-history scope (from Part D) as named follow-ons.
**STOP. No fixes.**

## OUT OF SCOPE
Any fix/wiring · the OM extraction spec itself (follow-on, shaped by Part C) · F-P1 window builds (operator, normal use) · D3 W2–W7 · new-source integration.

**Read-only. file:line throughout. This audit tells us whether the capsule's foundation is solid before D3's agent starts writing on top of it.**
