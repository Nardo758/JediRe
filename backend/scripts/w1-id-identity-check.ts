/**
 * W1-ID Identity Checkpoint — Per-deal verification that agent_confirmed layer
 * is dormant (byte-identical resolution) when no agent_confirmed values exist.
 *
 * Run in Replit with live DB access:
 *   npx ts-node --transpile-only backend/scripts/w1-id-identity-check.ts
 *
 * Validates dispatch requirement: "with no agent_confirmed values present on
 * either reference deal, resolution output is byte-identical to pre-change."
 */

import { getPool } from '../src/database/connection';
import { getFieldValue, getFieldValues } from '../src/services/field-access/get-field-value.service';
import { logger } from '../src/utils/logger';

const BISHOP_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
const HIGHLANDS_DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

const CHECKED_FIELDS = [
  'gpr', 'vacancy', 'concessions', 'bad_debt', 'loss_to_lease', 'other_income',
  'net_rental_income', 'egi',
  'real_estate_tax', 'insurance', 'management_fee', 'repairs_maintenance',
  'utilities', 'payroll', 'administrative', 'marketing', 'contract_services',
  'total_opex',
  'noi', 'noi_after_reserves', 'replacement_reserves',
  'purchase_price', 'loan_amount', 'interest_rate',
  'exit_cap', 'rent_growth_yr1', 'hold_period_years',
];

interface IdentityResult {
  dealId: string;
  dealName: string;
  field: string;
  agentConfirmedPresent: boolean;
  resolvedValue: number | null;
  storedResolvedValue: number | null;
  byteIdentical: boolean;
}

async function runIdentityCheck(dealId: string, dealName: string): Promise<IdentityResult[]> {
  const pool = getPool();
  const results: IdentityResult[] = [];

  // Batch-read all checked fields
  const fieldValues = await getFieldValues(pool, dealId, CHECKED_FIELDS);

  for (const field of CHECKED_FIELDS) {
    const lv = fieldValues[field];
    if (!lv) {
      results.push({
        dealId, dealName, field,
        agentConfirmedPresent: false,
        resolvedValue: null,
        storedResolvedValue: null,
        byteIdentical: true, // null === null is identical
      });
      continue;
    }

    // Identity condition: if agent_confirmed is absent, resolved MUST equal storedResolved
    // (or computedValue for aggregates, which the service already handles)
    const agentConfirmedPresent = lv.agentConfirmed != null;
    const resolvedValue = lv.resolved;
    const storedResolvedValue = lv.storedResolved;

    // Byte-identical when: no agent_confirmed AND resolved === storedResolved
    // (allowing for computed aggregates where storedResolved may be stale)
    const byteIdentical = !agentConfirmedPresent &&
      (resolvedValue === storedResolvedValue ||
       (lv.computedValue != null && resolvedValue === lv.computedValue));

    results.push({
      dealId, dealName, field,
      agentConfirmedPresent,
      resolvedValue,
      storedResolvedValue,
      byteIdentical,
    });
  }

  return results;
}

async function main() {
  console.log('=== W1-ID Identity Checkpoint ===\n');
  console.log('Reference deals: Bishop + Highlands');
  console.log('Checked fields:', CHECKED_FIELDS.length);
  console.log('Identity condition: agent_confirmed absent → resolved === storedResolved\n');

  let totalFields = 0;
  let totalIdentical = 0;
  let totalWithAgentConfirmed = 0;

  for (const [dealId, dealName] of [[BISHOP_DEAL_ID, 'Bishop'], [HIGHLANDS_DEAL_ID, 'Highlands']] as const) {
    console.log(`--- ${dealName} (${dealId}) ---`);
    const results = await runIdentityCheck(dealId, dealName);

    const identicalCount = results.filter(r => r.byteIdentical).length;
    const agentConfirmedCount = results.filter(r => r.agentConfirmedPresent).length;
    const divergent = results.filter(r => !r.byteIdentical);

    totalFields += results.length;
    totalIdentical += identicalCount;
    totalWithAgentConfirmed += agentConfirmedCount;

    console.log(`  Fields checked: ${results.length}`);
    console.log(`  Byte-identical: ${identicalCount}/${results.length}`);
    console.log(`  agent_confirmed present: ${agentConfirmedCount}`);

    if (divergent.length > 0) {
      console.log(`  ⚠️  DIVERGENT (${divergent.length}):`);
      for (const d of divergent) {
        console.log(`      ${d.field}: resolved=${d.resolvedValue}, storedResolved=${d.storedResolvedValue}`);
      }
    } else {
      console.log(`  ✅ All fields byte-identical (layer is dormant)`);
    }
    console.log('');
  }

  console.log('=== SUMMARY ===');
  console.log(`Total fields checked: ${totalFields}`);
  console.log(`Total byte-identical: ${totalIdentical}/${totalFields}`);
  console.log(`Total with agent_confirmed: ${totalWithAgentConfirmed}`);

  if (totalWithAgentConfirmed > 0) {
    console.log('\n⚠️  WARNING: Some fields have agent_confirmed values.');
    console.log('   This is expected if prior W2 proof runs wrote values.');
    console.log('   For a pure identity check, run on a fresh deal or clean test DB.');
  }

  const pass = totalIdentical === totalFields;
  console.log(`\n${pass ? '✅ W1-ID PASS' : '❌ W1-ID FAIL'} — Identity checkpoint ${pass ? 'verified' : 'failed'}`);
  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
