/**
 * ClassificationContext Loader — read raw classification rows from all DB sources.
 *
 * Wave 1 W2: Queries deals, deal_data, deal_context_fields, and any other
 * table that holds classification keys, then feeds the rows into the assembler.
 */

import { query } from '../database/connection';
import {
  assembleClassificationContext,
  type RawClassificationRow,
} from './classification-context-assembler';

interface DealDataClassification {
  deal_type?: string;
  asset_class?: string;
  strategy?: string;
  deal_mode?: string;
  project_intent?: string;
  view_mode?: string;
  _provenance?: {
    ingestionSource: string;
    userId: string | null;
    agentRunId?: string | null;
    stampedAt: string;
  };
}

/**
 * Load all classification rows for a deal from every known source.
 */
export async function loadClassificationRows(dealId: string): Promise<RawClassificationRow[]> {
  const rows: RawClassificationRow[] = [];

  // ── Source 1: deals table (direct columns + deal_data JSONB) ───────────────
  const dealResult = await query<
    {
      strategy: string | null;
      deal_data: string | null; // JSONB serialized
    }
  >(
    `SELECT strategy, deal_data::text AS deal_data FROM deals WHERE id = $1 LIMIT 1`,
    [dealId]
  );

  const dealRow = dealResult.rows[0];
  if (dealRow) {
    if (dealRow.strategy) {
      rows.push({
        field: 'strategy',
        value: dealRow.strategy,
        source: 'platform',
        confidence: 0.5,
        stampedAt: new Date().toISOString(),
        userId: null,
      });
    }

    if (dealRow.deal_data) {
      try {
        const dd = JSON.parse(dealRow.deal_data) as DealDataClassification;
        const prov = dd._provenance;
        const base = {
          source: prov?.ingestionSource ?? 'platform',
          stampedAt: prov?.stampedAt ?? new Date().toISOString(),
          userId: prov?.userId ?? null,
          agentRunId: prov?.agentRunId ?? null,
        };

        if (dd.deal_type) {
          rows.push({ field: 'deal_type', value: dd.deal_type, ...base, confidence: 0.6 });
        }
        if (dd.asset_class) {
          rows.push({ field: 'asset_class', value: dd.asset_class, ...base, confidence: 0.6 });
        }
        if (dd.strategy) {
          rows.push({ field: 'strategy', value: dd.strategy, ...base, confidence: 0.6 });
        }
        if (dd.deal_mode) {
          rows.push({ field: 'deal_mode', value: dd.deal_mode, ...base, confidence: 0.6 });
        }
        if (dd.project_intent) {
          rows.push({ field: 'project_intent', value: dd.project_intent, ...base, confidence: 0.6 });
        }
        if (dd.view_mode) {
          rows.push({ field: 'view_mode', value: dd.view_mode, ...base, confidence: 0.6 });
        }
      } catch {
        // deal_data is not valid JSON — skip
      }
    }
  }

  // ── Source 2: deal_context_fields (agent-written values) ──────────────────
  const dcfResult = await query<
    {
      field_path: string;
      value: string; // JSONB serialized
      source_label: string;
      agent_run_id: string | null;
      updated_at: string;
    }
  >(
    `SELECT field_path, value::text AS value, source_label, agent_run_id, updated_at
     FROM deal_context_fields
     WHERE deal_id = $1
       AND field_path IN ('deal_type','strategy','asset_class','deal_mode','project_intent','view_mode')`,
    [dealId]
  );

  for (const r of dcfResult.rows) {
    try {
      const parsed = JSON.parse(r.value);
      const rawValue = typeof parsed === 'string' ? parsed : parsed?.value ?? parsed;
      rows.push({
        field: r.field_path,
        value: String(rawValue),
        source: r.source_label,
        confidence: 0.75,
        stampedAt: r.updated_at,
        userId: null,
        agentRunId: r.agent_run_id,
      });
    } catch {
      // skip unparseable
    }
  }

  return rows;
}

/**
 * High-level entry point: load rows + assemble context in one call.
 */
export async function getClassificationContext(dealId: string) {
  const rows = await loadClassificationRows(dealId);
  return assembleClassificationContext(dealId, rows);
}
