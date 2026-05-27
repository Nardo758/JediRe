/**
 * proforma-template-row-sets.ts
 * ==============================
 * Canonical mapping from PROFORMA_TEMPLATES blueprint field names to the
 * operating-statement row fields used by ProFormaSummaryTab's renderer.
 *
 * Source of truth: backend/src/services/proforma/blueprint/proforma-blueprint.ts
 * § PROFORMA_TEMPLATES — each template's `sections[].fields[]` array.
 *
 * When the backend blueprint adds or renames a section field, mirror it here.
 * Field names follow snake_case to match OperatingStatementRow.field.
 *
 * Task #1236: Connect ProFormaTemplateId to F9 renderer.
 */

export interface TemplateRowDef {
  /** Matches OperatingStatementRow.field — used for byField lookup */
  field: string;
  /** Human-readable label shown in the operating statement table */
  label: string;
  /** Hint shown in the NOT SET placeholder badge */
  hint?: string;
}

export interface TemplateSectionDef {
  /** Section identifier from PROFORMA_TEMPLATES.sections[].id */
  sectionId: string;
  /** Section title rendered via SectionHeader */
  title: string;
  /** Color config for SectionHeader */
  accentColor: string;
  bg: string;
  /** Row definitions for this section — derived from blueprint fields */
  rows: TemplateRowDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// flip — PROFORMA_TEMPLATES.flip.sections
//   basis:  purchasePrice, closingCosts
//   capex:  hardCosts, softCosts, contingency, renovationTimelineMonths
//   carry:  propertyTax, insurance, utilities, debtService  (OPEX handled separately)
//   exit:   exitPrice, sellingCosts, netSaleProceeds
//   returns: profitMargin, cashOnCash, leveredIRR, monthsHeld
// ─────────────────────────────────────────────────────────────────────────────
export const FLIP_BASIS_ROWS: TemplateRowDef[] = [
  { field: 'purchase_price', label: 'Purchase Price',        hint: 'Enter in Deal Terms' },
  { field: 'closing_costs',  label: 'Closing Costs',         hint: 'Enter in Deal Terms' },
];

export const FLIP_CAPEX_ROWS: TemplateRowDef[] = [
  { field: 'hard_costs',                label: 'Hard Costs  (Materials + Labor)', hint: 'Enter in Deal Terms' },
  { field: 'soft_costs',                label: 'Soft Costs  (Design, Permits, Arch)', hint: 'Enter in Deal Terms' },
  { field: 'contingency',               label: 'Contingency Reserve',            hint: 'Enter in Deal Terms' },
  { field: 'renovation_timeline_months',label: 'Renovation Timeline  (months)',  hint: 'Enter in Deal Terms' },
];

export const FLIP_EXIT_ROWS: TemplateRowDef[] = [
  { field: 'exit_price',        label: 'Resale / Sale Price',          hint: 'Enter in Deal Terms' },
  { field: 'selling_costs',     label: 'Selling Costs  (Agent, Closing)', hint: 'Enter in Deal Terms' },
  { field: 'net_sale_proceeds', label: 'Net Sale Proceeds',             hint: 'Computed: resale − selling costs' },
  { field: 'profit_margin',     label: 'Profit Margin',                 hint: 'Computed: net proceeds − total cost' },
  { field: 'months_held',       label: 'Months Held',                   hint: 'Enter in Deal Terms' },
];

// OPEX carry fields (real_estate_tax, insurance, utilities) are rendered by
// templateCtrlRows / templateNctrlRows from the OPEX section — not repeated here.

// ─────────────────────────────────────────────────────────────────────────────
// str_shortterm — PROFORMA_TEMPLATES.str_shortterm.sections
//   basis:   purchasePrice, closingCosts, furnishingBudget  (not rendered in op stmt)
//   revenue: adr, occupancyRate, revPar, cleaningFees, platformFees, effectiveGrossIncome
//   opex:    standard rows (handled by existing OPEX section)
//   noi:     netOperatingIncome, debtService, cashFlowBeforeTax  (handled by existing NOI)
// ─────────────────────────────────────────────────────────────────────────────
export const STR_REVENUE_ROWS: TemplateRowDef[] = [
  { field: 'adr',           label: 'Avg Daily Rate  (ADR)',             hint: 'Enter in Deal Terms' },
  { field: 'occupancy_rate',label: 'Occupancy Rate  (%)',               hint: 'Enter in Deal Terms' },
  { field: 'rev_par',       label: 'RevPAR  (ADR × Occupancy)',         hint: 'Computed from ADR × occupancy' },
  { field: 'cleaning_fees', label: 'Cleaning Fees',                     hint: 'Enter in Deal Terms' },
  { field: 'platform_fees', label: 'Platform Fees  (Airbnb / VRBO)',    hint: 'Enter in Deal Terms' },
];

// ─────────────────────────────────────────────────────────────────────────────
// land_hold — PROFORMA_TEMPLATES.land_hold.sections
//   basis:  landCost, closingCosts   (not rendered as operating stmt rows)
//   carry:  propertyTax, insurance, debtService, maintenance  (OPEX section)
//   exit:   exitPrice, sellingCosts
//   returns: leveredIRR, profitMargin
// ─────────────────────────────────────────────────────────────────────────────
export const LAND_HOLD_EXIT_ROWS: TemplateRowDef[] = [
  { field: 'exit_price',        label: 'Land Exit / Sale Price', hint: 'Enter in Deal Terms' },
  { field: 'selling_costs',     label: 'Selling Costs',          hint: 'Enter in Deal Terms' },
  { field: 'net_sale_proceeds', label: 'Net Proceeds',            hint: 'Computed: exit − selling costs' },
  { field: 'profit_margin',     label: 'Profit Margin',           hint: 'Computed: net proceeds − cost basis' },
];
