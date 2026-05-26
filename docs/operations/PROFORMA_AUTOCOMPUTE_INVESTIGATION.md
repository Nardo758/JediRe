# F9 Proforma Auto-Compute Investigation

**Date:** 2026-05-26
**Scope:** Determine feasibility of auto-computing the F9 financial model on every assumption change, replacing or augmenting the manual "BUILD MODEL" button.

---

## 1. What the Build Button Does Today

**Frontend (`FinancialEnginePage.tsx` line 1638):**
- The "BUILD MODEL" button calls `handleBuildModel()`, which POSTs to `POST /api/v1/financial-model/build` with `{dealId, assumptions}`, timeout hardcoded at **120,000 ms**.
- `building = true` disables the button and shows "BUILDING..."
- On success: normalizes result, stores `assumptionsHash`, clears `staleModel`
- On failure: sets `buildError` state, shows "RETRY BUILD"

**Staleness tracking is already wired (but display-only):**
- `handleAssumptionsChange` sets `staleModel = true` whenever any assumption changes after a build
- The "MODEL OUTDATED" amber badge appears in the header
- There is no auto-recompute — it is purely a visual signal

**Auto-build fires once, on mount:**
- A `useEffect` fires one build when `assumptions` + `f9Financials` load and `modelResults` is null (guarded by `modelBuiltRef`)
- This is a startup fill, not continuous auto-compute

---

## 2. The Full Server-Side Build Pipeline

Every click of the Build button runs this pipeline in `FinancialModelEngineService.buildModel()`:

| Step | What Happens | I/O Type | Typical Time |
|---|---|---|---|
| 1. Hash assumptions | SHA-256 of sorted JSON | CPU only | <1 ms |
| 2. Agent fill-in pass | Tier-2 missing-field resolver (optional, conditional on resolver registration) | DB read | ~5–50 ms |
| 3. M26/M27 enhancer | Tax + comp data enhancement (currently a near-stub; `_dealId` param unused) | Minimal | <1 ms |
| 4. Anchor interceptor | Apply macro-anchored OPEX growth rates | CPU only | <1 ms |
| 5. DB INSERT | Write `deal_financial_models` row with `status='building'` | DB write | ~5–20 ms |
| **6. LLM call** | **The entire cost center — see §3** | **External API** | **15–60 seconds** |
| 7. Deterministic runner (1st pass) | `runModel()` — pure math, all years, IRR, waterfall | CPU only | <5 ms |
| 8. Integrity checks | ~10 INV-* hard invariants | CPU only | <1 ms |
| 9. LLM↔deterministic cross-check | KPI divergence comparison | CPU only | <1 ms |
| 10. M11 debt optimizer | Iterative `runModel()` convergence (max 3 passes) | CPU only | <15 ms |
| 11. M14 risk adjustments | Reads from in-memory `dataFlowRouter` | In-memory | <1 ms |
| 12. Deterministic runner (2nd pass) | Re-run with M11/M14-adjusted assumptions | CPU only | <5 ms |
| 13. DB UPDATE | Write full results JSONB + `status='complete'` | DB write | ~5–20 ms |

**Total typical wall time: 15–60 seconds**, dominated entirely by the LLM call (step 6).

---

## 3. The LLM Call in Detail

`callLLMForModel()` calls DeepSeek (preferred) → Replit OpenAI integration → plain OpenAI/GPT-4o, with:

- `max_tokens: 16000`
- `temperature: 0.1`
- System prompt: 30-rule institutional analyst persona
- User prompt: full deal spec — unit mix, expenses, financing, waterfall, development schedule

**Response schema the LLM must emit:**
- `summary` — IRR, equity multiple, CoC by year, NOI, cap rates, exit value, debt metrics
- `annualCashFlow` — one full object per year
- `sourcesAndUses`
- `debtMetrics`
- `sensitivityAnalysis` — 5×5 cap-rate × hold-period grid + 5-point rent-growth grid
- `waterfallDistributions` — by year

The LLM's job is not merely gap-filling. It computes the complete 10-year cash flow, IRR, equity waterfall, and sensitivity tables. The 16,000-token window is filled by design.

---

## 4. Why Naive Auto-Compute on Input Change Is Not Feasible

### 4a. Latency is 15–60 seconds — no debounce value solves this
A 300 ms debounce delays the trigger but not the operation. The user would see "BUILDING..." for up to a minute following any pause in typing. With continued edits, every 300 ms pause launches another 60-second operation.

