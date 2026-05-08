# Agent Seeder & Prompt Versioning — Side Debt

Logged during the leasing_cost_treatment / #641 chapter close (May 2026).
Items below surfaced during the zoning seeder startup crash investigation.
Do not fix inline — each is a separate scoped task.

Reference: seeder crash post-mortem, May 8 2026.

---

## SDB-01 — Consolidate agent seeders to shared upsertAgentPrompt helper

**Effort:** S  
**Reference:** `backend/src/agents/seeds/` — zoning seeder crash, May 2026

All 5 agent seeders (cashflow, commentary, research, supply, zoning) hand-write
the deactivate-then-insert pattern independently.  Three of the five (zoning,
research, supply) had the operations in the wrong order — INSERT first, deactivate
second — which caused a startup crash when the zoning seeder introduced a new
version id and the existing active row blocked the INSERT via
`idx_prompt_versions_active`.

The structural cause is convention enforced by manual copying rather than a shared
function.  Five hand-written variants with one inverted operation order is the
predictable outcome.

**Fix (when scoped):** Extract a single helper used by all five seeders:

```typescript
// backend/src/agents/seeds/_helpers.ts
export async function upsertAgentPrompt(params: {
  id: string;
  agentId: string;
  version: string;
  promptType: string;
  systemPrompt: string;
  outputSchema: Record<string, unknown>;
}): Promise<void> {
  // 1. Deactivate any current active row for this (agentId, promptType) FIRST.
  //    Must precede the INSERT to satisfy idx_prompt_versions_active.
  await query(
    `UPDATE prompt_versions SET active = false
     WHERE agent_id = $1 AND prompt_type = $2 AND active = true`,
    [params.agentId, params.promptType],
  );
  // 2. Insert new row — idempotent on id, always marks the row active.
  await query(
    `INSERT INTO prompt_versions
       (id, agent_id, version, prompt_type, system_prompt, output_schema,
        active, created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), 'system')
     ON CONFLICT (id) DO UPDATE
       SET system_prompt = $5, output_schema = $6, active = true, updated_at = NOW()`,
    [params.id, params.agentId, params.version, params.promptType,
     params.systemPrompt, JSON.stringify(params.outputSchema)],
  );
}
```

All five seed functions collapse to a single `upsertAgentPrompt(...)` call.
Operation-order divergence becomes structurally impossible.

---

## SDB-02 — Document idx_prompt_versions_active as load-bearing

**Effort:** S  
**Reference:** `backend/src/database/migrations/` — agent prompt versioning migration

`idx_prompt_versions_active` is a **partial unique index** on
`(agent_id, prompt_type) WHERE active = true`.  It is the enforcement layer that
prevents two prompts from being simultaneously active for the same agent — and it
was the reason the zoning seeder crash surfaced immediately rather than silently
corrupting the active-prompt table.

Without this index, a seeder bug (wrong operation order, race condition, double
restart) would silently insert a second active row, causing the runtime's
`WHERE active = true` query to return multiple rows and produce non-deterministic
agent behavior.

**Fix (when scoped):** Add a comment to the migration that created this index
explaining its load-bearing role.  Also reference it in the agent prompt
versioning ADR (queued as #638) so it's never removed as "cleanup":

```sql
-- LOAD-BEARING: this partial unique index enforces the invariant that at most
-- one prompt_versions row is active per (agent_id, prompt_type) at any time.
-- The agent runtime queries WHERE active = true and assumes exactly one result.
-- Removing this index would allow silent data corruption if seeders or operator
-- rollback tooling ever write two active rows simultaneously.
-- See: TODO_F9_SIDE_DEBT.md SDB-02, zoning seeder crash May 2026.
CREATE UNIQUE INDEX idx_prompt_versions_active
  ON prompt_versions (agent_id, prompt_type)
  WHERE active = true;
```

Cross-reference in ADR-003 (agent prompt versioning, #638) alongside the
deactivate-first seeder pattern.
