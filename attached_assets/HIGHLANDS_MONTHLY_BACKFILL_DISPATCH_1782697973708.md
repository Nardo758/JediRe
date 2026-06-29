# BACKFILL DISPATCH: Highlands 2023/2024 monthly actuals (FIND FIRST — load only if real, never fabricate)

The ÷12 accrual fallback is a floor (annual-correct, monthly-estimated). The correct state is real monthly values in `deal_monthly_actuals` so the fallback never fires. But this is only a load job **if the real monthly data exists.** If it doesn't, the accrual is the honest answer and we stop — we do NOT synthesize monthly numbers. Fabricating operating history is the worst possible outcome; empty-and-labeled beats full-and-invented. This dispatch finds the data, loads it only if real, and stops cleanly if it isn't there. STOP at the gate if no real source is found.

---

## GATE — does the real monthly data exist? (answer before loading anything)

Find the source for Highlands' 2023/2024 monthly `property_tax` and Jan–Mar 2025 `gross_potential_rent` (and any other NULL-covered dollar field for those periods). Search, in order:

1. **`deal_monthly_actuals` itself** — is the data there under a different column/period, or genuinely NULL for those months? Confirm the gap is real, not a query miss.
2. **Source operating statements** — the BPI financials / Yardi monthly P&Ls / T12 exports / uploaded operating statements for Highlands 2023–2024. Is there a file, table, or extraction holding *monthly* (not annual) values for those periods? Where?
3. **The extraction/ingestion path** — was monthly 2023/2024 data ever ingested and dropped at a seam (like the T12 months discarded at the data-router earlier), or never ingested at all?

**Report the gate verdict, one of:**
- **REAL-MONTHLY-EXISTS** — found, monthly granularity, first-party source named. → Proceed to LOAD.
- **ANNUAL-ONLY** — the data exists only as annual summaries; no monthly breakdown was ever captured. → STOP. The ÷12 accrual is the honest best for those years. Do not load, do not synthesize. Report this and stop.
- **DOES-NOT-EXIST** — no source for those periods. → STOP. Same as above.

**Hard rule:** if the verdict is ANNUAL-ONLY or DOES-NOT-EXIST, **do not interpolate, distribute, seasonally-curve, or generate** monthly values. The labeled accrual stays. Stopping here is the correct outcome, not a failure.

## CoStar firewall check (before any load)

Whatever source is found, confirm it is **first-party operating data** (Highlands' own Yardi/PM/operating statements), NOT a CoStar export or CoStar-derived figure. Highlands is a portfolio asset — its operating history is yours and clean. Name the source and confirm it's not CoStar. If the only available source is CoStar-derived, STOP — do not load (contamination vector), keep the accrual.

## LOAD — only if GATE = REAL-MONTHLY-EXISTS

- Load the real monthly values into `deal_monthly_actuals` for the NULL periods (2023/2024 property_tax, Q1 2025 GPR, any others found). Real per-month figures, not a spread annual.
- Re-seed Highlands through the production path.
- The fallback should now NOT fire for these periods — slots become real `extraction_t12`-sourced (or actuals-sourced), not `year1_accrual`.

## ACCEPTANCE (if loaded)

1. **Real, varying monthly values.** Post-load, the previously-NULL months show real per-month figures that vary (or are real flat accruals if that's genuinely how the source booked them), sourced from actuals — NOT `year1_accrual`. Paste the months with their source tag.
2. **No fallback firing.** Zero `year1_accrual` slots remain for the loaded periods. Paste.
3. **Annual now from real data.** real_estate_tax 2023 annual = the real summed monthly tax (whatever it actually is), GPR 2025 annual from real Q1+Q2-4. Paste — and confirm it's sane (tax ~$524k-ish range, GPR ~$6M-ish), not 12× and not the accrual estimate.
4. **No regression.** EGI 2025 still real, noi_margin 2025 still 57.17% (loading tax/GPR shouldn't touch EGI/NOI). Paste.
5. **Firewall.** Source named, confirmed first-party not CoStar. Stated.

## ACCEPTANCE (if NOT loaded — gate stopped)

- Report the gate verdict (ANNUAL-ONLY / DOES-NOT-EXIST / CoStar-only) with what was searched.
- Confirm the accrual remains in place and labeled `year1_accrual` for those periods.
- State plainly: those years are estimated-not-real by necessity, the grid should mark them so, and a future load can replace them if real monthly data ever surfaces. This is the honest end state, not an open bug.

---

**Report:** the GATE verdict first. Then either the LOAD acceptance (real data in, no fallback, sane annuals, no regression, firewall clean) or the gate-stop record (no real source, accrual stays labeled). 

**The point:** real monthly data is better than the accrual — but only real data. If it doesn't exist, the accrual labeled as estimated is the truthful state, and inventing monthly numbers to fill the grid would be the one move this whole program exists to prevent. Find first, load only if real, never fabricate. STOP after reporting.
