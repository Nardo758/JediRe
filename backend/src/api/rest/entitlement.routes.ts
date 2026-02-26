import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { EntitlementService } from '../../services/entitlement.service';

const router = Router();
const pool = getPool();
const entitlementService = new EntitlementService(pool);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, type, riskLevel, limit, offset } = req.query;
    const result = await entitlementService.list({
      status: status as string,
      type: type as string,
      riskLevel: riskLevel as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json({ success: true, data: result.entitlements, total: result.total });
  } catch (error: any) {
    console.error('List entitlements error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/kanban', async (req: Request, res: Response) => {
  try {
    const { market, type, dealId } = req.query;
    const kanban = await entitlementService.getKanbanView({
      market: market as string,
      type: type as string,
      dealId: dealId as string,
    });
    res.json({ success: true, data: kanban });
  } catch (error: any) {
    console.error('Kanban view error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const entitlements = await entitlementService.getByDeal(dealId);
    res.json({ success: true, data: entitlements });
  } catch (error: any) {
    console.error('Get entitlements by deal error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const entitlement = await entitlementService.getById(req.params.id);
    if (!entitlement) {
      return res.status(404).json({ success: false, error: 'Entitlement not found' });
    }
    res.json({ success: true, data: entitlement });
  } catch (error: any) {
    console.error('Get entitlement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/risk-factors', async (req: Request, res: Response) => {
  try {
    const factors = await entitlementService.identifyRiskFactors(req.params.id);
    res.json({ success: true, data: factors });
  } catch (error: any) {
    console.error('Risk factors error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, error: 'type is required' });
    }
    const entitlement = await entitlementService.create(req.body);
    res.status(201).json({ success: true, data: entitlement });
  } catch (error: any) {
    console.error('Create entitlement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const entitlement = await entitlementService.update(req.params.id, req.body);
    if (!entitlement) {
      return res.status(404).json({ success: false, error: 'Entitlement not found' });
    }
    res.json({ success: true, data: entitlement });
  } catch (error: any) {
    console.error('Update entitlement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await entitlementService.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Entitlement not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete entitlement error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/milestones', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    const milestone = await entitlementService.addMilestone({
      entitlementId: req.params.id,
      ...req.body,
    });
    res.status(201).json({ success: true, data: milestone });
  } catch (error: any) {
    console.error('Add milestone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/milestones/:milestoneId', async (req: Request, res: Response) => {
  try {
    const milestone = await entitlementService.updateMilestone(req.params.milestoneId, req.body);
    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Milestone not found' });
    }
    res.json({ success: true, data: milestone });
  } catch (error: any) {
    console.error('Update milestone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Entitlement Sync (Phase 5 — M02 ↔ M18 bidirectional wiring)
// ============================================================================
import { entitlementSyncService } from '../../services/entitlement-sync.service';

/** POST /sync/path-selected - Auto-create milestones from path selection */
router.post('/sync/path-selected', async (req: Request, res: Response) => {
  try {
    const { dealId, developmentPath, envelope } = req.body;
    if (!dealId || !developmentPath) {
      return res.status(400).json({ error: 'Required: dealId, developmentPath' });
    }
    const result = await entitlementSyncService.onPathSelected(dealId, developmentPath, envelope);
    res.json(result);
  } catch (error: any) {
    console.error('Path sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /sync/status-changed - Notify M02 of entitlement status change */
router.post('/sync/status-changed', async (req: Request, res: Response) => {
  try {
    const { dealId, entitlementId, newStatus, oldStatus } = req.body;
    if (!dealId || !entitlementId || !newStatus) {
      return res.status(400).json({ error: 'Required: dealId, entitlementId, newStatus' });
    }
    const result = await entitlementSyncService.onEntitlementStatusChanged(
      dealId, entitlementId, newStatus, oldStatus || 'unknown'
    );
    res.json(result);
  } catch (error: any) {
    console.error('Status sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /sync/milestone-template/:path - Get milestone template for a path */
router.get('/sync/milestone-template/:path', (req: Request, res: Response) => {
  const templates = entitlementSyncService.getMilestoneTemplate(req.params.path);
  const documents = entitlementSyncService.getRequiredDocuments(req.params.path);
  res.json({ path: req.params.path, milestones: templates, requiredDocuments: documents });
});

export default router;
