/**
 * F5-2 P4 — Highlands Finding V trace script
 *
 * Purpose: Determine WHY Highlands (seed-path deal, owned_import, never
 * underwritten on-platform) produces zero / missing inPlaceNOI evidence entries
 * when the deterministic model is invoked.
 *
 * Background:
 *   - Highlands fixtureClass = 'seed_path' (highlands.golden.ts)
 *   - rawAssumptions = null (no ProFormaAssumptions — never underwritten)
 *   - The real test runs aggregateSeedActuals(), NOT runFullModel()
 *   - But if runFullModel() IS called with seed-path data, what happens to
 *     inPlaceNOI?
 *
 * inPlaceNOI computation (deterministic-model-runner.ts:2058-2071):
 *   occupiedAtCloseUnits = a.units * (a.occupancyAtClose ?? 1.0)
 *   inPlaceGPR = occupiedAtCloseUnits * a.inPlaceRent * 12
 *   inPlaceEGI = inPlaceGPR + otherIncome
 *   inPlaceTotalExpenses = (per-unit opex sum) * units + mgmtFee + propertyTax
 *   inPlaceNOI = inPlaceEGI - inPlaceTotalExpenses
 *
 * For Highlands, if we construct minimal assumptions from seed data:
 *   - units = 290 (from deal_data or snapshot inference)
 *   - inPlaceRent = ??? (NOT in seed actuals — this is the gap)
 *   - occupancyAtClose = ??? (NOT in seed actuals — this is the gap)
 *   - All opex per-unit fields = 0 (not captured in seed snapshot)
 *
 * Hypothesis: inPlaceNOI is zero because:
 *   (H1) inPlaceRent defaults to 0 → inPlaceGPR = 0 → inPlaceNOI = 0
 *   (H2) occupancyAtClose defaults to 1.0 (engine default) but inPlaceRent = 0
 *   (H3) The seed-path aggregator never calls runFullModel() at all —
 *        inPlaceNOI is a build-path concept, not a seed-path concept
 *
 * This script tests H1/H2 by running the model with Highlands-like minimal
 * assumptions and inspecting the evidence block.
 */

import { runFullModel } from '../src/services/deterministic/run-full-model';
import type { ModelAssumptions } from '../src/services/deterministic/deterministic-model-runner';

// Minimal assumptions mimicking what we'd have for Highlands if we tried
// to force a build-path run on seed-path data
const highlandsMinimalAssumptions: ModelAssumptions = {
  units: 290,
  avgUnitSf: 800,
  marketRent: 1500,
  inPlaceRent: 0,          // UNKNOWN for seed path — no rent roll captured
  purchasePrice: 0,        // UNKNOWN — never acquired on-platform
  closingCostsPct: 0.01,
  isFlorida: false,
  docStampsPct: 0,
  intangibleTaxPct: 0,
  titleInsurancePct: 0,
  capexBudget: 0,
  rentGrowth: [0, 0, 0, 0, 0, 0.03],
  lossToLease: 0.03,
  vacancyY1: 0.05,
  vacancyStab: 0.05,
  concessions: 0,
  badDebt: 0.015,
  otherIncomePerUnit: 0,
  expenseGrowth: 0.031,
  payrollPerUnit: 0,
  maintenancePerUnit: 0,
  contractServicesPerUnit: 0,
  marketingPerUnit: 0,
  utilitiesPerUnit: 0,
  adminPerUnit: 0,
  insurancePerUnit: 0,
  managementFee: 0.05,
  replacementReserves: 250,
  loanAmount: 0,
  ltv: 0.65,
  term: 60,
  amort: 360,
  ioPeriod: 0,
  rate: 0.06,
  originationFeePct: 1,
  exitCap: 0.05,
  saleCosts: 0.02,
  holdYears: 5,
  lpEquity: 0,
  gpEquity: 0,
  preferredReturn: 0.08,
  promoteTiers: [0.08, 0.12, 0.15],
  promoteSplits: [0.2, 0.3, 0.5],
  dealType: 'existing',
  dealMode: 'existing',
};

console.log('=== F5-2 P4: Highlands inPlaceNOI Trace ===\n');

console.log('Input assumptions (Highlands-minimal):');
console.log('  units:', highlandsMinimalAssumptions.units);
console.log('  inPlaceRent:', highlandsMinimalAssumptions.inPlaceRent);
console.log('  occupancyAtClose:', highlandsMinimalAssumptions.occupancyAtClose ?? 'undefined (default 1.0)');
console.log('  purchasePrice:', highlandsMinimalAssumptions.purchasePrice);
console.log('  all per-unit opex:', 0);
console.log();

const results = runFullModel(highlandsMinimalAssumptions);

// Extract inPlaceNOI from evidence block (RunFullModelResult has .result, not .evidence directly)
const evidence = results.result.evidence;
const inPlaceNOIEntry = evidence.fields.find(f => f.field === 'inPlaceNOI');
const noiEntry = evidence.fields.find(f => f.field === 'NOI');

console.log('=== Evidence Block ===');
console.log('Total evidence fields:', evidence.fields.length);
console.log('Confidence distribution:', JSON.stringify(evidence.confidence_distribution));
console.log();

console.log('NOI entry:');
if (noiEntry) {
  console.log('  value:', noiEntry.value);
  console.log('  source:', noiEntry.source);
  console.log('  confidence:', noiEntry.confidence);
} else {
  console.log('  MISSING — no NOI field in evidence');
}
console.log();

