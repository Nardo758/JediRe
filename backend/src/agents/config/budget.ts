/**
 * Default budget caps per agent.
 * All five Layer 1 agents have explicit caps here.
 * Tune from telemetry once production data is available.
 * All agents share the same maxCostUsdPerDealPerDay cap;
 * BudgetEnforcer.check() enforces it across the deal regardless of agent.
 */

import type { BudgetCaps } from '../runtime/types';

export const DEFAULT_BUDGET_CAPS: Record<string, BudgetCaps> = {
  research: {
    maxTokensPerRun: 500_000,
    maxCostUsdPerRun: 5.00,
    maxStepsPerRun: 30,
    maxCostUsdPerDealPerDay: 20.00,
    maxCostUsdPerUserPerMonth: Infinity,
  },
  zoning: {
    maxTokensPerRun: 200_000,
    maxCostUsdPerRun: 2.50,
    maxStepsPerRun: 20,
    maxCostUsdPerDealPerDay: 20.00,
    maxCostUsdPerUserPerMonth: Infinity,
  },
  supply: {
    maxTokensPerRun: 250_000,
    maxCostUsdPerRun: 3.00,
    maxStepsPerRun: 25,
    maxCostUsdPerDealPerDay: 20.00,
    maxCostUsdPerUserPerMonth: Infinity,
  },
  cashflow: {
    maxTokensPerRun: 800_000,
    maxCostUsdPerRun: 8.00,
    maxStepsPerRun: 35,
    maxCostUsdPerDealPerDay: 25.00,
    maxCostUsdPerUserPerMonth: Infinity,
  },
  commentary: {
    maxTokensPerRun: 200_000,
    maxCostUsdPerRun: 2.50,
    maxStepsPerRun: 20,
    maxCostUsdPerDealPerDay: 20.00,
    maxCostUsdPerUserPerMonth: Infinity,
  },
};
