/**
 * Organization API Routes
 * 
 * Multi-tenant organization management, team assignments, and integrations.
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import * as orgService from '../../services/organization.service';
import * as contextService from '../../services/context-tracker.service';
import * as docusign from '../../services/integrations/docusign.service';
import * as notarize from '../../services/integrations/notarize.service';
import * as plaid from '../../services/integrations/plaid.service';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// ORGANIZATION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/organization
 * Get current user's organization
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) {
      return res.status(404).json({ success: false, error: 'No organization found' });
    }
    res.json({ success: true, organization: org });
  } catch (err) {
    logger.error('Get organization error:', err);
    res.status(500).json({ success: false, error: 'Failed to get organization' });
  }
});

/**
 * GET /api/v1/organization/members
 * Get organization members
 */
router.get('/members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) {
      return res.status(404).json({ success: false, error: 'No organization found' });
    }
    const members = await orgService.getOrganizationMembers(org.id);
    res.json({ success: true, members });
  } catch (err) {
    logger.error('Get members error:', err);
    res.status(500).json({ success: false, error: 'Failed to get members' });
  }
});

/**
 * POST /api/v1/organization/members/invite
 * Invite a member to the organization
 */
router.post('/members/invite', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) {
      return res.status(404).json({ success: false, error: 'No organization found' });
    }
    
    const { email, role, title, department } = req.body;
    const id = await orgService.inviteMember(org.id, email, role, title, department);
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Invite member error:', err);
    res.status(500).json({ success: false, error: 'Failed to invite member' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// DEAL TEAM ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/organization/deals/:dealId/team
 * Get team assignments for a deal
 */
router.get('/deals/:dealId/team', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { phase } = req.query;
    const team = await orgService.getDealTeam(
      req.params.dealId,
      phase as 'underwriting' | 'due_diligence' | 'closing' | 'operations' | undefined
    );
    res.json({ success: true, team });
  } catch (err) {
    logger.error('Get deal team error:', err);
    res.status(500).json({ success: false, error: 'Failed to get team' });
  }
});

/**
 * POST /api/v1/organization/deals/:dealId/team
 * Assign a team member to a deal
 */
router.post('/deals/:dealId/team', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { memberId, dealRole, phase, canEdit, canApprove, canSign, receivesNotifications } = req.body;
    const id = await orgService.assignTeamMember({
      dealId: req.params.dealId,
      memberId,
      dealRole,
      phase,
      canEdit,
      canApprove,
      canSign,
      receivesNotifications,
    });
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Assign team member error:', err);
    res.status(500).json({ success: false, error: 'Failed to assign member' });
  }
});

/**
 * DELETE /api/v1/organization/deals/:dealId/team/:memberId
 * Remove a team member from a deal
 */
router.delete('/deals/:dealId/team/:memberId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { phase } = req.body;
    await orgService.removeTeamMember(req.params.dealId, req.params.memberId, phase);
    res.json({ success: true });
  } catch (err) {
    logger.error('Remove team member error:', err);
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// DEAL HANDOFFS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/organization/deals/:dealId/handoffs
 * Get handoffs for a deal
 */
router.get('/deals/:dealId/handoffs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const handoffs = await orgService.getDealHandoffs(req.params.dealId);
    res.json({ success: true, handoffs });
  } catch (err) {
    logger.error('Get handoffs error:', err);
    res.status(500).json({ success: false, error: 'Failed to get handoffs' });
  }
});

/**
 * POST /api/v1/organization/deals/:dealId/handoffs
 * Initiate a handoff
 */
router.post('/deals/:dealId/handoffs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { handoffType, fromLeadId, toLeadId, handoffDate, notes } = req.body;
    const id = await orgService.initiateHandoff(
      req.params.dealId,
      handoffType,
      fromLeadId,
      toLeadId,
      new Date(handoffDate),
      notes
    );
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Initiate handoff error:', err);
    res.status(500).json({ success: false, error: 'Failed to initiate handoff' });
  }
});

/**
 * POST /api/v1/organization/handoffs/:handoffId/complete
 * Complete a handoff
 */
router.post('/handoffs/:handoffId/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { checklistCompleted } = req.body;
    await orgService.completeHandoff(req.params.handoffId, req.user!.userId, checklistCompleted);
    res.json({ success: true });
  } catch (err) {
    logger.error('Complete handoff error:', err);
    res.status(500).json({ success: false, error: 'Failed to complete handoff' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// CONTEXT TRACKER
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/organization/deals/:dealId/context
 * Get context items for a deal
 */
router.get('/deals/:dealId/context', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, status, assignedTo, limit } = req.query;
    const items = await contextService.getContextItems(req.params.dealId, {
      contextType: type as any,
      status: status as string,
      assignedTo: assignedTo as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, items });
  } catch (err) {
    logger.error('Get context items error:', err);
    res.status(500).json({ success: false, error: 'Failed to get items' });
  }
});

/**
 * POST /api/v1/organization/deals/:dealId/context
 * Create a context item
 */
router.post('/deals/:dealId/context', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = await contextService.createContextItem(
      { ...req.body, dealId: req.params.dealId },
      req.user!.userId
    );
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Create context item error:', err);
    res.status(500).json({ success: false, error: 'Failed to create item' });
  }
});

