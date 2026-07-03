# LIVE-SESSION RUNBOOK — W4 (D2 Part A) + W5 (D2b) + S1 Acceptance
**One session, one ordered checklist. Evidence pasted per step; verdict table at the end. S1-01 throughout: live output only — no code-inspection closes anything here.**
**Prerequisites:** PostgreSQL with Bishop (`3f32276f`) + Highlands (`eaabeb9f`) data · backend :4000 · frontend running · DeepSeek balance present (needed for step 14 only) · browser devtools available.

## PHASE 0 — Environment sanity (5 min; abort early if broken)
0.1 `git log --oneline -3` — confirm HEAD includes `47b3998f4` (harness) and the S1 commits.
0.2 Migration check: `deal_context_financials` exists; 0 pending migrations.
0.3 Both deals load: `SELECT id, name FROM deals WHERE id IN ('3f32276f…','eaabeb9f…')`.
0.4 Backend healthy; one authenticated API call succeeds.
0.5 **Secret hygiene verification (carried from prior session):** paste `git log --all -p -S 'sk_' -- . | head -20` (expect zero hits) + confirm the Stripe key was rotated. Blocker for closing the session report, not for proceeding.

## PHASE 1 — Deterministic builds & the numbers (core acceptance)
1. **Build Bishop** via `POST /build`: paste response time, confirm HTTP 200. Then: zero new LLM provider log lines, zero new `ai_usage_log` rows from the build. *(W4-5)*
2. **Build Highlands**: same proofs. *(W4-5)*
3. **402 immunity, live:** with DeepSeek balance state noted (whatever it is), builds succeeded with zero provider calls — paste the log window covering both builds. *(W4-6)*
4. **Tri-tab identity:** for both deals, every proforma year: yearly NOI == Σ 12 monthly NOI, yearly EGI == Σ monthly EGI, exact. Paste per-year tables. **BLOCKER.** *(W4-1)*
5. **Bishop before/after exhibit:** stale `deal_financial_models` row (Y1 $2,922,089 / Y2 $3,009,752 / Y5 $3,228,483) vs fresh deterministic Y1/Y2/Y5, side by side with the live assumption values both derive from. **BLOCKER — this is the operator's review artifact.** *(W4-2)*
6. **Ribbon consumption value check:** one projection month from Bishop's `periodic_seed` == the runner's same month, pasted pair; ramp intact (m24 vs live year1÷12); `months_to_stabilization` resolution dump for both deals (expect `platform_default:24` unless overridden). *(W4-3)*
7. **Highlands canary:** boundary 2026-04-01 · NOI margin 57.17% · EGI 2025 $6,315,308 — live values pasted. **BLOCKER.** *(W4-4)*

## PHASE 2 — Consumer equality (W5)
8. **Deal-panel route:** `GET /api/v1/proforma/:dealId` for both deals — `computed` envelope now equals Engine C's `getLatestModel()` values (paste both sides), or `computed: null + modelNotBuilt: true` if unbuilt (then build and re-fetch). **BLOCKER.** *(W5-1)*
9. **Overlap-set matrix:** NOI, EGI, DSCR, IRR, EM fetched via every consumer path (deal-panel route, F9 surfaces, terminal FinancialsTab, capital-structure read) — one value per quantity per deal everywhere. Paste the matrix. **BLOCKER.** *(W5-2)*
10. **getComparison() fix live:** baseline ≠ adjusted object; a real adjustment shows a real delta. *(W2 bug)*

## PHASE 3 — Behavioral & metering debts (oldest debts in the program — close them)
11. **D1 behavioral pass:** with backend log tailed + `ai_usage_log` row-count noted, navigate EVERY F9 tab and Deal Details screen for both deals, plus AssetHub and terminal. Zero LLM provider calls, zero new usage rows from pure navigation. Paste before/after row count + log window. **BLOCKER.** *(W4-7a)*
12. **T2 forced cache-hit:** same large prompt twice through the agent-pipeline path; second call logs nonzero `cache_read_tokens`; `cost_usd` matches three-term hand math pasted beside it. *(W4-7b)*

## PHASE 4 — S1 acceptance
13. **Populated-debt deal:** run the estimator on a deal with `debt_positions` rows — paste computed `est_debt_service`/DSCRs/`proceeds_gap`/flags NEXT TO hand math from the same inputs. **BLOCKER.** If no deal has debt rows, seed one real position from actual deal papers first (note it in the report — that's data entry, not fabrication).
14. **No-debt deal:** paste the all-`undeterminable` row with reason codes. **BLOCKER.**
15. **IO case:** bridge/IO position → `io_expiry_shock` evaluation with step-up math; or honest-undeterminable with the statement that no IO deal exists in data.
16. **Provenance:** pasted row showing `ruleset_version` + per-flag provenance tags.
17. **Zero-LLM:** log window covering steps 13–15 — no provider calls. **BLOCKER.**

## PHASE 5 — Harness activation (only if Phases 1–2 fully green)
18. **Pin golden fixtures:** capture Bishop + Highlands expected outputs from the now-accepted engine into the fixture files; golden regression un-skipped and green.
19. **Property tests:** ≥1000 seeded randomized sets, all identities green. Paste the run summary.
20. **Excel parity:** if operator workbook values are available this session, run and attach the line-by-line report; otherwise mark PARITY-PENDING-ORACLE with the exact value list needed from the operator (field, year, expected format) so it's a fill-in-the-blanks ask.

## VERDICT TABLE (end of session)
| # | Item | PASS/FAIL/BLOCKED | Evidence ref |
One row per step above. Blockers: 4, 5, 7, 8, 9, 11, 13, 14, 17. Any FAIL on a blocker: stop, report, no fixture pinning (Phase 5 depends on green Phases 1–2).

## RULES
- Order matters: builds (Phase 1) before consumer checks (Phase 2); acceptance before fixture pinning (Phase 5).
- A failed step gets diagnosed and reported, not silently retried until green — if a retry is warranted, the report says what changed between attempts.
- Nothing outside this list gets fixed mid-session; new defects go to the report's findings section for dispatch.
