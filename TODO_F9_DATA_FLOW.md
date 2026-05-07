# F9 Data Flow — Side Debt Log

Cross-reference: `docs/architecture/F9_DATA_FLOW_AUDIT_PHASE1.md` (Phase 1 audit)

Items below were deferred from Phase 2 and require schema changes, new UI surfaces,
or coordinated work before they can be fixed inline.

---

## P2-A — Unit-mix-as-GPR-source feature flag activation

**Flow:** Flow 1 (Unit Mix → Pro Forma)  
**Break class:** `DATA_NOT_FLOWING`  
**Effort:** M  

**Current state:**  
The `da:use_unit_mix_for_gpr` flag exists at `financials-composer.service.ts:286` and  
controls whether GPR is derived from `unit_mix[]` vs. extraction data (T-12 / OM). The  
flag is stored in `per_year_overrides` and can be set via `PATCH /financials/override`.  
For 464 Bishop (and likely most deals), the flag is not set → unit_mix edits are silently  
no-ops on GPR.

**Work needed:**  
1. Migration audit: identify all deals where `sum(unit_mix[].count × rent × 12)` diverges  
   from the stored `gprDecomposition.resolvedAnnual`. These deals need a reconciliation  
   step before the flag is enabled, or their GPR will jump.  
2. Decide the activation model:  
   - Per-deal opt-in (operator flips a toggle in Unit Mix tab header)  
   - Global default for new deals only  
   - Auto-enable on first unit_mix write (risky without reconciliation)  
3. Add a UI toggle in `UnitMixTab` that writes `da:use_unit_mix_for_gpr` via  
   `PATCH /financials/override`. Show the current source (Extraction vs Unit Mix) as  
   a labeled badge on the GPR row in Pro Forma Summary.

**Blocker:** Must reconcile deals where stored GPR ≠ sum(unit_mix) before enabling  
globally. Per-deal opt-in is safest.

---

## P2-B — LP-GP split user-facing write path

**Flow:** Flow 4 (Deal cost / Partnership → Capital + Returns)  
**Break class:** `PERSISTENCE_GAP`  
**Effort:** S (backend wiring) + M (frontend surface)  

**Current state:**  
`wf:lpShare` / `wf:gpShare` are readable in `per_year_overrides` at  
`proforma-adjustment.service.ts:2943` with defaults of 0.90 / 0.10. Write path exists  
via `PATCH /financials/override`. For 464 Bishop, no `wf:` overrides are set → always  
defaults to 90/10. `lpNetIrr` and `lpEquityMultiple` are computed correctly given whatever  
split is set.

**Work needed:**  
1. Add an LP-GP split row to the Deal Terms Section 4 (Capital Structure) or the  
   F9 Capital tab waterfall section — whichever is the canonical ownership surface.  
2. Wire the row to `PATCH /financials/override` with `field: 'wf:lpShare'` (and auto-  
   compute `gpShare = 1 - lpShare`).  
3. Confirm: does the Waterfall tab in M11 (Debt Advisor) also need to respect this  
   value, or does it have its own separate split input?

**Blocker:** Decision on which surface owns the dial — F9 Capital tab vs. Deal Terms  
§4. DEAL TERMS Section 4 (Capital Structure) was deliberately deferred; this would  
unblock part of that scope. Cross-ref: `TODO_DEAL_TERMS_FOLLOWUP.md` (Section 4 deferral).

---

## P3-A — Ancillary breakdown → other_income_per_unit rollup verification

**Flow:** Flow 2 (Other Income → Pro Forma)  
**Break class:** Potential `DATA_NOT_FLOWING` — unconfirmed  
**Effort:** S (read-only investigation)  

**Current state:**  
The ancillary breakdown fields (parking, RUBS, pet_rent, late_fees, vending, app_fee)  
are extracted and displayed in the Ancillary Income Reconciliation panel via  
`financials-composer.service.ts:979-1071` (`composeOtherIncomeBreakdown`). They do NOT  
flow into the main Pro Forma `other_income` OSRow directly. The Pro Forma reads only  
`other_income_per_unit` (an aggregate per-unit monthly value) and converts it to annual  
dollars at `proforma-adjustment.service.ts:3303`.

**Unknown:** Whether the `other_income_per_unit` seed properly sums all extraction  
ancillary buckets (parking + RUBS + pet + fees) or whether those buckets land in the  
breakdown-only display path and never reach `other_income_per_unit`.

**Action needed:**  
1. Pick one deal with known parking/RUBS extraction data (not 464 Bishop which has  
   `unit_mix={}` and sparse context fields).  
2. Query `deal_context_fields` or `deal_assumptions.year1` for that deal and compare:  
   - Sum of `parking_income + rubs_income + pet_rent + late_fees + other_income`  
     from raw extraction  
   - vs. `other_income_per_unit × totalUnits × 12`  
3. If they diverge: the seeder (`proforma-seeder.service.ts`) needs a fix to roll all  
   ancillary categories into the `other_income_per_unit` field, or the Pro Forma  
   compositor needs to sum the breakdown directly.  
4. If they match: no fix needed; mark P3-A closed.
