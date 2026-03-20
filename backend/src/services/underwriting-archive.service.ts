/**
 * M22 Underwriting Archive Service
 * PATTERN 1: Event-Triggered Snapshot (Write Side)
 * 
 * Freezes immutable Deal Capsule snapshots at stage transitions.
 * These snapshots are NEVER modified after creation.
 */

import { getPool } from '../database/connection';

const pool = getPool();

export type SnapshotTrigger = 'pipeline' | 'loi' | 'closed' | 'exit';

export interface DealCapsule {
  // Full Deal Capsule data structure
  deal_id: string;
  deal_name: string;
  
  // Property
  address: string;
  units: number;
  vintage: number;
  property_class: string;
  
  // Transaction
  purchase_price: number;
  price_per_unit: number;
  going_in_cap: number;
  exit_cap_assumed: number;
  
  // Strategy
  strategy: string;
  hold_period_years: number;
  
  // Underwriting
  underwritten_irr: number;
  underwritten_em: number;
  proforma: any;  // Full ProForma JSON
  
  // Market Context
  market_id: string;
  market_cap_rate: number;
  market_vacancy: number;
  jedi_score: number;
  
  // Additional sections
  capital_stack?: any;
  risk_assessment?: any;
  comp_set?: any;
  
  // Metadata
  underwritten_by: string;
  underwritten_date: string;
}

export interface DealSnapshot {
  id: number;
  deal_id: string;
  snapshot_date: string;
  trigger_event: SnapshotTrigger;
  capsule_data: DealCapsule;
  
  // Extracted key metrics
  purchase_price: number;
  units: number;
  price_per_unit: number;
  going_in_cap: number;
  exit_cap_assumed: number;
  strategy: string;
  hold_period_years: number;
  underwritten_irr: number;
  underwritten_em: number;
  market_id: string;
  market_cap_rate: number;
  market_vacancy: number;
  jedi_score: number;
  
  created_by: string;
  created_at: string;
}

export class UnderwritingArchiveService {
  /**
   * Freeze a Deal Capsule at stage transition
   * This is IMMUTABLE - never call update on a snapshot
   */
  async createSnapshot(
    capsule: DealCapsule,
    trigger: SnapshotTrigger,
    createdBy: string
  ): Promise<DealSnapshot> {
    const result = await pool.query(
      `INSERT INTO deal_snapshots (
        deal_id, snapshot_date, trigger_event, capsule_data,
        purchase_price, units, price_per_unit, going_in_cap, exit_cap_assumed,
        strategy, hold_period_years,
        underwritten_irr, underwritten_em,
        market_id, market_cap_rate, market_vacancy, jedi_score,
        created_by
      ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        capsule.deal_id,
        trigger,
        JSON.stringify(capsule),
        capsule.purchase_price,
        capsule.units,
        capsule.price_per_unit,
        capsule.going_in_cap,
        capsule.exit_cap_assumed,
        capsule.strategy,
        capsule.hold_period_years,
        capsule.underwritten_irr,
        capsule.underwritten_em,
        capsule.market_id,
        capsule.market_cap_rate,
        capsule.market_vacancy,
        capsule.jedi_score,
        createdBy,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get snapshots for a deal (multiple snapshots as deal progresses)
   */
  async getSnapshots(dealId: string): Promise<DealSnapshot[]> {
    const result = await pool.query(
      `SELECT * FROM deal_snapshots
       WHERE deal_id = $1
       ORDER BY snapshot_date ASC`,
      [dealId]
    );

    return result.rows;
  }

  /**
   * Get the most recent snapshot for a deal
   */
  async getLatestSnapshot(dealId: string): Promise<DealSnapshot | null> {
    const result = await pool.query(
      `SELECT * FROM deal_snapshots
       WHERE deal_id = $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [dealId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get snapshot by trigger event (e.g., get the "closed" snapshot)
   */
  async getSnapshotByTrigger(
    dealId: string,
    trigger: SnapshotTrigger
  ): Promise<DealSnapshot | null> {
    const result = await pool.query(
      `SELECT * FROM deal_snapshots
       WHERE deal_id = $1 AND trigger_event = $2
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [dealId, trigger]
    );

    return result.rows[0] || null;
  }

  /**
   * Background job: Auto-snapshot on deal stage change
   * Called by deal state machine when stage transitions occur
   */
  async autoSnapshotOnStageChange(
    dealId: string,
    newStage: string,
    capsule: DealCapsule,
    userId: string
  ): Promise<DealSnapshot | null> {
    // Map deal stages to snapshot triggers
    const triggerMap: Record<string, SnapshotTrigger> = {
      pipeline: 'pipeline',
      loi: 'loi',
      closed: 'closed',
      exited: 'exit',
    };

    const trigger = triggerMap[newStage.toLowerCase()];
    if (!trigger) {
      console.log(`Stage "${newStage}" does not trigger snapshot`);
      return null;
    }

    // Check if snapshot already exists for this trigger
    const existing = await this.getSnapshotByTrigger(dealId, trigger);
    if (existing) {
      console.log(`Snapshot already exists for deal ${dealId} trigger ${trigger}`);
      return existing;
    }

    // Create new snapshot
    console.log(`Creating snapshot for deal ${dealId} at ${trigger} transition`);
    return await this.createSnapshot(capsule, trigger, userId);
  }

  /**
   * Query archived deals for benchmark aggregation
   * Used by nightly job to compute benchmark_aggregations
   */
  async queryForBenchmarks(filters: {
    property_class?: string;
    vintage_decade?: number;
    submarket_id?: string;
    strategy?: string;
    hold_period_min?: number;
    hold_period_max?: number;
  }): Promise<DealSnapshot[]> {
    let query = `
      SELECT * FROM deal_snapshots
      WHERE trigger_event = 'closed'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.property_class) {
      query += ` AND capsule_data->>'property_class' = $${paramIndex++}`;
      params.push(filters.property_class);
    }

    if (filters.vintage_decade) {
      query += ` AND (CAST(capsule_data->>'vintage' AS INT) / 10 * 10) = $${paramIndex++}`;
      params.push(filters.vintage_decade);
    }

    if (filters.submarket_id) {
      query += ` AND market_id = $${paramIndex++}`;
      params.push(filters.submarket_id);
    }

    if (filters.strategy) {
      query += ` AND strategy = $${paramIndex++}`;
      params.push(filters.strategy);
    }

    if (filters.hold_period_min) {
      query += ` AND hold_period_years >= $${paramIndex++}`;
      params.push(filters.hold_period_min);
    }

    if (filters.hold_period_max) {
      query += ` AND hold_period_years <= $${paramIndex++}`;
      params.push(filters.hold_period_max);
    }

    query += ` ORDER BY snapshot_date DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }
}

export const underwritingArchiveService = new UnderwritingArchiveService();