### 4b. LLM cost compounds rapidly
- DeepSeek cost: ~$0.001–0.003 per build
- GPT-4o cost: ~$0.05–0.15 per build (16k output tokens)
- A user editing a 10-field deal over 2 minutes generates 40+ debounced triggers → potential $6+ in GPT-4o calls for a single session

### 4c. DB writes on every intermediate state
Every build does an INSERT + UPDATE on `deal_financial_models`. A user typing "150000000" in Purchase Price fires one build per keystroke pause: $1, $15, $150, $1500, etc., all inserted as distinct model records.

### 4d. Invalid intermediate states produce nonsense models
Mid-number input (e.g., Purchase Price = $0 mid-type, Interest Rate = "0.0" before the user types "5") sends garbage to the LLM, which produces a model for a $0 asset and persists it to the DB.

### 4e. No cancellation mechanism
`handleBuildModel` uses `apiClient.post()` with no `AbortController`. If assumptions change mid-flight, both the old and new build complete, and the later-arriving response overwrites the earlier one. With 60-second builds, overlapping concurrent calls are nearly certain.

### 4f. M26/M27 and M14 have their own latency budget
Even though M26/M27 is currently a near-stub and M14 reads from in-memory state, the architecture shows intent to hit external tax/comp APIs. Auto-compute would amplify that cost with every keystroke.

---

## 5. What IS Feasible — The Deterministic Runner Path

Steps 7–12 of the build pipeline are entirely CPU-bound pure functions that complete in **<15 ms total**. The deterministic runner (`runModel`) computes IRR, NOI, DSCR, CoC, equity multiple, waterfall distributions, and annual cash flows — the same numbers users primarily care about in real time.

**What the LLM adds that the deterministic runner does not:**
- Sensitivity analysis grids (purely formulaic — computable deterministically)
- AI narrative/commentary (not needed for live KPI display)
- Gap-filling for missing assumptions (the agent fill-in pass)

---

## 6. Recommended Approaches

### Option A — Fast Deterministic Endpoint + Manual LLM Build (Recommended)

Add `POST /api/v1/financial-model/compute-fast` that:
- Skips steps 1–5 (no hash, no fill-in, no M26/M27, no DB INSERT)
- Runs only the deterministic runner (steps 7–12)
- Returns KPIs in **<200 ms**
- **Zero LLM cost. Zero DB write.**

Frontend changes:
- Debounce assumption changes at 800 ms → fire `/compute-fast`
- Show live KPIs (IRR, NOI, DSCR, CoC, EM) updating as the user types
- "MODEL OUTDATED" badge becomes "LIVE ESTIMATE" (deterministic) vs "FULL MODEL" (LLM-backed)
- Build button label becomes "RUN FULL ANALYSIS" (remains deliberate / manual)

**This is Excel-like responsiveness at zero marginal cost.** Purely additive — the existing build pipeline is untouched.

### Option B — Auto-Build on 30-Second Quiet Period

Debounce the full LLM build at 30 seconds of no changes. Safer than 300 ms, still automatic.

- Requires `AbortController` support to cancel in-flight builds on new input
- Still has DB-write noise and invalid-intermediate-state risk
- Still charges LLM cost per auto-build
- Viable only if user sessions are infrequent and build counts stay low

### Option C — Status Quo + Better "MODEL OUTDATED" UX

Keep the manual Build button but make the staleness signal more prominent:
- Animate/pulse the "MODEL OUTDATED" badge
- Show which specific fields changed since the last build
- Auto-scroll to or highlight the Build button

Zero engineering risk, zero cost change. Addresses the UX friction without the architectural complexity.

---

## 7. Files Involved in Any Implementation

| File | Role |
|---|---|
| `backend/src/services/financial-model-engine.service.ts` | Add `computeFast()` method calling deterministic runner only |
| `backend/src/api/rest/financial-model.routes.ts` | Add `POST /:dealId/compute-fast` route |
| `backend/src/services/deterministic/deterministic-model-runner.ts` | Already exists; `runModel()` is the target function |
| `backend/src/services/deterministic/proforma-assumptions-bridge.ts` | `mapProFormaAssumptionsToModelAssumptions()` is the bridge into the runner |
| `frontend/src/pages/development/FinancialEnginePage.tsx` | Debounced compute-fast call, live KPI state, indicator badge update |

---

## 8. Conclusion

Auto-compute on every input change is not feasible with the current LLM-in-the-loop architecture. The right path is a **fast deterministic-only compute endpoint** returning live KPIs in <200 ms, keeping the full LLM build as the deliberate "Run Full Analysis" action. This is purely additive — no changes to the existing build pipeline are required.
