/**
 * Competitive Set Service
 * 
 * Manages competitive sets from underwriting through operations.
 * Tracks competitor pricing changes and generates alerts.
 */

import { query, getClient } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

export interface CompProperty {
  id?: string;
  dealId: string;
  createdAtStage: 'underwriting' | 'operations';
  compPropertyId?: string;
  compName: string;
  compAddress?: string;
  compCity?: string;
  compState?: string;
  compZip?: string;
  compUnits?: number;
  compYearBuilt?: number;
  compAssetClass?: string;
  compDistanceMiles?: number;
  relevanceScore?: number;
  relevanceFactors?: Record<string, number>;
  source?: string;
  sourceId?: string;
}

export interface CompPricingSnapshot {
  compSetId: string;
  dealId: string;
  snapshotDate: Date;
  pricingByType?: Record<string, { asking: number; effective: number }>;
  avgAskingRent?: number;
  avgEffectiveRent?: number;
  concessionsOffered?: string;
  concessionValue?: number;
  advertisedAvailability?: number;
  estimatedOccupancy?: number;
  currentSpecials?: string;
  source?: string;
  sourceUrl?: string;
}

export interface CompPricingAlert {
  dealId: string;
  compSetId: string;
  alertDate: Date;
  alertType: 'price_drop' | 'price_increase' | 'concession_added' | 'concession_removed';
  compName: string;
  unitType?: string;
  previousValue: number;
  newValue: number;
  changePct: number;
  recommendedAction?: string;
  urgency: 'high' | 'medium' | 'low';
}

// ─── Competitive Set Management ───────────────────────────────────────

/**
 * Add a property to the competitive set
 */
export async function addToCompSet(comp: CompProperty): Promise<string> {
  const result = await query(
    `INSERT INTO competitive_sets (
      deal_id, created_at_stage,
      comp_property_id, comp_name, comp_address, comp_city, comp_state, comp_zip,
      comp_units, comp_year_built, asset_class, comp_distance_miles,
      relevance_score, relevance_factors,
      source, source_id
    ) VALUES (
      $1, $2,
      $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14,
      $15, $16
    ) RETURNING id`,
    [
      comp.dealId, comp.createdAtStage,
      comp.compPropertyId, comp.compName, comp.compAddress, comp.compCity, comp.compState, comp.compZip,
      comp.compUnits, comp.compYearBuilt, comp.compAssetClass, comp.compDistanceMiles,
      comp.relevanceScore ?? 100, comp.relevanceFactors ? JSON.stringify(comp.relevanceFactors) : null,
      comp.source, comp.sourceId,
    ]
  );
  
  logger.info('[competitive-set] Added comp', {
    dealId: comp.dealId,
    compName: comp.compName,
    stage: comp.createdAtStage,
  });
  
  return result.rows[0]?.id;
}

/**
 * Get competitive set for a deal
 */
export async function getCompSet(dealId: string, includeInactive = false): Promise<CompProperty[]> {
  const result = await query(
    `SELECT * FROM competitive_sets
     WHERE deal_id = $1 ${includeInactive ? '' : 'AND is_active = true'}
     ORDER BY relevance_score DESC, comp_name`,
    [dealId]
  );
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    dealId: String(row.deal_id),
    createdAtStage: row.created_at_stage as 'underwriting' | 'operations',
    compPropertyId: row.comp_property_id as string | undefined,
    compName: String(row.comp_name),
    compAddress: row.comp_address as string | undefined,
    compCity: row.comp_city as string | undefined,
    compState: row.comp_state as string | undefined,
    compZip: row.comp_zip as string | undefined,
    compUnits: row.comp_units ? Number(row.comp_units) : undefined,
    compYearBuilt: row.comp_year_built ? Number(row.comp_year_built) : undefined,
    compAssetClass: row.asset_class as string | undefined,
    compDistanceMiles: row.comp_distance_miles ? Number(row.comp_distance_miles) : undefined,
    relevanceScore: Number(row.relevance_score ?? 100),
    relevanceFactors: row.relevance_factors as Record<string, number> | undefined,
    source: row.source as string | undefined,
    sourceId: row.source_id as string | undefined,
  }));
}

/**
 * Deactivate a comp from the set
 */
export async function deactivateComp(compId: string, reason?: string): Promise<void> {
  await query(
    `UPDATE competitive_sets SET is_active = false, deactivated_reason = $1 WHERE id = $2`,
    [reason, compId]
  );
}

