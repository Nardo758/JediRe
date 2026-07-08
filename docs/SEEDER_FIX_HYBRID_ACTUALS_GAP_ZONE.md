# DISPATCH — Periodic Seeder Fix: Hybrid Actuals (≤5yr), Derived Boundary, Gap Zone, Projection Units + Trend

**Arc:** Proforma Timeline — follows `TIMELINE_MODAL_P2-5_PIN_DELIVERY_AND_DERIVATION_TRACE.md` (findings table accepted by operator)
**Repo:** `Nardo758/JediRe.git` · backend port 4000
**Structure:** Phase 1 READ-ONLY with hard STOP. Phase 2 (seeder fix + Bishop reseed) only on approval.
**Standing rule (S1-01):** live DB output and rendered-chart observation. A reseed is a production data write — it does not run until Phase 1's report is approved.

## OPERATOR DECISIONS (encoded — do not re-litigate)
1. **Hybrid actuals:** the seed uses as many actuals as the user has provided, **capped at 5 years (60 months)**. If more than 60 months exist, keep the most recent 60.
2. **Seeder must support the full 5-year actuals window** — no 12-month/T12-only assumption anywhere in the ingest path.
3. **Bishop's gap is legitimate** (archived deal, worked years ago). Gaps between last actual and projection start are a first-class state → render as the spec's **gap zone**, not silently absorbed into projection.

---

## PHASE 1 — READ-ONLY VERIFICATION + DESIGN CONFIRMATION (STOP AT END)

### P1-1 · Projection units: prove annual-vs-monthly, don't assume
The flat projection value is `year1Seed.noi.resolved = $1,298,929.37` copied verbatim per month.
1. Paste Bishop's ProForma year-1 NOI from its source (`deal_assumptions` / proforma seed) with the field's unit semantics — is `$1,298,929.37` the ANNUAL year-1 NOI? Cross-check: annual ÷ 12 ≈ $108k/mo vs. Bishop's last real actuals (EGI $206k/mo, NOI just turning positive) — plausible stabilized month. $1.3M/mo (=$15.6M/yr) is not.
2. Check whether Highlands' projection months divide its ProForma annual figures by 12 or copy them — Highlands rendered plausibly, so identify what its path did differently (different code branch, or annual values that happen small?). Paste the comparison.
3. Verdict: ANNUAL-IN-MONTHLY-SLOT confirmed / refuted, with the evidence.

### P1-2 · Multi-year projection seeds
Flat-forever is a spec violation regardless of units (§3: projection = f(assumption trends)).
1. Enumerate what per-year seeds exist: does `deal_assumptions` hold year1..yearN NOI/EGI (or growth-rate assumptions) for Bishop and Highlands? Paste the available structure.
2. Report which minimal trend implementation the data supports: (a) yearly ProForma values ÷12 per projection year (preferred if year1..10 exist), or (b) year1 ÷12 + growth-rate compounding, or (c) only year1 exists → flag as design gap with options. Do not implement in this phase.

### P1-3 · Actuals inventory, both sources, both deals
For Bishop and Highlands:
1. `extraction_t12.months`: count, month range, sample values. (Bishop known: 15, →2018-10.)
2. `deal_monthly_actuals` non-null rows: count, month range. (Bishop known: 12, →2018-07. Confirm whether 2018-08/09/10 exist anywhere outside extraction.)
3. Month-collision check: for months present in BOTH sources, do values agree? Paste 3 collision samples per deal.
4. **Proposed merge rule (for operator sign-off in the report, not implementation):** union of both sources filtered to non-null financials, deduped by month with `deal_monthly_actuals` taking precedence over extraction on collision (operational ingest beats document extraction), then most-recent-60-months cap. Flag any case where this rule would change a value Highlands currently renders.

### P1-4 · Gap machinery
1. Paste `deriveGapForSeed`'s signature and logic (file:line, read-only). What does it need (`gap_start_month`, `gap_end_month`) and what zone/values does it emit for gap months?
2. Confirm `PeriodicChart` + `PeriodicGrid` already handle `zone: 'gap'` (amber band per mockup) — file:line. If either renderer lacks gap handling, report as Phase 2 scope addition.
3. Define (report only): projection start for a gapped deal = ? Proposed: gap runs from (last actual + 1) to (analysis/seed date − 1); projection starts at analysis date. Confirm against `PROFORMA_TIMELINE_MODEL_SPEC.md` §gap and flag any conflict.

### P1-5 · Boundary derivation target
Confirm every read-site of `boundary.actuals_through_month` (grep + paste file:line list) so Phase 2 can switch it from caller-written input to **derived at build time = last month with zone 'actual'** without breaking a consumer. Identify the current caller that writes it (the P2-5b unfound call site) — find it now.

**P1 REPORT:** findings per item + the two sign-off asks (merge precedence rule P1-3.4, gap/projection-start rule P1-4.3). **STOP.**

---

## PHASE 2 — SEEDER FIX + BISHOP RESEED (ON APPROVAL ONLY)

1. **Actuals ingest:** hybrid merge per approved rule; ≤60-month cap (most recent); null-financial rows ignored by filter (the 12 × 2026 shells stay in the DB, harmless — deletion is a separate hygiene ticket, not this dispatch).
2. **Boundary:** `actuals_through_month` derived inside `buildPeriodicSeed()` from the final period list's last `zone:'actual'` month. Remove/ignore the caller's independent write. `has_projection` / `first_projection_month` augmentation runs unconditionally.
3. **Gap zone:** when last actual + 1 < projection start, months between are `zone:'gap'` via `deriveGapForSeed` (per approved P1-4.3 rule). No silent projection fill of gap months.
4. **Projection values:** correct units per P1-1 verdict (÷12 if annual confirmed) + trend per P1-2's supported option. No flat verbatim copy of year1 into 120 months.
5. **Reseed Bishop only.** Highlands is NOT reseeded unless Phase 1 proves its current seed would be value-identical under the new code — if identical, reseed both for code-path uniformity; if not identical, STOP and report the diff before touching it.

### ACCEPTANCE (all observed)
| # | Item | Evidence |
|---|---|---|
| 1 | Bishop seed: actuals = merged count (expect 15), boundary = last actual (expect 2018-10-01), gap zone spans last-actual+1 → projection start, projection monthly values plausible (~$100–130k/mo scale, trended not flat) | Seed dump: zone distribution + boundary + 5 sample projection months |
| 2 | Chart render: three zones visible (cyan actuals, amber gap, muted projection), boundary line at 2018-10, no 20× step at any zone edge | Screenshot |
| 3 | Grid ↔ chart agreement on one actual month and one projection month | Paired values pasted |
| 4 | Highlands regression: boundary 2026-04-01, NOI margin 57.17%, EGI 2025 $6,315,308 — unchanged | Live DB / render values pasted |
| 5 | Pins: Bishop chart shows 16 pins, M35 legend active (closes P2-5a observation debt) | Screenshot + DOM count |
| 6 | Step discontinuity at actuals→gap and gap→projection edges reported numerically | Values pasted |

**Blockers: 1, 2, 4.** A Highlands value shift of any size fails the phase.

## OUT OF SCOPE
- Deleting the 2026 shell rows (separate hygiene ticket)
- Event→curve modeling, submarket band, interventions, lifecycle wiring
- `PeriodicGrid.tsx` internals beyond gap-zone rendering if P1-4.2 finds it missing
- Any change to ProForma/assumption values themselves — this dispatch fixes how the seeder consumes them, never what they are

**Run Phase 1. Report with the two sign-off asks. STOP.**
