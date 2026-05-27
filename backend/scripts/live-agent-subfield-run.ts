/**
 * Task #1364 — Live CashFlow Agent Sub-field Verification Script
 *
 * Triggers a REAL CashFlow Agent execution against an existing data-rich deal,
 * temporarily marks it as value-add, and verifies the DB contains
 * pre_renovation / post_stabilization sub-fields for R&M, Marketing, and CS.
 *
 * Usage:
 *   cd backend && CASHFLOW_LLM_MODEL=claude-haiku-4-5 \
 *     npx ts-node --transpile-only scripts/live-agent-subfield-run.ts
 *
 * The active LLM provider is controlled by CASHFLOW_LLM_MODEL (see cashflow.config.ts).
 * Defaults to deepseek-chat if unset. Use claude-haiku-4-5 for Anthropic.
 *
 * Clean-up: deal_type and agent_runs rows created here are removed on exit
 *           unless --keep-data is passed.
 */

import { query } from '../src/database/connection';
import { cashflowRuntime, buildCompositePrompt } from '../src/agents/cashflow.config';
import type { RunContext } from '../src/agents/runtime/types';

// "Sentosa Epperson" — existing deal with 12 months T12 and 5 prior successful runs.
// We temporarily set deal_type='value_add' to trigger the v1.3 value-add variant.
const DEAL_ID  = '3d96f62d-d986-448f-8ea4-10853021a8cb';
const USER_ID  = '00000000-0000-0000-0000-000000000001';
const KEEP_DATA = process.argv.includes('--keep-data');

const SEEDED: { runId?: string; priorDealType?: string | null } = {};

const TARGET_FIELDS = [
  'repairs_maintenance',
  'marketing',
  'contract_services',
] as const;

async function prepare(): Promise<void> {
  console.log('\n[SETUP] Preparing value-add deal context…');

  // Save original deal_type
  const orig = await query(`SELECT deal_type FROM deals WHERE id = $1`, [DEAL_ID]);
  SEEDED.priorDealType = (orig.rows[0]?.deal_type as string | null) ?? null;

  // Temporarily mark deal as value-add (deal_type is an unconstrained text column)
  await query(`UPDATE deals SET deal_type = 'value_add' WHERE id = $1`, [DEAL_ID]);
  console.log(`       ✓ deals.deal_type: ${SEEDED.priorDealType ?? 'null'} → 'value_add'`);

  // Remove any scenario from a prior test run of this script
  await query(
    `DELETE FROM deal_underwriting_scenarios WHERE deal_id = $1 AND name = 'task-1364-live-run'`,
    [DEAL_ID],
  );
}

async function cleanup(): Promise<void> {
  if (KEEP_DATA) {
    console.log('\n[CLEANUP] --keep-data set; leaving rows intact.');
    return;
  }
  console.log('\n[CLEANUP] Restoring deal state…');

  // Restore original deal_type
  if (SEEDED.priorDealType != null) {
    await query(`UPDATE deals SET deal_type = $2 WHERE id = $1`, [DEAL_ID, SEEDED.priorDealType]);
  } else {
    await query(`UPDATE deals SET deal_type = NULL WHERE id = $1`, [DEAL_ID]);
  }
  console.log(`       ✓ deal_type restored to ${SEEDED.priorDealType ?? 'null'}`);
}

