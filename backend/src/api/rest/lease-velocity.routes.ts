import { Router, Request, Response } from 'express';
import { LeaseVelocityEngine } from '../../services/lease-velocity-engine';
import type { LeaseVelocityInputs } from '../../services/lease-velocity-types';
import { getPool } from '../../database/connection';

const router = Router();
const engine = new LeaseVelocityEngine();

/**
 * Persist the LV engine's concession_records to deal_data.lv_concession_records
 * so that computeConcessionRecognition() in financials-composer can merge them.
 * Non-fatal — failure is logged but does not break the engine response.
 */
async function persistLvConcessionRecords(
  dealId: string,
  records: unknown[],
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE deals
       SET deal_data = jsonb_set(
         COALESCE(deal_data, '{}'::jsonb),
         '{lv_concession_records}',
         $1::jsonb
       )
       WHERE id = $2`,
      [JSON.stringify(records), dealId],
    );
  } catch (err: any) {
    console.warn('[LV routes] Failed to persist lv_concession_records:', err?.message ?? err);
  }
}

/**
 * POST /api/v1/lease-velocity/run
 * Run the lease velocity engine with explicit inputs.
 * Body: { dealId?: string, inputs: LeaseVelocityInputs }
 *
 * When dealId is provided, the resulting concession_records are persisted
 * to deal_data.lv_concession_records for downstream amortization.
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { dealId, inputs } = req.body as { dealId?: string; inputs: LeaseVelocityInputs };

    if (!inputs || !inputs.total_units || !inputs.target_occupancy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required inputs: total_units, target_occupancy',
      });
    }

    const enrichedInputs: LeaseVelocityInputs = dealId
      ? { ...inputs, deal_id: inputs.deal_id ?? dealId }
      : inputs;

    const result = engine.run(enrichedInputs);

    // Always persist when dealId is provided — including empty array — so that
    // stale records from a prior run are cleared when a re-run yields zero concessions.
    if (dealId) {
      await persistLvConcessionRecords(dealId, result.concession_records);
    }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Engine error' });
  }
});

/**
 * POST /api/v1/lease-velocity/scenario
 * Run with one of the 3 worked scenarios from the spec.
 * Body: { scenario: 'tampa_lease_up' | 'stabilized' | 'recovery', dealId?: string }
 */
router.post('/scenario', async (req: Request, res: Response) => {
  try {
    const { scenario, dealId } = req.body as { scenario: string; dealId?: string };
    let inputs: LeaseVelocityInputs;

    switch (scenario) {
      case 'tampa_lease_up':
        // Spec §13.1: 250-unit Class B, Tampa Westshore, Apr 2026 delivery
        inputs = {
          total_units: 250,
          target_occupancy: 0.95,
          current_occupancy: 0,
          mode: 'LEASE_UP_NEW_CONSTRUCTION',
          delivery_month: 4, // April
          pre_leased_count: 35,
          pre_lease_window_months: 6,
          avg_market_rent: 1800,
          property_class: 'B',
          stabilization_definition: 'PHYSICAL_95',
          marketing_intensity: 'MARKET',
          concession_strategy: 'MARKET',
          avg_lease_term_months: 12,
          time_horizon_months: 36,
        };
        break;

      case 'stabilized':
        // Spec §13.2: 308-unit Class A, 95% current
        inputs = {
          total_units: 308,
          target_occupancy: 0.95,
          current_occupancy: 0.95,
          mode: 'STABILIZED_MAINTENANCE',
          avg_market_rent: 2200,
          property_class: 'A',
          stabilization_definition: 'PHYSICAL_95',
          concession_strategy: 'MARKET',
          time_horizon_months: 24,
        };
        break;

      case 'recovery':
        // Spec §13.3: 200-unit Class C, 82% current
        inputs = {
          total_units: 200,
          target_occupancy: 0.95,
          current_occupancy: 0.82,
          mode: 'OCCUPANCY_RECOVERY',
          avg_market_rent: 1400,
          property_class: 'C',
          stabilization_definition: 'PHYSICAL_95',
          concession_strategy: 'AGGRESSIVE',
          catch_up_period_months: 12,
          time_horizon_months: 24,
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown scenario: ${scenario}. Use: tampa_lease_up, stabilized, recovery`,
        });
    }

    if (dealId) inputs = { ...inputs, deal_id: dealId };

    const result = engine.run(inputs);

    // Always persist when dealId is provided — clears stale records on zero-concession runs
    if (dealId) {
      await persistLvConcessionRecords(dealId, result.concession_records);
    }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Scenario error' });
  }
});

export default router;
