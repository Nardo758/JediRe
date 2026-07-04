// Force-unmatched-key test for Fix C2 loudness
// Proves that Title-Case / display-name keys in ProFormaAssumptions.expenses
// trigger the UNMATCHED_OPEX_KEYS integrity warning.

import { describe, it, expect } from 'vitest';
import { mapProFormaAssumptionsToModelAssumptions } from '../proforma-assumptions-bridge';
import type { ProFormaAssumptions } from '../financial-model-engine.service';

function baseMock(): ProFormaAssumptions {
  return {
    dealInfo: {
      dealName: 'Test Deal',
      totalUnits: 100,
      netRentableSF: 90000,
      vintage: 2010,
      address: '123 Test St',
      city: 'Testville',
      state: 'FL',
    },
    modelType: 'existing',
    holdPeriod: 5,
    unitMix: [
      {
        floorPlan: '1BR',
        unitSize: 900,
        beds: 1,
        units: 100,
        occupied: 95,
        vacant: 5,
        marketRent: 1500,
        inPlaceRent: 1400,
      },
    ],
    acquisition: {
      purchasePrice: 10000000,
      capRate: 0.05,
      closingCosts: {},
    },
    disposition: {
      exitCapRate: 0.055,
      sellingCosts: 0.03,
      saleNOIMethod: 'forward_noi',
    },
    revenue: {
      rentGrowth: [0.03, 0.03, 0.03, 0.03, 0.03],
      lossToLease: 0.02,
      stabilizedOccupancy: 0.95,
      collectionLoss: 0.01,
      otherIncome: {},
    },
    expenses: {},
    financing: {
      loanAmount: 5000000,
      loanType: 'agency',
      interestRate: 0.065,
      spread: 0,
      term: 30,
      amortization: 30,
      ioPeriod: 0,
      originationFee: 0.01,
      rateCapCost: 0,
      prepayPenalty: 0,
    },
    capex: {
      lineItems: [],
      contingencyPct: 0,
      reservesPerUnit: 250,
    },
    waterfall: {
      lpShare: 0.8,
      gpShare: 0.2,
      hurdles: [
        { hurdleRate: 0.08, promoteToGP: 0.2, lpSplit: 0.8 },
        { hurdleRate: 0.12, promoteToGP: 0.3, lpSplit: 0.7 },
        { hurdleRate: 0.18, promoteToGP: 0.5, lpSplit: 0.5 },
      ],
      equityContribution: 2500000,
    },
  };
}

describe('C2: canonical-key matching loudness', () => {
  it('emits _unmatchedOpexKeys when expenses use display-case keys', () => {
    const mock = baseMock();
    mock.expenses = {
      // Real-deal style: Title-Case display keys with spaces, ampersands, punctuation
      'Payroll': { amount: 75000, type: 'opex', growthRate: 0.03 },
      'Repairs & Maintenance': { amount: 120000, type: 'opex', growthRate: 0.03 },
      'Administrative': { amount: 45000, type: 'opex', growthRate: 0.03 },
      'Insurance': { amount: 30000, type: 'opex', growthRate: 0.03 },
      'Utilities': { amount: 60000, type: 'opex', growthRate: 0.03 },
      'Replacement Reserves': { amount: 25000, type: 'opex', growthRate: 0.03 },
      'Contract Services': { amount: 20000, type: 'opex', growthRate: 0.03 },
      'Management Fee': { amount: 15000, type: 'opex', growthRate: 0.03 },
      // Snake_case keys that should match via canonical normalization
      'payroll': { amount: 999999, type: 'opex', growthRate: 0.03 },
      'marketing': { amount: 18000, type: 'opex', growthRate: 0.03 },
    };

    const result = mapProFormaAssumptionsToModelAssumptions(mock);

    expect(result._unmatchedOpexKeys).toBeDefined();
    expect(result._unmatchedOpexKeys!.length).toBeGreaterThan(0);

    // Verify expected missing keys are present in the warning list.
    // canonicalKey() strips all non-alphanumeric chars including underscores,
    // so "Repairs & Maintenance" → "repairsmaintenance" matches "repairs_maintenance"
    // and "Contract Services" → "contractservices" matches "contract_services".
    // Only "Administrative" → "administrative" has no match for "g_and_a" → "ganda".
    const expectedMissing = ['g_and_a'];
    for (const k of expectedMissing) {
      expect(result._unmatchedOpexKeys).toContain(k);
    }
    // Verify keys that DO match via canonical normalization are NOT flagged
    expect(result._unmatchedOpexKeys).not.toContain('repairs_maintenance');
    expect(result._unmatchedOpexKeys).not.toContain('contract_services');
    expect(result._unmatchedOpexKeys).not.toContain('marketing');
    // Verify optional keys with fallbacks are NOT flagged even when absent
    expect(result._unmatchedOpexKeys).not.toContain('management_fee');
    expect(result._unmatchedOpexKeys).not.toContain('replacement_reserves');
  });

  it('passes silently (_unmatchedOpexKeys undefined) when expenses use exact snake_case keys', () => {
    const mock = baseMock();
    mock.expenses = {
      payroll: { amount: 75000, type: 'opex', growthRate: 0.03 },
      repairs_maintenance: { amount: 120000, type: 'opex', growthRate: 0.03 },
      contract_services: { amount: 20000, type: 'opex', growthRate: 0.03 },
      marketing: { amount: 18000, type: 'opex', growthRate: 0.03 },
      utilities: { amount: 60000, type: 'opex', growthRate: 0.03 },
      g_and_a: { amount: 45000, type: 'opex', growthRate: 0.03 },
      insurance: { amount: 30000, type: 'opex', growthRate: 0.03 },
      replacement_reserves: { amount: 25000, type: 'opex', growthRate: 0.03 },
    };

    const result = mapProFormaAssumptionsToModelAssumptions(mock);

    expect(result._unmatchedOpexKeys).toBeUndefined();
  });
});
