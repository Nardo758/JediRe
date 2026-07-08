# DISPATCH — F-P1 VERIFICATION SESSION: Close the Arc (DB + Frontend Required)

**Arc:** F-P1 store consolidation. Code-complete through Phase 2D; everything remaining is LIVE-ENVIRONMENT verification. **Run this in a session with backend :4000 up, DATABASE_URL set, and the frontend running.** If the environment lacks DB/browser access, STOP at V0 and report the gap — do not declare items "unprovable" from an environment that simply can't reach them (Phase 2D's mistake).
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git`.
**Deals:** Bishop `3f32276f-aacd-4da3-b306-317c5109b403` · Highlands `eaabeb9f-830e-44f9-a923-56679ad0329d`.
**Standing rules:** S1-01 — live DB/HTTP output pasted per item · value identity both deals · both compile baselines green · raw output in report.

## V0 · Environment gate (first, abort-if-missing)
Confirm and paste: `echo ${DATABASE_URL:+set}` · backend health 200 on :4000 · frontend reachable · `git pull` clean, HEAD contains `5edb00511`. If any missing → STOP, report which; this session cannot proceed without all three. (Clear `.git/*.lock` if fetch complains — known gremlin.)

## V1 · D2 floor-badge fix (environment-independent code-review + fix — do FIRST, doesn't need DB)
**Suspicion:** Bishop `floorBinding: true` in early lease-up is likely wrong — a deal at ~70% occupancy has physical vacancy far above the 5% floor; the floor should be DORMANT early, binding only near stabilization.
1. Trace the badge's data source: does it read PER-MONTH `floorBinding` from `monthlyProjection[i]`, or collapse to an aggregate / final-month / summary scalar?
2. If aggregate → THAT is the bug. Fix within render-only scope: badge reads per-period `floorBinding` for the displayed period. If the displayed surface has no single period (header-level badge), define the rule (e.g., "binds if ANY hold-year period binds" vs "Y1 binds") and implement it honestly.
3. Unit-test the fix: a lease-up fixture shows dormant early months, binding late; a stabilized fixture binds throughout. Paste.
4. Finding F-P1-D2-2 resolved or re-scoped with evidence.

## V2 · D1 equivalence forensic (DB)
1. Query for a pre-retirement client body: `SELECT id, created_at, assumptions FROM deal_financial_models WHERE deal_id = '<bishop>' AND created_at < '2026-07-07' ORDER BY created_at DESC LIMIT 1;` (adjust the retirement date to when B1 landed).
2. **Row exists** → diff its `assumptions` against the current server-fetch body for Bishop (build with server-fetch, capture the assumptions it used). Paste the field-level diff. Identical → F-P1-A equivalence PROVEN retroactively. Divergent → paste every differing field + both values; rule per field which was correct; any client-only-correct value = store gap to backfill; record as finding either way.
3. **No row** → the snapshot genuinely doesn't exist; F-P1-D1-1 becomes a real permanent gap (not a can't-reach-it gap). State it with the query result as proof.

## V3 · D3 Bishop live decomposition identity (DB)
1. Run `scenario-decomposition.ts` decompose on Bishop's active `deal_underwriting_scenarios.year1` blob → overlay rows.
2. Recompose from rows → reconstructed blob.
3. **Paste** the byte/field identity: reconstructed == original blob. Any mismatch = STOP, the round-trip contract failed on real data (synthetic passed; real is the proof).
4. Highlands: confirm zero active scenarios → decomposition correctly no-ops (paste the empty result, don't let a silent skip pass as success).

## V4 · Shadow-read window start + regression
1. Enable the shadow-read verifier (`verifyOverlayEquivalence()`); run the first of the confidence window's builds (10 clean / 7 days). Paste: shadow-read alarm-free on build 1, both deals.
2. Full regression: both compile baselines (main + test) zero new errors · golden suite (Highlands + Synthetic green, Bishop skipped-pending-F5) · D1-navigation LLM-silence still holds (row count before/after).
3. Value-identity finale: Bishop live five + Highlands seed canary, both unchanged from arc entry (epoch note: if F5 landed and moved Bishop's epoch, record it).

## CLOSE / RESIDUAL SPLIT
This session CLOSES F-P1 on: V1 fixed · V2 proven-or-genuinely-absent · V3 Bishop round-trip identity pasted · V4 build-1 clean + regression green + identity finale. The ONLY legitimately-remaining residuals after this are TIME-BASED or EXTERNAL, and they're pre-authorized to complete without a new dispatch:
- **Confidence window** (builds 2–10 / 7 days) — auto-completes; writer-path + trigger retirement (R-FP1-CLOSE-3, R-C6-7) fires at window's end, no new ruling needed.
- **F5 Bishop re-pin** — external agent's clock.
- **F-P1t tax trigger model** — queued next dispatch.
Report states F-P1 CLOSED-PENDING-WINDOW with those three owned, or names any V1–V4 failure that keeps it open. On close: **D3 (agent assumption seam) becomes the active arc.**

## OUT OF SCOPE
F-P1t · D3 execution · CU/F-P2 · FinancialEnginePage display refactor beyond the write-path already retired.

**Order: V0 gate → V1 → V2 → V3 → V4 → close report. STOP on: missing environment (V0), round-trip mismatch (V3), identity failure (V4), or divergence outside the known six. Every "done" pastes its live output.**
