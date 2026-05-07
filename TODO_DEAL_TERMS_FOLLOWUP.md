# DEAL TERMS — Follow-up tasks

Side-debt log for the DEAL TERMS sub-tab wiring (May 2026, branch
`claude/wire-deal-terms-tab`). Each row reported as `PERSISTENCE_GAP`,
`READ_GAP`, or otherwise blocked during Phase 1 audit is logged here.
Do not fix inline — each is a separate scoped task.

Reference: see Phase 1 audit table in the wiring PR.

---

## Persistence gaps — overrides land on disabled inputs today

These rows render with the override disabled and a `PENDING` flag in
DealTermsTab. The read path works; only the write path is missing.

### 1. Hold Period — surgical PATCH path ✅ FIXED (May 2026)

- **Row:** "Hold Period (years)" (Section 2)
- **Fix shipped:** Added `PATCH /:dealId/assumptions/hold-period` in
  `deal-assumptions.routes.ts` — targeted INSERT … ON CONFLICT touching
  only `hold_period_years`. `pickHoldChip` now calls `saveHoldPeriod(yr)`
  before emitting cross-tab signals; the row's `onCommit` fires on manual
  number entry + Enter. Persists across reload. ✓
- **Also fixed:** `JSON.stringify(input.unitMix || [])` → null-guard
  hotfix already shipped to master; bulk PUT is now safe for partial
  payloads.

### 2. Closing Costs — 5 sub-rows

- **Rows:** Broker Fee · Legal & DD · Lender / Orig · Reserves · Other / Cont.
- **Gap:** No per-sub-line storage — the platform tracks only the aggregate `f9Financials.sourcesUses.userOverrides.closingCosts` (writable via `su:closingCosts` override) and the benchmark percentage `sourcesUses.benchmarks.closingCostsPct`.
- **Fix options:**
  (a) Add 5 keys to the `su:` JSONB family (`su:closingCostsBrokerFee`, `:legalDD`, `:lenderOrig`, `:reserves`, `:other`) and have the composer roll them up into the aggregate.
  (b) Make this a single-input row that sets `su:closingCosts` and remove the sub-rows from the scaffold.
  (c) Keep sub-rows view-only and only allow editing the aggregate.
  Recommend option (a) since the scaffold's row breakdown matches the way analysts think about closing costs in OMs.
- **Note on row Lender / Orig:** overlaps with `debt:senior:origFee` from F9 Capital. Either (a) link to that field or (b) keep them separate and document the double-count rule.

### 3. Targets — IRR · EM · CoC

- **Rows:** Target Levered IRR · Target Equity Multiple · Target Cash-on-Cash (Y1)
- **Gap:** No deal-level persistence for operator return targets. M36 Sigma plausibility tier comparisons may want these, and they appear in the M08 strategy seed JSONB (`139_m08_strategy_arbitrage.sql`) as scenario inputs but never on the deal record.
- **Fix:** Either (a) extend `deal_assumptions` with three nullable numeric columns plus 3 `SCALAR_FIELD_MAP` entries, or (b) park them under `per_year_overrides` with a `target:*` prefix. Option (b) is cheaper and follows the existing prefix family.

### 4. Exit Strategy

- **Row:** "Exit Strategy" (Sale / Refinance / Hold)
- **Gap:** Same as Targets — no deal column or JSONB key. Appears only as M08 scenario seed input.
- **Fix:** Add `deal_assumptions.exit_strategy text` (or `target:exit_strategy` per_year_override key) and a string-field PATCH route. The existing override endpoint takes `value: number | string | boolean | null`, so a string path can ride on the same handler with a small validator.

### 5. Selling Costs %

- **Row:** "Selling Costs %"
- **Gap:** `financials-composer.service.ts:2362-2366` reads `y1.sellingCosts` defaulting to 2 % when the property is missing. There's no FIELD_MAP entry, no `deal_assumptions` column, and the field is not surfaced on `F9DealFinancials`.
- **Fix:** Add `sellingCostsPct` to `FIELD_MAP` (storing under `y1.selling_costs` LayeredValue) and surface it on the F9 contract so `f9Financials.assumptions` carries the resolved value back. The composer already has the consumption point.

