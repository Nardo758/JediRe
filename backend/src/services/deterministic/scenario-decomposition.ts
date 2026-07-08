import type { Pool } from 'pg';

/**
 * Decompose a deal_underwriting_scenarios.year1 JSONB blob into individual
 * deal_assumption_overlays rows.
 *
 * One row per top-level field that carries a resolved numeric value.
 * For plain LayeredValue<number> fields: extracts `resolved` and `resolution`.
 * For nested objects (other_income_breakdown, etc.): creates sub-rows with
 * dot-notation field_path.
 *
 * @param dealId       The deal UUID
 * @param scenarioId   The scenario UUID (can be null for base assumptions)
 * @param year1        The year1 JSONB blob (ProFormaYear1Seed shape)
 * @returns Array of overlay row inserts ready for INSERT
 */
export function decomposeYear1ToOverlays(
  dealId: string,
  scenarioId: string | null,
  year1: Record<string, any>
): Array<{
  deal_id: string;
  scenario_id: string | null;
  field_key: string;
  field_path: string;
  source_tag: string;
  value: number | null;
  value_text: string | null;
  value_jsonb: any;
  note: string | null;
}> {
  const rows: ReturnType<typeof decomposeYear1ToOverlays> = [];
  const ts = new Date().toISOString();

  function addRow(
    fieldPath: string,
    resolved: number | null,
    resolution: string,
    fullValue: any
  ) {
    rows.push({
      deal_id: dealId,
      scenario_id: scenarioId,
      field_key: fieldPath.split('.')[0],
      field_path: fieldPath,
      source_tag: resolution || 'unknown',
      value: resolved,
      value_text: resolved != null ? String(resolved) : null,
      value_jsonb: fullValue,
      note: `decomposed_at=${ts}`,
    });
  }

  for (const [key, val] of Object.entries(year1)) {
    if (val == null) continue;

    if (typeof val === 'object' && !Array.isArray(val)) {
      // LayeredValue or nested object
      if ('resolved' in val && typeof val.resolved === 'number') {
        // Standard LayeredValue<number>
        addRow(key, val.resolved, val.resolution || 'unknown', val);
      } else if (key === 'other_income_breakdown') {
        // Nested object: each sub-key is a LayeredValue
        for (const [subKey, subVal] of Object.entries(val)) {
          if (typeof subVal === 'object' && subVal != null && 'resolved' in subVal) {
            addRow(`${key}.${subKey}`, subVal.resolved, subVal.resolution || 'unknown', subVal);
          }
        }
      } else if (key === 'source_docs' || key === '_boundary_context') {
        // Metadata objects — skip (not financial assumptions)
        continue;
      } else if (key === 'other_income_user_lines') {
        // Array of user lines — skip for now (complex shape, not numeric)
        continue;
      } else {
        // Unknown nested object — store as JSONB with null numeric value
        addRow(key, null, 'unknown', val);
      }
    } else if (typeof val === 'number') {
      // Plain numeric (e.g. _unit_count)
      addRow(key, val, 'plain', val);
    } else if (typeof val === 'string') {
      // String (e.g. last_seeded_at) — skip
      continue;
    }
  }

  return rows;
}

/**
 * Recompose a deal_underwriting_scenarios.year1 JSONB blob from
 * deal_assumption_overlays rows.
 *
 * @param overlays  Rows from deal_assumption_overlays for a given deal+scenario
 * @returns         Reconstructed year1 JSONB blob (ProFormaYear1Seed shape)
 */
export function recomposeYear1FromOverlays(
  overlays: Array<{
    field_path: string;
    value: number | null;
    value_jsonb: any;
    source_tag: string;
  }>
): Record<string, any> {
  const year1: Record<string, any> = {};

  for (const o of overlays) {
    if (!o.field_path) continue;

    const parts = o.field_path.split('.');
    const topKey = parts[0];

    if (parts.length === 1) {
      // Top-level field
      if (o.value_jsonb != null && typeof o.value_jsonb === 'object') {
        // Restore the full LayeredValue object
        year1[topKey] = o.value_jsonb;
      } else if (o.value != null) {
        // Plain numeric — reconstruct minimal LayeredValue
        year1[topKey] = {
          resolved: o.value,
          resolution: o.source_tag || 'unknown',
        };
      } else {
        year1[topKey] = o.value_jsonb;
      }
    } else {
      // Nested field (e.g. other_income_breakdown.parking)
      const subKey = parts[1];
      if (!year1[topKey]) year1[topKey] = {};

      if (o.value_jsonb != null && typeof o.value_jsonb === 'object') {
        year1[topKey][subKey] = o.value_jsonb;
      } else if (o.value != null) {
        year1[topKey][subKey] = {
          resolved: o.value,
          resolution: o.source_tag || 'unknown',
        };
      } else {
        year1[topKey][subKey] = o.value_jsonb;
      }
    }
  }

  return year1;
}

