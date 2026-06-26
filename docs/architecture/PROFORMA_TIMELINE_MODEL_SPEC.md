# Proforma Timeline Model Spec

**Status:** Design — phased; Phase 0 actionable now, Phases 1–5 sequenced
**Predecessor finding:** Proforma is single-value throughout (storage → module → tab). Timeline reconciliation cannot sit on existing plumbing; it is net-new infrastructure. See Timeline Scoping Audit.
**Replaces:** the DC-31 "agent beats T12" precedence question (retired, not answered — see §8).

---

## 0. The problem in one line

T12 actuals and agent projections are **different temporal objects** — historical observations vs. forward estimates. The current field model collapses both into one annualized `resolved` cell and is then forced to pick a winner. That pick is the bug. The fix is not a precedence rule; it is a timeline that keeps actuals and projections in their own periods.

---

## 1. The production-process model

Treat each deal as a 15-year ribbon plus a gap, moving left to right like a production line:

```
│◄──── HISTORY: 1–5 yrs actuals ────►│◄─ GAP ─►│◄──────── PROJECTION: 10 yrs ────────►│
│                                    │         │                                       │
T-5 (or less)              actuals boundary   close                                  T+10
                          "actuals through M"  date
```

**Three zones:**

| Zone | Length | Source | Nature |
|---|---|---|---|
| History | 1–5 yrs (variable — a deal may have only 1 yr of operating history) | T12 + prior historical statements, **per-month** | Fixed, observed actuals |
| Gap | T12-end → closing date | bridge policy (§4) | Neither actual nor owned; transitional |
| Projection | 10 yrs from close | last-actual + assumptions (the agent projects here) | Derived forward estimate |

**Two boundaries:**

1. **Actuals boundary** — "actuals confirmed through month M." Everything left of it is real. It **advances** as new actuals arrive (new T12, monthly operating data). This is the production-line head.
2. **Closing boundary** — the deal close date. Projection begins here pre-close. Once owned, the actuals boundary advances *past* the closing boundary into what was projection — that crossover is where reconciliation fires (§5).

**The gap is real-world, not an artifact.** T12 actuals always lag the close date (you underwrite on stale-by-weeks-or-months actuals). The model makes the gap explicit instead of pretending close == last-actual.

---

## 2. Storage truth vs. derived view

**Invariant honored: derive-not-store; version inputs, not outputs.** The timeline is a *view*. Do not store 15yr × 12mo × N fields of values as truth.

**Persisted (inputs — versioned):**
- **Per-month actuals** (history zone + accumulating post-close actuals). The real observations.
- **Assumptions** (growth/inflation/vacancy-trend params — the control surface, §6).
- **Boundary facts** (`actuals_through_month`, `closing_date`).
- **Operator period overrides** (highest-precedence input layer; same role as the existing LayeredValue `override`).

**Derived on demand (outputs — never stored as truth):**
- The full per-field timeline series across all zones.
- Projection-zone values = f(last actual, assumption trends).
- Gap-zone values = f(bridge policy).

This mirrors the existing invariant *"proforma becomes derivable on demand, not stored as truth."* The timeline extends that from a single derived number to a derived series.

---

## 3. The periodic field model

Today a field is a single `LayeredValue` whose `resolved` is a trailing-twelve annual number (`proforma-seeder.service.ts` year1 envelope). The timeline model makes a field a **period-indexed series**:

- **Native granularity: monthly.** History is monthly (T12 is monthly at parse time — `t12-parser.ts:385–595`). Projection granularity is a decision (§DECISIONS).
- Each period carries a **period type**: `actual` | `gap` | `projection` | `override`.
- Annual rollup is a **derived view** over the monthly series, not a stored value (preserves derive-not-store).
- The existing `LayeredValue` envelope is retained **per period** for actual/override periods (source provenance still matters within a period). Projection periods carry derivation provenance (which assumption produced them), not source provenance.

---

## 4. The gap bridge (DECISION REQUIRED)

The gap (T12-end → close) has no actuals and isn't yet projection-from-close. Bridge options:

- **(a) Hold-flat:** carry last-actual monthly run-rate forward to close. Simplest; understates/overstates if a trend is in motion.
- **(b) Trend-extrapolate:** apply the trailing trend (or assumption growth) across the gap.
- **(c) Assumption-driven:** treat the gap as the first projection segment, driven by the same assumptions as projection but tagged `gap` for provenance.

**Recommendation:** (c) — fewest special cases, and the gap is honestly "early projection." But it's your call; the gap is small in months and the choice mostly affects month-one-of-ownership accuracy. Whatever is chosen, gap periods render **visibly distinct** (provenance), never silently as actuals.

---

## 5. Boundary advancement + reconciliation + notification

This is your Q1 answer made mechanical. When new actuals arrive and the **actuals boundary advances** over a month M that was previously `projection`:

1. **Cut over:** month M's period type flips `projection → actual`. The gap shrinks; the projection window starts one month later.
2. **Overlap variance (the calibration signal):** before discarding the old projection for M, compute `variance = actual(M) − projected(M)` per field. This is the agent's calibration record — arguably one of the more valuable outputs the system can produce, and the reason to *capture* the overlap rather than silently overwrite it.
3. **Re-base:** projection re-derives from the new boundary forward (last actual is now M, not M−1).
4. **Notify (no silent re-base):** surface to the user — *"Actuals advanced through {M}; projection re-based. Variance: {field: Δ, …}."* Material-threshold for notification is a DECISION (§DECISIONS); a boundary shift **always** notifies (the projection window literally moved); per-field variance notifies above threshold to avoid noise.

