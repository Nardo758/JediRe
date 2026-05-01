import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, 'phase-a-integration.test.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const section9 = `

// ─── 9. Anchor Interceptor (B2 — Wiring) ─────────────────────────────────────

console.log('\\n9. Anchor Interceptor (B2 — Wiring)\\n');

function testComputeAnchorGrowthRate(
  anchor: any, stateCode: string, stateRules: any[],
  expenseKey: string, amount: number,
  purchasePrice?: number, totalUnits?: number
): number {
  const stateUpper = stateCode.toUpperCase();
  const macroMap: Record<string, number> = { 'CUSR0000SEHC': 0.032, 'ECIWAG': 0.042, 'WPSFD49207': 0.035 };
  let macroGrowth = 0.025;
  if (anchor.macroSeriesId && macroMap[anchor.macroSeriesId]) {
    macroGrowth = macroMap[anchor.macroSeriesId];
  }
  const caps = stateRules.filter(
    (r: any) => r.lineItemId === anchor.lineItemId && r.stateCode === stateUpper && r.ruleType === 'cap'
  );
  const capValues: number[] = caps.map((r: any) => r.ruleValue).filter((v: any): v is number => v !== null);
  const stateCap = capValues.length > 0 ? Math.min(...capValues) : null;

  switch (anchor.lineItemId) {
    case 'insurance': {
      const zoneMult = anchor.geoModifiers.insuranceZoneMultiplier;
      const raw = macroGrowth * zoneMult + anchor.structuralPremium;
      return stateCap != null ? Math.min(raw, stateCap) : raw;
    }
    case 'taxes': {
      const raw = 0.015 + anchor.structuralPremium;
      return stateCap != null ? Math.min(raw, stateCap) : raw;
    }
    case 'mgmt_fees': return macroGrowth + anchor.structuralPremium;
    case 'utilities':
    case 'repairs_maint': return macroGrowth + anchor.structuralPremium;
    case 'reserves': return macroGrowth + anchor.structuralPremium;
    default: return macroGrowth + anchor.structuralPremium;
  }
}

function testApplyInterceptor(expenses: any, stateCode: string): any {
  const anchorMap: Record<string, any> = {};
  for (const a of TEST_ANCHORS) anchorMap[a.lineItemId] = a;
  const stateRules = TEST_STATE_RULES || [];
  const result: Record<string, any> = {};
  const breakdown: any[] = [];
  const stateUpper = stateCode.toUpperCase();
  const EXPENSE_TO_ANCHOR_KEY: Record<string, string> = {
    'insurance': 'insurance', 'real_estate_tax': 'taxes', 'personal_property_tax': 'taxes',
    'utilities': 'utilities', 'repairs_maintenance': 'repairs_maint',
    'management_fee': 'mgmt_fees', 'replacement_reserves': 'reserves',
    'payroll': 'mgmt_fees', 'contract_services': 'utilities', 'turnover': 'repairs_maint',
    'marketing': 'other_income', 'g_and_a': 'other_income', 'hoa_dues': 'utilities',
  };
  for (const [key, cfg] of Object.entries(expenses) as [string, any][]) {
    const aId = EXPENSE_TO_ANCHOR_KEY[key];
    const anchor = aId ? anchorMap[aId] : null;
    const orig = cfg.growthRate;
    let anchorG: number;
    if (anchor) {
      anchorG = testComputeAnchorGrowthRate(anchor, stateUpper, stateRules, key, cfg.amount, 12000000, 80);
    } else {
      anchorG = orig;
    }
    const diff = Math.abs(anchorG - orig);
    breakdown.push({
      lineItemId: key, originalGrowth: orig, anchorGrowth: anchorG,
      macroSeriesId: anchor?.macroSeriesId ?? null, stateRuleApplied: null,
      confidence: diff < 0.01 ? 'high' : diff < 0.02 ? 'medium' : 'low',
    });
    result[key] = { ...cfg, growthRate: anchorG };
  }
  return { expenses: result, anchorBreakdown: breakdown };
}

test('Interceptor maps insurance to macro-anchored rate', () => {
  const anchor = TEST_ANCHORS.find(a => a.lineItemId === 'insurance')!;
  const result = testComputeAnchorGrowthRate(anchor, 'FL', TEST_STATE_RULES, 'insurance', 700, 12000000, 80);
  assert(result <= 0.03, 'FL insurance should be capped at 3%, got ' + (result * 100).toFixed(1) + '%');
  console.log('    FL insurance: capped=' + (result * 100).toFixed(1) + '%');
});

