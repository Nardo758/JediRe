/**
 * Strategy Engine Routes
 * GET  /api/v1/strategies          — list preset + user's custom strategies
 * POST /api/v1/strategies          — save a new custom strategy
 * POST /api/v1/strategies/preview  — evaluate conditions against metric_time_series
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';

const router = Router();

// ── Metric ID mapping ────────────────────────────────────────────────────────
// Maps user-facing metricId strings to actual metric_id values in metric_time_series
const METRIC_MAP: Record<string, string> = {
  SFR_HOME_VALUE:    'home_value_index',
  HOME_VALUE:        'home_value_index',
  ZHVI:              'home_value_index',
  ZHVI_ALL:          'home_value_index',
  HOME_VALUE_YOY:    'home_value_index_yoy',
  ZHVI_YOY:          'home_value_index_yoy',
  RENT:              'rent_index',
  SFR_RENT:          'rent_index',
  ZORI:              'rent_index',
  RENT_INDEX:        'rent_index',
  ZORI_YOY:          'rent_index_yoy',
  RENT_YOY:          'rent_index_yoy',
  RENT_INDEX_YOY:    'rent_index_yoy',
};

function resolveMetricId(raw: string): string {
  return METRIC_MAP[raw?.toUpperCase()] ?? raw?.toLowerCase();
}

// ── Scope → geography_type mapping ──────────────────────────────────────────
const SCOPE_MAP: Record<string, string> = {
  submarket:   'metro',
  metro:       'metro',
  msa:         'metro',
  city:        'city',
  zip:         'zip',
  zipcode:     'zip',
  state:       'state',
  national:    'state',
  property:    'city',
};

function resolveGeoType(scope: string): string {
  return SCOPE_MAP[scope?.toLowerCase()] ?? 'metro';
}

// ── SQL operator builder ─────────────────────────────────────────────────────
type Operator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between' | 'change_gt' | 'change_lt';

function buildOperatorSql(operator: Operator, paramOffset: number): { sql: string; paramCount: number } {
  switch (operator) {
    case 'gt':        return { sql: `> $${paramOffset}`,                   paramCount: 1 };
    case 'lt':        return { sql: `< $${paramOffset}`,                   paramCount: 1 };
    case 'gte':       return { sql: `>= $${paramOffset}`,                  paramCount: 1 };
    case 'lte':       return { sql: `<= $${paramOffset}`,                  paramCount: 1 };
    case 'eq':        return { sql: `= $${paramOffset}`,                   paramCount: 1 };
    case 'neq':       return { sql: `<> $${paramOffset}`,                  paramCount: 1 };
    case 'between':   return { sql: `BETWEEN $${paramOffset} AND $${paramOffset + 1}`, paramCount: 2 };
    case 'change_gt': return { sql: `> $${paramOffset}`,                   paramCount: 1 };
    case 'change_lt': return { sql: `< $${paramOffset}`,                   paramCount: 1 };
    default:          return { sql: `> $${paramOffset}`,                   paramCount: 1 };
  }
}

interface Condition {
  id: string;
  metricId: string;
  operator: Operator;
  value: number | number[];
  weight?: number;
  required?: boolean;
}

interface PreviewRequest {
  scope?: string;
  combinator?: 'AND' | 'OR';
  conditions: Condition[];
  maxResults?: number;
}

interface GeoMatch {
  geographyId: string;
  geographyName: string | null;
  geographyType: string;
  matchedConditions: number;
  totalConditions: number;
  score: number;
  metrics: Record<string, { value: number; date: string }>;
}

// ── GET /api/v1/strategies ────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await query(`
      SELECT id, name, description, type, scope, conditions, combinator,
             signal_weights, sort_by, sort_direction, max_results,
             asset_classes, deal_types, tags, is_active, is_public,
             run_count, last_run_at, created_at, updated_at, user_id
      FROM strategy_definitions
      WHERE type = 'preset'
         OR (type = 'custom' AND (user_id = $1 OR is_public = true))
         OR user_id IS NULL
      ORDER BY type DESC, name ASC
    `, [userId]);

    const strategies = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      scope: r.scope,
      conditions: r.conditions,
      combinator: r.combinator,
      signalWeights: r.signal_weights,
      sortBy: r.sort_by,
      sortDirection: r.sort_direction,
      maxResults: r.max_results,
      assetClasses: r.asset_classes,
      dealTypes: r.deal_types,
      tags: r.tags,
      isActive: r.is_active,
      isPublic: r.is_public,
      runCount: r.run_count,
      lastRunAt: r.last_run_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isOwned: r.user_id === userId,
    }));

    res.json({ success: true, count: strategies.length, strategies });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/strategies ───────────────────────────────────────────────────
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {
      name, description, scope = 'submarket', conditions = [],
      combinator = 'AND', signalWeights, sortBy, sortDirection = 'desc',
      maxResults = 50, assetClasses = [], dealTypes = [], tags = [],
      isPublic = false,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({ error: 'conditions must be a non-empty array' });
    }

    const result = await query(`
      INSERT INTO strategy_definitions
        (user_id, name, description, type, scope, conditions, combinator,
         signal_weights, sort_by, sort_direction, max_results, asset_classes,
         deal_types, tags, is_public)
      VALUES ($1,$2,$3,'custom',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      userId, name, description, scope,
      JSON.stringify(conditions), combinator,
      signalWeights ? JSON.stringify(signalWeights) : null,
      sortBy, sortDirection, maxResults,
      assetClasses, dealTypes, tags, isPublic,
    ]);

    res.status(201).json({ success: true, strategy: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/strategies/preview ──────────────────────────────────────────
router.post('/preview', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      scope = 'submarket',
      combinator = 'AND',
      conditions = [],
      maxResults = 50,
    }: PreviewRequest = req.body;

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({ error: 'conditions must be a non-empty array' });
    }

    const geoType = resolveGeoType(scope);
    const totalConditions = conditions.length;

    // Check if metric_time_series has any data
    const countCheck = await query(
      `SELECT COUNT(*) AS cnt FROM metric_time_series WHERE geography_type = $1 LIMIT 1`,
      [geoType]
    );
    const hasData = parseInt(countCheck.rows[0]?.cnt ?? '0') > 0;

    if (!hasData) {
      return res.json({
        success: true,
        scope,
        geoType,
        combinator,
        totalConditions,
        matchCount: 0,
        results: [],
        warning: `No metric data found for geography_type="${geoType}". Ingest Zillow ZHVI/ZORI data first.`,
      });
    }

    // ── Evaluate each condition independently ─────────────────────────────
    // For each condition: find geographies where the latest metric value passes the filter.
    // We collect sets of matching geography_ids, then combine with AND/OR.

    const conditionSets: Array<{
      condition: Condition;
      geoIds: Set<string>;
      latestValues: Map<string, { value: number; date: string }>;
    }> = [];

    for (const cond of conditions) {
      const metricId = resolveMetricId(cond.metricId);
      const { sql: opSql, paramCount } = buildOperatorSql(cond.operator, 3);

      // Value(s) for the operator
      const values: number[] = Array.isArray(cond.value) ? cond.value : [cond.value];
      const operatorParams = values.slice(0, paramCount);

      // Get latest value per geography_id for this metric, filtered by operator
      const latestResult = await query(`
        SELECT DISTINCT ON (geography_id)
          geography_id,
          geography_name,
          period_date::TEXT AS period_date,
          value
        FROM metric_time_series
        WHERE metric_id      = $1
          AND geography_type = $2
          AND value          ${opSql}
        ORDER BY geography_id, period_date DESC
      `, [metricId, geoType, ...operatorParams]);

      const geoIds = new Set<string>();
      const latestValues = new Map<string, { value: number; date: string }>();

      for (const row of latestResult.rows) {
        geoIds.add(row.geography_id);
        latestValues.set(row.geography_id, { value: row.value, date: row.period_date });
      }

      conditionSets.push({ condition: cond, geoIds, latestValues });
    }

    // ── Combine condition sets ─────────────────────────────────────────────
    let candidateGeoIds: Set<string>;

    if (combinator === 'AND') {
      // Intersection: must match all required conditions
      const requiredSets = conditionSets.filter(c => c.condition.required !== false);
      if (requiredSets.length === 0) {
        candidateGeoIds = conditionSets[0]?.geoIds ?? new Set();
      } else {
        candidateGeoIds = new Set(requiredSets[0].geoIds);
        for (const cs of requiredSets.slice(1)) {
          for (const id of candidateGeoIds) {
            if (!cs.geoIds.has(id)) candidateGeoIds.delete(id);
          }
        }
      }
    } else {
      // OR: union of all condition sets
      candidateGeoIds = new Set();
      for (const cs of conditionSets) {
        for (const id of cs.geoIds) candidateGeoIds.add(id);
      }
    }

    // ── Score and rank results ─────────────────────────────────────────────
    const results: GeoMatch[] = [];
    const totalWeight = conditions.reduce((s, c) => s + (c.weight ?? 50), 0);

    // Get geography names for candidates in a single query
    const geoIdList = Array.from(candidateGeoIds).slice(0, 500);
    const nameResult = geoIdList.length > 0
      ? await query(
          `SELECT DISTINCT ON (geography_id) geography_id, geography_name
           FROM metric_time_series
           WHERE geography_type = $1 AND geography_id = ANY($2)`,
          [geoType, geoIdList]
        )
      : { rows: [] };
    const nameMap = new Map(nameResult.rows.map(r => [r.geography_id, r.geography_name]));

    for (const geoId of candidateGeoIds) {
      let matchedConditions = 0;
      let weightedScore = 0;
      const metrics: Record<string, { value: number; date: string }> = {};

      for (const cs of conditionSets) {
        const metricKey = cs.condition.metricId;
        if (cs.geoIds.has(geoId)) {
          matchedConditions++;
          const w = cs.condition.weight ?? 50;
          weightedScore += w;
          const mv = cs.latestValues.get(geoId);
          if (mv) metrics[metricKey] = mv;
        }
      }

      const score = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;

      results.push({
        geographyId: geoId,
        geographyName: nameMap.get(geoId) ?? null,
        geographyType: geoType,
        matchedConditions,
        totalConditions,
        score,
        metrics,
      });
    }

    // Sort by score desc, then alphabetically by name
    results.sort((a, b) => b.score - a.score || (a.geographyName ?? '').localeCompare(b.geographyName ?? ''));

    const paginated = results.slice(0, maxResults);

    res.json({
      success: true,
      scope,
      geoType,
      combinator,
      totalConditions,
      matchCount: results.length,
      results: paginated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/v1/strategies/:id ────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const {
      name, description, scope, conditions,
      combinator, signalWeights, sortBy, sortDirection,
      maxResults, assetClasses, dealTypes, tags, isPublic,
    } = req.body;

    const result = await query(`
      UPDATE strategy_definitions SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        scope = COALESCE($5, scope),
        conditions = COALESCE($6, conditions),
        combinator = COALESCE($7, combinator),
        sort_by = COALESCE($8, sort_by),
        sort_direction = COALESCE($9, sort_direction),
        max_results = COALESCE($10, max_results),
        asset_classes = COALESCE($11, asset_classes),
        deal_types = COALESCE($12, deal_types),
        tags = COALESCE($13, tags),
        is_public = COALESCE($14, is_public),
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [
      id, userId, name, description, scope,
      conditions ? JSON.stringify(conditions) : null,
      combinator, sortBy, sortDirection, maxResults,
      assetClasses, dealTypes, tags, isPublic,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Strategy not found or unauthorized' });
    }
    res.json({ success: true, strategy: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/v1/strategies/:id ─────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM strategy_definitions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Strategy not found or unauthorized' });
    }
    res.json({ success: true, deleted: id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
