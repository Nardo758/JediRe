import { Pool } from 'pg';

export interface TimelineGenerationInput {
  dealId: string;
  scenario: string;
  landBasis?: number;
  loanAmount?: number;
  loanRate?: number;
}

export class DealTimelineService {
  constructor(private pool: Pool) {}

  async getByDeal(dealId: string) {
    const result = await this.pool.query(
      `SELECT * FROM deal_timelines WHERE deal_id = $1 ORDER BY scenario`,
      [dealId]
    );
    return result.rows;
  }

  async getById(id: string) {
    const result = await this.pool.query(
      `SELECT * FROM deal_timelines WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async generateTimeline(input: TimelineGenerationInput) {
    const benchmarks = await this.getBenchmarksForDeal(input.dealId);
    const entitlements = await this.pool.query(
      `SELECT type, status, est_timeline_months, risk_level FROM entitlements WHERE deal_id = $1`,
      [input.dealId]
    );

    const phases = this.buildPhases(input.scenario, benchmarks, entitlements.rows);
    const totalMonths = phases.reduce((sum: number, p: any) => sum + (p.durationMonths || 0), 0);

    const carryingCosts = this.calculateCarryingCosts(
      totalMonths,
      input.landBasis || 0,
      input.loanAmount || 0,
      input.loanRate || 0.06
    );

    const financialImpact = this.calculateFinancialImpact(totalMonths, carryingCosts);

    const result = await this.pool.query(
      `INSERT INTO deal_timelines
       (deal_id, scenario, phases, total_months, carrying_costs, financial_impact,
        land_basis, loan_amount, loan_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [
        input.dealId,
        input.scenario,
        JSON.stringify(phases),
        totalMonths,
        JSON.stringify(carryingCosts),
        JSON.stringify(financialImpact),
        input.landBasis || null,
        input.loanAmount || null,
        input.loanRate || null,
      ]
    );

    return result.rows[0];
  }

  async getBenchmarksByMunicipality(municipality: string, state?: string) {
    const params: any[] = [municipality];
    let query = `SELECT * FROM municipal_benchmarks WHERE municipality ILIKE $1`;
    if (state) {
      query += ` AND state = $2`;
      params.push(state);
    }
    query += ` ORDER BY project_type, entitlement_type`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getJurisdictionComparison(municipalities: string[]) {
    if (municipalities.length === 0) return [];

    const placeholders = municipalities.map((_, i) => `$${i + 1}`).join(', ');
    const result = await this.pool.query(
      `SELECT municipality, state, project_type, entitlement_type,
              median_months, p25_months, p50_months, p75_months, p90_months,
              sample_size, trend
       FROM municipal_benchmarks
       WHERE municipality ILIKE ANY(ARRAY[${placeholders}])
       ORDER BY municipality, project_type`,
      municipalities.map(m => `%${m}%`)
    );

    const grouped: Record<string, any> = {};
    for (const row of result.rows) {
      const key = row.municipality;
      if (!grouped[key]) {
        grouped[key] = {
          municipality: row.municipality,
          state: row.state,
          benchmarks: [],
        };
      }
      grouped[key].benchmarks.push(row);
    }

    const comparisons = Object.values(grouped);
    for (const comp of comparisons as any[]) {
      const medians = comp.benchmarks
        .filter((b: any) => b.median_months)
        .map((b: any) => parseFloat(b.median_months));
      comp.avgMedianMonths = medians.length > 0
        ? Math.round((medians.reduce((a: number, b: number) => a + b, 0) / medians.length) * 10) / 10
        : null;
    }

    (comparisons as any[]).sort((a: any, b: any) => (a.avgMedianMonths || 999) - (b.avgMedianMonths || 999));
    (comparisons as any[]).forEach((c: any, i: number) => { c.rank = i + 1; });

    return comparisons;
  }

  async getCarryingCosts(dealId: string, scenario?: string) {
    const params: any[] = [dealId];
    let query = `SELECT * FROM deal_timelines WHERE deal_id = $1`;
    if (scenario) {
      query += ` AND scenario = $2`;
      params.push(scenario);
    }
    query += ` ORDER BY scenario`;

    const result = await this.pool.query(query, params);

    return result.rows.map(row => ({
      scenario: row.scenario,
      totalMonths: parseFloat(row.total_months),
      carryingCosts: row.carrying_costs,
      financialImpact: row.financial_impact,
      landBasis: row.land_basis ? parseFloat(row.land_basis) : null,
      loanAmount: row.loan_amount ? parseFloat(row.loan_amount) : null,
      loanRate: row.loan_rate ? parseFloat(row.loan_rate) : null,
    }));
  }

  private async getBenchmarksForDeal(dealId: string) {
    const dealResult = await this.pool.query(
      `SELECT d.municipality, d.state FROM deals d WHERE d.id = $1`,
      [dealId]
    );
    if (dealResult.rows.length === 0) return [];

    const { municipality, state } = dealResult.rows[0];
    if (!municipality) return [];

    return this.getBenchmarksByMunicipality(municipality, state);
  }

  private buildPhases(scenario: string, benchmarks: any[], entitlements: any[]) {
    const phases: any[] = [];

    if (scenario === 'by_right') {
      phases.push(
        { name: 'Site Planning & Design', durationMonths: 2, status: 'pending', category: 'planning' },
        { name: 'Permit Application', durationMonths: 1, status: 'pending', category: 'permitting' },
        { name: 'Plan Review', durationMonths: 3, status: 'pending', category: 'review' },
        { name: 'Permit Issuance', durationMonths: 0.5, status: 'pending', category: 'permitting' },
      );
    } else if (scenario === 'variance') {
      const varianceBenchmark = benchmarks.find((b: any) => b.entitlement_type === 'variance');
      const varianceMonths = varianceBenchmark ? parseFloat(varianceBenchmark.median_months) : 6;

      phases.push(
        { name: 'Pre-Application Conference', durationMonths: 1, status: 'pending', category: 'planning' },
        { name: 'Variance Application Prep', durationMonths: 2, status: 'pending', category: 'entitlement' },
        { name: 'Variance Review & Hearing', durationMonths: varianceMonths, status: 'pending', category: 'entitlement' },
        { name: 'Site Planning & Design', durationMonths: 2, status: 'pending', category: 'planning' },
        { name: 'Permit Application & Review', durationMonths: 3, status: 'pending', category: 'permitting' },
      );
    } else if (scenario === 'rezone') {
      const rezoneBenchmark = benchmarks.find((b: any) => b.entitlement_type === 'rezone');
      const rezoneMonths = rezoneBenchmark ? parseFloat(rezoneBenchmark.median_months) : 12;

      phases.push(
        { name: 'Pre-Application Conference', durationMonths: 1, status: 'pending', category: 'planning' },
        { name: 'Rezone Application & Studies', durationMonths: 3, status: 'pending', category: 'entitlement' },
        { name: 'Planning Commission Review', durationMonths: rezoneMonths * 0.4, status: 'pending', category: 'entitlement' },
        { name: 'City Council Hearings', durationMonths: rezoneMonths * 0.3, status: 'pending', category: 'entitlement' },
        { name: 'Rezone Approval Period', durationMonths: rezoneMonths * 0.3, status: 'pending', category: 'entitlement' },
        { name: 'Site Planning & Design', durationMonths: 2, status: 'pending', category: 'planning' },
        { name: 'Permit Application & Review', durationMonths: 3, status: 'pending', category: 'permitting' },
      );
    }

    for (const ent of entitlements) {
      if (ent.status === 'approved') {
        const phase = phases.find(p => p.category === 'entitlement');
        if (phase) phase.status = 'completed';
      }
    }

    let startMonth = 0;
    for (const phase of phases) {
      phase.startMonth = startMonth;
      phase.endMonth = startMonth + phase.durationMonths;
      startMonth = phase.endMonth;
    }

    return phases;
  }

  private calculateCarryingCosts(
    totalMonths: number,
    landBasis: number,
    loanAmount: number,
    annualRate: number
  ) {
    const monthlyRate = annualRate / 12;
    const totalInterest = loanAmount * monthlyRate * totalMonths;

    const annualTaxRate = 0.012;
    const totalTaxes = landBasis * (annualTaxRate / 12) * totalMonths;

    const annualInsurance = landBasis * 0.005;
    const totalInsurance = (annualInsurance / 12) * totalMonths;

    const monthlySoftCosts = landBasis * 0.002;
    const totalSoftCosts = monthlySoftCosts * totalMonths;

    const totalCarrying = totalInterest + totalTaxes + totalInsurance + totalSoftCosts;

    return {
      interest: { monthly: Math.round(loanAmount * monthlyRate), total: Math.round(totalInterest) },
      taxes: { monthly: Math.round(landBasis * annualTaxRate / 12), total: Math.round(totalTaxes) },
      insurance: { monthly: Math.round(annualInsurance / 12), total: Math.round(totalInsurance) },
      softCosts: { monthly: Math.round(monthlySoftCosts), total: Math.round(totalSoftCosts) },
      totalMonthly: Math.round(loanAmount * monthlyRate + landBasis * annualTaxRate / 12 + annualInsurance / 12 + monthlySoftCosts),
      totalCarrying: Math.round(totalCarrying),
    };
  }

  private calculateFinancialImpact(totalMonths: number, carryingCosts: any) {
    const baselineMonths = 6;
    const delayMonths = Math.max(0, totalMonths - baselineMonths);
    const additionalCarrying = delayMonths > 0
      ? Math.round(carryingCosts.totalMonthly * delayMonths)
      : 0;

    return {
      baselineMonths,
      actualMonths: totalMonths,
      delayMonths,
      additionalCarryingCost: additionalCarrying,
      irrImpact: delayMonths > 0 ? `Reduced by approximately ${(delayMonths * 0.5).toFixed(1)} percentage points` : 'No material impact',
      equityMultipleImpact: delayMonths > 0 ? `Reduced by approximately ${(delayMonths * 0.02).toFixed(2)}x` : 'No material impact',
      devMarginImpact: delayMonths > 0 ? `Compressed by additional $${additionalCarrying.toLocaleString()} in carrying costs` : 'No material impact',
    };
  }
}
