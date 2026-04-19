/**
 * Tool: detect_collision
 *
 * Pure logic tool — no LLM, no DB calls.
 * Compares an agent-derived value against a broker OM value and produces
 * a CollisionReport with delta_pct, magnitude classification, direction, and narrative.
 *
 * Magnitude thresholds:
 *   minor    — |delta| < 5%
 *   material — 5% ≤ |delta| < 15%
 *   severe   — |delta| ≥ 15%
 */

import { z } from 'zod';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  field_path: z.string().describe('Dot-separated proforma field, e.g. "vacancy_rate" or "taxes.annual"'),
  agent_value: z.number().describe('Agent-derived numeric value'),
  broker_value: z.number().describe('Broker OM numeric value'),
  field_label: z.string().optional().describe('Human-readable field label for narrative'),
  value_unit: z.string().optional().describe('Unit for display, e.g. "%" or "$/unit/yr" or "$"'),
});

const OutputSchema = z.object({
  field_path: z.string(),
  agent_value: z.number(),
  broker_value: z.number(),
  delta_pct: z.number().describe('Signed delta: (agent - broker) / |broker|'),
  magnitude: z.enum(['minor', 'material', 'severe']),
  direction: z.enum(['agent_higher', 'agent_lower', 'equal']),
  narrative: z.string(),
  collision_detected: z.boolean().describe('true if magnitude is material or severe'),
});

export const detectCollisionTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'detect_collision',
  description:
    'Compare agent-derived value against broker OM value. Returns a CollisionReport with ' +
    'delta percentage, magnitude (minor/material/severe), direction, and narrative. ' +
    'Call for every assumption where a broker OM value exists. Pure computation — no DB calls.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  execute: async (input) => {
    const { field_path, agent_value, broker_value, field_label, value_unit } = input;

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
  },
};
