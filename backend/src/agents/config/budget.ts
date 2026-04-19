/**
 * Default budget caps per agent.
 * Tune from telemetry once production data is available.
 * Commentary agent intentionally omitted — it generates short summaries
 * and shares the deal-daily cap with other agents.
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
    maxTokensPerRun: 200_000,
    maxCostUsdPerRun: 2.50,
    maxStepsPerRun: 20,
    maxCostUsdPerDealPerDay: 20.00,
    maxCostUsdPerUserPerMonth: Infinity,
  },
  cashflow: {
    maxTokensPerRun: 300_000,
    maxCostUsdPerRun: 3.00,
    maxStepsPerRun: 25,
    maxCostUsdPerDealPerDay: 20.00,
    maxCostUsdPerUserPerMonth: Infinity,
  },
  commentary: {
    maxTokensPerRun: 100_000,
    maxCostUsdPerRun: 1.00,
    maxStepsPerRun: 10,
    maxCostUsdPerDealPerDay: 20.00,
    maxCostUsdPerUserPerMonth: Infinity,
  },
};
