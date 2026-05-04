import { Router, Request, Response } from 'express';
import { LeaseVelocityEngine } from '../../services/lease-velocity-engine';
import type { LeaseVelocityInputs } from '../../services/lease-velocity-types';

const router = Router();
const engine = new LeaseVelocityEngine();

/**
 * POST /api/v1/lease-velocity/run
 * Run the lease velocity engine with explicit inputs.
 * Body: { dealId?: string, inputs: LeaseVelocityInputs }
 */
router.post('/run', (req: Request, res: Response) => {
  try {
    const { inputs } = req.body as { dealId?: string; inputs: LeaseVelocityInputs };

    if (!inputs || !inputs.total_units || !inputs.target_occupancy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required inputs: total_units, target_occupancy',
      });
    }

    const result = engine.run(inputs);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Engine error' });
  }
});

/**
 * POST /api/v1/lease-velocity/scenario
 * Run with one of the 3 worked scenarios from the spec.
 * Body: { scenario: 'tampa_lease_up' | 'stabilized' | 'recovery' }
 */
router.post('/scenario', (req: Request, res: Response) => {
  try {
    const { scenario } = req.body as { scenario: string };
    let inputs: LeaseVelocityInputs;

    switch (scenario) {
      case 'tampa_lease_up':
        // Spec Â§13.1: 250-unit Class B, Tampa Westshore, Apr 2026 delivery
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
        // Spec Â§13.2: 308-unit Class A, 95% current
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
        // Spec Â§13.3: 200-unit Class C, 82% current
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
        return res.status(400).json({ success: false, error: `Unknown scenario: ${scenario}. Use: tampa_lease_up, stabilized, recovery` });
    }

    const result = engine.run(inputs);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Scenario error' });
  }
});

export default router;
