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

### 2. Closing Costs — 5 sub-rows ✅ FIXED (May 2026)

- **Rows:** Broker Fee · Legal & DD · Lender / Orig · Reserves · Other / Cont.
- **Fix shipped (option a):**
  - 5 new `su:` keys added: `su:closingCostsBrokerFee`, `su:closingCostsLegalDD`, `su:closingCostsLenderOrig`, `su:closingCostsReserves`, `su:closingCostsOther` — stored as `{"value": N}` entries in `deal_assumptions.per_year_overrides`.
  - `PATCH /:dealId/assumptions/closing-costs` endpoint: accepts `{ brokerFee?, legalDD?, lenderOrig?, reserves?, other? }`, dynamically builds JSONB merge/remove expression — null clears the key, number merges it in.
  - Composer (`getProFormaComputed`): reads all 5 sub-keys; when any are set, sums them as `suClosingCosts` (overriding both the aggregate `su:closingCosts` override and the 2% estimate). Falls back gracefully when none are set.
  - Type definition (`DealFinancials.sourcesUses.userOverrides`) extended with all 5 keys.
  - DealTermsTab: sub-line resolved values hydrated from `fin.sourcesUses.userOverrides`; state populated on load; `saveClosingCosts(field, raw)` wired to each row's `onCommit`; source badge flips Override ↔ Not Provided; `PendingBadge` removed from all 5 rows.
  - **Lender / Orig note:** treated as a separate line item from `debt:senior:origFee` (two independent entries, no cross-link). Analyst should populate only one or the other to avoid double-counting in S&U.

### 3. Targets — IRR · EM · CoC ✅ FIXED (May 2026)

- **Rows:** Target Levered IRR · Target Equity Multiple · Target Cash-on-Cash (Y1)
- **Fix shipped:**
  - Migration `20260507_deal_assumptions_targets.sql` added `target_irr`, `target_em`, `target_coc` (nullable NUMERIC) to `deal_assumptions`.
  - `PATCH /:dealId/assumptions/targets` — single endpoint for all three; COALESCE-safe upsert so partial payloads don't clobber sibling fields.
  - `getDealFinancials` SELECT extended; `assumptions.targetIrr/Em/Coc` on the F9 contract.
  - DealTermsTab: `saveTargetIrr/Em/Coc` save functions wired; rows hydrate on load; `PendingBadge` removed; source badge flips Override ↔ Not Provided. ✓

### 4. Exit Strategy ✅ SUPERSEDED (May 2026 → Task #613)

- **Row:** "Exit Strategy" (Sale / Refinance / Hold)
- **Initial fix (May 2026):** Migration added `exit_strategy TEXT`; `PATCH /exit-strategy` endpoint; flat scalar on F9 contract.
- **Superseded by Task #613 (May 2026):**
  - `exit_strategy TEXT` column **dropped**; replaced with `exit_strategy_lv JSONB` storing `{detected,override}` shape.
  - Old `PATCH /:dealId/assumptions/exit-strategy` **removed**; replaced by `PATCH /:dealId/assumptions/strategy` (serves both fields).
  - F9 contract now returns `assumptions.exitStrategy = {detected,override,resolved}` (full LV object) instead of the old flat `assumptions.exitStrategy: string`.
  - Source badge shows "Override" / "Detected" / "Not Provided" based on which slot is populated.
  - Existing values backfilled from old TEXT column into `override` slot via migration `20260508_strategy_fields_lv.sql`. ✓

### 5. Selling Costs % ✅ FIXED (May 2026)

- **Row:** "Selling Costs %"
- **Fix shipped:**
  - Migration added `selling_costs_pct NUMERIC` to `deal_assumptions`.
  - `PATCH /:dealId/assumptions/selling-costs` — validates 0–1 decimal range; null resets to platform 2% default.
  - `getDealFinancials` SELECT extended; `assumptions.sellingCostsPct` on the F9 contract.
  - DealTermsTab: `saveSellingCosts` wired; `sellingCostsDecimal` now prefers resolved DB value over draft input, so exit math (Gross Sale Proceeds) updates immediately after save; `PendingBadge` removed; source badge flips Override ↔ Platform. ✓

### 6. Going-in Cap Rate — locked as derived ✅ FIXED (May 2026)

- **Row:** "Going-in Cap Rate"
- **Decision:** Row is by definition derived (T-12 NOI ÷ Purchase Price) and must not be operator-overrideable — overriding it would silently break the valuation chain.
- **Fix shipped:** `PendingBadge` replaced with `PendingBadge label="DERIVED"`; override input removed (`override=""`, `setOverride={() => {}}`); source badge stays "Computed". Row is clearly read-only with no teal edit border.

### 7. Stabilized Cap Rate — locked as derived ✅ FIXED (May 2026)

- **Row:** "Stabilized Cap Rate"
- **Decision:** Same as Going-in Cap — derived from Peak NOI ÷ Purchase Price; locking prevents contradictory operator inputs.
- **Fix shipped:** Same treatment as item 6 — `PendingBadge label="DERIVED"`, override input removed, source stays "Computed".

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

### 9. Net Sale Proceeds → Gross Sale Proceeds (loan payoff missing) ✅ FIXED (May 2026)

- **Row:** "Gross Sale Proceeds" (renamed from "Net Sale Proceeds" per Phase 1 spec 2f).
- **Fix shipped:** `exitYearProj.loanPayoff` and `exitYearProj.netSaleProceeds` are already computed by
  the projections engine. DealTermsTab now reads both:
  - "Gross Sale Proceeds" row (Exit Value − Selling Costs, before loan payoff) — no badge.
  - "Loan Payoff at Exit" sub-row (parenthesised deduction) — rendered only when debt schedule is present.
  - "Net Sale Proceeds" row (Gross − Loan Payoff) — GROSS badge retained only when no debt schedule is available.

### 10. Investment Strategy ✅ FIXED (Task #613, May 2026)

- **Row:** "Investment Strategy" (Section 2).
- **Fix shipped (Task #613):**
  - `investment_strategy_lv JSONB` column added to `deal_assumptions` via migration `20260508_strategy_fields_lv.sql`.
  - Shape: `{detected:{value,confidence,source}|null, override:string|null}`. Resolved = `override ?? detected?.value ?? null`.
  - `PATCH /:dealId/assumptions/strategy` with `{investmentStrategy?: 'Build-to-Sell'|'Flip'|'Rental'|'Short-Term Rental'|null}` wires the operator override slot.
  - F9 contract returns `assumptions.investmentStrategy = {detected,override,resolved}` (full LV object).
  - DealTermsTab row: `UPSTREAM` badge removed; active dropdown with 4 options; persists across reload.
  - `detected` slot is held open (null in V1) for M08 Strategy Arbitrage to write into later without schema migration.
  - `deal:strategy-changed` CustomEvent dispatched after each save for non-F9 listeners (M08 panel, OperatorStance).
- **Still out of scope:** AI extraction / THESIS §1 UI (#607); M08 wiring of detected slot (separate task). ✓

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
