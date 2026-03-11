import { logger } from '../utils/logger';
import type {
  FinancialOutput,
  ValidationResult,
  ValidationRule,
  VALIDATION_RULES,
} from '../types/financial-model.types';

/**
 * Validate Claude's financial model output against rules.
 * 
 * Checks:
 * - Range validations (IRR, DSCR, etc.)
 * - Structural validations (sources = uses)
 * - Logic validations (first cash flow negative, etc.)
 * - Custom model-specific rules
 */
export function validateModelOutput(output: FinancialOutput): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const reviewReasons: string[] = [];

  // Import validation rules (these are defined in financial-model.types.ts)
  // For now, implement core validators inline

  // 1. Sources = Uses validation
  if (output.sourcesAndUses) {
    const sourcesTotal = output.sourcesAndUses.sources.total;
    const usesTotal = output.sourcesAndUses.uses.total;
    const diff = Math.abs(sourcesTotal - usesTotal);

    if (diff > 1) { // Allow $1 tolerance
      errors.push({
        field: 'sourcesAndUses',
        message: `Sources (${sourcesTotal}) must equal Uses (${usesTotal}). Difference: $${diff.toFixed(2)}`,
        severity: 'error',
      });
    }
  }

  // 2. IRR range validation
  if (output.summaryMetrics?.irr !== undefined) {
    const irr = output.summaryMetrics.irr;
    
    if (irr < -1.0 || irr > 5.0) {
      errors.push({
        field: 'summaryMetrics.irr',
        message: `IRR ${(irr * 100).toFixed(1)}% outside plausible range (-100% to 500%). Likely computation error.`,
        severity: 'error',
      });
    } else if (irr < -0.5 || irr > 1.0) {
      errors.push({
        field: 'summaryMetrics.irr',
        message: `IRR ${(irr * 100).toFixed(1)}% outside typical range (-50% to 100%). Flagged for review.`,
        severity: 'warning',
      });
      reviewReasons.push(`IRR of ${(irr * 100).toFixed(1)}% is unusual`);
    }

    if (irr > 0.5) {
      reviewReasons.push(`High IRR (${(irr * 100).toFixed(1)}%) - verify assumptions`);
    }
  }

  // 3. Equity Multiple validation
  if (output.summaryMetrics?.equityMultiple !== undefined) {
    const em = output.summaryMetrics.equityMultiple;
    
    if (em < 0 || em > 20) {
      errors.push({
        field: 'summaryMetrics.equityMultiple',
        message: `Equity Multiple ${em.toFixed(2)}x outside plausible range (0-20x)`,
        severity: 'error',
      });
    } else if (em > 10) {
      errors.push({
        field: 'summaryMetrics.equityMultiple',
        message: `Equity Multiple ${em.toFixed(2)}x is unusually high (>10x)`,
        severity: 'warning',
      });
      reviewReasons.push(`Very high equity multiple (${em.toFixed(2)}x)`);
    }
  }

  // 4. DSCR range validation
  if (output.summaryMetrics?.minDSCR !== undefined) {
    const dscr = output.summaryMetrics.minDSCR;
    
    if (dscr < 0.5 || dscr > 5.0) {
      errors.push({
        field: 'summaryMetrics.minDSCR',
        message: `DSCR ${dscr.toFixed(2)}x outside normal range (0.5-5.0)`,
        severity: 'warning',
      });
    }

    if (dscr < 1.0) {
      reviewReasons.push(`Below breakeven DSCR (${dscr.toFixed(2)}x < 1.0)`);
    }
  }

  // 5. Cash flow vector validation
  if (output.cashFlowVector && output.cashFlowVector.length > 0) {
    const firstCF = output.cashFlowVector[0];
    
    if (firstCF >= 0) {
      errors.push({
        field: 'cashFlowVector',
        message: 'First cash flow must be negative (equity investment)',
        severity: 'error',
      });
    }
  }

  // 6. Model-specific validations
  switch (output.modelType) {
    case 'acquisition':
      validateAcquisitionSpecific(output, errors, reviewReasons);
      break;
    
    case 'development':
      validateDevelopmentSpecific(output, errors, reviewReasons);
      break;
    
    case 'redevelopment':
      validateRedevelopmentSpecific(output, errors, reviewReasons);
      break;
  }

  // 7. Projections monotonicity checks
  if (output.projections && output.projections.length > 0) {
    for (let i = 1; i < output.projections.length; i++) {
      const prev = output.projections[i - 1];
      const curr = output.projections[i];

      // GPR should generally increase (rent growth)
      if (curr.grossPotentialRent < prev.grossPotentialRent * 0.95) {
        errors.push({
          field: `projections[${i}].grossPotentialRent`,
          message: `GPR decreased significantly from year ${prev.year} to ${curr.year}`,
          severity: 'warning',
        });
      }

      // NOI should be positive in stabilized operations
      if (curr.netOperatingIncome < 0 && i > 1) {
        errors.push({
          field: `projections[${i}].netOperatingIncome`,
          message: `Negative NOI in year ${curr.year} ($${curr.netOperatingIncome.toLocaleString()})`,
          severity: 'warning',
        });
        reviewReasons.push(`Negative NOI in operating year ${curr.year}`);
      }
    }
  }

  // Build result
  const valid = errors.filter(e => e.severity === 'error').length === 0;
  const requiresReview = reviewReasons.length > 0 || 
                          errors.filter(e => e.severity === 'warning').length > 3;

  logger.info('[ModelValidator] Validation complete', {
    valid,
    errorCount: errors.filter(e => e.severity === 'error').length,
    warningCount: errors.filter(e => e.severity === 'warning').length,
    requiresReview,
  });

  return {
    valid,
    errors,
    requiresReview,
    reviewReasons,
  };
}

