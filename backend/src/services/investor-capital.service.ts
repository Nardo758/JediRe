/**
 * Investor Capital Service
 * 
 * Handles investor tracking, capital calls, distributions, and waterfall calculations.
 * Integrates with the Capital Structure service for waterfall computations.
 */

import { pool } from '../database/pool';
import { logger } from '../utils/logger';
import { capitalStructureService, EquityWaterfallConfig, WaterfallResult } from './capital-structure.service';
import Decimal from 'decimal.js';

// ============================================================================
// Types
// ============================================================================

export interface Investor {
  id: string;
  orgId: string;
  name: string;
  entityType: 'individual' | 'llc' | 'lp' | 'trust' | 'institutional' | 'family_office' | 'fund';
  taxIdType?: 'ein' | 'ssn' | 'foreign';
  investorClass: 'gp' | 'lp' | 'co_gp';
  accredited: boolean;
  qualifiedPurchaser: boolean;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  kycStatus: 'pending' | 'verified' | 'expired' | 'rejected';
  preferredDistributionMethod: 'ach' | 'wire' | 'check';
  withholdingRate: number;
  tags?: string[];
  notes?: string;
}

export interface DealInvestment {
  id: string;
  dealId: string;
  investorId: string;
  investorName?: string;
  commitmentAmount: number;
  commitmentDate: Date;
  ownershipPct: number;
  class: 'class_a' | 'class_b' | 'gp' | 'promote';
  preferredReturn?: number;
  promoteEligible: boolean;
  coInvest: boolean;
  capitalContributed: number;
  capitalReturned: number;
  distributionsPaid: number;
  unreturnedCapital: number;
  status: 'pending' | 'committed' | 'funded' | 'partial' | 'redeemed';
  fundingDeadline?: Date;
}

export interface CapitalCall {
  id: string;
  dealId: string;
  callNumber: number;
  callDate: Date;
  dueDate: Date;
  totalAmount: number;
  purpose: 'initial_closing' | 'subsequent_closing' | 'capital_improvement' | 'operating_shortfall';
  status: 'draft' | 'sent' | 'partial' | 'fulfilled' | 'overdue';
  sentAt?: Date;
  fulfilledAt?: Date;
  noticeDocUrl?: string;
  memo?: string;
  amountReceived: number;
  items?: CapitalCallItem[];
}

export interface CapitalCallItem {
  id: string;
  capitalCallId: string;
  investmentId: string;
  investorId: string;
  investorName?: string;
  calledAmount: number;
  calledPct: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue' | 'defaulted';
  amountPaid: number;
  paidAt?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  daysOverdue: number;
  defaultInterest: number;
}

export interface Distribution {
  id: string;
  dealId: string;
  distNumber: number;
  distDate: Date;
  recordDate: Date;
  distType: 'operating' | 'refinance' | 'sale' | 'return_of_capital' | 'preferred' | 'promote';
  source: 'cash_flow' | 'refi_proceeds' | 'sale_proceeds' | 'reserve_release';
  grossAmount: number;
  withholding: number;
  netAmount: number;
  waterfallTier?: string;
  isReturnOfCapital: boolean;
  isPreferred: boolean;
  isPromote: boolean;
  status: 'draft' | 'approved' | 'processing' | 'paid' | 'partial';
  approvedAt?: Date;
  paidAt?: Date;
  noticeDocUrl?: string;
  memo?: string;
  periodStart?: Date;
  periodEnd?: Date;
  items?: DistributionItem[];
}

export interface DistributionItem {
  id: string;
  distributionId: string;
  investmentId: string;
  investorId: string;
  investorName?: string;
  grossAmount: number;
  allocationPct: number;
  federalWithholding: number;
  stateWithholding: number;
  foreignWithholding: number;
  totalWithholding: number;
  netAmount: number;
  returnOfCapital: number;
  preferredReturn: number;
  profitShare: number;
  promote: number;
  status: 'pending' | 'paid' | 'failed' | 'held';
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: Date;
}

export interface DealWaterfall {
  id: string;
  dealId: string;
  lpCapital: number;
  gpCapital: number;
  totalEquity: number;
  lpPct: number;
  prefRate: number;
  prefCompounding: 'simple' | 'annual' | 'quarterly';
  prefAccrued: number;
  catchUpEnabled: boolean;
  catchUpPct: number;
  clawbackEnabled: boolean;
  clawbackReservePct: number;
  lookbackEnabled: boolean;
  lookbackHurdleRate?: number;
  tiers: WaterfallTier[];
}

export interface WaterfallTier {
  id: string;
  waterfallId: string;
  tierNumber: number;
  tierName: string;
  hurdleType: 'irr' | 'equity_multiple' | 'roi' | 'none';
  hurdleValue?: number;
  lpSplit: number;
  gpSplit: number;
}

export interface CapitalAccountEntry {
  id: string;
  investmentId: string;
  investorId: string;
  dealId: string;
  entryDate: Date;
  entryType: 'contribution' | 'distribution' | 'return_of_capital' | 'preferred' | 'profit_share' | 'promote' | 'adjustment';
  debit: number;
  credit: number;
  balanceAfter: number;
  referenceType?: 'capital_call' | 'distribution' | 'manual';
  referenceId?: string;
  description?: string;
}

