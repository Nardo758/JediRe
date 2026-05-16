/**
 * Shared upsert helper for all agent prompt seeders.
 *
 * Enforces the canonical deactivate-first, insert-second pattern so
 * operation-order drift across seeders is structurally impossible.
 *
 * Pattern rationale (SDB-01):
 *   idx_prompt_versions_active is a PARTIAL UNIQUE INDEX on
 *   (agent_id, prompt_type) WHERE active = true.  A fresh INSERT with
 *   active = true collides if any row for that (agent_id, prompt_type)
 *   is already active.  The deactivate step must always precede the insert.
 *   See: docs/architecture/ADR-003-cache-stamp-pattern.md (SDB-02 cross-ref),
 *   TODO_F9_SIDE_DEBT.md SDB-01.
 */

import { query } from '../../database/connection';

export interface UpsertAgentPromptParams {
  id: string;
  agentId: string;
  version: string;
  promptType: string;
  systemPrompt: string;
  outputSchema: Record<string, unknown>;
}

/**
 * Upsert a single agent prompt version.
 *
 * Step 1: deactivate any currently-active row for (agentId, promptType).
 * Step 2: insert new row, or update content + re-activate if id already exists.
 *
 * Safe to call on every startup — idempotent on (id).
 */
export async function upsertAgentPrompt(params: UpsertAgentPromptParams): Promise<void> {
  const { id, agentId, version, promptType, systemPrompt, outputSchema } = params;

  // Step 1: deactivate FIRST — satisfies idx_prompt_versions_active constraint.
  await query(
    `UPDATE prompt_versions SET active = false
     WHERE agent_id = $1 AND prompt_type = $2 AND active = true`,
    [agentId, promptType],
  );

  // Step 2: insert new row, or update content + re-activate on id conflict.
  await query(
    `INSERT INTO prompt_versions
       (id, agent_id, version, prompt_type, system_prompt, output_schema,
        active, created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, true, NOW(), 'system')
     ON CONFLICT (id) DO UPDATE
       SET system_prompt  = EXCLUDED.system_prompt,
           output_schema  = EXCLUDED.output_schema,
           version        = EXCLUDED.version,
           active         = true,
           updated_at     = NOW()`,
    [id, agentId, version, promptType, systemPrompt, JSON.stringify(outputSchema)],
  );
}
