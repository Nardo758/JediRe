/**
 * Underwriting Scenarios Service — M40 Phase 1
 *
 * Named, attributed, versioned underwriting states for deal_assumptions.year1.
 * Each scenario is a self-contained copy of year1.  The active scenario is
 * mirrored to deal_assumptions.year1 via a PostgreSQL trigger so existing code
 * that reads from deal_assumptions continues to work unchanged.
 *
 * Table: deal_underwriting_scenarios
 * API:   /api/v1/deals/:dealId/underwriting-scenarios
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UWScenario {
  id: string;
  deal_id: string;
  name: string;
  description: string | null;
  created_by: 'agent' | 'user';
  created_by_user_id: string | null;
  created_by_agent_run_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  is_active: boolean;
  parent_id: string | null;
  primary_snapshot_id: string | null;
  year1: Record<string, unknown>;
  ci_findings: Record<string, unknown>[] | null;
  tags: string[] | null;
  notes: string | null;
}

export interface CreateScenarioInput {
  name: string;
  description?: string | null;
  tags?: string[] | null;
  source_scenario_id?: string | null;
}

export interface UpdateScenarioMetaInput {
  name?: string;
  description?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export interface FieldDiff {
  field_path: string;
  scenario_a_value: number | null;
  scenario_b_value: number | null;
  delta_absolute: number;
  delta_pct: number | null;
  resolution_a: string;
  resolution_b: string;
  significance: 'major' | 'minor' | 'trivial';
}

export interface ScenarioDiff {
  scenario_a_id: string;
  scenario_b_id: string;
  computed_at: string;
  field_diffs: FieldDiff[];
  summary: {
    fields_with_changes: number;
    fields_unchanged: number;
    materially_different: number;
    a_higher: number;
    a_lower: number;
  };
}

// ── In-memory diff cache (1-hour TTL) ─────────────────────────────────────

interface CacheEntry {
  diff: ScenarioDiff;
  expires_at: number;
}
const diffCache = new Map<string, CacheEntry>();

function diffCacheKey(aId: string, bId: string): string {
  return [aId, bId].sort().join('|');
}

// ── Service ────────────────────────────────────────────────────────────────

export class UWScenarioService {
  private pool = getPool();

  // ── Query helpers ────────────────────────────────────────────────────────

  private async assertOwner(dealId: string, userId: string): Promise<void> {
    const r = await this.pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );
    if (r.rows.length === 0) {
      throw Object.assign(new Error('Deal not found or not authorized'), { statusCode: 403 });
    }
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  async listScenarios(
    dealId: string,
    filters: { status?: 'active' | 'archived'; created_by?: 'agent' | 'user' } = {}
  ): Promise<UWScenario[]> {
    const conditions: string[] = ['deal_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [dealId];

    if (filters.status === 'active') {
      conditions.push('archived_at IS NULL');
    } else if (filters.status === 'archived') {
      conditions.push('archived_at IS NOT NULL');
    }
    if (filters.created_by) {
      params.push(filters.created_by);
      conditions.push(`created_by = $${params.length}`);
    }

    const r = await this.pool.query<UWScenario>(
      `SELECT * FROM deal_underwriting_scenarios
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC`,
      params
    );
    return r.rows;
  }

  async getScenario(dealId: string, scenarioId: string): Promise<UWScenario | null> {
    const r = await this.pool.query<UWScenario>(
      `SELECT * FROM deal_underwriting_scenarios
        WHERE id = $1 AND deal_id = $2 AND deleted_at IS NULL`,
      [scenarioId, dealId]
    );
    return r.rows[0] ?? null;
  }

  async getActiveScenario(dealId: string): Promise<UWScenario | null> {
    const r = await this.pool.query<UWScenario>(
      `SELECT * FROM deal_underwriting_scenarios
        WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [dealId]
    );
    return r.rows[0] ?? null;
  }

  // ── Write ────────────────────────────────────────────────────────────────

  /**
   * Fork an existing scenario (or the active one) into a new named scenario.
   * The new scenario is NOT activated — the caller must activate explicitly.
   */
  async createScenario(
    dealId: string,
    userId: string,
    input: CreateScenarioInput
  ): Promise<UWScenario> {
    const sourceId = input.source_scenario_id ?? null;

    let sourceYear1: Record<string, unknown> = {};
    let parentId: string | null = null;

    if (sourceId) {
      const src = await this.getScenario(dealId, sourceId);
      if (!src) throw Object.assign(new Error('Source scenario not found'), { statusCode: 404 });
      sourceYear1 = src.year1;
      parentId = src.id;
    } else {
      const active = await this.getActiveScenario(dealId);
      if (active) {
        sourceYear1 = active.year1;
        parentId = active.id;
      }
    }

    const r = await this.pool.query<UWScenario>(
      `INSERT INTO deal_underwriting_scenarios
         (deal_id, name, description, created_by, created_by_user_id,
          is_active, parent_id, year1, tags)
       VALUES ($1, $2, $3, 'user', $4, FALSE, $5, $6::jsonb, $7)
       RETURNING *`,
      [
        dealId,
        input.name,
        input.description ?? null,
        userId,
        parentId,
        JSON.stringify(sourceYear1),
        input.tags ?? null,
      ]
    );
    return r.rows[0];
  }

  /**
   * Make this scenario the active one.
   * Deactivates the prior active scenario in the same UPDATE statement
   * to avoid momentarily violating the unique partial index.
   * The trigger fires for the newly-active row and syncs deal_assumptions.year1.
   */
  async activateScenario(
    dealId: string,
    scenarioId: string,
    userId: string
  ): Promise<UWScenario> {
    await this.assertOwner(dealId, userId);

    const target = await this.getScenario(dealId, scenarioId);
    if (!target) throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
    if (target.archived_at) throw Object.assign(new Error('Cannot activate an archived scenario'), { statusCode: 400 });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Deactivate current active scenario for this deal (if any)
      await client.query(
        `UPDATE deal_underwriting_scenarios
            SET is_active = FALSE, updated_at = NOW()
          WHERE deal_id = $1 AND is_active = TRUE AND id != $2`,
        [dealId, scenarioId]
      );

      // Activate the target — trigger fires and syncs deal_assumptions.year1
      const r = await client.query<UWScenario>(
        `UPDATE deal_underwriting_scenarios
            SET is_active = TRUE, updated_at = NOW()
          WHERE id = $1 AND deal_id = $2
          RETURNING *`,
        [scenarioId, dealId]
      );

      await client.query('COMMIT');
      return r.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** Update display metadata only — does NOT modify year1. */
  async updateMeta(
    dealId: string,
    scenarioId: string,
    input: UpdateScenarioMetaInput
  ): Promise<UWScenario> {
    const sets: string[] = [];
    const params: unknown[] = [scenarioId, dealId];

    if (input.name !== undefined) {
      params.push(input.name);
      sets.push(`name = $${params.length}`);
    }
    if (input.description !== undefined) {
      params.push(input.description);
      sets.push(`description = $${params.length}`);
    }
    if (input.tags !== undefined) {
      params.push(input.tags);
      sets.push(`tags = $${params.length}`);
    }
    if (input.notes !== undefined) {
      params.push(input.notes);
      sets.push(`notes = $${params.length}`);
    }

    if (sets.length === 0) throw new Error('No fields to update');
    sets.push('updated_at = NOW()');

    const r = await this.pool.query<UWScenario>(
      `UPDATE deal_underwriting_scenarios
          SET ${sets.join(', ')}
        WHERE id = $1 AND deal_id = $2 AND deleted_at IS NULL
        RETURNING *`,
      params
    );
    if (r.rows.length === 0) throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
    return r.rows[0];
  }

  async archiveScenario(dealId: string, scenarioId: string): Promise<UWScenario> {
    const r = await this.pool.query<UWScenario>(
      `UPDATE deal_underwriting_scenarios
          SET archived_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deal_id = $2 AND deleted_at IS NULL
        RETURNING *`,
      [scenarioId, dealId]
    );
    if (r.rows.length === 0) throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
    return r.rows[0];
  }

  async restoreScenario(dealId: string, scenarioId: string): Promise<UWScenario> {
    const r = await this.pool.query<UWScenario>(
      `UPDATE deal_underwriting_scenarios
          SET archived_at = NULL, updated_at = NOW()
        WHERE id = $1 AND deal_id = $2 AND deleted_at IS NULL
        RETURNING *`,
      [scenarioId, dealId]
    );
    if (r.rows.length === 0) throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
    return r.rows[0];
  }

  /**
   * Soft-delete a scenario.
   * Guards: cannot delete the active scenario; cannot delete the only scenario.
   */
  async deleteScenario(dealId: string, scenarioId: string): Promise<void> {
    const scenario = await this.getScenario(dealId, scenarioId);
    if (!scenario) throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
    if (scenario.is_active) {
      throw Object.assign(
        new Error('Cannot delete the active scenario — activate another scenario first'),
        { statusCode: 400 }
      );
    }

    const countR = await this.pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM deal_underwriting_scenarios
        WHERE deal_id = $1 AND deleted_at IS NULL`,
      [dealId]
    );
    if (parseInt(countR.rows[0].cnt, 10) <= 1) {
      throw Object.assign(
        new Error('Cannot delete the only remaining scenario for this deal'),
        { statusCode: 400 }
      );
    }

    await this.pool.query(
      `UPDATE deal_underwriting_scenarios
          SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deal_id = $2`,
      [scenarioId, dealId]
    );
  }

  // ── CIE findings ───────────────────────────────────────────────────────────

  /**
   * M40 Phase 4 — Write CIE findings to a scenario.
   * Called by the CIE post-pass after it completes analysis.
   * The sponsor_state on each finding is preserved (upsert logic).
   */
  async updateCieFindings(
    dealId: string,
    scenarioId: string,
    findings: Record<string, unknown>[]
  ): Promise<UWScenario> {
    const r = await this.pool.query<UWScenario>(
      `UPDATE deal_underwriting_scenarios
          SET ci_findings = $3::jsonb,
              updated_at = NOW()
        WHERE id = $1 AND deal_id = $2 AND deleted_at IS NULL
        RETURNING *`,
      [scenarioId, dealId, JSON.stringify(findings)]
    );
    if (r.rows.length === 0) throw Object.assign(new Error('Scenario not found'), { statusCode: 404 });
    return r.rows[0];
  }

  // ── Diff computation ─────────────────────────────────────────────────────

  /**
   * Compute a field-by-field diff between two scenarios.
   * Result is cached for 1 hour per scenario pair.
   */
  async computeDiff(
    dealId: string,
    scenarioAId: string,
    scenarioBId: string
  ): Promise<ScenarioDiff> {
    const cacheKey = diffCacheKey(scenarioAId, scenarioBId);
    const cached = diffCache.get(cacheKey);
    if (cached && cached.expires_at > Date.now()) return cached.diff;

    const [a, b] = await Promise.all([
      this.getScenario(dealId, scenarioAId),
      this.getScenario(dealId, scenarioBId),
    ]);
    if (!a) throw Object.assign(new Error(`Scenario A not found: ${scenarioAId}`), { statusCode: 404 });
    if (!b) throw Object.assign(new Error(`Scenario B not found: ${scenarioBId}`), { statusCode: 404 });

    const fieldDiffs = computeYear1Diff(scenarioAId, scenarioBId, a.year1, b.year1);

    const summary = {
      fields_with_changes:  fieldDiffs.length,
      fields_unchanged:     0,  // populated below
      materially_different: fieldDiffs.filter(f => f.significance === 'major').length,
      a_higher:             fieldDiffs.filter(f => (f.delta_absolute) < 0).length,
      a_lower:              fieldDiffs.filter(f => (f.delta_absolute) > 0).length,
    };

    const allKeys = new Set([
      ...Object.keys(a.year1),
      ...Object.keys(b.year1),
    ].filter(k => !k.startsWith('_')));
    summary.fields_unchanged = allKeys.size - fieldDiffs.length;

    const diff: ScenarioDiff = {
      scenario_a_id: scenarioAId,
      scenario_b_id: scenarioBId,
      computed_at:   new Date().toISOString(),
      field_diffs:   fieldDiffs,
      summary,
    };

    diffCache.set(cacheKey, { diff, expires_at: Date.now() + 60 * 60 * 1000 });
    return diff;
  }

  /**
   * Write the agent's field values into the active scenario's year1.
   * Called from cashflow.postprocess.ts in place of the old
   *   UPDATE deal_assumptions SET year1 = jsonb_set(...)
   * The trigger propagates the change to deal_assumptions automatically.
   *
   * Returns true if a scenario row was found and updated, false if the caller
   * should fall back to writing deal_assumptions directly (backward compat for
   * deals that were not migrated / have no scenario yet).
   */
  async writeAgentFieldToActiveScenario(
    dealId: string,
    year1Key: string,
    agentValue: number,
    resolution: string = 'agent:cashflow'
  ): Promise<boolean> {
    const r = await this.pool.query(
      `UPDATE deal_underwriting_scenarios
          SET year1 = jsonb_set(
            COALESCE(year1, '{}'),
            ARRAY[$2::text],
            COALESCE(
              CASE jsonb_typeof(year1->$2::text)
                WHEN 'object' THEN year1->$2::text
                ELSE NULL
              END,
              '{}'::jsonb
            ) || jsonb_build_object(
              'agent',      $3::numeric,
              'resolved',   $3::numeric,
              'resolution', $4::text
            ),
            true
          ),
          updated_at = NOW()
        WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL
        RETURNING id`,
      [dealId, year1Key, agentValue, resolution]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * M40 Phase 3 — Create an agent-attributed scenario from an active scenario.
   * Used by cashflow.postprocess when scenarioTarget === 'create_new'.
   * The new scenario is NOT activated automatically.
   */
  async createAgentScenario(
    dealId: string,
    runId: string,
    name: string
  ): Promise<UWScenario> {
    // Fork from the active scenario's year1
    const active = await this.getActiveScenario(dealId);
    const sourceYear1 = active?.year1 ?? {};

    const r = await this.pool.query<UWScenario>(
      `INSERT INTO deal_underwriting_scenarios
         (deal_id, name, description, created_by, created_by_user_id,
          created_by_agent_run_id, is_active, parent_id, year1, tags)
       VALUES ($1, $2, $3, 'agent', NULL, $4, FALSE, $5, $6::jsonb, NULL)
       RETURNING *`,
      [
        dealId,
        name,
        active ? `Agent run forked from "${active.name}"` : 'Initial agent scenario',
        runId,
        active?.id ?? null,
        JSON.stringify(sourceYear1),
      ]
    );
    return r.rows[0];
  }
}

// ── Pure diff computation (exported for testing) ───────────────────────────

export function computeYear1Diff(
  scenarioAId: string,
  scenarioBId: string,
  yearA: Record<string, unknown>,
  yearB: Record<string, unknown>
): FieldDiff[] {
  const allKeys = new Set([
    ...Object.keys(yearA),
    ...Object.keys(yearB),
  ].filter(k => !k.startsWith('_')));

  const diffs: FieldDiff[] = [];

  for (const key of allKeys) {
    const a = yearA[key] as Record<string, unknown> | undefined;
    const b = yearB[key] as Record<string, unknown> | undefined;

    const aVal = typeof a?.resolved === 'number' ? a.resolved : null;
    const bVal = typeof b?.resolved === 'number' ? b.resolved : null;

    if (aVal === bVal) continue;

    const delta = (bVal ?? 0) - (aVal ?? 0);
    const deltaPct =
      aVal !== null && aVal !== 0 ? delta / Math.abs(aVal) : null;

    const absPct = Math.abs(deltaPct ?? 0);
    const significance: FieldDiff['significance'] =
      absPct > 0.10 ? 'major'
      : absPct > 0.02 ? 'minor'
      : 'trivial';

    diffs.push({
      field_path:       key,
      scenario_a_value: aVal,
      scenario_b_value: bVal,
      delta_absolute:   delta,
      delta_pct:        deltaPct !== null ? Math.round(deltaPct * 10000) / 100 : null,
      resolution_a:     (a?.resolution as string) ?? 'unknown',
      resolution_b:     (b?.resolution as string) ?? 'unknown',
      significance,
    });
  }

  return diffs.sort(
    (x, y) => Math.abs(y.delta_pct ?? 0) - Math.abs(x.delta_pct ?? 0)
  );
}

export const uwScenarioService = new UWScenarioService();