/**
 * PATCH /api/v1/organization/context/:itemId/status
 * Update context item status
 */
router.patch('/context/:itemId/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, resolutionNotes } = req.body;
    await contextService.updateContextItemStatus(
      req.params.itemId,
      status,
      req.user!.userId,
      resolutionNotes
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('Update context status error:', err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

/**
 * GET /api/v1/organization/deals/:dealId/context/summary
 * Get context summary for a deal
 */
router.get('/deals/:dealId/context/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await contextService.getContextSummary(req.params.dealId);
    res.json({ success: true, ...summary });
  } catch (err) {
    logger.error('Get context summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

/**
 * GET /api/v1/organization/my-action-items
 * Get pending action items for current user
 */
router.get('/my-action-items', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit } = req.query;
    const items = await contextService.getPendingActionItemsForUser(
      req.user!.userId,
      limit ? parseInt(limit as string) : undefined
    );
    res.json({ success: true, items });
  } catch (err) {
    logger.error('Get my action items error:', err);
    res.status(500).json({ success: false, error: 'Failed to get items' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// DOCUMENT SIGNING (DocuSign)
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/organization/integrations/docusign/credentials
 * Save DocuSign credentials
 */
router.post('/integrations/docusign/credentials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) return res.status(404).json({ success: false, error: 'No organization' });
    
    const { credentials, environment } = req.body;
    await docusign.saveCredentials(org.id, credentials, environment);
    res.json({ success: true });
  } catch (err) {
    logger.error('Save DocuSign credentials error:', err);
    res.status(500).json({ success: false, error: 'Failed to save credentials' });
  }
});

/**
 * POST /api/v1/organization/deals/:dealId/envelopes
 * Create and send a signing envelope
 */
router.post('/deals/:dealId/envelopes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) return res.status(404).json({ success: false, error: 'No organization' });
    
    const envelopeId = await docusign.createEnvelope(org.id, {
      ...req.body,
      dealId: req.params.dealId,
    }, req.user!.userId);
    res.json({ success: true, envelopeId });
  } catch (err) {
    logger.error('Create envelope error:', err);
    res.status(500).json({ success: false, error: 'Failed to create envelope' });
  }
});

/**
 * GET /api/v1/organization/deals/:dealId/envelopes
 * Get envelopes for a deal
 */
router.get('/deals/:dealId/envelopes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const envelopes = await docusign.getEnvelopesForDeal(req.params.dealId);
    res.json({ success: true, envelopes });
  } catch (err) {
    logger.error('Get envelopes error:', err);
    res.status(500).json({ success: false, error: 'Failed to get envelopes' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// NOTARIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/organization/integrations/notarize/credentials
 * Save Notarize credentials
 */
router.post('/integrations/notarize/credentials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) return res.status(404).json({ success: false, error: 'No organization' });
    
    const { credentials, environment } = req.body;
    await notarize.saveCredentials(org.id, credentials, environment);
    res.json({ success: true });
  } catch (err) {
    logger.error('Save Notarize credentials error:', err);
    res.status(500).json({ success: false, error: 'Failed to save credentials' });
  }
});

/**
 * POST /api/v1/organization/deals/:dealId/notarize
 * Create a notarization session
 */
router.post('/deals/:dealId/notarize', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) return res.status(404).json({ success: false, error: 'No organization' });
    
    const sessionId = await notarize.createSession(org.id, {
      ...req.body,
      dealId: req.params.dealId,
    }, req.user!.userId);
    res.json({ success: true, sessionId });
  } catch (err) {
    logger.error('Create notarize session error:', err);
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// IDENTITY VERIFICATION (Plaid)
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/organization/integrations/plaid/credentials
 * Save Plaid credentials
 */
router.post('/integrations/plaid/credentials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) return res.status(404).json({ success: false, error: 'No organization' });
    
    const { credentials, environment } = req.body;
    await plaid.saveCredentials(org.id, credentials, environment);
    res.json({ success: true });
  } catch (err) {
    logger.error('Save Plaid credentials error:', err);
    res.status(500).json({ success: false, error: 'Failed to save credentials' });
  }
});

/**
 * POST /api/v1/organization/deals/:dealId/verify
 * Create an identity verification
 */
router.post('/deals/:dealId/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await orgService.getOrganizationByUser(req.user!.userId);
    if (!org) return res.status(404).json({ success: false, error: 'No organization' });
    
    const verificationId = await plaid.createVerification(org.id, {
      ...req.body,
      dealId: req.params.dealId,
    }, req.user!.userId);
    res.json({ success: true, verificationId });
  } catch (err) {
    logger.error('Create verification error:', err);
    res.status(500).json({ success: false, error: 'Failed to create verification' });
  }
});

/**
 * GET /api/v1/organization/deals/:dealId/verifications
 * Get verifications for a deal
 */
router.get('/deals/:dealId/verifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const verifications = await plaid.getVerificationsForDeal(req.params.dealId);
    res.json({ success: true, verifications });
  } catch (err) {
    logger.error('Get verifications error:', err);
    res.status(500).json({ success: false, error: 'Failed to get verifications' });
  }
});

export default router;
