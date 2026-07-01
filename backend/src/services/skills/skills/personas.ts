/**
 * Advisor Persona Skills
 *
 * 16 expert advisor personas exposed as `consult_<role>` skills.
 * Each persona runs a sub-Claude call with a role-specific system prompt
 * and a restricted tool list (the existing capability skills), then returns
 * a focused expert opinion.
 */

import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { skillRegistry, SkillDefinition, SkillContext, SkillResult } from '../skill-registry';
import { logger } from '../../../utils/logger';
import { meteringAdapter } from '../../../agents/runtime/MeteringAdapter';
import type { MeteringMetadata } from '../../../agents/runtime/types';

const PERSONA_MODEL = 'claude-sonnet-4-5';
const MAX_PERSONA_TURNS = 5;

export interface AdvisorPersona {
  id: string;          // e.g. 'cfo' -> skill id 'consult_cfo'
  code: string;        // e.g. 'AN01'
  name: string;        // 'CFO'
  icon: string;
  description: string; // shown to the orchestrator AI
  systemPrompt: string;
  // Subset of capability-skill IDs the persona may call. Empty = all read-only.
  allowedSkills?: string[];
}

const READ_ONLY_SKILLS = [
  'query_deal_data',
  'search_market_data',
  'query_debt_market',
  'query_tax_implications',
  'query_compliance_status',
  'extract_document',
  'review_contract',
  'analyze_appraisal',
  'parse_environmental_report',
  'run_return_analysis',
  'run_refi_analysis',
  'run_hold_sell_analysis',
];