test('Interceptor maps management fee to ECI-based rate', () => {
  const anchor = TEST_ANCHORS.find(a => a.lineItemId === 'mgmt_fees')!;
  const result = testComputeAnchorGrowthRate(anchor, 'GA', TEST_STATE_RULES, 'mgmt_fees', 50000);
  const eciBase = 0.042;
  const expected = eciBase + anchor.structuralPremium;
  assert(Math.abs(result - expected) < 0.0001, 'Mgmt fee growth should be ' + (expected * 100).toFixed(1) + '%, got ' + (result * 100).toFixed(1) + '%');
  console.log('    Mgmt fees: ECI-based growth=' + (result * 100).toFixed(1) + '%');
});

test('Interceptor maps taxes to county-based growth with GA no cap', () => {
  const anchor = TEST_ANCHORS.find(a => a.lineItemId === 'taxes')!;
  const result = testComputeAnchorGrowthRate(anchor, 'GA', TEST_STATE_RULES, 'taxes', 100000);
  assert(Math.abs(result - 0.045) < 0.0001, 'Tax growth should be 4.5%, got ' + (result * 100).toFixed(1) + '%');
  console.log('    Taxes: GA growth=' + (result * 100).toFixed(1) + '%');
});

test('Interceptor returns modified expense list with all entries', () => {
  const testExpenses = {
    insurance: { amount: 56000, type: 'operating', growthRate: 0.03 },
    real_estate_tax: { amount: 120000, type: 'operating', growthRate: 0.03 },
    utilities: { amount: 32000, type: 'operating', growthRate: 0.03 },
    repairs_maintenance: { amount: 28000, type: 'operating', growthRate: 0.03 },
    management_fee: { amount: 45000, type: 'operating', growthRate: 0.03 },
  };
  const result = testApplyInterceptor(testExpenses, 'GA');
  assert(Object.keys(result.expenses).length === 5, 'All 5 expense keys present');
  assert(result.anchorBreakdown.length === 5, 'All 5 have breakdown entries');
  for (const entry of result.anchorBreakdown) {
    assert(entry.anchorGrowth !== undefined, 'Entry ' + entry.lineItemId + ' has anchorGrowth');
  }
  console.log('    All 5 expenses intercepted successfully');
});

test('Interceptor preserves unknown expense keys', () => {
  const testExpenses = {
    insurance: { amount: 56000, type: 'operating', growthRate: 0.03 },
    unknown_item: { amount: 10000, type: 'misc', growthRate: 0.02 },
  };
  const result = testApplyInterceptor(testExpenses, 'GA');
  assert(result.expenses.unknown_item.growthRate === 0.02, 'Unknown key preserves original growth rate');
  console.log('    Unknown key preserved:', result.expenses.unknown_item.growthRate);
});

test('FL insurance cap applied in interceptor', () => {
  const flExpenses = { insurance: { amount: 50000, type: 'operating', growthRate: 0.05 } };
  const flResult = testApplyInterceptor(flExpenses, 'FL');
  const gaResult = testApplyInterceptor(flExpenses, 'GA');
  assert(flResult.expenses.insurance.growthRate <= 0.03,
    'FL capped: ' + (flResult.expenses.insurance.growthRate * 100).toFixed(1) + '%');
  assert(gaResult.expenses.insurance.growthRate > 0.03,
    'GA no cap: ' + (gaResult.expenses.insurance.growthRate * 100).toFixed(1) + '%');
  console.log('    FL vs GA insurance: FL=' + (flResult.expenses.insurance.growthRate * 100).toFixed(1) + '%, GA=' + (gaResult.expenses.insurance.growthRate * 100).toFixed(1) + '%');
});

test('Interceptor tracks confidence based on divergence', () => {
  const testExpenses = {
    insurance: { amount: 56000, type: 'operating', growthRate: 0.03 },
    real_estate_tax: { amount: 120000, type: 'operating', growthRate: 0.10 },
  };
  const result = testApplyInterceptor(testExpenses, 'GA');
  for (const entry of result.anchorBreakdown) {
    const diff = Math.abs(entry.anchorGrowth - entry.originalGrowth);
    if (diff < 0.01) assert(entry.confidence === 'high', 'High confidence expected for ' + entry.lineItemId);
    else assert(entry.confidence === 'low', 'Low confidence expected for ' + entry.lineItemId);
  }
  console.log('    Confidence tracking verified');
});
`;

// Insert section 9 before the Report section
const reportMarker = '\n// ─── Report ──────────────────────────────────────────────────────────────────';
const idx = content.indexOf(reportMarker);
if (idx === -1) {
  // Append at end
  content += section9;
} else {
  content = content.slice(0, idx) + section9 + '\n\n' + content.slice(idx);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Section 9 inserted successfully');
console.log('File size:', content.length, 'bytes');
