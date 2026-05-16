/**
 * Tool: write_underwriting
 *
 * Persists evidence rows to underwriting_evidence and a proforma snapshot to
 * deal_underwriting_snapshots. All writes via direct DB (same exception as write_dealcontext).
 *
 * Requires capability: write:deal_context
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const EvidencePointInputSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  source: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  weight: z.number().min(0).max(1),
  notes: z.string().optional(),
});

const AlternativeInputSchema = z.object({
  source: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  delta_pct: z.number().nullable().optional(),
  reason_rejected: z.string(),
});

const CollisionInputSchema = z.object({
  field_path: z.string(),
  agent_value: z.union([z.number(), z.string(), z.null()]),
  broker_value: z.union([z.number(), z.string(), z.null()]),
  delta_pct: z.number().nullable(),
  magnitude: z.enum(['minor', 'material', 'severe']),
  direction: z.enum(['agent_higher', 'agent_lower', 'equal']),
  narrative: z.string(),
}).nullable().optional();

const EvidenceRowInputSchema = z.object({
  field_path: z.string(),
  value_numeric: z.number().nullable().optional(),
  value_text: z.string().nullable().optional(),
  primary_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  data_points: z.array(EvidencePointInputSchema).default([]),
  reasoning: z.string().default(''),
  alternatives: z.array(AlternativeInputSchema).default([]),
  collision: CollisionInputSchema,
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
});

const InputSchema = z.object({
  deal_id: z.string().uuid(),
  proforma_snapshot: z.record(z.string(), z.unknown())
    .describe('Full proforma_fields map for the snapshot table'),
  evidence_map: z.record(z.string(), z.unknown()).optional()
    .describe('Evidence map for the snapshot table'),
});

const OutputSchema = z.object({
  success: z.boolean(),
  evidence_ids: z.array(z.string()),
  snapshot_id: z.string().nullable(),
  written_at: z.string(),
  sanity_warnings: z.array(z.string()).optional(),
});

// ── Sanity Check Thresholds ──────────────────────────────────────────────────
// These guard against extraction errors or hallucinated values before DB write.
interface SanityCheckResult {
  passed: boolean;
  warnings: string[];
  blockers: string[];  // If any blockers, refuse to write
}

function runSanityChecks(
  evidenceRows: z.infer<typeof EvidenceRowInputSchema>[],
  proformaSnapshot?: Record<string, unknown>,
  dealContext?: { projectType?: string | null }
): SanityCheckResult {
  const warnings: string[] = [];
  const blockers: string[] = [];

  // Extract key metrics from evidence rows
  const metrics: Record<string, number | null> = {};
  for (const row of evidenceRows) {
    if (row.value_numeric != null) {
      metrics[row.field_path] = row.value_numeric;
    }
  }

  // Also check proforma snapshot if provided
  if (proformaSnapshot) {
    for (const [key, val] of Object.entries(proformaSnapshot)) {
      if (typeof val === 'object' && val !== null && 'value' in val) {
        const v = (val as { value: unknown }).value;
        if (typeof v === 'number') {
          metrics[key] = v;
        }
      }
    }
  }

  const gpr = metrics['gpr'] ?? metrics['revenue.gpr'] ?? null;
  const egi = metrics['egi'] ?? metrics['revenue.egi'] ?? null;
  const totalOpex = metrics['total_opex'] ?? metrics['opex.total'] ?? null;
  const noi = metrics['noi'] ?? metrics['noi_year1'] ?? null;

  // Occupancy from evidence rows (stored as decimal 0–1 or pct 0–100)
  const occupancyRaw = metrics['occupancy_pct'] ?? metrics['occupancy'] ?? metrics['physical_occupancy'] ?? null;
  const occupancyPct = occupancyRaw != null
    ? (occupancyRaw > 1 ? occupancyRaw / 100 : occupancyRaw)
    : null;

  // Lease-up / non-stabilised flag: project_type is 'lease-up' or occupancy < 88%
  const isLeasingUp =
    dealContext?.projectType === 'lease-up' ||
    (occupancyPct != null && occupancyPct < 0.88);

  // ── Check 1: OpEx should not exceed EGI ──
  if (totalOpex != null && egi != null && egi > 0) {
    const opexRatio = totalOpex / egi;
    if (opexRatio > 1.0) {
      blockers.push(
        `BLOCKER: OpEx ($${Math.round(totalOpex).toLocaleString()}) exceeds EGI ($${Math.round(egi).toLocaleString()}) — ` +
        `${(opexRatio * 100).toFixed(0)}% ratio indicates extraction error`
      );
    } else if (opexRatio > 0.75) {
      warnings.push(
        `WARNING: OpEx ratio ${(opexRatio * 100).toFixed(0)}% is unusually high for multifamily (typical: 40-55%)`
      );
    }
  }

  // ── Check 2: NOI should not be negative for stabilized assets ──
  // Lease-up and sub-88% occupancy assets legitimately carry negative T-12 NOI;
  // downgrade from a hard blocker to a warning in those cases.
  if (noi != null && noi < 0 && gpr != null && gpr > 100000) {
    if (isLeasingUp) {
      const occupancyLabel = occupancyPct != null
        ? ` (${(occupancyPct * 100).toFixed(0)}% occupancy — lease-up drag expected)`
        : ' (lease-up project type — negative NOI expected during stabilisation)';
      warnings.push(
        `WARNING: NOI is negative ($${Math.round(noi).toLocaleString()}) on a property with ` +
        `$${Math.round(gpr).toLocaleString()} GPR${occupancyLabel}`
      );
    } else {
      blockers.push(
        `BLOCKER: NOI is negative ($${Math.round(noi).toLocaleString()}) on a property with ` +
        `$${Math.round(gpr).toLocaleString()} GPR — likely extraction or calculation error`
      );
    }
  }

  // ── Check 3: NOI margin sanity (should be 30-70% for most multifamily) ──
  if (noi != null && egi != null && egi > 0) {
    const noiMargin = noi / egi;
    if (noiMargin < 0.20 && noi > 0) {
      warnings.push(
        `WARNING: NOI margin ${(noiMargin * 100).toFixed(0)}% is below typical multifamily range (35-55%)`
      );
    } else if (noiMargin > 0.75) {
      warnings.push(
        `WARNING: NOI margin ${(noiMargin * 100).toFixed(0)}% is unusually high — verify expense completeness`
      );
    }
  }

  // ── Check 4: Per-unit metrics sanity ──
  const units = metrics['total_units'] ?? metrics['units'] ?? null;
  if (units != null && units > 0) {
    if (gpr != null) {
      const gprPerUnit = gpr / units / 12;  // Monthly per unit
      if (gprPerUnit < 300) {
        warnings.push(
          `WARNING: GPR/unit/month ($${Math.round(gprPerUnit)}) is below $300 — verify unit count or rent data`
        );
      } else if (gprPerUnit > 5000) {
        warnings.push(
          `WARNING: GPR/unit/month ($${Math.round(gprPerUnit)}) exceeds $5,000 — verify luxury/high-rise classification`
        );
      }
    }
    if (totalOpex != null) {
      const opexPerUnit = totalOpex / units;
      if (opexPerUnit < 2000) {
        warnings.push(
          `WARNING: Annual OpEx/unit ($${Math.round(opexPerUnit)}) is below $2,000 — expenses may be incomplete`
        );
      } else if (opexPerUnit > 15000) {
        warnings.push(
          `WARNING: Annual OpEx/unit ($${Math.round(opexPerUnit)}) exceeds $15,000 — verify expense allocation`
        );
      }
    }
  }

  return {
    passed: blockers.length === 0,
    warnings,
    blockers,
  };
}

export const writeUnderwritingTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'write_underwriting',
  description:
    'Persist the proforma snapshot to deal_underwriting_snapshots. ' +
    'Call ONCE per run after all write_evidence_rows calls are done. ' +
    'Runs sanity checks against the snapshot before writing.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:deal_context',

  execute: async (input, ctx) => {
    // ── Fetch deal context for lease-up detection ──
    let dealProjectType: string | null = null;
    try {
      const dealRow = await query(
        `SELECT project_type FROM deals WHERE id = $1`,
        [input.deal_id]
      );
      dealProjectType = (dealRow.rows[0]?.project_type as string | null) ?? null;
    } catch (lookupErr) {
      logger.warn('write_underwriting: could not fetch deal project_type (non-fatal)', {
        dealId: input.deal_id,
        err: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
      });
    }

    // ── Run sanity checks BEFORE writing to database ──
    // evidence_rows are written separately via write_evidence_rows;
    // sanity checks run against the proforma_snapshot values only.
    const sanityResult = runSanityChecks(
      [],
      input.proforma_snapshot,
      { projectType: dealProjectType }
    );

    // Log warnings and blockers
    if (sanityResult.warnings.length > 0) {
      logger.warn('write_underwriting sanity warnings', {
        runId: ctx.correlationId,
        dealId: input.deal_id,
        warnings: sanityResult.warnings,
      });
    }

    // If blockers exist, REFUSE to write and return error
    if (!sanityResult.passed) {
      logger.error('write_underwriting BLOCKED by sanity check', {
        runId: ctx.correlationId,
        dealId: input.deal_id,
        blockers: sanityResult.blockers,
      });

      // Return failure with explanation instead of writing bad data
      return {
        success: false,
        evidence_ids: [],
        snapshot_id: null,
        written_at: new Date().toISOString(),
        sanity_warnings: [
          ...sanityResult.blockers,
          ...sanityResult.warnings,
          'Data NOT written to database. Please review extraction data for errors.',
        ],
      };
    }

    // Sanity checks passed — write snapshot
    let snapshotId: string | null = null;
    if (input.proforma_snapshot) {
      const snapResult = await query(
        `INSERT INTO deal_underwriting_snapshots
           (deal_id, agent_run_id, proforma_json, evidence_map)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          input.deal_id,
          ctx.correlationId ?? null,
          JSON.stringify(input.proforma_snapshot),
          JSON.stringify(input.evidence_map),
        ]
      );
      snapshotId = snapResult.rows[0]?.id as string ?? null;
    }

    logger.info('write_underwriting', {
      runId: ctx.correlationId,
      dealId: input.deal_id,
      snapshotId,
      sanityWarnings: sanityResult.warnings.length,
    });

    return {
      success: true,
      evidence_ids: [],
      snapshot_id: snapshotId,
      written_at: new Date().toISOString(),
      sanity_warnings: sanityResult.warnings.length > 0 ? sanityResult.warnings : undefined,
    };
  },
};