// ============================================================================
// Service Class
// ============================================================================

export class InvestorCapitalService {

  // ─────────────────────────────────────────────────────────────────────────
  // INVESTORS
  // ─────────────────────────────────────────────────────────────────────────

  async createInvestor(orgId: string, data: Partial<Investor>): Promise<Investor> {
    const result = await pool.query(`
      INSERT INTO investors (
        org_id, name, entity_type, tax_id_type, investor_class,
        accredited, qualified_purchaser, contact_name, contact_email, contact_phone,
        address_line1, address_line2, city, state, zip, country,
        preferred_distribution_method, withholding_rate, notes, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      orgId,
      data.name,
      data.entityType || 'individual',
      data.taxIdType,
      data.investorClass || 'lp',
      data.accredited ?? true,
      data.qualifiedPurchaser ?? false,
      data.contactName,
      data.contactEmail,
      data.contactPhone,
      data.address?.line1,
      data.address?.line2,
      data.address?.city,
      data.address?.state,
      data.address?.zip,
      data.address?.country || 'USA',
      data.preferredDistributionMethod || 'ach',
      data.withholdingRate || 0,
      data.notes,
      data.tags,
    ]);

    return this.mapInvestor(result.rows[0]);
  }

  async getInvestor(investorId: string): Promise<Investor | null> {
    const result = await pool.query('SELECT * FROM investors WHERE id = $1', [investorId]);
    return result.rows[0] ? this.mapInvestor(result.rows[0]) : null;
  }

  async listInvestors(orgId: string, filters?: {
    investorClass?: string;
    kycStatus?: string;
    search?: string;
  }): Promise<Investor[]> {
    let query = 'SELECT * FROM investors WHERE org_id = $1';
    const params: any[] = [orgId];
    let paramIdx = 2;

    if (filters?.investorClass) {
      query += ` AND investor_class = $${paramIdx++}`;
      params.push(filters.investorClass);
    }
    if (filters?.kycStatus) {
      query += ` AND kyc_status = $${paramIdx++}`;
      params.push(filters.kycStatus);
    }
    if (filters?.search) {
      query += ` AND (name ILIKE $${paramIdx} OR contact_email ILIKE $${paramIdx})`;
      params.push(`%${filters.search}%`);
      paramIdx++;
    }

    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    return result.rows.map(r => this.mapInvestor(r));
  }

  async updateInvestor(investorId: string, data: Partial<Investor>): Promise<Investor> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fields: (keyof Investor)[] = [
      'name', 'entityType', 'investorClass', 'accredited', 'qualifiedPurchaser',
      'contactName', 'contactEmail', 'contactPhone', 'preferredDistributionMethod',
      'withholdingRate', 'notes', 'tags'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        const dbField = this.camelToSnake(field);
        sets.push(`${dbField} = $${idx++}`);
        params.push(data[field]);
      }
    }

    if (data.address) {
      if (data.address.line1 !== undefined) { sets.push(`address_line1 = $${idx++}`); params.push(data.address.line1); }
      if (data.address.line2 !== undefined) { sets.push(`address_line2 = $${idx++}`); params.push(data.address.line2); }
      if (data.address.city !== undefined) { sets.push(`city = $${idx++}`); params.push(data.address.city); }
      if (data.address.state !== undefined) { sets.push(`state = $${idx++}`); params.push(data.address.state); }
      if (data.address.zip !== undefined) { sets.push(`zip = $${idx++}`); params.push(data.address.zip); }
      if (data.address.country !== undefined) { sets.push(`country = $${idx++}`); params.push(data.address.country); }
    }

    sets.push('updated_at = now()');
    params.push(investorId);

    const result = await pool.query(
      `UPDATE investors SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    return this.mapInvestor(result.rows[0]);
  }

  async updateKycStatus(investorId: string, status: 'pending' | 'verified' | 'expired' | 'rejected'): Promise<void> {
    await pool.query(`
      UPDATE investors 
      SET kyc_status = $1, 
          kyc_verified_at = CASE WHEN $1 = 'verified' THEN now() ELSE kyc_verified_at END,
          kyc_expires_at = CASE WHEN $1 = 'verified' THEN now() + INTERVAL '1 year' ELSE kyc_expires_at END,
          updated_at = now()
      WHERE id = $2
    `, [status, investorId]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEAL INVESTMENTS
  // ─────────────────────────────────────────────────────────────────────────

  async addInvestment(dealId: string, investorId: string, data: {
    commitmentAmount: number;
    ownershipPct: number;
    class?: string;
    preferredReturn?: number;
    promoteEligible?: boolean;
    coInvest?: boolean;
    fundingDeadline?: Date;
  }): Promise<DealInvestment> {
    const result = await pool.query(`
      INSERT INTO deal_investments (
        deal_id, investor_id, commitment_amount, commitment_date, ownership_pct,
        class, preferred_return, promote_eligible, co_invest, funding_deadline
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      dealId,
      investorId,
      data.commitmentAmount,
      data.ownershipPct,
      data.class || 'class_a',
      data.preferredReturn,
      data.promoteEligible ?? true,
      data.coInvest ?? false,
      data.fundingDeadline,
    ]);

    return this.mapInvestment(result.rows[0]);
  }

  async getInvestment(investmentId: string): Promise<DealInvestment | null> {
    const result = await pool.query(`
      SELECT di.*, i.name AS investor_name
      FROM deal_investments di
      JOIN investors i ON i.id = di.investor_id
      WHERE di.id = $1
    `, [investmentId]);
    return result.rows[0] ? this.mapInvestment(result.rows[0]) : null;
  }

  async listDealInvestments(dealId: string): Promise<DealInvestment[]> {
    const result = await pool.query(`
      SELECT di.*, i.name AS investor_name
      FROM deal_investments di
      JOIN investors i ON i.id = di.investor_id
      WHERE di.deal_id = $1
      ORDER BY di.ownership_pct DESC
    `, [dealId]);
    return result.rows.map(r => this.mapInvestment(r));
  }

  async listInvestorDeals(investorId: string): Promise<DealInvestment[]> {
    const result = await pool.query(`
      SELECT di.*, d.name AS deal_name
      FROM deal_investments di
      JOIN deals d ON d.id = di.deal_id
      WHERE di.investor_id = $1
      ORDER BY di.commitment_date DESC
    `, [investorId]);
    return result.rows.map(r => this.mapInvestment(r));
  }

  async updateInvestment(investmentId: string, data: Partial<DealInvestment>): Promise<DealInvestment> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.ownershipPct !== undefined) { sets.push(`ownership_pct = $${idx++}`); params.push(data.ownershipPct); }
    if (data.class !== undefined) { sets.push(`class = $${idx++}`); params.push(data.class); }
    if (data.preferredReturn !== undefined) { sets.push(`preferred_return = $${idx++}`); params.push(data.preferredReturn); }
    if (data.promoteEligible !== undefined) { sets.push(`promote_eligible = $${idx++}`); params.push(data.promoteEligible); }
    if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }

    sets.push('updated_at = now()');
    params.push(investmentId);

    const result = await pool.query(
      `UPDATE deal_investments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    return this.mapInvestment(result.rows[0]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CAPITAL CALLS
  // ─────────────────────────────────────────────────────────────────────────

  async createCapitalCall(dealId: string, data: {
    dueDate: Date;
    totalAmount: number;
    purpose: CapitalCall['purpose'];
    memo?: string;
    allocationMethod?: 'pro_rata' | 'commitment_pct' | 'custom';
    customAllocations?: { investmentId: string; amount: number }[];
  }, createdBy: string): Promise<CapitalCall> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get next call number
      const numResult = await client.query(
        'SELECT next_capital_call_number($1) AS num',
        [dealId]
      );
      const callNumber = numResult.rows[0].num;

      // Create capital call
      const callResult = await client.query(`
        INSERT INTO capital_calls (
          deal_id, call_number, call_date, due_date, total_amount, purpose, memo, created_by
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7)
        RETURNING *
      `, [dealId, callNumber, data.dueDate, data.totalAmount, data.purpose, data.memo, createdBy]);

      const capitalCall = callResult.rows[0];

      // Get all investments for this deal
      const investments = await client.query(`
        SELECT di.*, i.name AS investor_name
        FROM deal_investments di
        JOIN investors i ON i.id = di.investor_id
        WHERE di.deal_id = $1 AND di.status != 'redeemed'
      `, [dealId]);

      // Calculate allocations
      const totalCommitment = investments.rows.reduce((sum: number, inv: any) => 
        sum + parseFloat(inv.commitment_amount), 0
      );

      for (const inv of investments.rows) {
        let calledAmount: number;
        let calledPct: number;

        if (data.allocationMethod === 'custom' && data.customAllocations) {
          const custom = data.customAllocations.find(a => a.investmentId === inv.id);
          calledAmount = custom?.amount || 0;
          calledPct = (calledAmount / parseFloat(inv.commitment_amount)) * 100;
        } else {
          // Pro-rata by commitment or ownership
          const pct = data.allocationMethod === 'commitment_pct'
            ? parseFloat(inv.commitment_amount) / totalCommitment
            : parseFloat(inv.ownership_pct) / 100;
          calledAmount = new Decimal(data.totalAmount).times(pct).toDecimalPlaces(2).toNumber();
          calledPct = (calledAmount / parseFloat(inv.commitment_amount)) * 100;
        }

        await client.query(`
          INSERT INTO capital_call_items (
            capital_call_id, investment_id, investor_id, called_amount, called_pct
          ) VALUES ($1, $2, $3, $4, $5)
        `, [capitalCall.id, inv.id, inv.investor_id, calledAmount, calledPct]);
      }

      await client.query('COMMIT');

      return this.getCapitalCall(capitalCall.id) as Promise<CapitalCall>;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getCapitalCall(callId: string): Promise<CapitalCall | null> {
    const callResult = await pool.query('SELECT * FROM capital_calls WHERE id = $1', [callId]);
    if (!callResult.rows[0]) return null;

    const itemsResult = await pool.query(`
      SELECT cci.*, i.name AS investor_name
      FROM capital_call_items cci
      JOIN investors i ON i.id = cci.investor_id
      WHERE cci.capital_call_id = $1
      ORDER BY cci.called_amount DESC
    `, [callId]);

    return {
      ...this.mapCapitalCall(callResult.rows[0]),
      items: itemsResult.rows.map(r => this.mapCapitalCallItem(r)),
    };
  }

  async listCapitalCalls(dealId: string): Promise<CapitalCall[]> {
    const result = await pool.query(`
      SELECT * FROM capital_calls WHERE deal_id = $1 ORDER BY call_number DESC
    `, [dealId]);
    return result.rows.map(r => this.mapCapitalCall(r));
  }

  async sendCapitalCall(callId: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update call status
      await client.query(`
        UPDATE capital_calls SET status = 'sent', sent_at = now(), updated_at = now()
        WHERE id = $1
      `, [callId]);

      // Update all items to pending
      await client.query(`
        UPDATE capital_call_items SET notice_sent_at = now(), updated_at = now()
        WHERE capital_call_id = $1
      `, [callId]);

      // TODO: Queue investor notification emails

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async recordCapitalCallPayment(itemId: string, data: {
    amountPaid: number;
    paymentMethod: 'ach' | 'wire' | 'check';
    paymentReference?: string;
  }): Promise<CapitalCallItem> {
    const result = await pool.query(`
      UPDATE capital_call_items
      SET 
        amount_paid = amount_paid + $1,
        status = CASE 
          WHEN amount_paid + $1 >= called_amount THEN 'paid'
          WHEN amount_paid + $1 > 0 THEN 'partial'
          ELSE status
        END,
        paid_at = CASE WHEN amount_paid + $1 >= called_amount THEN now() ELSE paid_at END,
        payment_method = $2,
        payment_reference = $3,
        updated_at = now()
      WHERE id = $4
      RETURNING *
    `, [data.amountPaid, data.paymentMethod, data.paymentReference, itemId]);

    return this.mapCapitalCallItem(result.rows[0]);
  }

  async markOverdueCapitalCalls(): Promise<number> {
    const result = await pool.query(`
      UPDATE capital_call_items cci
      SET status = 'overdue', updated_at = now()
      FROM capital_calls cc
      WHERE cci.capital_call_id = cc.id
        AND cc.due_date < CURRENT_DATE
        AND cci.status IN ('pending', 'partial')
      RETURNING cci.id
    `);
    return result.rowCount || 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DISTRIBUTIONS
  // ─────────────────────────────────────────────────────────────────────────

  async createDistribution(dealId: string, data: {
    distDate: Date;
    recordDate: Date;
    distType: Distribution['distType'];
    source: Distribution['source'];
    grossAmount: number;
    memo?: string;
    periodStart?: Date;
    periodEnd?: Date;
    useWaterfall?: boolean; // if true, calculate via waterfall
  }, createdBy: string): Promise<Distribution> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get next distribution number
      const numResult = await client.query(
        'SELECT next_distribution_number($1) AS num',
        [dealId]
      );
      const distNumber = numResult.rows[0].num;

      // Determine distribution classification
      const isReturnOfCapital = data.distType === 'return_of_capital';
      const isPreferred = data.distType === 'preferred';
      const isPromote = data.distType === 'promote';

      // Create distribution
      const distResult = await client.query(`
        INSERT INTO distributions (
          deal_id, dist_number, dist_date, record_date, dist_type, source,
          gross_amount, is_return_of_capital, is_preferred, is_promote,
          memo, period_start, period_end, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        dealId, distNumber, data.distDate, data.recordDate, data.distType, data.source,
        data.grossAmount, isReturnOfCapital, isPreferred, isPromote,
        data.memo, data.periodStart, data.periodEnd, createdBy
      ]);

      const distribution = distResult.rows[0];

      // Get investors as of record date
      const investments = await client.query(`
        SELECT di.*, i.name AS investor_name, i.withholding_rate
        FROM deal_investments di
        JOIN investors i ON i.id = di.investor_id
        WHERE di.deal_id = $1 
          AND di.status IN ('committed', 'funded', 'partial')
          AND di.commitment_date <= $2
      `, [dealId, data.recordDate]);

      // Calculate allocations
      if (data.useWaterfall) {
        // Use waterfall calculation
        const waterfallResult = await this.calculateWaterfallDistribution(dealId, data.grossAmount);
        
        for (const inv of investments.rows) {
          const isGP = inv.class === 'gp' || inv.class === 'promote';
          const invShare = isGP 
            ? waterfallResult.gpTotalReturn * (parseFloat(inv.ownership_pct) / 100)
            : waterfallResult.lpTotalReturn * (parseFloat(inv.ownership_pct) / 100);

          const withholding = new Decimal(invShare).times(parseFloat(inv.withholding_rate) / 100).toDecimalPlaces(2).toNumber();

          await client.query(`
            INSERT INTO distribution_items (
              distribution_id, investment_id, investor_id, gross_amount, allocation_pct,
              foreign_withholding, return_of_capital, preferred_return, profit_share, promote
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            distribution.id, inv.id, inv.investor_id, invShare, parseFloat(inv.ownership_pct),
            withholding,
            isReturnOfCapital ? invShare : 0,
            isPreferred ? invShare : 0,
            (!isReturnOfCapital && !isPreferred && !isGP) ? invShare : 0,
            isGP ? invShare : 0,
          ]);
        }
      } else {
        // Simple pro-rata distribution
        const totalOwnership = investments.rows.reduce((sum: number, inv: any) => 
          sum + parseFloat(inv.ownership_pct), 0
        );

        for (const inv of investments.rows) {
          const pct = parseFloat(inv.ownership_pct) / totalOwnership * 100;
          const grossAmt = new Decimal(data.grossAmount).times(pct / 100).toDecimalPlaces(2).toNumber();
          const withholding = new Decimal(grossAmt).times(parseFloat(inv.withholding_rate) / 100).toDecimalPlaces(2).toNumber();

          await client.query(`
            INSERT INTO distribution_items (
              distribution_id, investment_id, investor_id, gross_amount, allocation_pct,
              foreign_withholding, return_of_capital, preferred_return, profit_share
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            distribution.id, inv.id, inv.investor_id, grossAmt, pct,
            withholding,
            isReturnOfCapital ? grossAmt : 0,
            isPreferred ? grossAmt : 0,
            (!isReturnOfCapital && !isPreferred) ? grossAmt : 0,
          ]);
        }
      }

      await client.query('COMMIT');

      return this.getDistribution(distribution.id) as Promise<Distribution>;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getDistribution(distId: string): Promise<Distribution | null> {
    const distResult = await pool.query('SELECT * FROM distributions WHERE id = $1', [distId]);
    if (!distResult.rows[0]) return null;

    const itemsResult = await pool.query(`
      SELECT di.*, i.name AS investor_name
      FROM distribution_items di
      JOIN investors i ON i.id = di.investor_id
      WHERE di.distribution_id = $1
      ORDER BY di.gross_amount DESC
    `, [distId]);

    return {
      ...this.mapDistribution(distResult.rows[0]),
      items: itemsResult.rows.map(r => this.mapDistributionItem(r)),
    };
  }

  async listDistributions(dealId: string): Promise<Distribution[]> {
    const result = await pool.query(`
      SELECT * FROM distributions WHERE deal_id = $1 ORDER BY dist_number DESC
    `, [dealId]);
    return result.rows.map(r => this.mapDistribution(r));
  }

  async approveDistribution(distId: string, approvedBy: string): Promise<void> {
    await pool.query(`
      UPDATE distributions 
      SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now()
      WHERE id = $2
    `, [approvedBy, distId]);
  }

  async processDistribution(distId: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update distribution status
      await client.query(`
        UPDATE distributions SET status = 'processing', updated_at = now()
        WHERE id = $1
      `, [distId]);

      // Get all items
      const items = await client.query(`
        SELECT di.*, inv.preferred_distribution_method, inv.bank_account
        FROM distribution_items di
        JOIN investors inv ON inv.id = di.investor_id
        WHERE di.distribution_id = $1 AND di.status = 'pending'
      `, [distId]);

      // TODO: Queue actual payment processing (ACH/wire)
      // For now, just mark as paid
      for (const item of items.rows) {
        await client.query(`
          UPDATE distribution_items
          SET status = 'paid', payment_method = $1, paid_at = now(), updated_at = now()
          WHERE id = $2
        `, [item.preferred_distribution_method, item.id]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WATERFALL
  // ─────────────────────────────────────────────────────────────────────────

  async getOrCreateWaterfall(dealId: string): Promise<DealWaterfall> {
    const existing = await pool.query(`
      SELECT dw.*, json_agg(wt.* ORDER BY wt.tier_number) AS tiers
      FROM deal_waterfalls dw
      LEFT JOIN waterfall_tiers wt ON wt.waterfall_id = dw.id
      WHERE dw.deal_id = $1
      GROUP BY dw.id
    `, [dealId]);

    if (existing.rows[0]) {
      return this.mapWaterfall(existing.rows[0]);
    }

    // Create default waterfall
    const investments = await this.listDealInvestments(dealId);
    const lpCapital = investments
      .filter(i => i.class !== 'gp' && i.class !== 'promote')
      .reduce((sum, i) => sum + i.commitmentAmount, 0);
    const gpCapital = investments
      .filter(i => i.class === 'gp' || i.class === 'promote')
      .reduce((sum, i) => sum + i.commitmentAmount, 0);

    const wfResult = await pool.query(`
      INSERT INTO deal_waterfalls (
        deal_id, lp_capital, gp_capital, pref_rate, catch_up_enabled, catch_up_pct
      ) VALUES ($1, $2, $3, 8.00, true, 100)
      RETURNING *
    `, [dealId, lpCapital, gpCapital]);

    // Create default tiers
    const defaultTiers = [
      { tierNumber: 1, tierName: 'First Hurdle (0-12% IRR)', hurdleType: 'irr', hurdleValue: 12, lpSplit: 80, gpSplit: 20 },
      { tierNumber: 2, tierName: 'Second Hurdle (12-18% IRR)', hurdleType: 'irr', hurdleValue: 18, lpSplit: 70, gpSplit: 30 },
      { tierNumber: 3, tierName: 'Above 18% IRR', hurdleType: 'none', hurdleValue: null, lpSplit: 60, gpSplit: 40 },
    ];

    for (const tier of defaultTiers) {
      await pool.query(`
        INSERT INTO waterfall_tiers (
          waterfall_id, tier_number, tier_name, hurdle_type, hurdle_value, lp_split, gp_split
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [wfResult.rows[0].id, tier.tierNumber, tier.tierName, tier.hurdleType, tier.hurdleValue, tier.lpSplit, tier.gpSplit]);
    }

    return this.getOrCreateWaterfall(dealId);
  }

  async updateWaterfall(dealId: string, data: Partial<DealWaterfall>): Promise<DealWaterfall> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.prefRate !== undefined) { sets.push(`pref_rate = $${idx++}`); params.push(data.prefRate); }
    if (data.prefCompounding !== undefined) { sets.push(`pref_compounding = $${idx++}`); params.push(data.prefCompounding); }
    if (data.catchUpEnabled !== undefined) { sets.push(`catch_up_enabled = $${idx++}`); params.push(data.catchUpEnabled); }
    if (data.catchUpPct !== undefined) { sets.push(`catch_up_pct = $${idx++}`); params.push(data.catchUpPct); }
    if (data.clawbackEnabled !== undefined) { sets.push(`clawback_enabled = $${idx++}`); params.push(data.clawbackEnabled); }
    if (data.lookbackEnabled !== undefined) { sets.push(`lookback_enabled = $${idx++}`); params.push(data.lookbackEnabled); }
    if (data.lookbackHurdleRate !== undefined) { sets.push(`lookback_hurdle_rate = $${idx++}`); params.push(data.lookbackHurdleRate); }

    if (sets.length > 0) {
      sets.push('updated_at = now()');
      params.push(dealId);
      await pool.query(
        `UPDATE deal_waterfalls SET ${sets.join(', ')} WHERE deal_id = $${idx}`,
        params
      );
    }

    return this.getOrCreateWaterfall(dealId);
  }

  async updateWaterfallTiers(waterfallId: string, tiers: Partial<WaterfallTier>[]): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete existing tiers
      await client.query('DELETE FROM waterfall_tiers WHERE waterfall_id = $1', [waterfallId]);

      // Insert new tiers
      for (const tier of tiers) {
        await client.query(`
          INSERT INTO waterfall_tiers (
            waterfall_id, tier_number, tier_name, hurdle_type, hurdle_value, lp_split, gp_split
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          waterfallId, tier.tierNumber, tier.tierName, tier.hurdleType, 
          tier.hurdleValue, tier.lpSplit, tier.gpSplit
        ]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async calculateWaterfallDistribution(dealId: string, exitProceeds: number, holdYears?: number): Promise<WaterfallResult> {
    const waterfall = await this.getOrCreateWaterfall(dealId);
    
    // Get annual cash flows for pref calculation
    const cashFlowsResult = await pool.query(`
      SELECT COALESCE(SUM(gross_amount), 0) AS total
      FROM distributions
      WHERE deal_id = $1 AND dist_type = 'operating' AND status = 'paid'
    `, [dealId]);
    
    // Estimate annual cash flows (simplified)
    const totalOperatingDist = parseFloat(cashFlowsResult.rows[0].total) || 0;
    const years = holdYears || 5;
    const avgAnnualCashFlow = totalOperatingDist / years;
    const annualCashFlows = Array(years).fill(avgAnnualCashFlow);

    // Build config for capital structure service
    const config: EquityWaterfallConfig = {
      lpCapital: waterfall.lpCapital,
      gpCapital: waterfall.gpCapital,
      totalEquity: waterfall.totalEquity,
      lpPercentage: waterfall.lpPct,
      gpPercentage: 100 - waterfall.lpPct,
      preferredReturn: waterfall.prefRate,
      tiers: waterfall.tiers.map(t => ({
        id: t.id,
        name: t.tierName,
        hurdleRate: t.hurdleValue || 0,
        gpSplit: t.gpSplit / 100,
        lpSplit: t.lpSplit / 100,
      })),
      catchUpProvision: waterfall.catchUpEnabled,
      catchUpPercentage: waterfall.catchUpPct,
      clawbackProvision: waterfall.clawbackEnabled,
    };

    return capitalStructureService.calculateWaterfall(config, exitProceeds, years, annualCashFlows);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CAPITAL ACCOUNT
  // ─────────────────────────────────────────────────────────────────────────

  async getCapitalAccountLedger(investmentId: string): Promise<CapitalAccountEntry[]> {
    const result = await pool.query(`
      SELECT * FROM capital_account_entries
      WHERE investment_id = $1
      ORDER BY entry_date, created_at
    `, [investmentId]);
    return result.rows.map(r => this.mapCapitalEntry(r));
  }

  async getInvestorCapitalSummary(investorId: string): Promise<{
    totalDeals: number;
    totalCommitted: number;
    totalContributed: number;
    totalDistributions: number;
    totalUnreturned: number;
    overallMultiple: number;
    pendingCapitalCalls: number;
    deals: Array<{
      dealId: string;
      dealName: string;
      committed: number;
      contributed: number;
      distributions: number;
      unreturned: number;
      multiple: number;
    }>;
  }> {
    const summary = await pool.query(`
      SELECT * FROM mv_investor_summary WHERE investor_id = $1
    `, [investorId]);

    const deals = await pool.query(`
      SELECT 
        di.deal_id,
        d.name AS deal_name,
        di.commitment_amount AS committed,
        di.capital_contributed AS contributed,
        di.distributions_paid AS distributions,
        di.unreturned_capital AS unreturned,
        CASE WHEN di.capital_contributed > 0 
          THEN di.distributions_paid / di.capital_contributed 
          ELSE 0 
        END AS multiple
      FROM deal_investments di
      JOIN deals d ON d.id = di.deal_id
      WHERE di.investor_id = $1
      ORDER BY di.commitment_date DESC
    `, [investorId]);

    const s = summary.rows[0] || {};
    return {
      totalDeals: parseInt(s.total_deals) || 0,
      totalCommitted: parseFloat(s.total_committed) || 0,
      totalContributed: parseFloat(s.total_contributed) || 0,
      totalDistributions: parseFloat(s.total_distributions) || 0,
      totalUnreturned: parseFloat(s.total_unreturned) || 0,
      overallMultiple: parseFloat(s.overall_multiple) || 0,
      pendingCapitalCalls: parseFloat(s.pending_capital_calls) || 0,
      deals: deals.rows.map(d => ({
        dealId: d.deal_id,
        dealName: d.deal_name,
        committed: parseFloat(d.committed),
        contributed: parseFloat(d.contributed),
        distributions: parseFloat(d.distributions),
        unreturned: parseFloat(d.unreturned),
        multiple: parseFloat(d.multiple),
      })),
    };
  }

  async getDealCapitalSummary(dealId: string): Promise<{
    investorCount: number;
    fundedInvestorCount: number;
    totalCommitted: number;
    totalContributed: number;
    totalDistributed: number;
    totalCalls: number;
    fulfilledCalls: number;
    totalCalled: number;
    totalDistributions: number;
    totalPaidDistributions: number;
    unfundedCommitments: number;
  }> {
    const result = await pool.query(`
      SELECT * FROM mv_deal_capital_summary WHERE deal_id = $1
    `, [dealId]);

    const s = result.rows[0] || {};
    return {
      investorCount: parseInt(s.investor_count) || 0,
      fundedInvestorCount: parseInt(s.funded_investor_count) || 0,
      totalCommitted: parseFloat(s.total_committed) || 0,
      totalContributed: parseFloat(s.total_contributed) || 0,
      totalDistributed: parseFloat(s.total_distributed) || 0,
      totalCalls: parseInt(s.total_calls) || 0,
      fulfilledCalls: parseInt(s.fulfilled_calls) || 0,
      totalCalled: parseFloat(s.total_called) || 0,
      totalDistributions: parseInt(s.total_distributions) || 0,
      totalPaidDistributions: parseFloat(s.total_paid_distributions) || 0,
      unfundedCommitments: parseFloat(s.unfunded_commitments) || 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private mapInvestor(row: any): Investor {
    return {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      entityType: row.entity_type,
      taxIdType: row.tax_id_type,
      investorClass: row.investor_class,
      accredited: row.accredited,
      qualifiedPurchaser: row.qualified_purchaser,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      address: {
        line1: row.address_line1,
        line2: row.address_line2,
        city: row.city,
        state: row.state,
        zip: row.zip,
        country: row.country,
      },
      kycStatus: row.kyc_status,
      preferredDistributionMethod: row.preferred_distribution_method,
      withholdingRate: parseFloat(row.withholding_rate) || 0,
      tags: row.tags,
      notes: row.notes,
    };
  }

  private mapInvestment(row: any): DealInvestment {
    return {
      id: row.id,
      dealId: row.deal_id,
      investorId: row.investor_id,
      investorName: row.investor_name,
      commitmentAmount: parseFloat(row.commitment_amount),
      commitmentDate: new Date(row.commitment_date),
      ownershipPct: parseFloat(row.ownership_pct),
      class: row.class,
      preferredReturn: row.preferred_return ? parseFloat(row.preferred_return) : undefined,
      promoteEligible: row.promote_eligible,
      coInvest: row.co_invest,
      capitalContributed: parseFloat(row.capital_contributed) || 0,
      capitalReturned: parseFloat(row.capital_returned) || 0,
      distributionsPaid: parseFloat(row.distributions_paid) || 0,
      unreturnedCapital: parseFloat(row.unreturned_capital) || 0,
      status: row.status,
      fundingDeadline: row.funding_deadline ? new Date(row.funding_deadline) : undefined,
    };
  }

  private mapCapitalCall(row: any): CapitalCall {
    return {
      id: row.id,
      dealId: row.deal_id,
      callNumber: row.call_number,
      callDate: new Date(row.call_date),
      dueDate: new Date(row.due_date),
      totalAmount: parseFloat(row.total_amount),
      purpose: row.purpose,
      status: row.status,
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at) : undefined,
      noticeDocUrl: row.notice_doc_url,
      memo: row.memo,
      amountReceived: parseFloat(row.amount_received) || 0,
    };
  }

  private mapCapitalCallItem(row: any): CapitalCallItem {
    return {
      id: row.id,
      capitalCallId: row.capital_call_id,
      investmentId: row.investment_id,
      investorId: row.investor_id,
      investorName: row.investor_name,
      calledAmount: parseFloat(row.called_amount),
      calledPct: parseFloat(row.called_pct) || 0,
      status: row.status,
      amountPaid: parseFloat(row.amount_paid) || 0,
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      daysOverdue: parseInt(row.days_overdue) || 0,
      defaultInterest: parseFloat(row.default_interest) || 0,
    };
  }

  private mapDistribution(row: any): Distribution {
    return {
      id: row.id,
      dealId: row.deal_id,
      distNumber: row.dist_number,
      distDate: new Date(row.dist_date),
      recordDate: new Date(row.record_date),
      distType: row.dist_type,
      source: row.source,
      grossAmount: parseFloat(row.gross_amount),
      withholding: parseFloat(row.withholding) || 0,
      netAmount: parseFloat(row.net_amount) || 0,
      waterfallTier: row.waterfall_tier,
      isReturnOfCapital: row.is_return_of_capital,
      isPreferred: row.is_preferred,
      isPromote: row.is_promote,
      status: row.status,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      noticeDocUrl: row.notice_doc_url,
      memo: row.memo,
      periodStart: row.period_start ? new Date(row.period_start) : undefined,
      periodEnd: row.period_end ? new Date(row.period_end) : undefined,
    };
  }

  private mapDistributionItem(row: any): DistributionItem {
    return {
      id: row.id,
      distributionId: row.distribution_id,
      investmentId: row.investment_id,
      investorId: row.investor_id,
      investorName: row.investor_name,
      grossAmount: parseFloat(row.gross_amount),
      allocationPct: parseFloat(row.allocation_pct) || 0,
      federalWithholding: parseFloat(row.federal_withholding) || 0,
      stateWithholding: parseFloat(row.state_withholding) || 0,
      foreignWithholding: parseFloat(row.foreign_withholding) || 0,
      totalWithholding: parseFloat(row.total_withholding) || 0,
      netAmount: parseFloat(row.net_amount) || 0,
      returnOfCapital: parseFloat(row.return_of_capital) || 0,
      preferredReturn: parseFloat(row.preferred_return) || 0,
      profitShare: parseFloat(row.profit_share) || 0,
      promote: parseFloat(row.promote) || 0,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
    };
  }

  private mapWaterfall(row: any): DealWaterfall {
    return {
      id: row.id,
      dealId: row.deal_id,
      lpCapital: parseFloat(row.lp_capital),
      gpCapital: parseFloat(row.gp_capital),
      totalEquity: parseFloat(row.total_equity),
      lpPct: parseFloat(row.lp_pct),
      prefRate: parseFloat(row.pref_rate),
      prefCompounding: row.pref_compounding,
      prefAccrued: parseFloat(row.pref_accrued) || 0,
      catchUpEnabled: row.catch_up_enabled,
      catchUpPct: parseFloat(row.catch_up_pct),
      clawbackEnabled: row.clawback_enabled,
      clawbackReservePct: parseFloat(row.clawback_reserve_pct) || 0,
      lookbackEnabled: row.lookback_enabled,
      lookbackHurdleRate: row.lookback_hurdle_rate ? parseFloat(row.lookback_hurdle_rate) : undefined,
      tiers: (row.tiers || []).filter((t: any) => t).map((t: any) => ({
        id: t.id,
        waterfallId: t.waterfall_id,
        tierNumber: t.tier_number,
        tierName: t.tier_name,
        hurdleType: t.hurdle_type,
        hurdleValue: t.hurdle_value ? parseFloat(t.hurdle_value) : undefined,
        lpSplit: parseFloat(t.lp_split),
        gpSplit: parseFloat(t.gp_split),
      })),
    };
  }

  private mapCapitalEntry(row: any): CapitalAccountEntry {
    return {
      id: row.id,
      investmentId: row.investment_id,
      investorId: row.investor_id,
      dealId: row.deal_id,
      entryDate: new Date(row.entry_date),
      entryType: row.entry_type,
      debit: parseFloat(row.debit) || 0,
      credit: parseFloat(row.credit) || 0,
      balanceAfter: parseFloat(row.balance_after),
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      description: row.description,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

// Singleton export
export const investorCapitalService = new InvestorCapitalService();