/**
 * Copy competitive set from underwriting to operations
 * (Called when deal moves to owned/portfolio status)
 */
export async function copyCompSetToOperations(dealId: string): Promise<number> {
  const result = await query(
    `UPDATE competitive_sets
     SET created_at_stage = 'operations'
     WHERE deal_id = $1 AND created_at_stage = 'underwriting' AND is_active = true`,
    [dealId]
  );
  
  return result.rowCount ?? 0;
}

// ─── Pricing Tracking ─────────────────────────────────────────────────

/**
 * Record a pricing snapshot for a comp
 */
export async function recordPricingSnapshot(snapshot: CompPricingSnapshot): Promise<string> {
  const result = await query(
    `INSERT INTO comp_pricing_snapshots (
      comp_set_id, deal_id, snapshot_date,
      pricing_by_type, avg_asking_rent, avg_effective_rent,
      concessions_offered, concession_value,
      advertised_availability, estimated_occupancy,
      current_specials, source, source_url
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8,
      $9, $10,
      $11, $12, $13
    ) RETURNING id`,
    [
      snapshot.compSetId, snapshot.dealId, snapshot.snapshotDate,
      snapshot.pricingByType ? JSON.stringify(snapshot.pricingByType) : null,
      snapshot.avgAskingRent, snapshot.avgEffectiveRent,
      snapshot.concessionsOffered, snapshot.concessionValue,
      snapshot.advertisedAvailability, snapshot.estimatedOccupancy,
      snapshot.currentSpecials, snapshot.source, snapshot.sourceUrl,
    ]
  );
  
  // Check for price changes and generate alerts
  await checkForPricingAlerts(snapshot);
  
  return result.rows[0]?.id;
}

/**
 * Check for pricing changes and generate alerts
 */
