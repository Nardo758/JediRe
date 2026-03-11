import { Router, Request, Response } from 'express';
import { municodeUrlService } from '../../services/municode-url.service';

const router = Router();

router.get('/resolve', async (req: Request, res: Response) => {
  try {
    const { municipality, section } = req.query;
    if (!municipality || !section) {
      return res.status(400).json({ error: 'Required: municipality, section' });
    }

    const url = await municodeUrlService.resolveCodeReference(
      municipality as string,
      section as string,
    );

    const normalized = municodeUrlService.normalizeSection(section as string);

    res.json({
      municipality,
      section,
      normalizedSection: normalized,
      url,
      fallback: !url || url.includes('searchRequest'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/district/:municipalityId/:districtCode', async (req: Request, res: Response) => {
  try {
    const { municipalityId, districtCode } = req.params;
    const result = await municodeUrlService.getDistrictWithUrl(municipalityId, districtCode);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sections/:municipalityId', async (req: Request, res: Response) => {
  try {
    const { municipalityId } = req.params;
    const { codeType } = req.query;
    const sections = await municodeUrlService.getSectionsForMunicipality(
      municipalityId,
      codeType as string | undefined,
    );
    res.json({ municipality: municipalityId, sections, count: sections.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/chapter/:municipalityId', async (req: Request, res: Response) => {
  try {
    const { municipalityId } = req.params;
    const url = await municodeUrlService.buildChapterUrl(municipalityId);
    res.json({ municipality: municipalityId, url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
