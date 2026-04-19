/**
 * Coordinator Dispatch Table
 *
 * INTENT_DISPATCH maps each of the 10 routing specialists to either:
 *   - An AgentRuntime instance (Layer 1 — full tool-calling loop)
 *   - A named context fragment (Layer 2 — injected into general LLM handler)
 *
 * Layer 1 agents (4): RESEARCH, ZONING, SUPPLY, CASH
 * Layer 2 specialists (6): DEMAND, COMPS, RISK, DEBT, NEWS, STRATEGY
 *
 * Usage in agent-delegator.ts:
 *   const dispatch = INTENT_DISPATCH[specialist];
 *   if (dispatch.type === 'agent') { dispatch.runtime.run(...) }
 *   else { inject dispatch.fragmentKey into LLM system prompt }
 */

import type { AgentRuntime } from '../agents/runtime/AgentRuntime';
import { researchRuntime } from '../agents/research.config';
import { zoningRuntime } from '../agents/zoning.config';
import { supplyRuntime } from '../agents/supply.config';
import { cashflowRuntime } from '../agents/cashflow.config';

export type SpecialistKey =
  | 'RESEARCH' | 'ZONING' | 'SUPPLY' | 'CASH'
  | 'DEMAND' | 'COMPS' | 'RISK' | 'DEBT' | 'NEWS' | 'STRATEGY';

/** Layer 1 dispatch — routes to AgentRuntime with full tool-calling loop */
export interface AgentDispatch {
  type: 'agent';
  agentId: string;
  runtime: AgentRuntime;
}

/** Layer 2 dispatch — routes to named context fragment injected into general LLM handler */
export interface FragmentDispatch {
  type: 'fragment';
  fragmentKey: string;
  description: string;
}

export type DispatchEntry = AgentDispatch | FragmentDispatch;

/**
 * INTENT_DISPATCH — authoritative routing table for all 10 specialist labels.
 *
 * Modify this table to graduate a Layer 2 specialist to Layer 1 once
 * 30-day usage data confirms tool investment is warranted.
 */
export const INTENT_DISPATCH: Record<SpecialistKey, DispatchEntry> = {
  // ── Layer 1: Full AgentRuntime execution ──────────────────────────
  RESEARCH: {
    type: 'agent',
    agentId: 'research',
    runtime: researchRuntime,
  },
  ZONING: {
    type: 'agent',
    agentId: 'zoning',
    runtime: zoningRuntime,
  },
  SUPPLY: {
    type: 'agent',
    agentId: 'supply',
    runtime: supplyRuntime,
  },
  CASH: {
    type: 'agent',
    agentId: 'cashflow',
    runtime: cashflowRuntime,
  },

  // ── Layer 2: Context fragment injection ───────────────────────────
  DEMAND: {
    type: 'fragment',
    fragmentKey: 'demand',
    description: 'Demand drivers: employment, population, rent growth, occupancy trends',
  },
  COMPS: {
    type: 'fragment',
    fragmentKey: 'comps',
    description: 'Comparable sales, rent comps, cap rate benchmarks for the submarket',
  },
  RISK: {
    type: 'fragment',
    fragmentKey: 'risk',
    description: 'Risk identification: market, operational, regulatory, capital structure',
  },
  DEBT: {
    type: 'fragment',
    fragmentKey: 'debt',
    description: 'Debt options, interest rates, loan terms, lender matching for this deal type',
  },
  NEWS: {
    type: 'fragment',
    fragmentKey: 'news',
    description: 'Recent market news, sentiment, employer announcements, regulatory changes',
  },
  STRATEGY: {
    type: 'fragment',
    fragmentKey: 'strategy',
    description: 'Investment strategy options: core, value-add, opportunistic, development',
  },
};

/**
 * Type guard to check if a dispatch entry routes to an AgentRuntime.
 */
export function isAgentDispatch(entry: DispatchEntry): entry is AgentDispatch {
  return entry.type === 'agent';
}

/**
 * Type guard to check if a dispatch entry routes to a context fragment.
 */
export function isFragmentDispatch(entry: DispatchEntry): entry is FragmentDispatch {
  return entry.type === 'fragment';
}
