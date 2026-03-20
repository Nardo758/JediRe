import { Router, Request, Response } from 'express';
import { proformaGeneratorService } from '../../services/proforma-generator.service';
import { proformaTemplateService } from '../../services/proforma-template.service';

const router = Router();

router.post('/:propertyId/proforma/generate', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { strategy, templateId, overrides } = req.body;
    if (!strategy) return res.status(400).json({ error: 'strategy is required (bts, flip, rental, str)' });
    const result = await proformaGeneratorService.generate(propertyId, strategy, templateId, overrides);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:propertyId/proforma/snapshots', async (req: Request, res: Response) => {
  try {
    const snapshots = await proformaGeneratorService.getSnapshots(req.params.propertyId);
    res.json({ success: true, data: snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/proforma/snapshots/:snapshotId', async (req: Request, res: Response) => {
  try {
    const snapshot = await proformaGeneratorService.getSnapshot(req.params.snapshotId);
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
    res.json({ success: true, data: snapshot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/proforma/snapshots/:snapshotId', async (req: Request, res: Response) => {
  try {
    const deleted = await proformaGeneratorService.deleteSnapshot(req.params.snapshotId);
    res.json({ success: deleted, message: deleted ? 'Deleted' : 'Not found' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || 'system';
    const templates = await proformaTemplateService.getAll(userId);
    res.json({ success: true, data: templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || 'system';
    const template = await proformaTemplateService.create(userId, req.body);
    res.json({ success: true, data: template });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const template = await proformaTemplateService.getById(req.params.templateId);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || 'system';
    const template = await proformaTemplateService.update(req.params.templateId, userId, req.body);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || 'system';
    const deleted = await proformaTemplateService.delete(req.params.templateId, userId);
    res.json({ success: deleted, message: deleted ? 'Deleted' : 'Not found or system template' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