**Invariant honored: no silent stale fallback — from both directions.** Stale projections don't silently win over fresh actuals (the old DC-31 bug), *and* fresh actuals don't silently re-base the projection shape without telling the user.

---

## 6. The control surface: proforma & assumptions

**"The proforma & assumptions are where alteration to the timeline trends happens."** This is the architectural spine:

- The user **never paints the timeline by hand.** They edit **assumptions** (rent growth, expense inflation, vacancy trend, etc.) and **proforma inputs**, and the projection zone **re-derives**.
- Assumptions are **versioned inputs** (version inputs, not outputs). A change to a growth assumption produces a new derived timeline; the prior timeline is reproducible from the prior assumption version.
- A direct edit to a specific period is an **operator override** = a versioned input layer at that period, highest precedence — identical in spirit to the existing `LayeredValue.override` (override always wins), now period-scoped.
- Actuals are **immutable inputs** — assumptions cannot alter history; they only shape gap + projection.

So the timeline has exactly three input classes feeding the derived view: **immutable actuals**, **versioned assumptions** (trends), **period overrides** (point edits). Everything rendered is derived from those three.

---

## 7. Phasing (cheap-now → larger-later)

| Phase | Scope | Cost | Why this order |
|---|---|---|---|
| **0 — GATE (now)** | Confirm whether `T12Data.months[]` (`t12-parser.ts:595`) is **persisted** before the aggregation seam at `:516–537`, or **discarded**. If discarded, add per-month persistence to `deal_data` (or an extraction store) **before the seam reduces to trailing-twelve**. | Small | **Has a now-cost if skipped.** Every month operated without this **permanently loses** per-month actuals you can never recover. The whole timeline depends on per-month actuals existing. Do this even if Phases 1–5 wait. |
| **1** | Boundary facts: `actuals_through_month`, `closing_date` as stored fields. No concept exists today (audit Q3: zero hits). | Small | Cheap, unblocks everything; harmless standalone. |
| **2** | Periodic field model: field becomes a derived monthly series; storage stays {actuals, assumptions, boundary, overrides}. | Large | The core rebuild. Touches the seeder's notion of "field." |
| **3** | Derivation engine: gap bridge (§4) + projection trend application from assumptions (§6). | Medium | Makes the series actually populate. |
| **4** | Reconciliation + notification (§5): boundary-advance cutover, overlap variance, user notify. | Medium | Depends on 1–3. The payoff feature. |
| **5** | F9 surfaces the timeline: period view + boundary indicator on **both** F9 surfaces (module `financial-model.routes.ts`; tab `ProFormaTab.tsx`/`FinancialEnginePage.tsx`, which today flatten to `[0]`-index single values — `ProFormaTab.tsx:346–348`, `SensitivityTab.tsx:83`, `FinancialEnginePage.tsx:899`). | Medium | User-visible. Per-surface (vertical) work — module and tab are separate consumers. |

**Phase 0 is the only piece with a now-cost.** Recommend running the `months[]` persistence trace immediately and, if it's discarded, capturing it before the seam regardless of when Phases 1–5 are scheduled. Phases 1–5 are a real project — sequence them when proforma-depth (Surface 2 power-user) becomes priority, likely alongside Correlation Engine Phase 1B (both need historical/outcome substrate; they'd share infrastructure).

---

## 8. Relationship to DC-31 (the precedence question, retired)

DC-31 asked: should a prior agent value beat a fresh T12 re-extraction of the same field? Under the single-value model that was a real, unanswerable-without-spec precedence conflict (the implicit "agent wins until override" rule emerging from `buildSeed()` order of operations).

**The timeline model dissolves it.** T12 lives in **historical periods**; the agent projects into **projection periods**. They never occupy the same cell, so there is nothing to rank. When an actual arrives for a month the agent projected, that is not a precedence contest — it is a **boundary advance + overlap reconciliation** (§5): the actual takes the period, the projection's value for that period becomes a *variance datum*, not a loser. The agent's write-back path (`DC31_RESOLUTION_SPEC.md` Item 1) is retained; its outputs simply land in projection-zone periods.

So DC-31's resolver cleanup (`DC31_RESOLUTION_SPEC.md`) and this timeline model are complementary: the former fixes the resolver layer that exists today; the latter removes the architectural conflation that created the precedence question.

---

## DECISIONS (open — your call before Phase 2+)

1. **Gap bridge method** (§4): (a) hold-flat / (b) trend-extrapolate / (c) assumption-driven. Recommend (c).
2. **Projection granularity** (§3): monthly throughout (consistent, heavier) vs. monthly history + annual projection (lighter, common in proformas). Affects derivation cost and F9 render.
3. **Notification threshold** (§5): boundary shift always notifies; per-field variance threshold for "material" to avoid per-re-seed noise — set the threshold (absolute $, %, or per-field).
4. **History depth handling** (§1): how the timeline renders/derives when <5 yrs of history exist (1–4 yr deals). Recommend: render only the actual history present; do not back-fill synthetic history.

---

## Invariants this model must honor (checklist)

- ✅ Derive-not-store — timeline is a derived view; truth is {actuals, assumptions, boundary, overrides}.
- ✅ Version inputs, not outputs — assumptions are the versioned control surface; timeline re-derives.
- ✅ No silent stale fallback — both directions: stale projection never silently wins; fresh actual never silently re-bases without notification.
- ✅ Δ_operator is an input, never a residual — period overrides are explicit input layers.
- ✅ Jurisdiction branching only in rulesets — any FL/Dallas-specific gap or projection rules live in ruleset files, not inline.
- ✅ Agent stays on its write-back path (DC-31 Item 1) — agent does not re-enter via `resolve()`.
