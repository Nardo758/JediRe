/**
 * CashFlow Agent Prompt Seed (v4 — Evidence System)
 *
 * Seeds 6 prompt_versions entries for the cashflow agent:
 *   • 1 core prompt    (prompt_type: 'core')
 *   • 5 variant prompts (prompt_type: 'variant:existing', 'variant:value-add', etc.)
 *
 * Idempotent — safe to call on every agent run startup.
 * The new prompt_type column (added in 20260419_cashflow_evidence.sql) allows one
 * active row per (agent_id, prompt_type), enabling multi-variant prompts.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { CashflowOutputSchema } from '../cashflow.config';
import { CASHFLOW_SYSTEM_PROMPT } from '../prompts/cashflow/system';
import { CASHFLOW_OUTPUT_SCHEMA } from '../prompts/cashflow/output-schema';
import { CASHFLOW_VARIANT_EXISTING } from '../prompts/cashflow/variants/existing';
import { CASHFLOW_VARIANT_VALUE_ADD } from '../prompts/cashflow/variants/value-add';
import { CASHFLOW_VARIANT_LEASE_UP } from '../prompts/cashflow/variants/lease-up';
import { CASHFLOW_VARIANT_DEVELOPMENT } from '../prompts/cashflow/variants/development';
import { CASHFLOW_VARIANT_REDEVELOPMENT } from '../prompts/cashflow/variants/redevelopment';
import { z } from 'zod';

const LEGACY_OUTPUT_SCHEMA_JSON = (() => {
  return z.toJSONSchema(CashflowOutputSchema) as Record<string, unknown>;
})();

const EVIDENCE_PROMPTS: Array<{
  id: string;
  promptType: string;
  version: string;
  systemPrompt: string;
}> = [
  {
    id: 'cashflow-v4-core',
    promptType: 'core',
    version: '4.0.0',
    systemPrompt: CASHFLOW_SYSTEM_PROMPT,
  },
  {
    id: 'cashflow-v4-variant-existing',
    promptType: 'variant:existing',
    version: '4.0.0',
    systemPrompt: CASHFLOW_VARIANT_EXISTING,
  },
  {
    id: 'cashflow-v4-variant-value-add',
    promptType: 'variant:value-add',
    version: '4.0.0',
    systemPrompt: CASHFLOW_VARIANT_VALUE_ADD,
  },
  {
    id: 'cashflow-v4-variant-lease-up',
    promptType: 'variant:lease-up',
    version: '4.0.0',
    systemPrompt: CASHFLOW_VARIANT_LEASE_UP,
  },
  {
    id: 'cashflow-v4-variant-development',
    promptType: 'variant:development',
    version: '4.0.0',
    systemPrompt: CASHFLOW_VARIANT_DEVELOPMENT,
  },
  {
    id: 'cashflow-v4-variant-redevelopment',
    promptType: 'variant:redevelopment',
    version: '4.0.0',
    systemPrompt: CASHFLOW_VARIANT_REDEVELOPMENT,
  },
];

export async function seedCashflowPrompt(): Promise<void> {
  // ON CONFLICT DO NOTHING: existing prompt rows are never overwritten on restart.
  // Preserves any operator rollback (active-flag flip) across process restarts.
  // Initial inserts set active=true so agents are ready on first deploy.
  const upcomingIds = EVIDENCE_PROMPTS.map(p => p.id);

  for (const p of EVIDENCE_PROMPTS) {
    await query(
      `INSERT INTO prompt_versions
         (id, agent_id, version, prompt_type, system_prompt, output_schema, tools, active, created_at, created_by)
       VALUES
         ($1, 'cashflow', $2, $3, $4, $5, '[]'::jsonb, true, NOW(), 'system')
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id,
        p.version,
        p.promptType,
        p.systemPrompt,
        JSON.stringify(
          p.promptType === 'core' ? CASHFLOW_OUTPUT_SCHEMA : LEGACY_OUTPUT_SCHEMA_JSON
        ),
      ]
    );
  }

  logger.info('CashFlow Agent prompts seeded (v4 evidence system)', {
    count: EVIDENCE_PROMPTS.length,
    ids: upcomingIds,
  });
}
