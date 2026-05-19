/**
 * Recipient Deal Context — Capsule Sharing Piece 4
 *
 * Builds a scoped-down DealContext for non-platform recipients.
 * Scrubs sender-private data: owned-portfolio, other deals, full knowledge graph.
 *
 * @version 1.0.0
 * @date 2026-05-19
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

export interface RecipientDealContext {
  deal_id: string;
  deal_name: string;
  property: {
    city: string | null;
    state: string | null;
    property_type: string | null;
    total_units: number | null;
    year_built: number | null;
  };
  scenario: {
    scenario_id: string | null;
    scenario_name: string | null;
    assumptions: Record<string, any>;
  };
  source_documents: Array<{
    file_id: string;
    filename: string;
    document_type: string;
    mime_type: string | null;
    extracted_at: string;
    key_fields: string[];
  }>;
  market: {
    market_id: string | null;
    cycle_phase: string | null;
    rent_growth_baseline: number | null;
    cap_rate_forecast: number | null;
  };
  cohort: {
    cohort_baseline_p50: number | null;
    cohort_n: number | null;
    delta_from_cohort_p50: number | null;
    cohort_comparison_status: string | null;
  };
  // Explicitly null — fields excluded for recipient privacy
  sender_owned_portfolio: null;
  other_scenarios: null;
  full_knowledge_graph: null;
  other_deals: null;
}

/**
 * Build a recipient-scoped deal context from a capsule share.
 *
 * @param shareId — capsule_shares.share_id
 * @returns RecipientDealContext or null if deal/share not found
 */
export async function buildRecipientDealContext(shareId: string): Promise<RecipientDealContext | null> {
  const pool = getPool();

  try {
    // Fetch deal + share info
    const dealResult = await pool.query(
      `SELECT
         d.id AS deal_id,
         d.name AS deal_name,
         d.deal_data->>'property_city' AS property_city,
         d.deal_data->>'property_state' AS property_state,
         d.deal_data->>'property_type' AS property_type,
         d.deal_data->>'total_units' AS total_units,
         d.deal_data->>'year_built' AS year_built,
         d.msa_id AS market_id
       FROM deals d
       JOIN capsule_shares cs ON cs.deal_id = d.id
       WHERE cs.share_id = $1
         AND cs.revoked_at IS NULL
         AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       LIMIT 1`,
      [shareId]
    );

    if (dealResult.rows.length === 0) {
      return null;
    }

    const deal = dealResult.rows[0];

    // Fetch the shared scenario (if any)
    let scenario = { scenario_id: null, scenario_name: null, assumptions: {} };
    const scenarioResult = await pool.query(
      `SELECT cs.scenario_id, us.name AS scenario_name
       FROM capsule_shares cs
       LEFT JOIN deal_scenarios us ON us.scenario_id = cs.scenario_id AND us.deal_id = cs.deal_id
       WHERE cs.share_id = $1
       LIMIT 1`,
      [shareId]
    );

    if (scenarioResult.rows.length > 0 && scenarioResult.rows[0].scenario_id) {
      const sResult = await pool.query(
        `SELECT scenario_data FROM deal_scenarios WHERE scenario_id = $1 LIMIT 1`,
        [scenarioResult.rows[0].scenario_id]
      );
      if (sResult.rows.length > 0) {
        scenario = {
          scenario_id: scenarioResult.rows[0].scenario_id,
          scenario_name: scenarioResult.rows[0].scenario_name ?? 'Shared Scenario',
          assumptions: sResult.rows[0].scenario_data ?? {},
        };
      }
    }

    // Fetch source documents
    const sourceDocsResult = await pool.query(
      `SELECT
         COALESCE(sd->>'file_id', '') AS file_id,
         COALESCE(sd->>'filename', '') AS filename,
         COALESCE(sd->>'document_type', '') AS document_type,
         sd->>'mime_type' AS mime_type,
         COALESCE(sd->>'extracted_at', '') AS extracted_at,
         COALESCE(sd->>'key_fields', '[]') AS key_fields_json
       FROM deals d,
       jsonb_array_elements(COALESCE(d.deal_data->'source_documents', '[]'::jsonb)) AS sd
       WHERE d.id = $1`,
      [deal.deal_id]
    );

    const sourceDocuments = sourceDocsResult.rows.map((row: any) => ({
      file_id: row.file_id,
      filename: row.filename,
      document_type: row.document_type,
      mime_type: row.mime_type,
      extracted_at: row.extracted_at,
      key_fields: typeof row.key_fields_json === 'string'
        ? JSON.parse(row.key_fields_json)
        : (row.key_fields_json ?? []),
    }));

    // Fetch market / cycle data (if available)
    let marketCycle: string | null = null;
    if (deal.market_id) {
      try {
        const { cycleIntelligenceService } = await import('./cycle-intelligence.service');
        const snapshot = await cycleIntelligenceService.getCyclePhase(deal.market_id).catch(() => null);
        if (snapshot) {
          marketCycle = snapshot.lag_phase ?? snapshot.lead_phase ?? null;
        }
      } catch {
        // Non-critical — cycle data may not be available
      }
    }

    // Fetch cohort comparison from assumption evidence
    let cohort = {
      cohort_baseline_p50: null as number | null,
      cohort_n: null as number | null,
      delta_from_cohort_p50: null as number | null,
      cohort_comparison_status: null as string | null,
    };
    try {
      const cohortResult = await pool.query(
        `SELECT evidence->'cohort_context' AS cohort_context
         FROM deal_assumptions
         WHERE deal_id = $1
           AND evidence->'cohort_context' IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [deal.deal_id]
      );
      if (cohortResult.rows.length > 0) {
        const cc = cohortResult.rows[0].cohort_context;
        if (cc) {
          cohort = {
            cohort_baseline_p50: cc.cohort_baseline_p50 ?? null,
            cohort_n: cc.cohort_n ?? null,
            delta_from_cohort_p50: cc.delta_from_cohort_p50 ?? null,
            cohort_comparison_status: cc.cohort_comparison_status ?? null,
          };
        }
      }
    } catch {
      // Non-critical
    }

    return {
      deal_id: deal.deal_id,
      deal_name: deal.deal_name,
      property: {
        city: deal.property_city ?? null,
        state: deal.property_state ?? null,
        property_type: deal.property_type ?? null,
        total_units: deal.total_units ? parseInt(deal.total_units, 10) : null,
        year_built: deal.year_built ? parseInt(deal.year_built, 10) : null,
      },
      scenario,
      source_documents: sourceDocuments,
      market: {
        market_id: deal.market_id ?? null,
        cycle_phase: marketCycle,
        rent_growth_baseline: null,
        cap_rate_forecast: null,
      },
      cohort,
      // Privacy-scrubbed
      sender_owned_portfolio: null,
      other_scenarios: null,
      full_knowledge_graph: null,
      other_deals: null,
    };
  } catch (err: any) {
    logger.error('Failed to build recipient deal context', { error: err?.message, shareId });
    return null;
  }
}
