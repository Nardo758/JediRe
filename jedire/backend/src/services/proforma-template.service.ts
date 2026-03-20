import { query } from '../database/connection';
import { logger } from '../utils/logger';

export interface ProformaTemplateInput {
  name: string;
  description?: string;
  propertyType?: string;
  productType?: string;
  strategy?: string;
  holdYears?: number;
  rentGrowthYr1?: number;
  rentGrowthYr2_5?: number;
  rentGrowthYr6_10?: number;
  vacancyRate?: number;
  vacancyTrend?: number;
  concessionPct?: number;
  badDebtPct?: number;
  otherIncomePerUnit?: number;
  opexRatio?: number;
  opexGrowth?: number;
  managementFeePct?: number;
  capexPerUnit?: number;
  propertyTaxGrowth?: number;
  insuranceGrowth?: number;
  ltv?: number;
  interestRate?: number;
  amortizationYears?: number;
  loanTermYears?: number;
  ioPeriodMonths?: number;
  exitCapRate?: number;
  exitCapSpread?: number;
  sellingCostsPct?: number;
  targetIrr?: number;
  targetCoc?: number;
  targetEquityMult?: number;
  targetDscrMin?: number;
  isDefault?: boolean;
}

class ProformaTemplateService {
  async create(userId: string, input: ProformaTemplateInput): Promise<any> {
    const result = await query(
      `INSERT INTO proforma_templates (
        user_id, name, description, property_type, product_type, strategy, hold_years,
        rent_growth_yr1, rent_growth_yr2_5, rent_growth_yr6_10,
        vacancy_rate, vacancy_trend, concession_pct, bad_debt_pct, other_income_per_unit,
        opex_ratio, opex_growth, management_fee_pct, capex_per_unit,
        property_tax_growth, insurance_growth,
        ltv, interest_rate, amortization_years, loan_term_years, io_period_months,
        exit_cap_rate, exit_cap_spread, selling_costs_pct,
        target_irr, target_coc, target_equity_mult, target_dscr_min, is_default
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34
      ) RETURNING *`,
      [
        userId, input.name, input.description || null,
        input.propertyType || null, input.productType || null, input.strategy || null,
        input.holdYears || 5,
        input.rentGrowthYr1 || 0.03, input.rentGrowthYr2_5 || 0.025, input.rentGrowthYr6_10 || 0.02,
        input.vacancyRate || 0.05, input.vacancyTrend || 0.0,
        input.concessionPct || 0.01, input.badDebtPct || 0.015, input.otherIncomePerUnit || 150,
        input.opexRatio || 0.45, input.opexGrowth || 0.025,
        input.managementFeePct || 0.05, input.capexPerUnit || 300,
        input.propertyTaxGrowth || 0.02, input.insuranceGrowth || 0.03,
        input.ltv || 0.70, input.interestRate || 0.065,
        input.amortizationYears || 30, input.loanTermYears || 10, input.ioPeriodMonths || 0,
        input.exitCapRate || 0.055, input.exitCapSpread || 0.001, input.sellingCostsPct || 0.02,
        input.targetIrr || 0.15, input.targetCoc || 0.08,
        input.targetEquityMult || 2.0, input.targetDscrMin || 1.25,
        input.isDefault || false,
      ]
    );
    return result.rows[0];
  }

  async getAll(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT * FROM proforma_templates WHERE user_id = $1 OR is_system = TRUE ORDER BY is_system DESC, name`,
      [userId]
    );
    return result.rows;
  }

  async getById(templateId: string): Promise<any | null> {
    const result = await query('SELECT * FROM proforma_templates WHERE id = $1', [templateId]);
    return result.rows[0] || null;
  }

  async update(templateId: string, userId: string, input: Partial<ProformaTemplateInput>): Promise<any> {
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description', propertyType: 'property_type',
      productType: 'product_type', strategy: 'strategy', holdYears: 'hold_years',
      rentGrowthYr1: 'rent_growth_yr1', rentGrowthYr2_5: 'rent_growth_yr2_5',
      rentGrowthYr6_10: 'rent_growth_yr6_10', vacancyRate: 'vacancy_rate',
      vacancyTrend: 'vacancy_trend', concessionPct: 'concession_pct',
      badDebtPct: 'bad_debt_pct', otherIncomePerUnit: 'other_income_per_unit',
      opexRatio: 'opex_ratio', opexGrowth: 'opex_growth',
      managementFeePct: 'management_fee_pct', capexPerUnit: 'capex_per_unit',
      propertyTaxGrowth: 'property_tax_growth', insuranceGrowth: 'insurance_growth',
      ltv: 'ltv', interestRate: 'interest_rate', amortizationYears: 'amortization_years',
      loanTermYears: 'loan_term_years', ioPeriodMonths: 'io_period_months',
      exitCapRate: 'exit_cap_rate', exitCapSpread: 'exit_cap_spread',
      sellingCostsPct: 'selling_costs_pct', targetIrr: 'target_irr',
      targetCoc: 'target_coc', targetEquityMult: 'target_equity_mult',
      targetDscrMin: 'target_dscr_min', isDefault: 'is_default',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((input as any)[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push((input as any)[key]);
        idx++;
      }
    }

    if (updates.length === 0) throw new Error('No fields to update');

    updates.push('updated_at = now()');
    params.push(templateId, userId);

    const result = await query(
      `UPDATE proforma_templates SET ${updates.join(', ')} WHERE id = $${idx} AND (user_id = $${idx + 1} OR is_system = FALSE) RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(templateId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM proforma_templates WHERE id = $1 AND user_id = $2 AND is_system = FALSE',
      [templateId, userId]
    );
    return (result.rowCount || 0) > 0;
  }
}

export const proformaTemplateService = new ProformaTemplateService();