console.log('inPlaceNOI entry:');
if (inPlaceNOIEntry) {
  console.log('  value:', inPlaceNOIEntry.value);
  console.log('  source:', inPlaceNOIEntry.source);
  console.log('  confidence:', inPlaceNOIEntry.confidence);
  console.log('  reasoning:', inPlaceNOIEntry.reasoning);
} else {
  console.log('  MISSING — no inPlaceNOI field in evidence');
}
console.log();

// Manual recomputation to show the math
const a = highlandsMinimalAssumptions;
const occupiedAtCloseUnits = a.units * (a.occupancyAtClose ?? 1.0);
const inPlaceGPR = occupiedAtCloseUnits * a.inPlaceRent * 12;
const inPlaceOtherIncome = a.otherIncomePerUnit * a.units;
const inPlaceEGI = inPlaceGPR + inPlaceOtherIncome;
const inPlaceMgmtFee = inPlaceEGI * a.managementFee;
const inPlaceTotalExpenses =
  (a.payrollPerUnit + a.maintenancePerUnit + a.contractServicesPerUnit +
   a.marketingPerUnit + a.utilitiesPerUnit + a.adminPerUnit + a.insurancePerUnit +
   a.replacementReserves) * a.units +
  inPlaceMgmtFee +
  0; // propertyTax = 0 (no tax data in minimal assumptions)
const manualInPlaceNOI = inPlaceEGI - inPlaceTotalExpenses;

console.log('=== Manual inPlaceNOI Recomputation ===');
console.log('  occupiedAtCloseUnits =', occupiedAtCloseUnits, '(units * occupancyAtClose)');
console.log('  inPlaceGPR =', inPlaceGPR, '(occupiedAtCloseUnits * inPlaceRent * 12)');
console.log('  inPlaceOtherIncome =', inPlaceOtherIncome);
console.log('  inPlaceEGI =', inPlaceEGI);
console.log('  inPlaceMgmtFee =', inPlaceMgmtFee);
console.log('  inPlaceTotalExpenses =', inPlaceTotalExpenses);
console.log('  manual inPlaceNOI =', manualInPlaceNOI);
console.log();

// Now test with inPlaceRent populated (what if we had rent roll data?)
console.log('=== Counterfactual: inPlaceRent = $1,400 (Bishop-like) ===');
const counterfactual = { ...highlandsMinimalAssumptions, inPlaceRent: 1400 };
const cfOccupied = counterfactual.units * (counterfactual.occupancyAtClose ?? 1.0);
const cfGPR = cfOccupied * counterfactual.inPlaceRent * 12;
const cfEGI = cfGPR + (counterfactual.otherIncomePerUnit * counterfactual.units);
const cfMgmtFee = cfEGI * counterfactual.managementFee;
const cfTotalExp =
  (counterfactual.payrollPerUnit + counterfactual.maintenancePerUnit + counterfactual.contractServicesPerUnit +
   counterfactual.marketingPerUnit + counterfactual.utilitiesPerUnit + counterfactual.adminPerUnit + counterfactual.insurancePerUnit +
   counterfactual.replacementReserves) * counterfactual.units +
  cfMgmtFee;
const cfNOI = cfEGI - cfTotalExp;
console.log('  Counterfactual inPlaceNOI =', cfNOI);
console.log();

// Verdict
console.log('=== VERDICT ===');
if (inPlaceNOIEntry && inPlaceNOIEntry.value === 0) {
  console.log('CONFIRMED: inPlaceNOI is zero because inPlaceRent = 0 in seed-path data.');
  console.log('Root cause: Seed-path deals (owned_import) never had a rent roll captured');
  console.log('at acquisition time. The inPlaceRent field is a build-path concept — it');
  console.log('comes from the underwriting assumption set, not from monthly actuals.');
  console.log();
  console.log('This is NOT a bug. It is a category mismatch:');
  console.log('  - inPlaceNOI = left edge of M09 bridge = acquisition-state run-rate');
  console.log('  - Seed-path deals have no acquisition state — they were already owned');
  console.log('  - Asking for inPlaceNOI on a seed-path deal is like asking for');
  console.log('    "purchase price" on a deal that was never purchased');
} else if (inPlaceNOIEntry && inPlaceNOIEntry.value === null) {
  console.log('CONFIRMED: inPlaceNOI is NULL with source: "absent".');
  console.log('The engine correctly signals that this deal has no acquisition-state rent data.');
  console.log('Reasoning:', inPlaceNOIEntry.reasoning);
  console.log();
  console.log('This is the CORRECT behavior for seed-path deals:');
  console.log('  - inPlaceNOI = left edge of M09 bridge = acquisition-state run-rate');
  console.log('  - Seed-path deals (owned_import) have no acquisition state — never underwritten');
  console.log('  - The engine emits null + source:absent + LOW confidence instead of fabricating');
  console.log('    a zero or negative number that would mislead downstream consumers');
  console.log('  - Category mismatch, not a bug — the field genuinely does not apply');
} else if (!inPlaceNOIEntry) {
  console.log('CONFIRMED: inPlaceNOI field is ABSENT from evidence.');
  console.log('The engine does not emit this field when assumptions are incomplete.');
} else {
  console.log('UNEXPECTED: inPlaceNOI =', inPlaceNOIEntry.value);
  console.log('Expected zero, null, or absent. Investigate further.');
}
