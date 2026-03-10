import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import type { ModelType } from '../types/financial-model.types';

/**
 * Infer which financial model type to use based on deal characteristics.
 * 
 * Logic:
 * - Acquisition: Existing property with T-12 data, no construction
 * - Development: No existing property, has construction budget
 * - Redevelopment: Existing property + renovation budget
 */
export async function inferModelType(dealId: string): Promise<ModelType> {
  const pool = getPool();

  // Fetch deal data
  const result = await pool.query(
    `SELECT 
       project_type,
       deal_data
     FROM deals
     WHERE id = $1`,
    [dealId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Deal ${dealId} not found`);
  }

  const { project_type, deal_data } = result.rows[0];
  const dealData = deal_data || {};

  // Check for explicit project type
  if (project_type === 'development') {
    logger.info('[ModelTypeInference] Inferred: development', { dealId });
    return 'development';
  }

  // Check for renovation budget (redevelopment indicator)
  const hasRenovationBudget = 
    dealData.renovation?.totalBudget > 0 ||
    dealData.capex?.renovationBudget > 0;

  // Check for T-12 data (acquisition indicator)
  const hasT12Data = 
    dealData.existingProperty?.unitMixProgram ||
    dealData.currentPerformance?.trailingNOI;

  // Decision tree
  if (!hasT12Data && !hasRenovationBudget) {
    // No existing property, no renovation → Development
    logger.info('[ModelTypeInference] Inferred: development (no T-12, no renovation)', { dealId });
    return 'development';
  }

  if (hasT12Data && hasRenovationBudget) {
    // Existing property + renovation → Redevelopment
    logger.info('[ModelTypeInference] Inferred: redevelopment (T-12 + renovation)', { dealId });
    return 'redevelopment';
  }

  if (hasT12Data && !hasRenovationBudget) {
    // Existing property, no renovation → Acquisition
    logger.info('[ModelTypeInference] Inferred: acquisition (T-12, no renovation)', { dealId });
    return 'acquisition';
  }

  // Default fallback: acquisition (most common)
  logger.warn('[ModelTypeInference] Ambiguous - defaulting to acquisition', { dealId });
  return 'acquisition';
}

/**
 * Override model type for a deal (user can force a specific model).
 */
export async function setModelType(dealId: string, modelType: ModelType): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE deals
     SET deal_data = COALESCE(deal_data, '{}'::jsonb) || jsonb_build_object('forcedModelType', $1)
     WHERE id = $2`,
    [modelType, dealId]
  );
  logger.info('[ModelTypeInference] Model type set manually', { dealId, modelType });
}

/**
 * Get model type compatibility for a deal (returns which models could work).
 */
export async function getModelTypeCompatibility(dealId: string): Promise<{
  inferred: ModelType;
  compatible: ModelType[];
  reasons: Record<ModelType, string>;
}> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT project_type, deal_data FROM deals WHERE id = $1`,
    [dealId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Deal ${dealId} not found`);
  }

  const { project_type, deal_data } = result.rows[0];
  const dealData = deal_data || {};

  const hasT12 = !!dealData.existingProperty?.unitMixProgram;
  const hasRenovation = (dealData.renovation?.totalBudget || 0) > 0;
  const hasConstruction = project_type === 'development';

  const compatible: ModelType[] = [];
  const reasons: Record<ModelType, string> = {
    acquisition: '',
    development: '',
    redevelopment: '',
  };

  // Acquisition compatibility
  if (hasT12) {
    compatible.push('acquisition');
    reasons.acquisition = 'Has T-12 data for stabilized analysis';
  } else {
    reasons.acquisition = 'Missing T-12 data (no existing property)';
  }

  // Development compatibility
  if (!hasT12 || hasConstruction) {
    compatible.push('development');
    reasons.development = 'Ground-up construction scenario';
  } else {
    reasons.development = 'Has existing property (not ground-up)';
  }

  // Redevelopment compatibility
  if (hasT12 && hasRenovation) {
    compatible.push('redevelopment');
    reasons.redevelopment = 'Existing property with renovation budget';
  } else if (!hasT12) {
    reasons.redevelopment = 'Missing existing property data';
  } else if (!hasRenovation) {
    reasons.redevelopment = 'No renovation budget specified';
  }

  const inferred = await inferModelType(dealId);

  return { inferred, compatible, reasons };
}