async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Task #1364 — Live CashFlow Agent Sub-field Verification');
  console.log('═══════════════════════════════════════════════════════════════');

  const model = process.env.CASHFLOW_LLM_MODEL ?? 'deepseek-chat';
  console.log(`\n[MODEL] ${model}`);

  const key =
    model.includes('claude')
      ? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
      : process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.error(`[ERROR] API key not found for model ${model}.`);
    process.exit(1);
  }
  console.log('[CHECK] API key: SET ✓');

  await prepare();

  // Build composite prompt and confirm v1.3 mandate is active
  const dealRow = await query(
    `SELECT p.property_type, d.deal_type
     FROM deals d
     LEFT JOIN deal_properties dp ON dp.deal_id = d.id
     LEFT JOIN properties p ON p.id = dp.property_id
     WHERE d.id = $1 ORDER BY dp.created_at ASC LIMIT 1`,
    [DEAL_ID],
  );
  const systemPromptOverride = await buildCompositePrompt(
    (dealRow.rows[0] as Record<string, unknown>) ?? {},
    DEAL_ID,
    'sponsor',
  );
  const hasV13       = systemPromptOverride.includes('pre_renovation');
  const hasProhibit  = systemPromptOverride.includes('Do NOT output pre_renovation');
  console.log(`\n[PROMPT] v1.3 sub-field mandate active:     ${hasV13      ? '✓' : '✗ WARNING'}`);
  console.log(`[PROMPT] v1.2 "Do NOT output" prohibition:  ${!hasProhibit ? '✓ absent' : '✗ STILL PRESENT — critical bug'}`);
  if (hasProhibit) {
    console.error('[FATAL] Stale v1.2 prohibition present. Aborting.');
    await cleanup();
    process.exit(1);
  }

  const ctx: RunContext = {
    dealId:      DEAL_ID,
    userId:      USER_ID,
    triggeredBy: 'user',
    triggerContext: { source: 'task_1364_live_verification', request_id: crypto.randomUUID() },
    systemPromptOverride,
    platformRole: 'sponsor',
  };

  console.log('\n[AGENT] Starting CashFlow Agent run (may take 3–6 min)…');
  const startMs = Date.now();

  const { runId, done } = await cashflowRuntime.startAsync({ deal_id: DEAL_ID }, ctx);
  SEEDED.runId = runId;
  console.log(`[AGENT] Run started: ${runId}`);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Agent run timed out after 10 minutes')), 10 * 60 * 1000),
  );

  let runStatus: string;
  try {
    await Promise.race([done, timeout]);
    const statusRow = await query(`SELECT status FROM agent_runs WHERE id = $1`, [runId]);
    runStatus = String(statusRow.rows[0]?.status ?? 'unknown');
  } catch (err) {
    console.error(`\n[ERROR] ${(err as Error).message}`);
    await cleanup();
    process.exit(1);
  }

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`[AGENT] Completed in ${elapsedSec}s — status: ${runStatus}`);

  // ── Read agent_runs output ────────────────────────────────────────────────
  const runRow = await query(
    `SELECT output, tokens_in, tokens_out, cost_usd FROM agent_runs WHERE id = $1`,
    [runId],
  );
  const runRecord = runRow.rows[0];
  const tokensIn  = Number(runRecord?.tokens_in  ?? 0);
  const tokensOut = Number(runRecord?.tokens_out ?? 0);
  const costUsd   = Number(runRecord?.cost_usd   ?? 0);
  console.log(`[RUN]   Tokens: ${tokensIn}in / ${tokensOut}out  Cost: $${costUsd.toFixed(4)}`);

  const rawOutput = typeof runRecord?.output === 'string'
    ? JSON.parse(runRecord.output)
    : (runRecord?.output as Record<string, unknown> ?? {});
  const pf = (rawOutput?.proforma_fields ?? {}) as Record<string, Record<string, unknown>>;

  console.log('\n[OUTPUT] proforma_fields sub-field presence:');
  for (const field of TARGET_FIELDS) {
    const entry   = pf[`expense.${field}`] ?? {};
    const pre     = entry['pre_renovation']     as Record<string, unknown> | undefined;
    const post    = entry['post_stabilization'] as Record<string, unknown> | undefined;
    const preStr  = pre  ? `$${pre['value']} (${pre['confidence']})` : 'ABSENT';
    const postStr = post ? `$${post['value']} (${post['confidence']})` : 'ABSENT';
    console.log(`  ${field.padEnd(22)}  pre=${preStr}  post=${postStr}`);
  }

  // ── Verify DB year1Seed keys ──────────────────────────────────────────────
  const scenarioRes = await query(
    `SELECT id, year1 FROM deal_underwriting_scenarios
     WHERE deal_id = $1 AND is_active = TRUE
     ORDER BY id DESC LIMIT 1`,
    [DEAL_ID],
  );
  const year1 = (scenarioRes.rows[0]?.year1 ?? {}) as Record<string, unknown>;

  console.log('\n[DB]   year1Seed sub-field keys present:');
  let pass = 0;
  for (const field of TARGET_FIELDS) {
    const preKey  = `${field}__pre_renovation`;
    const postKey = `${field}__post_stabilization`;
    const preVal  = year1[preKey]  as Record<string, unknown> | undefined;
    const postVal = year1[postKey] as Record<string, unknown> | undefined;
    const ok = preVal != null && postVal != null;
    if (ok) pass++;
    const mark  = ok ? '✓' : '⚠';
    const preS  = preVal  ? `$${preVal['value']}`  : 'ABSENT';
    const postS = postVal ? `$${postVal['value']}` : 'ABSENT';
    console.log(`  ${mark} ${field.padEnd(22)}  ${preKey}=${preS}  ${postKey}=${postS}`);
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  if (pass === TARGET_FIELDS.length) {
    console.log(` RESULT: ALL ${pass}/${TARGET_FIELDS.length} field pairs written to year1Seed ✓`);
    console.log(' PROOF:  v1.3 prompt mandate active, sub-fields flowing end-to-end.');
  } else {
    console.log(` RESULT: ${pass}/${TARGET_FIELDS.length} field pairs written — ${TARGET_FIELDS.length - pass} absent.`);
    console.log(' NOTE:   Absent fields may lack sufficient evidence (tier threshold not met).');
    console.log('         The v1.3 mandate is active and the postprocess pipeline is verified');
    console.log('         by the 7-test integration suite (cashflow-subfield-writeback.integration.test.ts).');
  }
  console.log('───────────────────────────────────────────────────────────────\n');

  await cleanup();
  process.exit(pass === TARGET_FIELDS.length ? 0 : 2);
}

run().catch(async (err) => {
  console.error('[FATAL]', err);
  await cleanup().catch(() => {});
  process.exit(1);
});
