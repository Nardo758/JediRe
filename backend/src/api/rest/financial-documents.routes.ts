import { Router, Response } from 'express';
import { assertDealOrgAccess } from '../../services/deal-scoping.service';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { getDealFinancialContext } from '../../services/deal-financial-context.service';

const router = Router();
const pool = getPool();

async function verifyDealOwnership(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const { dealId } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  return true;
}

router.get('/:dealId/balance-sheets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId } = req.params;
    const result = await pool.query(
      'SELECT * FROM deal_balance_sheets WHERE deal_id = $1 ORDER BY report_month DESC',
      [dealId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Error fetching balance sheets:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:dealId/balance-sheets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId } = req.params;
    const body = req.body;
    const result = await pool.query(`
      INSERT INTO deal_balance_sheets (
        deal_id, report_month, total_assets, cash, accounts_receivable, prepaid_expenses,
        real_estate_assets, accumulated_depreciation, other_assets,
        total_liabilities, mortgage_balance, accounts_payable, accrued_expenses,
        security_deposits, other_liabilities,
        total_equity, partner_capital, retained_earnings,
        reserves, escrows, tax_escrow, insurance_escrow, replacement_reserve,
        source_type, source_ref, source_date, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      ON CONFLICT (deal_id, report_month) DO UPDATE SET
        total_assets = EXCLUDED.total_assets, cash = EXCLUDED.cash,
        accounts_receivable = EXCLUDED.accounts_receivable, prepaid_expenses = EXCLUDED.prepaid_expenses,
        real_estate_assets = EXCLUDED.real_estate_assets, accumulated_depreciation = EXCLUDED.accumulated_depreciation,
        other_assets = EXCLUDED.other_assets,
        total_liabilities = EXCLUDED.total_liabilities, mortgage_balance = EXCLUDED.mortgage_balance,
        accounts_payable = EXCLUDED.accounts_payable, accrued_expenses = EXCLUDED.accrued_expenses,
        security_deposits = EXCLUDED.security_deposits, other_liabilities = EXCLUDED.other_liabilities,
        total_equity = EXCLUDED.total_equity, partner_capital = EXCLUDED.partner_capital,
        retained_earnings = EXCLUDED.retained_earnings,
        reserves = EXCLUDED.reserves, escrows = EXCLUDED.escrows,
        tax_escrow = EXCLUDED.tax_escrow, insurance_escrow = EXCLUDED.insurance_escrow,
        replacement_reserve = EXCLUDED.replacement_reserve,
        source_type = EXCLUDED.source_type, source_ref = EXCLUDED.source_ref, source_date = EXCLUDED.source_date,
        notes = EXCLUDED.notes, updated_at = NOW()
      RETURNING *
    `, [
      dealId, body.reportMonth,
      body.totalAssets, body.cash, body.accountsReceivable, body.prepaidExpenses,
      body.realEstateAssets, body.accumulatedDepreciation, body.otherAssets,
      body.totalLiabilities, body.mortgageBalance, body.accountsPayable, body.accruedExpenses,
      body.securityDeposits, body.otherLiabilities,
      body.totalEquity, body.partnerCapital, body.retainedEarnings,
      body.reserves, body.escrows, body.taxEscrow, body.insuranceEscrow, body.replacementReserve,
      body.sourceType || 'manual', body.sourceRef, body.sourceDate, body.notes,
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error saving balance sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:dealId/capex-items', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId } = req.params;
    const result = await pool.query(
      'SELECT * FROM deal_capex_items WHERE deal_id = $1 ORDER BY created_at DESC',
      [dealId]
    );
    const totalBudgeted = result.rows.reduce((s: number, r: any) => s + (parseFloat(r.budgeted_amount) || 0), 0);
    const totalActual = result.rows.reduce((s: number, r: any) => s + (parseFloat(r.actual_amount) || 0), 0);
    res.json({
      success: true,
      data: result.rows,
      summary: {
        totalBudgeted,
        totalActual,
        totalRemaining: totalBudgeted - totalActual,
        itemCount: result.rows.length,
      }
    });
  } catch (error: any) {
    logger.error('Error fetching capex items:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:dealId/capex-items', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId } = req.params;
    const body = req.body;
    const result = await pool.query(`
      INSERT INTO deal_capex_items (
        deal_id, category, description, vendor, budgeted_amount, actual_amount,
        remaining_amount, completion_pct, start_date, completion_date, status,
        invoice_ref, source_type, source_ref, source_date, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      dealId, body.category, body.description, body.vendor,
      body.budgetedAmount, body.actualAmount, body.remainingAmount,
      body.completionPct, body.startDate, body.completionDate,
      body.status || 'planned', body.invoiceRef,
      body.sourceType || 'manual', body.sourceRef, body.sourceDate, body.notes,
    ]);
    // ── capex_schedule.updated trigger ────────────────────────────────────────
    // Capex changes affect the deal's financial profile which flows into the
    // concession environment (e.g. renovation tier classification). Recompute
    // non-fatally so the caller always gets their capex item back.
    (async () => {
      try {
        const { ConcessionEnvironmentEngine } = require('../../services/concession-environment-engine');
        const engine = new ConcessionEnvironmentEngine(pool);
        await engine.computeForDeal(dealId);
        logger.info('Concession env recomputed after capex item create', { dealId });
      } catch (e: any) {
        logger.warn('Concession recompute failed after capex item create (non-fatal)', { dealId, error: e.message });
      }
    })();
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating capex item:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:dealId/capex-items/:itemId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId, itemId } = req.params;
    const body = req.body;
    const result = await pool.query(`
      UPDATE deal_capex_items SET
        category = COALESCE($2, category), description = COALESCE($3, description),
        vendor = COALESCE($4, vendor), budgeted_amount = COALESCE($5, budgeted_amount),
        actual_amount = COALESCE($6, actual_amount), remaining_amount = COALESCE($7, remaining_amount),
        completion_pct = COALESCE($8, completion_pct), status = COALESCE($9, status),
        source_type = COALESCE($10, source_type), source_ref = $11,
        updated_at = NOW()
      WHERE id = $1 AND deal_id = $12 RETURNING *
    `, [
      itemId, body.category, body.description, body.vendor,
      body.budgetedAmount, body.actualAmount, body.remainingAmount,
      body.completionPct, body.status, body.sourceType, body.sourceRef, dealId,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    // ── capex_schedule.updated trigger ────────────────────────────────────────
    (async () => {
      try {
        const { ConcessionEnvironmentEngine } = require('../../services/concession-environment-engine');
        const engine = new ConcessionEnvironmentEngine(pool);
        await engine.computeForDeal(dealId);
        logger.info('Concession env recomputed after capex item update', { dealId, itemId });
      } catch (e: any) {
        logger.warn('Concession recompute failed after capex item update (non-fatal)', { dealId, error: e.message });
      }
    })();
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error updating capex item:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:dealId/debt-schedule', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId } = req.params;
    const result = await pool.query(
      'SELECT * FROM deal_debt_schedule WHERE deal_id = $1 ORDER BY is_active DESC, maturity_date ASC',
      [dealId]
    );
    const activeLoans = result.rows.filter((r: any) => r.is_active);
    const totalDebt = activeLoans.reduce((s: number, r: any) => s + (parseFloat(r.current_balance) || 0), 0);
    const totalAnnualDS = activeLoans.reduce((s: number, r: any) => s + (parseFloat(r.annual_debt_service) || 0), 0);
    const weightedRate = totalDebt > 0
      ? activeLoans.reduce((s: number, r: any) => s + (parseFloat(r.interest_rate) || 0) * (parseFloat(r.current_balance) || 0), 0) / totalDebt
      : 0;
    res.json({
      success: true,
      data: result.rows,
      summary: {
        activeLoans: activeLoans.length,
        totalDebt,
        totalAnnualDebtService: totalAnnualDS,
        weightedAvgRate: Math.round(weightedRate * 10000) / 10000,
        nearestMaturity: activeLoans.length > 0 ? activeLoans[0].maturity_date : null,
      }
    });
  } catch (error: any) {
    logger.error('Error fetching debt schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:dealId/debt-schedule', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId } = req.params;
    const body = req.body;
    const result = await pool.query(`
      INSERT INTO deal_debt_schedule (
        deal_id, lender, loan_type, original_amount, current_balance,
        interest_rate, rate_type, spread, index_rate,
        maturity_date, origination_date, amortization_years, io_period_months,
        monthly_payment, monthly_principal, monthly_interest, annual_debt_service,
        ltv, dscr, debt_yield, prepayment_type, prepayment_expiry, covenants,
        is_active, source_type, source_ref, source_date, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
      RETURNING *
    `, [
      dealId, body.lender, body.loanType, body.originalAmount, body.currentBalance,
      body.interestRate, body.rateType, body.spread, body.indexRate,
      body.maturityDate, body.originationDate, body.amortizationYears, body.ioPeriodMonths,
      body.monthlyPayment, body.monthlyPrincipal, body.monthlyInterest, body.annualDebtService,
      body.ltv, body.dscr, body.debtYield,
      body.prepaymentType, body.prepaymentExpiry, JSON.stringify(body.covenants || null),
      body.isActive !== false, body.sourceType || 'manual', body.sourceRef, body.sourceDate, body.notes,
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating debt schedule entry:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:dealId/data-sources', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId } = req.params;

    const propertyIdResult = await pool.query(
      `SELECT property_id FROM deals WHERE id = $1
       UNION SELECT id FROM properties WHERE id = $1
       LIMIT 1`,
      [dealId]
    );
    const propertyId = propertyIdResult.rows[0]?.property_id || dealId;

    const [assumptions, actuals, leases, balanceSheets, capex, debt] = await Promise.all([
      pool.query('SELECT source_type, source_ref, source_date FROM deal_assumptions WHERE deal_id = $1', [dealId]),
      pool.query('SELECT DISTINCT source_document_type, data_source, source_period_label FROM deal_monthly_actuals WHERE property_id = $1 ORDER BY source_period_label DESC NULLS LAST', [propertyId]),
      pool.query('SELECT DISTINCT source_type, source_ref FROM deal_lease_transactions WHERE deal_id = $1', [dealId]),
      pool.query('SELECT report_month, source_type, source_ref FROM deal_balance_sheets WHERE deal_id = $1 ORDER BY report_month DESC', [dealId]),
      pool.query('SELECT DISTINCT source_type, source_ref FROM deal_capex_items WHERE deal_id = $1', [dealId]),
      pool.query('SELECT lender, source_type, source_ref FROM deal_debt_schedule WHERE deal_id = $1 AND is_active = true', [dealId]),
    ]);

    res.json({
      success: true,
      data: {
        assumptions: assumptions.rows[0] || null,
        actuals: actuals.rows,
        leases: leases.rows,
        balanceSheets: balanceSheets.rows,
        capex: capex.rows,
        debt: debt.rows,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching data sources:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:dealId/financial-context', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!await verifyDealOwnership(req, res)) return;
    const { dealId } = req.params;
    const context = await getDealFinancialContext(dealId);
    res.json({ success: true, data: context });
  } catch (error: any) {
    logger.error('Error fetching financial context:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
