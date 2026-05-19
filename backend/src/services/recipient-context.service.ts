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
 * Build a recipient-scoped deal context directly from a frozen snapshot.
 * Used when the share was created under the v1 snapshot architecture.
 * No live DB queries — the snapshot IS the privacy boundary.
 */
export function buildRecipientContextFromSnapshot(
  snapshot: Record<string, unknown>,
  shareId: string,
  capsuleId: string,
): RecipientDealContext {
  const dealData = (snapshot.deal_data as Record<string, unknown>) ?? {};
  const platformIntel = (snapshot.platform_intel as Record<string, unknown>) ?? {};
  const moduleOutputs = (snapshot.module_outputs as Record<string, unknown>) ?? {};

  const fin = moduleOutputs.financial as Record<string, unknown> | undefined;
  const sourceDocs = (dealData.source_documents as Array<Record<string, unknown>>) ?? [];

  return {
    deal_id: capsuleId,
    deal_name: (snapshot.property_address as string) ?? 'Unknown Property',
    property: {
      city: (dealData.city ?? dealData.property_city) as string | null ?? null,
      state: (dealData.state ?? dealData.property_state) as string | null ?? null,
      property_type: (snapshot.asset_class ?? dealData.property_type) as string | null ?? null,
      total_units: dealData.units != null ? Number(dealData.units) : null,
      year_built: dealData.year_built != null ? Number(dealData.year_built) : null,
    },
    scenario: {
      scenario_id: (fin?.scenario_id as string) ?? null,
      scenario_name: (fin?.scenario_name as string) ?? 'Shared Scenario',
      assumptions: {
        hold_period: dealData.hold_period ?? null,
        target_irr: dealData.target_irr ?? null,
        exit_cap: dealData.exit_cap_assumption ?? null,
        ...(fin?.assumptions as Record<string, unknown> ?? {}),
      },
    },
    source_documents: sourceDocs.map((d: Record<string, unknown>) => ({
      file_id: (d.file_id as string) ?? '',
      filename: (d.filename as string) ?? '',
      document_type: (d.document_type as string) ?? '',
      mime_type: (d.mime_type as string) ?? null,
      extracted_at: (d.extracted_at as string) ?? '',
      key_fields: (d.key_fields as string[]) ?? [],
    })),
    market: {
      market_id: (platformIntel.market_id as string) ?? null,
      cycle_phase: (platformIntel.cycle_phase as string) ?? null,
      rent_growth_baseline: platformIntel.rent_growth != null ? Number(platformIntel.rent_growth) : null,
      cap_rate_forecast: platformIntel.market_cap_rate_avg != null ? Number(platformIntel.market_cap_rate_avg) : null,
    },
    cohort: {
      cohort_baseline_p50: null,
      cohort_n: null,
      delta_from_cohort_p50: null,
      cohort_comparison_status: null,
    },
    sender_owned_portfolio: null,
    other_scenarios: null,
    full_knowledge_graph: null,
    other_deals: null,
  };
}

/**
 * Build a recipient-scoped deal context from a capsule share.
 * Prefers frozen snapshot when available; falls back to live DB queries
 * for shares created before the snapshot migration.
 *
 * @param shareId — capsule_external_shares.share_id
 * @returns RecipientDealContext or null if deal/share not found
 */
export async function buildRecipientDealContext(shareId: string): Promise<RecipientDealContext | null> {
  const pool = getPool();

  try {
    // Check for frozen snapshot first
    const snapshotResult = await pool.query(
      `SELECT capsule_id, capsule_snapshot FROM capsule_external_shares WHERE share_id = $1 LIMIT 1`,
      [shareId]
    );
    if (snapshotResult.rows.length > 0 && snapshotResult.rows[0].capsule_snapshot) {
      return buildRecipientContextFromSnapshot(
        snapshotResult.rows[0].capsule_snapshot,
        shareId,
        snapshotResult.rows[0].capsule_id,
      );
    }

    // Fetch deal + share info (legacy path — no snapshot)
    const dealResult = await pool.query(
      `SELECT
         dc.id AS deal_id,
         dc.property_address AS deal_name,
         COALESCE(dc.deal_data->>'city', dc.deal_data->>'property_city') AS property_city,
         COALESCE(dc.deal_data->>'state', dc.deal_data->>'property_state') AS property_state,
         COALESCE(dc.asset_class, dc.deal_data->>'property_type') AS property_type,
         COALESCE(dc.deal_data->>'units', dc.deal_data->>'total_units') AS total_units,
         dc.deal_data->>'year_built' AS year_built,
         NULL::TEXT AS market_id
       FROM deal_capsules dc
       JOIN capsule_external_shares ces ON ces.capsule_id = dc.id
       WHERE ces.share_id = $1
         AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
       LIMIT 1`,
      [shareId]
    );

    if (dealResult.rows.length === 0) {
      return null;
    }

    const deal = dealResult.rows[0];

    // Capsule shares don't carry a linked scenario
    const scenario = { scenario_id: null, scenario_name: null, assumptions: {} };

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
