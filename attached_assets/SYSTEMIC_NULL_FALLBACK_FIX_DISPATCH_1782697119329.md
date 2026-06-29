# FIX DISPATCH: systemic NULL-coverage fallback (the root under the EGI/tax/GPR instances)

The key-alignment fix worked where data exists — but the verification exposed a deeper, systemic defect: **when a SUM-rollup dollar field has NO monthly actual, the seeder falls back to the year1 ANNUAL figure and writes it into each monthly slot → 12× inflation when summed.** This is the same bug as the EGI constant, from a different cause (missing data, not key mismatch). It's not Highlands-specific — it's a seeder rule that silently inflates *any* dollar field, *any* deal, *any* month where `deal_monthly_actuals` is NULL. For a pre-launch product where most deals have incomplete monthly data, this ships 12× errors broadly. Fix the rule, not the three instances. **One display decision is yours (below) — the dispatch stops for it.** STOP at the report.

---

## STEP 0 — Map the fallback rule precisely (don't guess the scope)

Read the seeder's NULL-coverage fallback in `buildFieldSeries` / the periodic seed path. Report:
- When a field's T12/monthly-actual value is NULL for a month, what exactly gets written? Confirm it's the year1 **annual** figure (not ÷12).
- Which field classes hit this fallback: SUM-rollup dollar fields (egi, gpr, real_estate_tax, opex categories…), AVG rate fields (vacancy_pct…), AVG dollar fields (noi_per_unit, management_fee_pct)?
- **The fix must scope to SUM-rollup dollar fields only.** Rate fields already AVG correctly (constant in = constant out). AVG dollar fields are accidentally-correct via AVG. Touching those would break what works. Report the exact field set that takes the new rule.

## THE DECISION (yours — dispatch stops here for your call)

When a SUM-rollup dollar field has no monthly actual, what should the month cell show? Two honest options:

- **(A) ÷12 accrual, flagged as estimated.** Write `year1_annual ÷ 12` into the slot, marked with an `estimated`/`imputed` zone or flag (distinct from `actual`). Annual SUM = the year1 annual figure (correct total), and the user can see which cells are imputed vs real. Keeps annual math sane; invents monthly precision but labels it.
- **(B) visible gap / NULL.** Leave the month empty, mark it "no data." Annual column either shows a partial sum (only real months) or "incomplete." Most truthful; leaves holes; annual totals for sparse years read as incomplete rather than estimated.

Lean: **(A) with an explicit estimated flag** — the annual total stays correct and the grid distinguishes real from imputed, matching the project's "don't show fabricated precision *unlabeled*" principle. But it's your model call (it determines what a partially-covered year's annual column means). **State your choice; the rest of the dispatch implements it.**

## FIX — implement the chosen rule (SUM-rollup dollar fields only)

- **If (A):** change the NULL fallback for SUM-rollup dollar fields from `year1_annual` to `year1_annual ÷ 12`, tag the slot `estimated` (or equivalent zone the grid can style). The grid SUM of 12 estimated accruals = the year1 annual figure, not 12×. Rate/AVG fields untouched.
- **If (B):** NULL fallback writes no value (or an explicit no-data sentinel the grid renders as a gap); the annual rollup sums only real months and marks the column incomplete.
- Either way: **do not touch the rollup engine, AVG fields, or rate fields.** The fix is in the fallback-write path, scoped to the field set from Step 0.

## RE-SEED + the per-field instances

- Re-seed Highlands through the production path. Confirm the previously-broken instances now behave per the chosen rule:
  - **real_estate_tax 2023/2024** (was $6.29M = 12× via NULL fallback): under (A), now shows the year1 annual (~$524k) as 12 flagged ÷12 accruals summing to ~$524k, not $6.29M. Under (B), shows incomplete. Paste.
  - **GPR Jan–Mar 2025** (still $5.3M/slot): under (A), those 3 months show ~$443k flagged accruals (or are overwritten if you also backfill); 2025 GPR annual ≈ real, not $20.5M. Paste.
- Note: data **backfill** from BPI source (real 2023/2024 tax, real Q1 2025 GPR) is still better than estimation and remains a separate data-repair — but the fallback fix is the floor that stops the 12× regardless of backfill. State which instances you're estimating-vs-backfilling.

## RE-VERIFY — confirm 57.17% holds on a FULLY-COVERED year (the lesson applied to itself)

57.17% rests on 2025 EGI being all-real. Confirm it isn't coverage-lucky:
- For 2025, confirm all 12 EGI months are `extraction_t12` (real), zero NULL-fallback. Paste the source per month.
- Re-confirm `noi_margin` 2025 = **57.17%** post-this-fix (the EGI fix shouldn't have changed — this proves the new fallback rule didn't disturb a fully-covered field). Paste.
- Pick one field that WAS NULL-covered (tax 2023) and confirm its annual column is now sane (~$524k, flagged) not $6.29M. Paste rendered + DB.

---

## ACCEPTANCE

| Item | Closes when |
|---|---|
| Scope | Step 0 field set named: SUM-rollup dollar fields only; rate/AVG untouched |
| Decision | your (A)/(B) choice stated and implemented |
| Fallback fixed | a NULL-covered dollar field's annual column is sane (not 12×), per chosen rule — paste tax 2023 before/after |
| No regression | 2025 EGI still all-real, noi_margin still 57.17% (fully-covered field undisturbed) |
| Engine untouched | git diff = fallback-write path only; rollup/AVG/rate logic unchanged |
| Instances | real_estate_tax 2023/24 + GPR Q1 2025 reported: estimated (flagged) or backfilled, no $6.29M/$5.3M survivors |

**Blocker: a NULL-covered dollar field that still sums to 12×.** That means the fallback rule didn't take. The fix isn't done until a previously-broken year (tax 2023) renders sane and a fully-covered year (EGI 2025 → 57.17%) is undisturbed — proving the rule fixed the broken case without breaking the working one. STOP after reporting.

---

**Why fix the rule, not the three fields:** backfilling tax-2023 and GPR-Q1 repairs two instances and leaves the rule that created them live — the next deal with a NULL month inflates again. The ÷12-or-gap fallback is the class fix: it makes *every* future NULL-covered dollar field degrade sanely instead of 12×. Same logic that made the key map the right fix over a rollup hack — target the mechanism, not the symptom.