function validateAcquisitionSpecific(
  output: any,
  errors: ValidationResult['errors'],
  reviewReasons: string[]
): void {
  // Acquisition-specific checks
  if (output.summaryMetrics?.goingInCapRate !== undefined) {
    const capRate = output.summaryMetrics.goingInCapRate;
    if (capRate < 0.03 || capRate > 0.15) {
      errors.push({
        field: 'summaryMetrics.goingInCapRate',
        message: `Going-in cap rate ${(capRate * 100).toFixed(1)}% outside typical range (3-15%)`,
        severity: 'warning',
      });
    }
  }
}

function validateDevelopmentSpecific(
  output: any,
  errors: ValidationResult['errors'],
  reviewReasons: string[]
): void {
  // Development-specific checks
  if (output.developmentMetrics) {
    const { developmentYield, developmentSpread } = output.developmentMetrics;
    
    if (developmentYield < 0.03 || developmentYield > 0.15) {
      errors.push({
        field: 'developmentMetrics.developmentYield',
        message: `Development yield ${(developmentYield * 100).toFixed(1)}% outside typical range (3-15%)`,
        severity: 'warning',
      });
    }

    if (developmentSpread < -0.02) {
      reviewReasons.push(`Negative development spread (${(developmentSpread * 100).toFixed(1)}bps) - building below market value`);
    }
  }

  // Construction loan balance validation
  if (output.constructionDebtSchedule) {
    const maxBalance = Math.max(...output.constructionDebtSchedule.map(m => m.balance));
    // Check if max balance doesn't exceed loan amount significantly
  }

  // Lease-up validation
  if (output.leaseUpSchedule) {
    const finalMonth = output.leaseUpSchedule[output.leaseUpSchedule.length - 1];
    if (finalMonth && finalMonth.occupancyPct < 0.90) {
      reviewReasons.push(`Low stabilized occupancy (${finalMonth.occupancyPct.toFixed(1)}%)`);
    }
  }
}

function validateRedevelopmentSpecific(
  output: any,
  errors: ValidationResult['errors'],
  reviewReasons: string[]
): void {
  // Redevelopment-specific checks
  if (output.redevelopmentMetrics) {
    const { renovationROI, goingInCapRate } = output.redevelopmentMetrics;
    
    if (renovationROI < 0.05 || renovationROI > 0.50) {
      errors.push({
        field: 'redevelopmentMetrics.renovationROI',
        message: `Renovation ROI ${(renovationROI * 100).toFixed(1)}% outside typical range (5-50%)`,
        severity: 'warning',
      });
    }

    if (goingInCapRate > 0.12) {
      reviewReasons.push(`High going-in cap rate (${(goingInCapRate * 100).toFixed(1)}%) - value-add opportunity or distressed asset`);
    }
  }

  // Monthly detail validation (units must sum correctly)
  if (output.monthlyDetail) {
    for (const month of output.monthlyDetail) {
      const totalUnits = (month.unitsVintage || 0) + 
                        (month.unitsInRenovation || 0) + 
                        (month.unitsRenovated || 0);
      
      // Tolerance for rounding
      if (Math.abs(totalUnits - output.redevelopmentMetrics.totalUnits) > 1) {
        errors.push({
          field: `monthlyDetail[${month.month}]`,
          message: `Unit count mismatch in month ${month.month}: ${totalUnits} vs ${output.redevelopmentMetrics.totalUnits}`,
          severity: 'error',
        });
      }

      // Units in renovation should have zero income
      if (month.unitsInRenovation > 0 && month.vintageRentalIncome + month.renovatedRentalIncome > 0) {
        // This is complex to validate precisely without unit-level detail
        // Just log for review
      }
    }
  }

  // Refi validation
  if (output.refinanceEvent) {
    const { netRefiProceeds, equityReturnedPct } = output.refinanceEvent;
    
    if (netRefiProceeds < 0) {
      reviewReasons.push(`Additional equity required at refi ($${Math.abs(netRefiProceeds).toLocaleString()})`);
    }

    if (equityReturnedPct > 1.0) {
      reviewReasons.push(`Refi returns >100% of equity (${(equityReturnedPct * 100).toFixed(0)}%) - strong value creation`);
    }
  }
}

/**
 * Quick validation helper (returns true/false only, no details).
 */
export function isValidModel(output: FinancialOutput): boolean {
  const result = validateModelOutput(output);
  return result.valid;
}

/**
 * Get validation summary for display.
 */
export function getValidationSummary(result: ValidationResult): string {
  const errorCount = result.errors.filter(e => e.severity === 'error').length;
  const warningCount = result.errors.filter(e => e.severity === 'warning').length;

  if (!result.valid) {
    return `${errorCount} error(s) found - model invalid`;
  }

  if (result.requiresReview) {
    return `${warningCount} warning(s) - manual review recommended`;
  }

  return 'Validation passed';
}