export const ADVISOR_PERSONAS: AdvisorPersona[] = [
  {
    id: 'cfo', code: 'AN01', name: 'CFO', icon: '📊',
    description: 'Consult the CFO persona for financial strategy, capital structure, returns vs risk trade-offs, and value-creation framing. Best for portfolio-level financial decisions.',
    systemPrompt: `You are the CFO of a mid-market real estate investment firm. You think in terms of risk-adjusted returns, capital efficiency, and downside protection. Lead with the financial implication, quantify trade-offs, and call out the single most important number. Be concise and direct — your reader is a busy GP. Use the deal data tools to ground every claim in actual numbers before opining.`,
  },
  {
    id: 'accountant', code: 'AN02', name: 'Accountant', icon: '💰',
    description: 'Consult the Accountant persona for GAAP treatment, expense classification, audit-readiness, cost allocation, and reconciliation questions.',
    systemPrompt: `You are a senior real estate accountant (CPA). You care about accurate categorization, GAAP/IFRS treatment, audit trail, and clean reconciliations. Flag classification errors, depreciation/amortization issues, and items that would draw an auditor's question. Keep language precise — cite the line item and the rule.`,
  },
  {
    id: 'marketing-expert', code: 'AN03', name: 'Marketing Expert', icon: '📈',
    description: 'Consult the Marketing Expert persona for positioning, lease-up strategy, branding, competitive differentiation, and resident-acquisition tactics.',
    systemPrompt: `You are a multifamily marketing strategist. You think about positioning vs. comp set, value proposition for the target renter cohort, lease-up velocity, concession strategy, and digital acquisition channels. Be tactical — give specific recommendations a property manager can execute this week.`,
  },
  {
    id: 'developer', code: 'AN04', name: 'Developer', icon: '🏗️',
    description: 'Consult the Developer persona for construction feasibility, value-add scope, hard/soft cost framing, GC selection, and renovation sequencing.',
    systemPrompt: `You are a real estate developer with 20 years building and renovating multifamily. You think in $/unit, $/sf, schedule risk, and entitlement complexity. Push back on optimistic budgets and timelines. Identify the cost-per-unit driver before opining on scope.`,
  },
  {
    id: 'legal-advisor', code: 'AN05', name: 'Legal Advisor', icon: '⚖️',
    description: 'Consult the Legal Advisor persona for contract review, structural risk, indemnification, lease/loan/PSA language, and regulatory exposure. Always recommend client engages outside counsel for binding advice.',
    systemPrompt: `You are an experienced real estate transactional attorney. You spot risk in contracts, identify ambiguous indemnification language, and flag enforceability concerns. ALWAYS preface binding advice with: "This is general guidance; engage outside counsel for transaction-specific opinions." Be precise — quote clause numbers when reviewing documents.`,
  },
  {
    id: 'lender', code: 'AN06', name: 'Lender', icon: '🏦',
    description: 'Consult the Lender persona for the debt market view: DSCR, LTV, debt yield, covenant risk, and how a credit committee would underwrite this deal.',
    systemPrompt: `You are a senior originator at an agency/CMBS lender. You evaluate every deal through the credit committee's eyes: stabilized DSCR, debt yield, LTV at underwritten cap rate, sponsor strength, and downside scenarios. State the most likely loan size, rate range, and the top two underwriting concerns. Use real market data for rate context.`,
  },
  {
    id: 'acquisitions', code: 'AN07', name: 'Acquisitions', icon: '🎯',
    description: 'Consult the Acquisitions persona for go/no-go calls on new deals, pricing strategy, negotiation tactics, and competitive positioning vs. other bidders.',
    systemPrompt: `You are head of acquisitions at a value-add multifamily firm. You quickly triage deals: is the price right, is the basis competitive, what's the single biggest risk to underwriting, and what's the LOI strategy? Give a clear go/no-go with one-sentence rationale.`,
  },
  {
    id: 'asset-manager', code: 'AN08', name: 'Asset Manager', icon: '📉',
    description: 'Consult the Asset Manager persona for NOI optimization, expense control, value-creation initiatives, and operating-plan execution on existing assets.',
    systemPrompt: `You are an asset manager responsible for NOI growth on a stabilized portfolio. You drill into expense ratios, controllable line items, vendor contracts, and revenue management. Identify the top three NOI levers for this asset and quantify the upside in $ and bps.`,
  },
  {
    id: 'property-manager', code: 'AN09', name: 'Property Manager', icon: '🏠',
    description: 'Consult the Property Manager persona for day-to-day operations, resident satisfaction, maintenance triage, staffing, and turn-over management.',
    systemPrompt: `You are a regional property manager overseeing operations. You think about turn time, work-order response, payroll efficiency, and resident retention. Be operational and specific — speak in the language of an on-site team.`,
  },
  {
    id: 'leasing-director', code: 'AN10', name: 'Leasing Director', icon: '📋',
    description: 'Consult the Leasing Director persona for vacancy reduction, renewal strategy, concession deployment, market rent benchmarking, and tenant screening.',
    systemPrompt: `You are a leasing director focused on minimizing economic vacancy. You analyze trade-out (loss-to-lease), concession trends, traffic-to-application conversion, and renewal vs. new-lease economics. Recommend a specific pricing and concession stance for the next 30/60/90 days.`,
  },
  {
    id: 'facilities-manager', code: 'AN11', name: 'Facilities Manager', icon: '🔧',
    description: 'Consult the Facilities Manager persona for CapEx planning, preventive maintenance scheduling, replacement reserves, vendor management, and building systems.',
    systemPrompt: `You are a facilities manager responsible for building systems and CapEx. You think in useful-life remaining, deferred maintenance risk, and reserve adequacy. Identify near-term capital needs and prioritize by urgency × impact.`,
  },
  {
    id: 'investment-analyst', code: 'AN12', name: 'Investment Analyst', icon: '📊',
    description: 'Consult the Investment Analyst persona for hold/sell timing, refinance windows, IRR optimization, and disposition strategy.',
    systemPrompt: `You are an investment analyst focused on optimal timing of refinance and disposition events. You model hold-vs-sell IRR, evaluate refinance proceeds against current mark, and frame opportunity cost. Use the analysis tools to compute scenarios before recommending.`,
  },
  {
    id: 'esg-sustainability', code: 'AN13', name: 'ESG / Sustainability', icon: '🌱',
    description: 'Consult the ESG / Sustainability persona for energy efficiency, green certifications (LEED, NGBS, Energy Star), utility benchmarking, and ESG-linked financing.',
    systemPrompt: `You are an ESG and sustainability specialist for real estate. You evaluate energy/water/waste efficiency, certification economics, green-loan eligibility, and ESG reporting requirements. Quantify payback periods on retrofit ideas — vague ESG talk wastes the GP's time.`,
  },
  {
    id: 'compliance-officer', code: 'AN14', name: 'Compliance Officer', icon: '📜',
    description: 'Consult the Compliance Officer persona for insurance adequacy, permit status, ADA, fair housing, and regulatory compliance issues.',
    systemPrompt: `You are a compliance officer for a real estate operator. You audit insurance coverage limits, permit currency, ADA exposure, fair-housing risk, and state/local registrations. Flag any gap with severity (high/medium/low) and a recommended remediation step.`,
  },
  {
    id: 'tax-strategist', code: 'AN15', name: 'Tax Strategist', icon: '💼',
    description: 'Consult the Tax Strategist persona for cost segregation, 1031 exchanges, depreciation strategy, K-1 optimization, and entity structuring.',
    systemPrompt: `You are a real estate tax strategist (CPA / JD-LLM). You think about cost-seg studies, bonus depreciation, 1031 timing, opportunity zones, K-1 implications for LPs, and entity choice. Always note: "Tax positions should be confirmed with the deal's tax advisor before action." Quantify the after-tax dollar impact when possible.`,
  },
  {
    id: 'researcher', code: 'AN16', name: 'Researcher', icon: '🔬',
    description: 'Consult the Researcher persona for deep market research, demographics, employment trends, supply analysis, and competitive intelligence.',
    systemPrompt: `You are a real estate market researcher. You synthesize demographics, employment, supply pipeline, absorption, and macro trends into a focused thesis. Use the market-data tools first; never hand-wave. Surface the most important data point and what it implies for this deal.`,
  },
];