/**
 * Shadow-read verifier: compare a year1 blob against its decomposed overlay rows.
 * ALARMS on mismatch.
 *
 * @param year1Blob    The original year1 JSONB blob
 * @param overlays     The decomposed overlay rows
 * @returns            Match result + list of mismatches
 */
export function verifyOverlayEquivalence(
  year1Blob: Record<string, any>,
  overlays: Array<{
    field_path: string;
    value: number | null;
    source_tag: string;
    value_jsonb: any;
  }>
): {
  matches: boolean;
  mismatches: Array<{
    field: string;
    blobValue: any;
    overlayValue: any;
    reason: string;
  }>;
} {
  const mismatches: ReturnType<typeof verifyOverlayEquivalence>['mismatches'] = [];

  // Check 1: every blob key has a matching overlay
  for (const [key, val] of Object.entries(year1Blob)) {
    const overlay = overlays.find(o => o.field_path === key || o.field_path.startsWith(`${key}.`));
    if (!overlay) {
      mismatches.push({
        field: key,
        blobValue: val,
        overlayValue: null,
        reason: 'missing_overlay',
      });
      continue;
    }

    // Compare resolved value
    const blobResolved =
      typeof val === 'object' && val != null && 'resolved' in val
        ? val.resolved
        : val;

    if (blobResolved !== overlay.value) {
      mismatches.push({
        field: key,
        blobValue: blobResolved,
        overlayValue: overlay.value,
        reason: 'value_mismatch',
      });
    }
  }

  // Check 2: every overlay has a matching blob key (no orphaned overlays)
  for (const o of overlays) {
    const topKey = o.field_path.split('.')[0];
    if (!(topKey in year1Blob)) {
      mismatches.push({
        field: o.field_path,
        blobValue: null,
        overlayValue: o.value,
        reason: 'orphaned_overlay',
      });
    }
  }

  return { matches: mismatches.length === 0, mismatches };
}

/**
 * Database helper: decompose a scenario's year1 blob and insert overlay rows.
 * Supersedes previous overlay rows for this scenario.
 */
export async function persistDecomposedOverlays(
  pool: Pool,
  dealId: string,
  scenarioId: string,
  year1: Record<string, any>
): Promise<{ inserted: number; superseded: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Supersede previous overlays for this scenario
    const supersedeResult = await client.query(
      `UPDATE deal_assumption_overlays
       SET superseded_at = NOW(),
           superseded_by = (
             SELECT id FROM deal_assumption_overlays
             WHERE deal_id = $1 AND scenario_id = $2 AND superseded_at IS NULL
             ORDER BY snapshot_at DESC LIMIT 1
           )
       WHERE deal_id = $1 AND scenario_id = $2 AND superseded_at IS NULL`,
      [dealId, scenarioId]
    );

    // 2. Decompose and insert new overlays
    const rows = decomposeYear1ToOverlays(dealId, scenarioId, year1);
    let inserted = 0;
    for (const row of rows) {
      await client.query(
        `INSERT INTO deal_assumption_overlays
         (deal_id, scenario_id, field_key, field_path, source_tag, value, value_text, value_jsonb, note, snapshot_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())`,
        [
          row.deal_id,
          row.scenario_id,
          row.field_key,
          row.field_path,
          row.source_tag,
          row.value,
          row.value_text,
          JSON.stringify(row.value_jsonb),
          row.note,
        ]
      );
      inserted++;
    }

    await client.query('COMMIT');
    return { inserted, superseded: supersedeResult.rowCount || 0 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
