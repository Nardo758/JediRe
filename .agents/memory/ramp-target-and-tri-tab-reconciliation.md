---
name: Stabilization ramp target field + tri-tab reconciliation architecture
description: Which periodic-seed field is the correct ramp target for NOI stabilization, and how F9 tabs stay reconciled without a separate recompute path.
---

## Ramp target field trap
When wiring a stabilization ramp (current NOI → stabilized NOI over N months), the periodic seed exposes two fields that look interchangeable but are not:
- `periodicSeed._meta.resolved_noi` — the **last actual monthly** NOI (a point-in-time actual, already monthly-scale).
- `seed.noi?.resolved` — the **annual, stabilized** NOI produced by `buildSeed()` (the actual ramp target).

Using `_meta.resolved_noi` as the ramp target silently ramps toward the wrong number (a stale monthly actual instead of the stabilized annual target). Always ramp toward `seed.noi?.resolved` (divided by 12 for a monthly ramp step), never `_meta.resolved_noi`.

**Why:** This exact substitution was the root cause of an incorrect stabilization ramp (Bishop deal) — values compounded toward the wrong asymptote until traced back to the seed field naming collision.

**How to apply:** Any future ramp/target-value wiring in `proforma-seeder.service.ts` or `gap-bridge.service.ts` should re-verify which of these two fields it's reading before trusting a "NOI" value.

## Tri-tab reconciliation — single source of truth
All F9 frontend consumers of periodic (month-indexed) financial data — charts, tabs, overlays — read through one endpoint: `GET /api/v1/financial-model/:dealId/periodic` (backed by `financial-model.routes.ts`, which reads `deal_assumptions.periodic_seed` and calls `getFieldSeries()` per field). The frontend hook `usePeriodicData.ts` is the sole client-side gateway to this data.

**Why:** There is no separate per-tab recompute path for periodic fields (e.g. no independent NOI calc in the chart component) — so once a value is correct in `periodic_seed`, it propagates consistently everywhere. This makes "tri-tab reconciliation" checks tractable: verify the persisted `periodic_seed` value once, then confirm the single API route serves it unmodified, rather than auditing each tab separately.

**How to apply:** When debugging inconsistent NOI/values across F9 tabs, check `deal_assumptions.periodic_seed` first (source of truth) and `financial-model.routes.ts` (transport) before suspecting per-tab logic. Note: the *executive-summary* model-build path (IRR/EM/cash-on-cash shown on the F9 Overview sub-tab) is a **separate** compute pipeline from the periodic-seed chart data — it can fail independently (e.g. on external LLM API errors) without affecting periodic_seed correctness.

## DeepSeek 402 "Insufficient Balance" is an environment issue, not a code bug
F9 "BUILD MODEL" can fail with `BUILD FAILED — 402 Insufficient Balance` / `DeepSeek API error ... Insufficient Balance` in backend logs. This is the DeepSeek account running out of credit, unrelated to proforma/ramp/seeder code correctness. Don't chase this as a regression when verifying unrelated backend changes — check backend logs for the literal "Insufficient Balance" message to confirm before deep-diving.