async function checkForPricingAlerts(snapshot: CompPricingSnapshot): Promise<void> {
  // Get previous snapshot
  const prevResult = await query(
    `SELECT * FROM comp_pricing_snapshots
     WHERE comp_set_id = $1 AND snapshot_date < $2
     ORDER BY snapshot_date DESC LIMIT 1`,
    [snapshot.compSetId, snapshot.snapshotDate]
  );
  
  if (prevResult.rows.length === 0) return;
  
  const prev = prevResult.rows[0] as Record<string, unknown>;
  const prevRent = Number(prev.avg_asking_rent ?? 0);
  const newRent = snapshot.avgAskingRent ?? 0;
  
  if (prevRent === 0 || newRent === 0) return;
  
  const changePct = ((newRent - prevRent) / prevRent) * 100;
  
  // Only alert on significant changes (>3%)
  if (Math.abs(changePct) < 3) return;
  
  // Get comp name
  const compResult = await query(
    `SELECT comp_name FROM competitive_sets WHERE id = $1`,
    [snapshot.compSetId]
  );
  const compName = String((compResult.rows[0] as Record<string, string>)?.comp_name ?? 'Unknown');
  
  const alertType = changePct > 0 ? 'price_increase' : 'price_drop';
  const urgency = Math.abs(changePct) > 10 ? 'high' : Math.abs(changePct) > 5 ? 'medium' : 'low';
  
  let recommendedAction = '';
  if (alertType === 'price_drop' && Math.abs(changePct) > 5) {
    recommendedAction = 'Review your pricing strategy. Competitor dropping rents may indicate softening demand.';
  } else if (alertType === 'price_increase' && changePct > 5) {
    recommendedAction = 'Consider testing higher rents on new leases. Market may support increases.';
  }
  
  await query(
    `INSERT INTO comp_pricing_alerts (
      deal_id, comp_set_id, alert_date, alert_type,
      comp_name, previous_value, new_value, change_pct,
      recommended_action, urgency
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      snapshot.dealId, snapshot.compSetId, snapshot.snapshotDate, alertType,
      compName, prevRent, newRent, changePct,
      recommendedAction, urgency,
    ]
  );
  
  logger.info('[competitive-set] Generated pricing alert', {
    dealId: snapshot.dealId,
    compName,
    alertType,
    changePct,
  });
}

/**
 * Get pricing alerts for a deal
 */
export async function getPricingAlerts(
  dealId: string,
  options?: { acknowledged?: boolean; limit?: number }
): Promise<CompPricingAlert[]> {
  const conditions = ['deal_id = $1'];
  const params: unknown[] = [dealId];
  
  if (options?.acknowledged !== undefined) {
    params.push(options.acknowledged);
    conditions.push(`acknowledged = $${params.length}`);
  }
  
  const limit = options?.limit ?? 50;
  params.push(limit);
  
  const result = await query(
    `SELECT * FROM comp_pricing_alerts
     WHERE ${conditions.join(' AND ')}
     ORDER BY alert_date DESC
     LIMIT $${params.length}`,
    params
  );
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    dealId: String(row.deal_id),
    compSetId: String(row.comp_set_id),
    alertDate: new Date(row.alert_date as string),
    alertType: row.alert_type as CompPricingAlert['alertType'],
    compName: String(row.comp_name),
    unitType: row.unit_type as string | undefined,
    previousValue: Number(row.previous_value),
    newValue: Number(row.new_value),
    changePct: Number(row.change_pct),
    recommendedAction: row.recommended_action as string | undefined,
    urgency: row.urgency as 'high' | 'medium' | 'low',
  }));
}

/**
 * Acknowledge a pricing alert
 */
export async function acknowledgePricingAlert(alertId: string, userId: string): Promise<void> {
  await query(
    `UPDATE comp_pricing_alerts SET acknowledged = true, acknowledged_at = NOW(), acknowledged_by = $1 WHERE id = $2`,
    [userId, alertId]
  );
}

/**
 * Get comp pricing history
 */
export async function getCompPricingHistory(
  compSetId: string,
  months = 12
): Promise<{ date: Date; avgAskingRent: number; avgEffectiveRent: number; occupancy: number }[]> {
  const result = await query(
    `SELECT snapshot_date, avg_asking_rent, avg_effective_rent, estimated_occupancy
     FROM comp_pricing_snapshots
     WHERE comp_set_id = $1
       AND snapshot_date >= CURRENT_DATE - ($2 || ' months')::interval
     ORDER BY snapshot_date`,
    [compSetId, months]
  );
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    date: new Date(row.snapshot_date as string),
    avgAskingRent: Number(row.avg_asking_rent ?? 0),
    avgEffectiveRent: Number(row.avg_effective_rent ?? 0),
    occupancy: Number(row.estimated_occupancy ?? 0),
  }));
}

/**
 * Get competitive position summary
 */
export async function getCompetitivePosition(dealId: string): Promise<{
  subjectRent: number;
  avgCompRent: number;
  rentPremiumPct: number;
  subjectOccupancy: number;
  avgCompOccupancy: number;
  position: 'premium' | 'market' | 'discount';
  compsCount: number;
}> {
  // Get subject property's current rent
  const subjectResult = await query(
    `SELECT AVG(current_rent) as avg_rent, AVG(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) * 100 as occupancy
     FROM rent_roll_units
     WHERE deal_id = $1 AND as_of_date = (SELECT MAX(as_of_date) FROM rent_roll_units WHERE deal_id = $1)`,
    [dealId]
  );
  
  const subject = subjectResult.rows[0] as Record<string, number>;
  const subjectRent = Number(subject?.avg_rent ?? 0);
  const subjectOccupancy = Number(subject?.occupancy ?? 0);
  
  // Get latest comp pricing
  const compResult = await query(
    `SELECT AVG(cps.avg_asking_rent) as avg_rent, AVG(cps.estimated_occupancy) as avg_occ, COUNT(DISTINCT cs.id) as count
     FROM competitive_sets cs
     JOIN comp_pricing_snapshots cps ON cps.comp_set_id = cs.id
     WHERE cs.deal_id = $1 AND cs.is_active = true
       AND cps.snapshot_date = (SELECT MAX(snapshot_date) FROM comp_pricing_snapshots WHERE comp_set_id = cs.id)`,
    [dealId]
  );
  
  const comp = compResult.rows[0] as Record<string, number>;
  const avgCompRent = Number(comp?.avg_rent ?? 0);
  const avgCompOccupancy = Number(comp?.avg_occ ?? 0);
  const compsCount = Number(comp?.count ?? 0);
  
  const rentPremiumPct = avgCompRent > 0 ? ((subjectRent - avgCompRent) / avgCompRent) * 100 : 0;
  
  let position: 'premium' | 'market' | 'discount';
  if (rentPremiumPct > 5) position = 'premium';
  else if (rentPremiumPct < -5) position = 'discount';
  else position = 'market';
  
  return {
    subjectRent,
    avgCompRent,
    rentPremiumPct,
    subjectOccupancy,
    avgCompOccupancy,
    position,
    compsCount,
  };
}
