/**
 * Investor Capital Routes
 * 
 * API endpoints for investor tracking, capital calls, distributions, and waterfall.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthedRequest } from '../../middleware/auth';
import { investorCapitalService } from '../../services/investor-capital.service';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require auth
router.use(requireAuth);

// ============================================================================
// INVESTORS
// ============================================================================

/**
 * POST /investors
 * Create new investor
 */
router.post('/investors', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, ...data } = req.body;
    if (!orgId) {
      return res.status(400).json({ error: 'orgId required' });
    }
    const investor = await investorCapitalService.createInvestor(orgId, data);
    res.status(201).json({ investor });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /investors
 * List investors for org
 */
router.get('/investors', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, investorClass, kycStatus, search } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: 'orgId required' });
    }
    const investors = await investorCapitalService.listInvestors(
      orgId as string,
      { investorClass: investorClass as string, kycStatus: kycStatus as string, search: search as string }
    );
    res.json({ investors });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /investors/:investorId
 * Get investor details
 */
router.get('/investors/:investorId', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const investor = await investorCapitalService.getInvestor(req.params.investorId);
    if (!investor) {
      return res.status(404).json({ error: 'Investor not found' });
    }
    res.json({ investor });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /investors/:investorId
 * Update investor
 */
router.patch('/investors/:investorId', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const investor = await investorCapitalService.updateInvestor(req.params.investorId, req.body);
    res.json({ investor });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /investors/:investorId/kyc
 * Update KYC status
 */
router.post('/investors/:investorId/kyc', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!['pending', 'verified', 'expired', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await investorCapitalService.updateKycStatus(req.params.investorId, status);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /investors/:investorId/summary
 * Get investor capital summary across all deals
 */
router.get('/investors/:investorId/summary', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await investorCapitalService.getInvestorCapitalSummary(req.params.investorId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /investors/:investorId/deals
 * Get all deals for an investor
 */
router.get('/investors/:investorId/deals', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await investorCapitalService.listInvestorDeals(req.params.investorId);
    res.json({ investments });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DEAL INVESTMENTS
// ============================================================================

/**
 * POST /deals/:dealId/investments
 * Add investor to deal
 */
router.post('/deals/:dealId/investments', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { investorId, commitmentAmount, ownershipPct, ...rest } = req.body;
    if (!investorId || !commitmentAmount || ownershipPct === undefined) {
      return res.status(400).json({ error: 'investorId, commitmentAmount, ownershipPct required' });
    }
    const investment = await investorCapitalService.addInvestment(
      req.params.dealId,
      investorId,
      { commitmentAmount, ownershipPct, ...rest }
    );
    res.status(201).json({ investment });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deals/:dealId/investments
 * List all investments for deal
 */
router.get('/deals/:dealId/investments', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await investorCapitalService.listDealInvestments(req.params.dealId);
    res.json({ investments });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deals/:dealId/investments/:investmentId
 * Get investment details
 */
router.get('/deals/:dealId/investments/:investmentId', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const investment = await investorCapitalService.getInvestment(req.params.investmentId);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.json({ investment });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /deals/:dealId/investments/:investmentId
 * Update investment
 */
router.patch('/deals/:dealId/investments/:investmentId', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const investment = await investorCapitalService.updateInvestment(req.params.investmentId, req.body);
    res.json({ investment });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deals/:dealId/investments/:investmentId/ledger
 * Get capital account ledger for investment
 */
router.get('/deals/:dealId/investments/:investmentId/ledger', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const entries = await investorCapitalService.getCapitalAccountLedger(req.params.investmentId);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// CAPITAL CALLS
// ============================================================================

/**
 * POST /deals/:dealId/capital-calls
 * Create capital call
 */
router.post('/deals/:dealId/capital-calls', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { dueDate, totalAmount, purpose, memo, allocationMethod, customAllocations } = req.body;
    if (!dueDate || !totalAmount || !purpose) {
      return res.status(400).json({ error: 'dueDate, totalAmount, purpose required' });
    }
    const call = await investorCapitalService.createCapitalCall(
      req.params.dealId,
      { dueDate: new Date(dueDate), totalAmount, purpose, memo, allocationMethod, customAllocations },
      req.user!.id
    );
    res.status(201).json({ capitalCall: call });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deals/:dealId/capital-calls
 * List capital calls for deal
 */
router.get('/deals/:dealId/capital-calls', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const calls = await investorCapitalService.listCapitalCalls(req.params.dealId);
    res.json({ capitalCalls: calls });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deals/:dealId/capital-calls/:callId
 * Get capital call with items
 */
router.get('/deals/:dealId/capital-calls/:callId', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const call = await investorCapitalService.getCapitalCall(req.params.callId);
    if (!call) {
      return res.status(404).json({ error: 'Capital call not found' });
    }
    res.json({ capitalCall: call });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /deals/:dealId/capital-calls/:callId/send
 * Send capital call notice to investors
 */
router.post('/deals/:dealId/capital-calls/:callId/send', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    await investorCapitalService.sendCapitalCall(req.params.callId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /deals/:dealId/capital-calls/:callId/items/:itemId/payment
 * Record payment for capital call item
 */
router.post('/deals/:dealId/capital-calls/:callId/items/:itemId/payment', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { amountPaid, paymentMethod, paymentReference } = req.body;
    if (!amountPaid || !paymentMethod) {
      return res.status(400).json({ error: 'amountPaid, paymentMethod required' });
    }
    const item = await investorCapitalService.recordCapitalCallPayment(
      req.params.itemId,
      { amountPaid, paymentMethod, paymentReference }
    );
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DISTRIBUTIONS
// ============================================================================

/**
 * POST /deals/:dealId/distributions
 * Create distribution
 */
router.post('/deals/:dealId/distributions', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { distDate, recordDate, distType, source, grossAmount, memo, periodStart, periodEnd, useWaterfall } = req.body;
    if (!distDate || !recordDate || !distType || !source || !grossAmount) {
      return res.status(400).json({ error: 'distDate, recordDate, distType, source, grossAmount required' });
    }
    const distribution = await investorCapitalService.createDistribution(
      req.params.dealId,
      { 
        distDate: new Date(distDate), 
        recordDate: new Date(recordDate), 
        distType, 
        source, 
        grossAmount, 
        memo,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        useWaterfall,
      },
      req.user!.id
    );
    res.status(201).json({ distribution });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deals/:dealId/distributions
 * List distributions for deal
 */
router.get('/deals/:dealId/distributions', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const distributions = await investorCapitalService.listDistributions(req.params.dealId);
    res.json({ distributions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /deals/:dealId/distributions/:distId
 * Get distribution with items
 */
router.get('/deals/:dealId/distributions/:distId', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const distribution = await investorCapitalService.getDistribution(req.params.distId);
    if (!distribution) {
      return res.status(404).json({ error: 'Distribution not found' });
    }
    res.json({ distribution });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /deals/:dealId/distributions/:distId/approve
 * Approve distribution
 */
router.post('/deals/:dealId/distributions/:distId/approve', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    await investorCapitalService.approveDistribution(req.params.distId, req.user!.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /deals/:dealId/distributions/:distId/process
 * Process distribution payments
 */
router.post('/deals/:dealId/distributions/:distId/process', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    await investorCapitalService.processDistribution(req.params.distId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// WATERFALL
// ============================================================================

/**
 * GET /deals/:dealId/waterfall
 * Get deal waterfall configuration
 */
router.get('/deals/:dealId/waterfall', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const waterfall = await investorCapitalService.getOrCreateWaterfall(req.params.dealId);
    res.json({ waterfall });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /deals/:dealId/waterfall
 * Update waterfall configuration
 */
router.patch('/deals/:dealId/waterfall', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const waterfall = await investorCapitalService.updateWaterfall(req.params.dealId, req.body);
    res.json({ waterfall });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /deals/:dealId/waterfall/tiers
 * Replace waterfall tiers
 */
router.put('/deals/:dealId/waterfall/tiers', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const waterfall = await investorCapitalService.getOrCreateWaterfall(req.params.dealId);
    const { tiers } = req.body;
    if (!Array.isArray(tiers)) {
      return res.status(400).json({ error: 'tiers array required' });
    }
    await investorCapitalService.updateWaterfallTiers(waterfall.id, tiers);
    const updated = await investorCapitalService.getOrCreateWaterfall(req.params.dealId);
    res.json({ waterfall: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /deals/:dealId/waterfall/calculate
 * Calculate waterfall distribution for given proceeds
 */
router.post('/deals/:dealId/waterfall/calculate', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const { exitProceeds, holdYears } = req.body;
    if (!exitProceeds) {
      return res.status(400).json({ error: 'exitProceeds required' });
    }
    const result = await investorCapitalService.calculateWaterfallDistribution(
      req.params.dealId,
      exitProceeds,
      holdYears
    );
    res.json({ waterfall: result });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DEAL CAPITAL SUMMARY
// ============================================================================

/**
 * GET /deals/:dealId/capital-summary
 * Get deal capital summary
 */
router.get('/deals/:dealId/capital-summary', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await investorCapitalService.getDealCapitalSummary(req.params.dealId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// ADMIN
// ============================================================================

/**
 * POST /admin/mark-overdue
 * Mark overdue capital calls (cron job)
 */
router.post('/admin/mark-overdue', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const count = await investorCapitalService.markOverdueCapitalCalls();
    res.json({ marked: count });
  } catch (err) {
    next(err);
  }
});

export default router;
