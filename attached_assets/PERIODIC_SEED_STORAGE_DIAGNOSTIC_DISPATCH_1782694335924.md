# DIAGNOSTIC DISPATCH: periodic seed field storage — real-monthly vs annual-constant (AUDIT ONLY, fix nothing)

The custom-metrics re-verification proved EGI is stored as an annual constant repeated in all 12 monthly slots, so the re-derive path sums 12 copies → 12× inflated denominator → every EGI-based ratio renders 12× too small (6.29% vs the true 75.47%). But the report also showed the **P&L grid's own EGI year column displays $57.40M (12× the real ~$4.78M)** — so this is NOT only a custom-metrics bug; the grid's annual rollup is wrong for any annual-constant field, and has been since Phase 5 closed (NOI was checked, EGI never was). Before any fix, map the true blast radius and determine the fix shape. **Change nothing — this picks the fix, it doesn't apply it.** STOP at the report.

---

## D1 — Per-field storage audit (the blast radius)

For Highlands' periodic seed, for **every** field in the series, determine storage type by inspecting the raw monthly values for one actual year:

- Pull all 12 monthly values for each field (noi, egi, gpr, total_opex, vacancy_pct, noi_per_unit, management_fee_pct, and every other seeded field — the report cited 31 fields).
- Classify each:
  - **REAL-MONTHLY** — values vary month to month (like NOI: $305k, $308k, $265k…). Summing 12 → correct annual.
  - **ANNUAL-CONSTANT** — same value in all 12 slots (like EGI: $4,783,645.81 ×12). Summing 12 → 12× wrong.
  - **RATE/PERCENT** — a percentage (vacancy_pct, management_fee_pct). These should never sum regardless; flag how they're currently rolled up.
- Output a table: field → storage type → what the annual rollup currently does (sum / use-once / avg) → is that correct for this storage type.

**This table is the blast radius.** Any ANNUAL-CONSTANT field that's being summed is currently rendering 12× wrong in the grid's annual column AND corrupting any custom metric that uses it. Name them all.

## D2 — Is annual-constant storage intended or a seeder defect? (decides the fix shape)

For each ANNUAL-CONSTANT field found in D1, determine **why** it's stored that way — trace the seeder.

- Where does the seeder get EGI (and each other annual-constant field)? Read `proforma-seeder.service.ts` / the periodic seed build path.
- Is the source value **inherently annual** (computed once per year by definition, e.g. an annualized figure), or is it a **monthly quantity the seeder is back-filling** as a constant because it only had an annual number (or because the schema demands a per-month value)?
- The distinction decides everything:
  - **If the field SHOULD be monthly** (revenue-driven, varies like NOI — EGI is effective gross income, which plausibly varies monthly): the seeder is the bug. It's storing a fiction (annual ÷ nothing, repeated). Fix = seeder stores real monthly values; the re-derive path then works with zero special-casing.
  - **If the field is INHERENTLY annual** (defined once per year, no meaningful monthly decomposition): storing it in monthly slots is a category error, and the rollup engine needs a per-field rule ("annual — use the period value once, never sum").
- Report per annual-constant field: SHOULD-BE-MONTHLY (seeder fix) or INHERENTLY-ANNUAL (rollup-rule fix). For EGI specifically, state which, with the model reasoning.

## D3 — Confirm the P&L grid symptom (is the base grid already wrong on screen?)

The report cited the F9 EGI year column showing $57.40M for 2022. Confirm the scope on the rendered grid, not just in custom metrics:

- For each ANNUAL-CONSTANT field, does the grid's **own P&L year column** show the 12×-inflated sum (like EGI $57.4M), or does it use-once correctly?
- Confirm against the live API `/financial-model/:dealId/periodic` annual rollup (or the grid's annual aggregation logic) for each constant field.
- Result: list which P&L grid rows are currently rendering 12× wrong annual values. This is the user-visible damage that exists *today*, independent of custom metrics — and it means the Phase 5 grid close had a gap (only NOI's annual rollup was DB-verified; constant fields weren't).

## D4 — Fix-shape recommendation (recommend, don't implement)

From D1–D3, recommend the fix, and be explicit that **special-casing `computeCorrectAnnualSeries` to detect constant fields is the WRONG fix** — it patches a symptom, becomes wrong the moment storage is corrected, and "detect suspiciously-constant" is a brittle heuristic (a legitimately flat field would false-positive). Recommend the root fix:

- If most annual-constant fields are SHOULD-BE-MONTHLY → **seeder fix** (store real monthly values), and the rollup paths need no change. Name what the seeder must compute per month.
- If some are INHERENTLY-ANNUAL → **per-field rollup rule** (a flag on the field: SUM | USE-ONCE | AVG | RE-DERIVE), applied consistently in BOTH the P&L grid annual rollup AND `computeCorrectAnnualSeries`. Name the fields and their rules.
- Likely it's a mix — report which fields take which fix.
- Flag the consistency requirement: whatever the rule, the P&L grid rollup (D3) and the custom-metrics re-derive (D2) must use the **same** per-field rule, or they'll disagree (grid shows one annual EGI, custom metric uses another).

---

## Report

| Output | Content |
|---|---|
| D1 | per-field storage table + the ANNUAL-CONSTANT-being-summed list (blast radius) |
| D2 | per annual-constant field: seeder-defect vs inherently-annual, with EGI's verdict + model reasoning |
| D3 | which P&L grid rows render 12× wrong today (user-visible damage, independent of custom metrics) |
| D4 | recommended root fix (seeder and/or per-field rollup rule), with the explicit warning against special-casing the symptom, and the grid↔custom-metric consistency requirement |

**Change nothing.** This maps the true scope (likely bigger than EGI — any annual-constant field) and picks the fix shape so the eventual fix targets the root, not a compensating hack. The fix is a separate gated dispatch after you review this. STOP after reporting.

---

**Why diagnose before fixing:** the obvious fix (teach the re-derive function to spot constant denominators) is a trap — it special-cases the symptom, will silently invert once EGI is stored correctly, and leaves the P&L grid's own 12× EGI display unfixed. The root is either the seeder storing a fiction or a missing per-field rollup rule, and which one depends on whether EGI is genuinely monthly or genuinely annual — a model question this audit answers before a single line changes.