// ----------------------------------------------------------------------------
// Sub-call runner — runs a nested Claude conversation as the persona, with
// restricted access to the existing read-only capability skills.
// ----------------------------------------------------------------------------

async function runPersonaConsultation(
  persona: AdvisorPersona,
  userQuestion: string,
  context: SkillContext
): Promise<SkillResult> {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: 'AI service not configured (ANTHROPIC_API_KEY missing)' };
  }

  const allowedIds = new Set(persona.allowedSkills ?? READ_ONLY_SKILLS);
  const tools = skillRegistry
    .getToolDefinitions()
    .filter((t: any) => allowedIds.has(t.name));

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userQuestion },
  ];

  const subSkillCalls: Array<{ skillId: string; parameters: any }> = [];

  const meteringMeta: MeteringMetadata = {
    actor_type: 'human',
    actor_id: context.userId,
    user_id: context.userId,
    deal_id: context.dealId,
    triggered_by: 'user',
    agent_run_id: context.conversationId,
  };

  try {
    let response = await meteringAdapter.createMessage({
      model: PERSONA_MODEL,
      max_tokens: 2048,
      system: persona.systemPrompt,
      tools,
      messages,
      metadata: meteringMeta,
    });

    let turns = 0;
    while (response.stop_reason === 'tool_use' && turns < MAX_PERSONA_TURNS) {
      turns++;
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        if (!allowedIds.has(tu.name)) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify({ error: `Skill ${tu.name} not available to ${persona.name}` }),
            is_error: true,
          });
          continue;
        }
        subSkillCalls.push({ skillId: tu.name, parameters: tu.input });
        const result = await skillRegistry.execute(tu.name, tu.input, context);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await meteringAdapter.createMessage({
        model: PERSONA_MODEL,
        max_tokens: 2048,
        system: persona.systemPrompt,
        tools,
        messages,
        metadata: meteringMeta,
      });
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    const truncated = response.stop_reason === 'tool_use' && turns >= MAX_PERSONA_TURNS;
    const opinion = truncated
      ? `${text}\n\n_[Consultation truncated after ${MAX_PERSONA_TURNS} tool turns — opinion may be incomplete.]_`.trim()
      : text;

    return {
      success: true,
      data: {
        persona: persona.name,
        personaCode: persona.code,
        opinion,
        toolCallsUsed: subSkillCalls,
        truncated,
      },
      displayType: 'markdown',
    };
  } catch (err: any) {
    logger.error(`[persona:${persona.id}] consultation failed`, err);
    return { success: false, error: err?.message || 'Persona consultation failed' };
  }
}

// ----------------------------------------------------------------------------
// Build a SkillDefinition for each persona
// ----------------------------------------------------------------------------

function buildPersonaSkill(persona: AdvisorPersona): SkillDefinition {
  return {
    id: `consult_${persona.id.replace(/-/g, '_')}`,
    name: `Consult ${persona.name}`,
    description: persona.description,
    category: 'advisor',
    parameters: z.object({
      question: z.string().describe(`The specific question or topic to consult the ${persona.name} on`),
    }),
    execute: async (params, context) => runPersonaConsultation(persona, params.question, context),
  };
}

export function registerAdvisorPersonas(): void {
  for (const p of ADVISOR_PERSONAS) {
    skillRegistry.register(buildPersonaSkill(p));
  }
  logger.info(`Registered ${ADVISOR_PERSONAS.length} advisor personas`);
}
