/** CashFlow Agent Tool: generate_roadmap — prescriptive action plan to a target return. */

import { z } from 'zod';
import { generateRoadmap } from '../../services/roadmap/roadmap-engine';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  deal_id: z.string().uuid().describe(
    'Deal UUID — must match the deal currently being analysed'
  ),
  target_return: z.object({
    metric: z.enum(['irr', 'equity_multiple', 'noi_growth_3yr', 'cash_on_cash_y3']).describe(
      'Which return metric the operator is targeting'
    ),
    value: z.number().positive().describe(
      'Target value — IRR/CoC/NOI-growth as decimal (e.g. 0.15 for 15%), equity multiple as ratio (e.g. 2.0)'
    ),
    hold_years: z.number().int().min(1).max(36).describe(
      'Holding period in years'
    ),
  }).describe('Target return specification'),
  constraints: z.object({
    max_capex_budget: z.number().nonnegative().optional().describe(
      'Maximum total capital expenditure budget across all actions ($)'
    ),
    sponsor_excluded_actions: z.array(z.string()).optional().describe(
      'Action IDs the sponsor explicitly wants to exclude'
    ),
    must_include_actions: z.array(z.string()).optional().describe(
      'Action IDs that must be included regardless of eligibility'
    ),
  }).optional().describe('Optional constraints on the roadmap'),
  sponsor_capabilities: z.object({
    in_house_pm: z.boolean().describe('Sponsor has in-house property management capability'),
    renovation_experience: z.enum(['low', 'medium', 'high']).describe('Sponsor renovation track record'),
    leasing_strategy_change_capability: z.boolean().describe('Sponsor can execute a leasing strategy overhaul'),
  }).optional().describe('Sponsor operational capabilities affecting action eligibility'),
});

export type GenerateRoadmapInput = z.infer<typeof InputSchema>;

const OutputSchema = z.object({
  success: z.boolean(),
  roadmap_id: z.string().optional().describe('DB row ID if persisted, undefined for in-agent calls'),
  summary: z.string().describe('One-line achievability summary for agent narrative'),
  achievability_status: z.string(),
  baseline_irr: z.number().describe('Baseline IRR (%)'),
  roadmap_irr: z.number().describe('IRR achievable via the roadmap (%)'),
  target_irr: z.number().describe('Target IRR requested (%)'),
  action_count: z.number().int().describe('Number of ordered actions in the roadmap'),
  total_noi_gap: z.number().describe('Total NOI gap to close ($)'),
  roadmap_output: z.unknown().describe('Full RoadmapOutput JSON — include in agent response'),
});

export const generateRoadmapTool = {
  name: 'generate_roadmap',
  description: `Generate a value-creation roadmap for the deal.

Use this tool when the operator asks for:
- A plan to reach a specific IRR, equity multiple, cash-on-cash, or NOI growth target
- "What actions should I take to hit X%?"
- "Build me a roadmap to achieve Y return"
- Roadmap Mode (mode: roadmap)

This tool derives the baseline from the underwriting snapshot already assembled by
context tools, computes the NOI gap to the target, sequences evidence-backed operational
actions, and produces a year-by-year trajectory showing how IRR improves.

IMPORTANT: Call fetch_data_matrix (or fetch_t12 + fetch_assumptions) BEFORE this tool
so the underwriting baseline reflects current deal data.`,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async (input: GenerateRoadmapInput) => {
    logger.info('[generate_roadmap] Tool called by cashflow agent', {
      deal_id: input.deal_id,
      metric: input.target_return.metric,
      value: input.target_return.value,
      hold_years: input.target_return.hold_years,
    });

    const roadmapOutput = await generateRoadmap({
      deal_id: input.deal_id,
      target_return: input.target_return,
      constraints: input.constraints,
      sponsor_capabilities: input.sponsor_capabilities,
    });

    return {
      success: true,
      summary: roadmapOutput.meta.achievability_reasoning,
      achievability_status: roadmapOutput.meta.achievability_status,
      baseline_irr: roadmapOutput.meta.baseline_irr,
      roadmap_irr: roadmapOutput.meta.roadmap_irr,
      target_irr: roadmapOutput.meta.target_irr,
      action_count: roadmapOutput.roadmap_actions.length,
      total_noi_gap: roadmapOutput.gap_analysis.total_noi_gap,
      roadmap_output: roadmapOutput,
    };
  },
};
