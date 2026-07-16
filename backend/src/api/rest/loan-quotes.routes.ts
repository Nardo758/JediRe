/**
 * loan-quotes.routes.ts
 * LQ-3: REST endpoints for loan quote CRUD + comparison.
 *
 * Routes (all org-scoped, Lane B privacy):
 *   GET    /api/v1/orgs/:orgId/quotes          — list quotes
 *   POST   /api/v1/orgs/:orgId/quotes          — create quote
 *   GET    /api/v1/orgs/:orgId/quotes/:id      — read quote
 *   PATCH  /api/v1/orgs/:orgId/quotes/:id      — update quote
 *   DELETE /api/v1/orgs/:orgId/quotes/:id      — delete quote
 *   POST   /api/v1/orgs/:orgId/quotes/compare  — compare quotes for a deal
 *
 * Auth: requireAuth + requireOrgRoleForOrg('viewer') for reads,
 *       requireOrgRoleForOrg('analyst') for writes.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { loanQuoteStore } from '../../services/loan-quotes/loan-quote-store';
import type { LoanQuote } from '../../services/loan-quotes/loan-quote.types';
import { compareQuotes } from '../../services/loan-quotes/quote-comparison';
import { requireAuth } from '../../middleware/auth';
import { requireOrgRoleForOrg, OrgAuthenticatedRequest } from '../../middleware/rbac';
import { logger } from '../../utils/logger';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const indexBasisSchema = z.enum(['SOFR', 'treasury_5yr', 'treasury_7yr', 'treasury_10yr', 'treasury_30yr']);
const rateTypeSchema = z.enum(['fixed', 'floating']);
const spreadMatrixSchema = z.object({ program: z.string().min(1), grid: z.record(z.string().min(1), z.record(z.any(), z.any())) });
const adjustmentSchema = z.object({ name: z.string().min(1), bps: z.number(), provenance: z.string().min(1) });
const prepayStructureSchema = z.object({ type: z.enum(['yield_maintenance', 'defeasance', 'step_down']), terms: z.record(z.string(), z.any()) });
const brokerClaimsSchema = z.object({ source: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), confidence: z.number().min(0).max(1), sourceId: z.string().optional(), context: z.string().optional() });

const createQuoteSchema = z.object({
  lender: z.string().min(1).max(255),
  program: z.string().min(1).max(255),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  indexBasis: indexBasisSchema,
  rateType: rateTypeSchema,
  spreadMatrix: spreadMatrixSchema,
  adjustments: z.array(adjustmentSchema).default([]),
  prepayStructure: prepayStructureSchema,
  brokerClaims: brokerClaimsSchema,
  notes: z.string().max(5000).optional(),
});

const updateQuoteSchema = z.object({
  lender: z.string().min(1).max(255).optional(),
  program: z.string().min(1).max(255).optional(),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  indexBasis: indexBasisSchema.optional(),
  rateType: rateTypeSchema.optional(),
  spreadMatrix: spreadMatrixSchema.optional(),
  adjustments: z.array(adjustmentSchema).optional(),
  prepayStructure: prepayStructureSchema.optional(),
  brokerClaims: brokerClaimsSchema.optional(),
  notes: z.string().max(5000).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });

const compareSchema = z.object({
  deal: z.object({ purchasePrice: z.number().positive(), noiY1: z.number().positive(), targetLtv: z.number().min(0).max(1), preferredTerm: z.number().int().positive().optional(), preferredProgram: z.string().optional() }),
  objective: z.enum(['lowest_all_in', 'max_proceeds', 'best_levered_irr', 'best_dscr_headroom']),
  quoteIds: z.array(z.string().uuid()).optional(),
});

// ============================================================================
// Helpers
// ============================================================================

function serializeQuote(quote: LoanQuote) {
  return { id: quote.id, orgId: quote.orgId, lender: quote.lender, program: quote.program, quoteDate: quote.quoteDate, expires: quote.expires, indexBasis: quote.indexBasis, rateType: quote.rateType, spreadMatrix: quote.spreadMatrix, adjustments: quote.adjustments, prepayStructure: quote.prepayStructure, brokerClaims: quote.brokerClaims, notes: quote.notes, createdAt: quote.createdAt, updatedAt: quote.updatedAt };
}

// ============================================================================
// Routes
// ============================================================================

router.get('/', requireAuth, requireOrgRoleForOrg('viewer'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.params.orgId;
    const { lender, program } = req.query;
    const quotes = await loanQuoteStore.list(orgId, { lender: typeof lender === 'string' ? lender : undefined, program: typeof program === 'string' ? program : undefined });
    res.json({ success: true, count: quotes.length, data: quotes.map(serializeQuote) });
  } catch (error: any) {
    logger.error('[LoanQuotes] LIST failed', { orgId: req.params.orgId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to list quotes' });
  }
});

router.post('/', requireAuth, requireOrgRoleForOrg('analyst'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.params.orgId;
    const parsed = createQuoteSchema.parse(req.body);
    const quote = await loanQuoteStore.create({ orgId, lender: parsed.lender, program: parsed.program, quoteDate: parsed.quoteDate, expires: parsed.expires, indexBasis: parsed.indexBasis, rateType: parsed.rateType, spreadMatrix: parsed.spreadMatrix as LoanQuote['spreadMatrix'], adjustments: parsed.adjustments as LoanQuote['adjustments'], prepayStructure: parsed.prepayStructure as LoanQuote['prepayStructure'], brokerClaims: parsed.brokerClaims as LoanQuote['brokerClaims'], notes: parsed.notes });
    res.status(201).json({ success: true, data: serializeQuote(quote) });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    logger.error('[LoanQuotes] CREATE failed', { orgId: req.params.orgId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create quote' });
  }
});

router.get('/stale', requireAuth, requireOrgRoleForOrg('viewer'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const quotes = await loanQuoteStore.findStale(req.params.orgId);
    res.json({ success: true, count: quotes.length, data: quotes.map(serializeQuote) });
  } catch (error: any) {
    logger.error('[LoanQuotes] STALE failed', { orgId: req.params.orgId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to list stale quotes' });
  }
});

router.post('/compare', requireAuth, requireOrgRoleForOrg('viewer'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.params.orgId;
    const parsed = compareSchema.parse(req.body);
    let quotes: LoanQuote[];
    if (parsed.quoteIds && parsed.quoteIds.length > 0) {
      const fetched = await Promise.all(parsed.quoteIds.map((id) => loanQuoteStore.read(id, orgId)));
      quotes = fetched.filter((q): q is LoanQuote => q !== null);
      if (quotes.length === 0) return res.status(404).json({ success: false, error: 'None of the requested quote IDs were found for this organization' });
    } else {
      quotes = await loanQuoteStore.list(orgId);
    }
    if (quotes.length === 0) return res.status(200).json({ success: true, data: { rankedQuotes: [], staleQuotes: [], failedQuotes: [], objective: parsed.objective, comparedAt: new Date().toISOString() }, message: 'No quotes available for comparison' });
    const result = compareQuotes({ deal: parsed.deal, quotes, objective: parsed.objective });
    res.json({ success: true, data: { rankedQuotes: result.rankedQuotes.map((rq) => ({ rank: rq.rank, rankScore: rq.rankScore, quote: serializeQuote(rq.quote), pricing: rq.pricing })), staleQuotes: result.staleQuotes.map(serializeQuote), failedQuotes: result.failedQuotes.map((fq) => ({ quote: serializeQuote(fq.quote), reason: fq.reason })), objective: result.objective, comparedAt: result.comparedAt } });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    logger.error('[LoanQuotes] COMPARE failed', { orgId: req.params.orgId, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to compare quotes' });
  }
});

router.get('/:id', requireAuth, requireOrgRoleForOrg('viewer'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const quote = await loanQuoteStore.read(req.params.id, req.params.orgId);
    if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });
    res.json({ success: true, data: serializeQuote(quote) });
  } catch (error: any) {
    logger.error('[LoanQuotes] READ failed', { orgId: req.params.orgId, id: req.params.id, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to read quote' });
  }
});

router.patch('/:id', requireAuth, requireOrgRoleForOrg('analyst'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateQuoteSchema.parse(req.body);
    const quote = await loanQuoteStore.update(req.params.id, req.params.orgId, parsed as Partial<Omit<LoanQuote, 'id' | 'orgId' | 'createdAt'>>);
    res.json({ success: true, data: serializeQuote(quote) });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    if (error.message?.includes('Quote not found')) return res.status(404).json({ success: false, error: 'Quote not found' });
    if (error.message?.includes('No fields provided')) return res.status(400).json({ success: false, error: error.message });
    logger.error('[LoanQuotes] UPDATE failed', { orgId: req.params.orgId, id: req.params.id, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update quote' });
  }
});

router.delete('/:id', requireAuth, requireOrgRoleForOrg('analyst'), async (req: OrgAuthenticatedRequest, res: Response) => {
  try {
    const deleted = await loanQuoteStore.delete(req.params.id, req.params.orgId);
    if (!deleted) return res.status(404).json({ success: false, error: 'Quote not found' });
    res.json({ success: true, message: 'Quote deleted' });
  } catch (error: any) {
    logger.error('[LoanQuotes] DELETE failed', { orgId: req.params.orgId, id: req.params.id, error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete quote' });
  }
});

export default router;
