/**
 * Tool: fetch_assumption_module_map
 *
 * Returns the D-MOD-1 module mapping for one or all F9 assumptions.
 *
 * The agent calls this before deriving a key assumption to learn:
 *   - Which module is authoritative (its value wins on disagreement)
 *   - Which modules provide supporting cross-checks
 *   - The conflict band threshold (% divergence that triggers a flag)
 *   - Which D-MOD-3 pipeline stage must be complete before this assumption can be set
 *
 * This tool is READ-ONLY and requires no special capabilities.
 * Requires no DB access — returns from in-memory config.
 */

import { z } from 'zod';
import type { ToolDefinition } from '../runtime/types';
import {
  ASSUMPTION_MODULE_MAPPINGS,
  getAssumptionMapping,
  getMappingsByStage,
  type AssumptionField,
} from '../../services/module-wiring/assumption-module-mapping.config';
import { REASONING_STAGES } from '../../services/module-wiring/reasoning-pipeline';

const VALID_FIELDS = ASSUMPTION_MODULE_MAPPINGS.map(m => m.field) as [string, ...string[]];

const InputSchema = z.object({
  field: z.enum(VALID_FIELDS as [AssumptionField, ...AssumptionField[]])
    .optional()
    .describe(
      'Specific assumption field to look up (e.g. "revenue.rentGrowth.y1"). ' +
      'If omitted, returns the full mapping table for all 10 assumptions.'
    ),
  stage: z.string().optional()
    .describe(
      'D-MOD-3 pipeline stage to look up (e.g. "market", "capital_structure"). ' +
      'If provided, returns all assumptions that depend on this stage.'
    ),
  include_pipeline: z.boolean().optional().default(false)
    .describe(
      'When true, also returns the full 11-stage D-MOD-3 reasoning pipeline definition ' +
      'with stage gates and dependency chains.'
    ),
});

const MappingOutputSchema = z.object({
  field:                z.string(),
  label:                z.string(),
  description:          z.string(),
  authoritative_module: z.string(),
  supporting_modules:   z.array(z.string()),
  conflict_band_pct:    z.number(),
  placeholder_modules:  z.array(z.string()),
  stage_dependency:     z.string(),
  notes:                z.string(),
});

const StageOutputSchema = z.object({
  id:                  z.string(),
  ordinal:             z.number(),
  name:                z.string(),
  description:         z.string(),
  depends_on:          z.array(z.string()),
  required_modules:    z.array(z.string()),
  optional_modules:    z.array(z.string()),
  primary_agent_tool:  z.string().nullable(),
});

const OutputSchema = z.object({
  mappings:  z.array(MappingOutputSchema),
  pipeline:  z.array(StageOutputSchema).optional(),
  summary:   z.string(),
});

type Input  = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

export const fetchAssumptionModuleMapTool: ToolDefinition<Input, Output> = {
  name: 'fetch_assumption_module_map',
  description:
    'Return the D-MOD-1 assumption → module mapping so you know which module is authoritative ' +
    'for each F9 proforma assumption and what the cross-check conflict band is. ' +
    'Call this before deriving a key assumption (rent growth, vacancy, exit cap, etc.) ' +
    'to understand which module wins on disagreement and what conflict threshold applies. ' +
    'Optionally include the full D-MOD-3 11-stage reasoning pipeline definition.',

  inputSchema:  InputSchema,
  outputSchema: OutputSchema,

  execute: async (input, _ctx) => {
    let mappings = [...ASSUMPTION_MODULE_MAPPINGS];

    if (input.field) {
      const single = getAssumptionMapping(input.field as AssumptionField);
      mappings = single ? [single] : [];
    } else if (input.stage) {
      mappings = getMappingsByStage(input.stage);
    }

    const mappingOutput = mappings.map(m => ({
      field:                m.field,
      label:                m.label,
      description:          m.description,
      authoritative_module: m.authoritativeModule,
      supporting_modules:   m.supportingModules as string[],
      conflict_band_pct:    m.conflictBandPct,
      placeholder_modules:  m.placeholderModules,
      stage_dependency:     m.stageDependency,
      notes:                m.notes,
    }));

    const pipelineOutput = input.include_pipeline
      ? REASONING_STAGES.map(s => ({
          id:                  s.id,
          ordinal:             s.ordinal,
          name:                s.name,
          description:         s.description,
          depends_on:          s.dependsOn as string[],
          required_modules:    s.requiredModules as string[],
          optional_modules:    s.optionalModules as string[],
          primary_agent_tool:  s.primaryAgentTool,
        }))
      : undefined;

    const summary = input.field
      ? `Module mapping for "${input.field}": authoritative=${mappings[0]?.authoritativeModule ?? 'none'}, conflict_band=${(mappings[0]?.conflictBandPct ?? 0) * 100}%, stage=${mappings[0]?.stageDependency ?? 'none'}.`
      : input.stage
        ? `${mappings.length} assumption(s) depend on the "${input.stage}" pipeline stage.`
        : `Full D-MOD-1 mapping table: ${mappings.length} assumptions across ${new Set(mappings.map(m => m.stageDependency)).size} pipeline stages. Resolve authoritative module before cross-checking supporting modules.`;

    return {
      mappings:  mappingOutput,
      pipeline:  pipelineOutput,
      summary,
    };
  },
};
