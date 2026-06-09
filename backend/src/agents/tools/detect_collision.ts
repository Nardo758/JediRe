/**
 * Tool: detect_collision
 *
 * Pure logic tool — no LLM, no DB calls.
 * Compares agent-derived values against broker OM values and produces
 * CollisionReports with delta_pct, magnitude classification, direction, and narrative.
 *
 * Accepts a batch of comparisons in one call to avoid per-field round-trips.
 * The `comparisons` array accepts 1–20 field comparisons and returns results
 * keyed by field_path.
 *
 * Magnitude thresholds:
 *   minor    — |delta| < 5%
 *   material — 5% ≤ |delta| < 15%
 *   severe   — |delta| ≥ 15%
 */

import { z } from 'zod';
import type { ToolDefinition } from '../runtime/types';

const ComparisonSchema = z.object({
  field_path: z.string().describe('Dot-separated proforma field, e.g. "vacancy_rate" or "taxes.annual"'),
  agent_value: z.number().describe('Agent-derived numeric value'),
  broker_value: z.number().describe('Broker OM numeric value'),
  field_label: z.string().optional().describe('Human-readable field label for narrative'),
  value_unit: z.string().optional().describe('Unit for display, e.g. "%" or "$/unit/yr" or "$"'),
});

const CollisionReportSchema = z.object({
  field_path: z.string(),
  agent_value: z.number(),
  broker_value: z.number(),
  delta_pct: z.number().describe('Signed delta: (agent - broker) / |broker|'),
  magnitude: z.enum(['minor', 'material', 'severe']),
  direction: z.enum(['agent_higher', 'agent_lower', 'equal']),
  narrative: z.string(),
  collision_detected: z.boolean().describe('true if magnitude is material or severe'),
});

const InputSchema = z.object({
  comparisons: z.array(ComparisonSchema).min(1).max(20).describe(
    'Array of field comparisons. Pass ALL fields needing collision detection in one call ' +
    'to avoid per-field round-trips. Each entry needs field_path, agent_value, broker_value.'
  ),
});

const OutputSchema = z.object({
  results: z.record(z.string(), CollisionReportSchema).describe(
    'Map of field_path → CollisionReport for each comparison'
  ),
  summary: z.object({
    minor_count: z.number(),
    material_count: z.number(),
    severe_count: z.number(),
    collision_detected_count: z.number(),
  }),
});

function computeCollision(comp: z.infer<typeof ComparisonSchema>): z.infer<typeof CollisionReportSchema> {
  const { field_path, agent_value, broker_value, field_label, value_unit } = comp;

  let delta_pct = 0;
  if (broker_value !== 0) {
    delta_pct = (agent_value - broker_value) / Math.abs(broker_value);
  } else if (agent_value !== 0) {
    delta_pct = agent_value > 0 ? 1 : -1;
  }

  const absDelta = Math.abs(delta_pct);
  const magnitude: 'minor' | 'material' | 'severe' =
    absDelta >= 0.15 ? 'severe' : absDelta >= 0.05 ? 'material' : 'minor';

  const direction: 'agent_higher' | 'agent_lower' | 'equal' =
    delta_pct > 0.001 ? 'agent_higher' : delta_pct < -0.001 ? 'agent_lower' : 'equal';

  const label = field_label ?? field_path;
  const unit = value_unit ?? '';
  const agentDisplay = `${agent_value.toLocaleString()}${unit}`;
  const brokerDisplay = `${broker_value.toLocaleString()}${unit}`;
  const deltaPct = `${(delta_pct * 100).toFixed(1)}%`;

  let narrative: string;
  if (magnitude === 'severe') {
    narrative =
      `SEVERE COLLISION on ${label}: Agent derives ${agentDisplay} vs broker OM ${brokerDisplay} ` +
      `(${deltaPct} delta). This is a material difference that requires explicit explanation. ` +
      `${direction === 'agent_higher'
        ? 'The agent is more conservative — broker OM may be overstating income or understating expenses.'
        : 'The agent is more aggressive — verify evidence tier before accepting.'}`;
  } else if (magnitude === 'material') {
    narrative =
      `MATERIAL COLLISION on ${label}: Agent derives ${agentDisplay} vs broker OM ${brokerDisplay} ` +
      `(${deltaPct} delta). ` +
      `${direction === 'agent_higher'
        ? 'Agent is higher — cross-check with Tier 1-2 data.'
        : 'Broker OM is higher — verify whether this reflects market or is aspirational.'}`;
  } else {
    narrative =
      `Minor variance on ${label}: Agent ${agentDisplay} vs broker OM ${brokerDisplay} (${deltaPct}). Within acceptable range.`;
  }

  return {
    field_path,
    agent_value,
    broker_value,
    delta_pct: Math.round(delta_pct * 10000) / 10000,
    magnitude,
    direction,
    narrative,
    collision_detected: magnitude !== 'minor',
  };
}

export const detectCollisionTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'detect_collision',
  description:
    'Compare agent-derived values against broker OM values. Pass ALL fields needing collision ' +
    'detection in a single call via the comparisons array (max 20 entries). Returns a CollisionReport ' +
    'per field_path with delta percentage, magnitude (minor/material/severe), direction, and narrative. ' +
    'Pure computation — no DB calls. Batching eliminates per-field round-trips.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  execute: async (input) => {
    const results: Record<string, z.infer<typeof CollisionReportSchema>> = {};
    let minor_count = 0, material_count = 0, severe_count = 0;

    for (const comp of input.comparisons) {
      const report = computeCollision(comp);
      results[comp.field_path] = report;
      if (report.magnitude === 'minor') minor_count++;
      else if (report.magnitude === 'material') material_count++;
      else severe_count++;
    }

    return {
      results,
      summary: {
        minor_count,
        material_count,
        severe_count,
        collision_detected_count: material_count + severe_count,
      },
    };
  },
};
