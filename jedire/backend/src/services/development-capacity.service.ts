import { Pool } from 'pg';
import { BuildingEnvelopeService } from './building-envelope.service';

export interface CapacityScenarioResult {
  scenario: string;
  units: number;
  height: string;
  far: string;
  gfa: number;
  parking: number;
  openSpace: string;
  timelineMonths: string;
  estimatedCost: string;
  riskLevel: string;
  successRate: string;
  estimatedValue: number;
  delta: string;
}

export class DevelopmentCapacityService {
  private envelopeService: BuildingEnvelopeService;

  constructor(private pool: Pool) {
    this.envelopeService = new BuildingEnvelopeService();
  }

  async getCapacityComparison(dealId: string) {
    const zoningResult = await this.pool.query(
      `SELECT * FROM zoning_capacity WHERE deal_id = $1`,
      [dealId]
    );

    const boundaryResult = await this.pool.query(
      `SELECT metrics FROM property_boundaries WHERE deal_id = $1`,
      [dealId]
    );

    const zoning = zoningResult.rows[0] || {};
    const metrics = boundaryResult.rows[0]?.metrics || {};
    const landArea = metrics.area || zoning.land_area || 43560;

    const setbacks = { front: 25, side: 10, rear: 20 };
    if (zoning.zoning_code) {
      try {
        const distResult = await this.pool.query(
          `SELECT COALESCE(setback_front_ft, min_front_setback_ft) as front,
                  COALESCE(setback_side_ft, min_side_setback_ft) as side,
                  COALESCE(setback_rear_ft, min_rear_setback_ft) as rear
           FROM zoning_districts
           WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1)
           LIMIT 1`,
          [zoning.zoning_code]
        );
        if (distResult.rows.length > 0) {
          const d = distResult.rows[0];
          setbacks.front = parseFloat(d.front) || 25;
          setbacks.side = parseFloat(d.side) || 10;
          setbacks.rear = parseFloat(d.rear) || 20;
        }
      } catch {}
    }

    const byRight = this.calculateScenario('by_right', landArea, setbacks, {
      maxDensity: zoning.max_density || null,
      maxFAR: zoning.max_far || null,
      maxHeight: zoning.max_height_feet || null,
      maxStories: zoning.max_stories || null,
      minParkingPerUnit: zoning.min_parking_per_unit || null,
      maxLotCoverage: null,
    });

    const variance = this.calculateScenario('variance', landArea, setbacks, {
      maxDensity: zoning.max_density ? zoning.max_density * 1.2 : null,
      maxFAR: zoning.max_far ? zoning.max_far * 1.15 : null,
      maxHeight: zoning.max_height_feet ? zoning.max_height_feet + 10 : null,
      maxStories: zoning.max_stories ? zoning.max_stories + 1 : null,
      minParkingPerUnit: zoning.min_parking_per_unit ? zoning.min_parking_per_unit * 0.85 : null,
      maxLotCoverage: null,
    });

    const rezone = this.calculateScenario('rezone', landArea, setbacks, {
      maxDensity: zoning.max_density ? zoning.max_density * 1.6 : null,
      maxFAR: zoning.max_far ? zoning.max_far * 1.5 : null,
      maxHeight: zoning.max_height_feet ? zoning.max_height_feet * 1.5 : null,
      maxStories: zoning.max_stories ? zoning.max_stories + 3 : null,
      minParkingPerUnit: zoning.min_parking_per_unit ? zoning.min_parking_per_unit * 0.7 : null,
      maxLotCoverage: null,
    });

    return {
      scenarios: [byRight, variance, rezone],
      currentZoning: {
        code: zoning.zoning_code || 'Unknown',
        description: zoning.zoning_description || '',
        landArea,
      },
    };
  }

