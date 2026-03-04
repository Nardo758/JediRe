import { Router, Request, Response } from 'express';
import { dataUploadService } from '../../services/data-upload.service';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const templates = await dataUploadService.getTemplates();
    res.json({ success: true, data: templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:format', async (req: Request, res: Response) => {
  try {
    const csv = await dataUploadService.generateTemplateCSV(req.params.format);
    if (!csv) return res.status(404).json({ error: 'Template not found' });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.format}_template.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
