# FIX DISPATCH: EGI / real_estate_tax key alignment (root fix + re-seed + prove against the pre-established truth)

Diagnostic proved the root cause: `CANONICAL_FIELDS` has `'egi'`/`'real_estate_tax'` but `FIELD_TO_T12_COLUMN` keys them as `'effective_gross_income'`/`'property_tax'` → lookup misses → silent year1-annual-constant fallback in all 12 months → 12× inflated annual columns (EGI $57.4M vs ~$4.78M; tax $6.29M vs ~$524k) on the live grid, AND the 12× custom-metric error (noi_margin 6.29% vs true 75.47%). The real per-month data exists in T12, just unreachable. **The rollup engine and `computeCorrectAnnualSeries` are NOT touched — they're correct once the data is correct.** Acceptance proves the fix against the independently-established truth (75.47%), not "the key is aligned." STOP at the report.

**Do NOT special-case the rollup engine.** That patches a symptom, leaves the grid's 12× columns broken, and inverts the moment data is correct. The fix is at the source: the key map + a re-seed.

---

## FIX A — Align the T12 keys (the core, two lines)

In `FIELD_TO_T12_COLUMN` (`periodic-field.types.ts`), add:
```
egi: 'effectiveGrossIncome',
real_estate_tax: 'propertyTax',
```
Confirm the T12 month objects actually carry `effectiveGrossIncome` (line ~1295) and `propertyTax` (line ~1305) per the diagnostic. After this, `buildFieldSeries` reads real per-month values for actual months instead of the year1 constant.

## FIX A½ — real_estate_tax: determine accrual shape BEFORE declaring it fixed (don't assume)

EGI genuinely varies monthly — aligning its key is sufficient. **Property tax does not** — it's inherently annual (one bill/year), so T12 likely carries the *full annual figure in every monthly slot*. If so, aligning the key alone means summing 12 copies of the real T12 annual tax → back to 12×, just with a different number.

- Inspect the actual T12 `propertyTax` values across the 12 months for Highlands (paste them). Two cases:
  - **Real monthly accruals** (varies, or annual÷12): key alignment is sufficient, summing 12 → correct annual. Done.
  - **Annual figure repeated per slot** (same value ×12): add `real_estate_tax` to a divide-at-extraction rule (÷12 to a monthly accrual) so the 12-month SUM equals the true annual tax.
- State which case Highlands' T12 is, and apply the matching fix. **Do not declare real_estate_tax fixed until its annual column shows ~$524k, proven, not assumed.**

## RE-SEED — the data fix the code fix requires (do not skip)

Fix A only changes *future* seeds. Highlands' existing periodic seed still holds the constant EGI/tax until re-seeded. Code-fixed + DB-unchanged is the exact "fixed in code, wrong on screen" gap that's bitten before.
- Re-seed Highlands through the **production path** (`ensureDealAssumptionsSeeded`, the portfolio-asset path fixed earlier — not a one-off script if avoidable).
- Confirm the re-seed actually wrote new values: the EGI monthly slots for an actual year must now **vary month-to-month** (not 12 copies of $4,783,645.81). Paste the 12 new EGI values showing they differ.

## FIX B — GPR contamination repair (Jan–Mar 2025)

Diagnostic found GPR's 2025-01..03 hold the annual $5.3M figure (pre-T12 seed pass), 2025-04..12 hold real ~$500k. The re-seed above should overwrite these from T12 — confirm it did.
- After re-seed: paste GPR's 12 months for 2025. All should be real monthly (~$500k range), no $5.3M slots. Annual GPR ~$6M, not ~$20.5M.
- If the re-seed did NOT fix the contaminated months (e.g. T12 source still missing for Q1), report it — that's a separate data-repair, don't fake it.

---

## ACCEPTANCE — the pre-established truth must appear on screen (75.47%, not 6.29%)

The truth values were derived from DB rows *before* this fix (V1: annual NOI $3,610,299 ÷ annual EGI $4,783,646 = **75.47%**). The fix is proven only when that number renders. Each item = paste.

1. **EGI months now vary.** Post-re-seed, the 12 EGI slots for 2025 differ month-to-month (real T12 data), not 12× the constant. Paste.
2. **Grid EGI annual correct.** F9 P&L grid EGI column shows **~$4.78M** for 2025 (and 2022–2024), NOT $57.4M. Screenshot/rendered value. The 12× inflation is gone from the user-visible grid.
3. **Grid tax annual correct.** real_estate_tax annual column shows **~$524k**, not $6.29M. Paste (per Fix A½'s resolution).
4. **GPR annual correct.** 2025 GPR ~$6M, no $5.3M monthly slots. Paste.
5. **noi_margin renders the TRUTH.** The custom-metric `noi_margin` row for 2025 now renders **75.47%** (the V1 pre-established truth), NOT 6.29%. Pull from the live authenticated API + confirm the rendered grid cell. Paste rendered-next-to-truth. **This is the blocker — 6.29% means the fix didn't reach the render.**
6. **Grid ↔ custom-metric agree.** The EGI used by `noi_margin` (denominator) equals the EGI shown in the P&L EGI row (both ~$4.78M annual). They must agree — that was the consistency requirement; confirm they now read the same value.
7. **Rollup engine untouched.** Confirm no change was made to `computeCorrectAnnualSeries` or the grid rollup logic — the fix is data/key only. `git diff` scope shows only the key map (+ optional tax accrual rule + re-seed). Paste the changed-files list.

**Report:** each PROVEN / FAIL with paste. Item 5 (75.47% on screen) and item 2 (EGI grid ~$4.78M) are the blockers. The fix is not done until the independently-established truth renders — a self-checked number or "the key looks right" is not proof. STOP after reporting.

---

## Logged, NOT in this dispatch (separate, don't fold in)

- **`noi_per_unit`** — stored as annual constant, accidentally correct via AVG rollup, monthly cells meaningless. Deferred derive-from-NOI fix. Note the fragility: it breaks if its rollup rule ever changes.
- **`management_fee_pct`** — misnamed; stores dollars not a percent. **Human confirm: intended or a naming bug?** A `_pct` field holding dollars is a formula landmine. Decide, don't fix blind.
- Both stay out of this dispatch to keep the core fix tight.

---

**Why prove against 75.47% specifically:** that number was established from raw DB rows before the fix existed, so it can't be contaminated by the fix agreeing with itself — the failure that let the original "done" ship at 6.29%. The fix renders 75.47% or it isn't fixed. Same discipline that made the bug visible makes the fix real.