### 6. Going-in Cap Rate — operator override

- **Row:** "Going-in Cap Rate"
- **Gap:** Read works (`proforma.valuationSnapshot.goingInCapT12`). No override path — the rate is purely derived from T-12 NOI ÷ Purchase Price.
- **Fix:** Either (a) add a `da:going_in_cap_override` flag that, when set, replaces the derivation in the composer, or (b) document that this row is by definition derived and should never be operator-overrideable.

### 7. Stabilized Cap Rate — operator override

- **Row:** "Stabilized Cap Rate"
- **Gap:** Same as Going-in Cap. Read works (`returns.valuation.multiples.capRate.stabilized`). No override path.
- **Fix:** Same options as Going-in Cap.

---

## Read gaps — placeholder rows awaiting upstream feeds

### 8. Stabilized NOI at Exit

- **Row:** Section 3, "Stabilized NOI at Exit" (Exit Math derivations).
- **Gap:** F9 projection-engine year-N output isn't surfaced on `F9DealFinancials` today. `getDealFinancials` calls `buildProjectionsForExport(data, holdYears)` (`deal-assumptions.routes.ts:504`) for IRR cashflows, but the projections array is local to the handler and not put on the response.
- **Fix:** Surface `proforma.projections: { year: number; noi: number | null; … }[]` (or just `proforma.year[hold].noi`) on the F9 contract. Out of scope per the spec.
- **Effect downstream:** Without this, Exit Value derives to `--` because the dividend is null. Exit Date and Gross Sale Proceeds are similarly affected by the missing input.

### 9. Net Sale Proceeds → Gross Sale Proceeds (loan payoff missing)

- **Row:** "Gross Sale Proceeds" (renamed from "Net Sale Proceeds" per Phase 1 spec 2f).
- **Gap:** Loan Payoff at Exit isn't surfaced on `F9DealFinancials.returns.debtMetrics.refi` in a "balance at hold-end" form — only `events[].payoff` arrays for refi events. Showing a partial Net would mislead.
- **Fix:** Add `returns.debtMetrics.coverage.balanceAtExit` (or similar). Then DealTermsTab can compute a real Net Proceeds and rename the row back to "Net Sale Proceeds". Out of scope per the spec.

### 10. Investment Strategy

- **Row:** "Investment Strategy" (Section 2, "From THESIS §1 — not yet wired").
- **Gap:** Ticket #607 — THESIS §1 strategy detection. Out of scope per the spec.

---

## Side-debt found during the audit (not DEAL TERMS rows)

### 11. Purchase Price dual-source read divergence ✅ FIXED (May 2026)

- **What:** `financials-composer` reads `deal_data.purchase_price` (canonical);
  old write path (`PATCH /deals/:id { budget }`) wrote to `deals.budget` only —
  silent miss when `deal_data.purchase_price` is already populated.
- **Fix shipped:** Added `PATCH /:dealId/purchase-price` in
  `deal-assumptions.routes.ts` — JSONB merge `deal_data || jsonb_build_object(
  'purchase_price', $2::numeric)`. `savePurchasePrice` in DealTermsTab now
  calls this endpoint. Capital/S&U tabs pick up the new value on next
  `onF9Refresh`. `DUAL-SRC` flag remains as a best-effort detector for deals
  that still have a divergent `deals.budget` value from old writes.

### 12. Bulk PUT /assumptions clobbers unit_mix on partial payload

- See item 1 above. Standalone bug — affects any caller that sends a partial payload.

---

## Notes for the next pass

- DealTermsTab keeps a `SourceKind` thin-mapping layer (`SOURCE_KIND_TO_BADGE`) so the scaffold's row-level label vocabulary survives. If a future pass replaces all rows with explicit canonical source strings (e.g. `t12`, `override`, `platform`), the mapping can be deleted entirely.
- Section 4 (Capital Structure) deliberately omitted — pending the duplication-vs-F9-Capital decision called out in the scaffold's trailing comment.
