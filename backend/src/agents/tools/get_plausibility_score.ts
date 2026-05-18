/**
 * Tool: get_plausibility_score
 *
 * Returns a plausibility band (green / amber / red) for a single named
 * underwriting variable, based on its Mahalanobis distance from the
 * market-regime distribution stored in VARIABLE_META.
 *
 * Designed for the F9 evidence drawer: each proforma field can call this
 * tool to obtain its aggressiveness chip without requiring the full
 * assumption vector that evaluate_plausibility needs.
 *
 * Band → UI color mapping:
 *   Realistic  (|z| ≤ 1.0)   → green
 *   Stretch    (|z| ≤ 1.5)   → amber
 *   Aggressive (|z| ≤ 2.0)   → amber
 *   Heroic     (|z| ≤ 3.0)   → red
 *   Unrealistic(|z| > 3.0)   → red
 */

import { z } from 'zod';
import { VARIABLE_META } from '../../services/sigma/sigma-engine';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  variable_name: z.string().describe(
    'VARIABLE_META key for the assumption (e.g., "rentGrowthY1", "vacancyAtStabilization", "exitCapRate"). ' +
    'Full list: purchasePrice, pricePerUnit, goingInCapRate, rentGrowthY1, rentGrowthStabilized, ' +
    'vacancyAtStabilization, lossToLeasePct, concessionsPct, otherIncomePerUnit, opexPerUnit, ' +
    'expenseGrowthRate, propertyTaxPctOfRevenue, insurancePerUnit, managementFeePct, ' +
    'replacementReservesPerUnit, capexPerUnitYr1, loanAmount, interestRate, ltv, ' +
    'ioPeriodYears, amortYears, exitCapRate, holdYears, renovationCostPerUnit.'
  ),
  value: z.number().describe(
    'The assumption value in native units (e.g., 0.035 for 3.5% rent growth, 0.07 for 7% vacancy).'
  ),
  field_path: z.string().optional().describe(
    'Optional proforma field path for logging (e.g., "revenue.rent_growth_y1"). ' +
    'Not used in computation; aids correlation in evidence drawer.'
  ),
});

const OutputSchema = z.object({
  variable_name: z.string(),
  value: z.number(),
  prior: z.number().describe('Market-regime center (prior mean) for this variable'),
  std: z.number().describe('Market-regime standard deviation'),
  z_score: z.number().describe('Signed z-score: (value − prior) / std'),
  abs_z: z.number().describe('|z_score| — absolute deviation'),
  band: z.string().describe('Realistic | Stretch | Aggressive | Heroic | Unrealistic'),
  color: z.enum(['green', 'amber', 'red']).describe(
    'UI chip color: green = Realistic, amber = Stretch/Aggressive, red = Heroic/Unrealistic'
  ),
  anomaly: z.boolean().describe('True when |z| > 2.0 — flags >2σ anomaly for alert system'),
  known_variable: z.boolean().describe(
    'False when variable_name is not in VARIABLE_META (score is not applicable)'
  ),
});

export type GetPlausibilityScoreInput  = z.infer<typeof InputSchema>;
export type GetPlausibilityScoreOutput = z.infer<typeof OutputSchema>;

export async function getPlausibilityScore(
  input: GetPlausibilityScoreInput,
): Promise<GetPlausibilityScoreOutput> {
  const meta = VARIABLE_META[input.variable_name];

  logger.info('[get_plausibility_score] Scoring variable', {
    variable_name: input.variable_name,
    value: input.value,
    field_path: input.field_path,
  });

  if (!meta) {
    return {
      variable_name: input.variable_name,
      value: input.value,
      prior: 0,
      std: 1,
      z_score: 0,
      abs_z: 0,
      band: 'Realistic',
      color: 'green',
      anomaly: false,
      known_variable: false,
    };
  }

  const z_score = (input.value - meta.prior) / meta.std;
  const abs_z   = Math.abs(z_score);

  let band: string;
  let color: 'green' | 'amber' | 'red';

  if (abs_z <= 1.0)      { band = 'Realistic';   color = 'green'; }
  else if (abs_z <= 1.5) { band = 'Stretch';      color = 'amber'; }
  else if (abs_z <= 2.0) { band = 'Aggressive';   color = 'amber'; }
  else if (abs_z <= 3.0) { band = 'Heroic';       color = 'red'; }
  else                   { band = 'Unrealistic';  color = 'red'; }

  return {
    variable_name: input.variable_name,
    value: input.value,
    prior: meta.prior,
    std: meta.std,
    z_score: parseFloat(z_score.toFixed(3)),
    abs_z:   parseFloat(abs_z.toFixed(3)),
    band,
    color,
    anomaly: abs_z > 2.0,
    known_variable: true,
  };
}

export const getPlausibilityScoreTool = {
  name: 'get_plausibility_score',
  description: `Score a single underwriting assumption for plausibility vs the market-regime distribution.

Returns z-score, band (Realistic/Stretch/Aggressive/Heroic/Unrealistic), UI color chip (green/amber/red),
and anomaly flag (true when |z| > 2σ).

Use this to annotate individual proforma field evidence rows with a plausibility chip,
so the F9 evidence drawer can surface aggressiveness context next to each assumption.

Anomaly flag (|z| > 2σ) is also used by the deal capsule alert system to emit medium-severity
anomaly alerts when projected variables are outside the expected distribution.

Known variable names (VARIABLE_META keys):
  rentGrowthY1, rentGrowthStabilized, vacancyAtStabilization, exitCapRate,
  goingInCapRate, opexPerUnit, expenseGrowthRate, lossToLeasePct, concessionsPct,
  ltv, interestRate, propertyTaxPctOfRevenue, insurancePerUnit, managementFeePct,
  replacementReservesPerUnit, capexPerUnitYr1

Example: { "variable_name": "rentGrowthY1", "value": 0.055, "field_path": "revenue.rent_growth_y1" }`,
  inputSchema:  InputSchema,
  outputSchema: OutputSchema,
  execute: getPlausibilityScore,
};
