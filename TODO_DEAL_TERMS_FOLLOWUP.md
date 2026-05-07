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

### 3. Targets — IRR · EM · CoC ✅ FIXED (May 2026)

- **Rows:** Target Levered IRR · Target Equity Multiple · Target Cash-on-Cash (Y1)
- **Fix shipped:**
  - Migration `20260507_deal_assumptions_targets.sql` added `target_irr`, `target_em`, `target_coc` (nullable NUMERIC) to `deal_assumptions`.
  - `PATCH /:dealId/assumptions/targets` — single endpoint for all three; COALESCE-safe upsert so partial payloads don't clobber sibling fields.
  - `getDealFinancials` SELECT extended; `assumptions.targetIrr/Em/Coc` on the F9 contract.
  - DealTermsTab: `saveTargetIrr/Em/Coc` save functions wired; rows hydrate on load; `PendingBadge` removed; source badge flips Override ↔ Not Provided. ✓

### 4. Exit Strategy ✅ FIXED (May 2026)

- **Row:** "Exit Strategy" (Sale / Refinance / Hold)
- **Fix shipped:**
  - Migration added `exit_strategy TEXT` to `deal_assumptions`.
  - `PATCH /:dealId/assumptions/exit-strategy` — validates against `['Sale','Refinance','Hold']`; null clears the field.
  - `getDealFinancials` SELECT extended; `assumptions.exitStrategy` on the F9 contract.
  - DealTermsTab: `saveExitStrategy` wired to dropdown `onCommit`; row hydrates on load; `PendingBadge` removed. ✓

### 5. Selling Costs % ✅ FIXED (May 2026)

- **Row:** "Selling Costs %"
- **Fix shipped:**
  - Migration added `selling_costs_pct NUMERIC` to `deal_assumptions`.
  - `PATCH /:dealId/assumptions/selling-costs` — validates 0–1 decimal range; null resets to platform 2% default.
  - `getDealFinancials` SELECT extended; `assumptions.sellingCostsPct` on the F9 contract.
  - DealTermsTab: `saveSellingCosts` wired; `sellingCostsDecimal` now prefers resolved DB value over draft input, so exit math (Gross Sale Proceeds) updates immediately after save; `PendingBadge` removed; source badge flips Override ↔ Platform. ✓

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

### 8. Stabilized NOI at Exit ✅ FIXED (May 2026)

- **Row:** Section 3, "Stabilized NOI at Exit" (Exit Math derivations).
- **Fix shipped:**
  - `DealFinancials.projections` was already populated by `getDealFinancials` with `exitNoi`, `grossSaleValue`, and `sellingCosts` per year — no backend change needed.
  - DealTermsTab now reads `fin.projections[holdIndex]` (0-indexed by resolved hold period) to hydrate `stabilizedNoiAtExit`, `exitValueDerived`, and `grossProceedsDerived`.
  - `grossProceedsDerived` prefers projections-engine `sellingCosts` (which now respects operator `selling_costs_pct`) over local decimal fallback.
  - Projections engine selling cost bug fixed: hardcoded `0.015` replaced with `sellingCostsPct ?? 0.02` so Item 5's operator override flows all the way through to exit math. ✓
  - UPSTREAM `PendingBadge` removed; row now shows computed value when projections are seeded.

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

### 12. Bulk PUT /assumptions clobbers unit_mix on partial payload ✅ ALREADY FIXED

- See item 1 above. The fix was shipped alongside item 1: line 252 of `deal-assumptions.routes.ts` reads `input.unitMix != null ? JSON.stringify(input.unitMix) : null`, and the ON CONFLICT clause uses `COALESCE($13, deal_assumptions.unit_mix)` — so a missing `unitMix` in a partial payload sends `null` which COALESCE ignores, preserving the stored value.

---

## Notes for the next pass

- DealTermsTab keeps a `SourceKind` thin-mapping layer (`SOURCE_KIND_TO_BADGE`) so the scaffold's row-level label vocabulary survives. If a future pass replaces all rows with explicit canonical source strings (e.g. `t12`, `override`, `platform`), the mapping can be deleted entirely.
- Section 4 (Capital Structure) deliberately omitted — pending the duplication-vs-F9-Capital decision called out in the scaffold's trailing comment.
