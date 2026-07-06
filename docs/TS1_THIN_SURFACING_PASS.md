# TS-1 — Thin Surfacing Pass

**Status:** ACTIVE (gate satisfied 2026-07-06, see `docs/POST_D2_PROGRAM_ROADMAP.md` Phase-0)
**Owner:** Next session
**Scope discipline:** Render-only, frontend-only diff. No engine changes, no new API routes, no assumption-store writes.

---

## Why This Is Unblocked Now

W5 (deterministic turn-cohort engine re-acceptance) closed 2026-07-06 with named residuals (see `backend/src/services/deterministic/W5-DISPATCH.md` closing declaration). The gate for TS-1 was: **surfacing renders live outputs across all consumer paths for both reference deals.** That was verified live this session via the consumer matrix (`GET /proforma/:dealId`, `GET /financial-model/:dealId/latest`, `GET /financial-model/:dealId/periodic`, `GET /capital-structure/:dealId` — all HTTP 200, NOI/IRR/EM/loan consistent across surfaces for both Bishop and Highlands).

Bishop's golden-fixture pin remains blocked (Finding M/O, external-agent `runFullModel()` extraction) — **this does not block TS-1.** The fixture-pin gap is a test-harness limitation (`runWithBridge()` can't exercise the M11/M14 cycle), not a live-build defect. Bishop's actual `/build` output already renders correctly across all consumer surfaces; TS-1 is free to proceed against live data.

## Known Caveats to Carry Into TS-1

1. **Finding O (equity reconciliation, ~46.7% divergence)** is still open. If TS-1 surfaces any equity-derived figures for Bishop (IRR, equity multiple, total equity), treat them as subject to change once the external-agent fix lands — do not hard-code or cache them as "final" in any new surfacing code.
2. **Finding U (new, 2026-07-06):** `GET /api/v1/capital-structure/:dealId`'s `summary.dscr` field is inflated ~100x (double `/100` division bug on an already-decimal `interestRate`). If TS-1 touches any capital-structure-consuming surface, **do not surface `summary.dscr` from that route** — use `results.debtMetrics.dscr` from `/financial-model/:dealId/latest` instead, which is correct. Full repro in `W5-DISPATCH.md` Finding U.
3. **T2 (forced cache-hit) is blocked**, unrelated to TS-1 scope but worth knowing: the DeepSeek account is returning `402 Insufficient Balance` in this environment, so any agent-chat-dependent surfacing work will hit the "limited mode" fallback rather than real LLM output until the account is funded.

## Scope Reminder (unchanged from prior specs)

- Render-only: wire existing, already-correct API responses into UI. Do not add new backend computation.
- Frontend-only diff: changes should be scoped to `frontend/src/`. If a gap is found that requires a backend change, stop and name it as a new finding rather than reaching into engine/API code (same fix-authority boundary this dispatch operated under).
