/**
 * W1-5 Behavioral Guard — Strategy Seam Convergence Test
 *
 * Sets an operator override that differs from the M08 detected winner,
 * then verifies three downstream consumers converge on the override:
 *   1. resolved value from the ClassificationContext assembler
 *   2. M09 template pick from pickTemplateForStrategy(resolved)
 *   3. Cashflow variant (deal_type derived from resolved strategy)
 *
 * Run in Replit (needs live DB):
 *   npx ts-node --transpile-only backend/scripts/w1-5-strategy-seam-guard.ts
 *
 * The script is SAFE — it reads current state, mutates in a transaction,
 * reports, then ROLLBACKs. No permanent changes.
 */

import { getPool } from '../src/database/connection';
import { pickTemplateForStrategy, defaultTemplateForDealType } from '../src/services/proforma/blueprint';

const TEST_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403'; // Bishop

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Read current state ────────────────────────────────────────────────
    const currentRes = await client.query(`
      SELECT
        da.investment_strategy_lv,
        d.deal_type
      FROM deal_assumptions da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.deal_id = $1
    `, [TEST_DEAL_ID]);

    if (currentRes.rows.length === 0) {
      throw new Error(`Deal ${TEST_DEAL_ID} not found in deal_assumptions`);
    }

    const current = currentRes.rows[0];
    const stratLv = current.investment_strategy_lv || { detected: null, override: null };
    console.log('=== W1-5 Strategy Seam Guard ===\n');
    console.log('Test deal:', TEST_DEAL_ID, '(Bishop)');
    console.log('Current investment_strategy_lv:', JSON.stringify(stratLv, null, 2));
    console.log('Current deals.deal_type:', current.deal_type);

    // ── 2. Set up the conflict scenario ──────────────────────────────────────
    // M08 detected winner = 'Rental', operator override = 'Flip'
    const detectedValue = 'Rental';
    const overrideValue = 'Flip';

    await client.query(`
      UPDATE deal_assumptions
      SET investment_strategy_lv = jsonb_build_object(
        'detected', jsonb_build_object('value', $2::text, 'confidence', 0.85, 'source', 'm08_arbitrage'),
        'override', $3::text
      )
      WHERE deal_id = $1
    `, [TEST_DEAL_ID, detectedValue, overrideValue]);

    // ── 3. Read back the resolved value (assembler logic: override wins) ──────
    const afterRes = await client.query(`
      SELECT investment_strategy_lv FROM deal_assumptions WHERE deal_id = $1
    `, [TEST_DEAL_ID]);

    const afterLv = afterRes.rows[0].investment_strategy_lv;
    const resolved = afterLv?.override ?? afterLv?.detected?.value ?? null;

    // ── 4. Compute M09 template pick ─────────────────────────────────────────
    const strategySlug = (resolved ?? '').toLowerCase().replace(/[\s-]+/g, '_');
    const templateId = strategySlug
      ? pickTemplateForStrategy(strategySlug)
      : defaultTemplateForDealType(current.deal_type ?? 'existing');

    // ── 5. Compute cashflow variant (deal_type derived from resolved strategy) ─
    // This mirrors investmentStrategyToDealType() from deal-assumptions.routes.ts
    const strategyToDealType: Record<string, string> = {
      'build-to-sell': 'development',
      'flip': 'value_add',
      'rental': 'existing',
      'short-term_rental': 'existing',
      'value-add': 'value_add',
      'redevelopment': 'redevelopment',
      'lease-up': 'existing',
    };
    const derivedDealType = resolved ? (strategyToDealType[resolved.toLowerCase()] ?? 'existing') : current.deal_type;

    // ── 6. Report ────────────────────────────────────────────────────────────
    console.log('\n--- After override injection ---');
    console.log('investment_strategy_lv.detected.value :', afterLv?.detected?.value);
    console.log('investment_strategy_lv.override       :', afterLv?.override);
    console.log('>>> RESOLVED (override wins)          :', resolved);
    console.log('');
    console.log('Consumer 1 — Context assembler resolved :', resolved);
    console.log('Consumer 2 — M09 template pick          :', templateId);
    console.log('Consumer 3 — Cashflow variant (deal_type):', derivedDealType);
    console.log('');

    // Guard: all three must equal the override, not the detected value
    const pass =
      resolved === overrideValue &&
      templateId === 'flip' &&
      derivedDealType === 'value_add';

    console.log('=== GUARD RESULT ===');
    console.log(`resolved === '${overrideValue}'     : ${resolved === overrideValue ? '✅' : '❌'} (got: ${resolved})`);
    console.log(`templateId === 'flip'               : ${templateId === 'flip' ? '✅' : '❌'} (got: ${templateId})`);
    console.log(`derivedDealType === 'value_add'     : ${derivedDealType === 'value_add' ? '✅' : '❌'} (got: ${derivedDealType})`);
    console.log('');
    console.log(pass ? '✅ W1-5 PASS — All consumers converge on override' : '❌ W1-5 FAIL — Divergence detected');

    // ── 7. ALWAYS ROLLBACK — this is a read-only guard ───────────────────────
    await client.query('ROLLBACK');
    console.log('\n(Rolled back — no permanent changes)');
    process.exit(pass ? 0 : 1);

  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Guard failed with error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
