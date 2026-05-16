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
import { upsertAgentPrompt } from './_helpers';

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
    id: 'cashflow-v8.0-core',
    promptType: 'core',
    version: '5.2.0',
    systemPrompt: CASHFLOW_SYSTEM_PROMPT,
  },
  {
    id: 'cashflow-v7.1-variant-existing',
    promptType: 'variant:existing',
    version: '4.1.0',
    systemPrompt: CASHFLOW_VARIANT_EXISTING,
  },
  {
    id: 'cashflow-v7.1-variant-value-add',
    promptType: 'variant:value-add',
    version: '4.1.0',
    systemPrompt: CASHFLOW_VARIANT_VALUE_ADD,
  },
  {
    id: 'cashflow-v7.1-variant-lease-up',
    promptType: 'variant:lease-up',
    version: '4.1.0',
    systemPrompt: CASHFLOW_VARIANT_LEASE_UP,
  },
  {
    id: 'cashflow-v7.1-variant-development',
    promptType: 'variant:development',
    version: '4.1.0',
    systemPrompt: CASHFLOW_VARIANT_DEVELOPMENT,
  },
  {
    id: 'cashflow-v7.1-variant-redevelopment',
    promptType: 'variant:redevelopment',
    version: '4.1.0',
    systemPrompt: CASHFLOW_VARIANT_REDEVELOPMENT,
  },
];

export async function seedCashflowPrompt(): Promise<void> {
  for (const p of EVIDENCE_PROMPTS) {
    await upsertAgentPrompt({
      id: p.id,
      agentId: 'cashflow',
      version: p.version,
      promptType: p.promptType,
      systemPrompt: p.systemPrompt,
      outputSchema: p.promptType === 'core' ? CASHFLOW_OUTPUT_SCHEMA : LEGACY_OUTPUT_SCHEMA_JSON,
    });
  }

  logger.info('CashFlow Agent prompts seeded (v8.0 — pricing power posture framework, prompt-spec v4.0 / agent-version v5.2.0)', {
    count: EVIDENCE_PROMPTS.length,
    ids: EVIDENCE_PROMPTS.map(p => p.id),
  });
}