  async getStrategyArbitrageImpact(dealId: string) {
    const capacity = await this.getCapacityComparison(dealId);
    const strategies = ['BTS', 'Rental', 'Flip', 'STR'];

    const impact: Record<string, any> = {};
    for (const strategy of strategies) {
      const scenarioImpacts: Record<string, any> = {};
      for (const scenario of capacity.scenarios) {
        const multipliers = this.getStrategyMultipliers(strategy);
        const estimatedRevenue = scenario.estimatedValue * multipliers.revenueMultiplier;
        const estimatedIRR = `${(multipliers.baseIRR - (scenario.scenario === 'rezone' ? 2 : scenario.scenario === 'variance' ? 1 : 0)).toFixed(1)}% - ${(multipliers.baseIRR + (scenario.units > 50 ? 3 : 1)).toFixed(1)}%`;
        const capRate = `${(multipliers.baseCapRate * 100).toFixed(1)}%`;

        scenarioImpacts[scenario.scenario] = {
          units: scenario.units,
          estimatedRevenue: Math.round(estimatedRevenue),
          irrRange: estimatedIRR,
          capRate,
          timeline: scenario.timelineMonths,
          riskLevel: scenario.riskLevel,
        };
      }
      impact[strategy] = scenarioImpacts;
    }

    return impact;
  }

  private calculateScenario(
    scenario: string,
    landArea: number,
    setbacks: { front: number; side: number; rear: number },
    constraints: any
  ): CapacityScenarioResult {
    const envelope = this.envelopeService.calculateEnvelope({
      landArea,
      setbacks,
      zoningConstraints: constraints,
      propertyType: 'multifamily',
    });

    const scenarioMeta = this.getScenarioMeta(scenario);

    return {
      scenario,
      units: envelope.maxCapacity,
      height: constraints.maxHeight ? `${constraints.maxHeight} ft` : 'No limit',
      far: constraints.maxFAR ? `${constraints.maxFAR}` : 'No limit',
      gfa: Math.round(envelope.maxGFA),
      parking: envelope.parkingRequired,
      openSpace: `${Math.round(landArea * 0.15)} sqft (est.)`,
      timelineMonths: scenarioMeta.timeline,
      estimatedCost: scenarioMeta.cost,
      riskLevel: scenarioMeta.riskLevel,
      successRate: scenarioMeta.successRate,
      estimatedValue: Math.round(envelope.maxCapacity * 250000),
      delta: scenario === 'by_right' ? 'Baseline' : `+${Math.round(((envelope.maxCapacity / Math.max(1, envelope.maxCapacity)) - 1) * 100)}% vs by-right`,
    };
  }

  private getScenarioMeta(scenario: string) {
    switch (scenario) {
      case 'by_right':
        return {
          timeline: '6-9 months',
          cost: '$50K-$150K (permits & fees)',
          riskLevel: 'low',
          successRate: 'Very high — by-right approval',
        };
      case 'variance':
        return {
          timeline: '9-18 months',
          cost: '$100K-$350K (applications, legal, consultants)',
          riskLevel: 'moderate',
          successRate: 'Moderate — depends on variance type and community support',
        };
      case 'rezone':
        return {
          timeline: '12-36 months',
          cost: '$200K-$750K (studies, legal, lobbying, impact fees)',
          riskLevel: 'high',
          successRate: 'Lower — requires legislative approval and comprehensive plan alignment',
        };
      default:
        return { timeline: 'Unknown', cost: 'Unknown', riskLevel: 'unknown', successRate: 'Unknown' };
    }
  }

  private getStrategyMultipliers(strategy: string) {
    switch (strategy) {
      case 'BTS':
        return { revenueMultiplier: 1.1, baseIRR: 18, baseCapRate: 0.055 };
      case 'Rental':
        return { revenueMultiplier: 1.0, baseIRR: 14, baseCapRate: 0.05 };
      case 'Flip':
        return { revenueMultiplier: 1.15, baseIRR: 22, baseCapRate: 0.06 };
      case 'STR':
        return { revenueMultiplier: 1.25, baseIRR: 16, baseCapRate: 0.065 };
      default:
        return { revenueMultiplier: 1.0, baseIRR: 15, baseCapRate: 0.05 };
    }
  }
}
