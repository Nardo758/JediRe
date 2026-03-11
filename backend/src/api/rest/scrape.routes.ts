import { Router, Request, Response } from 'express';
import { scrapingService } from '../../services/scraping.service';

const router = Router();

router.post('/zoning', async (req: Request, res: Response) => {
  try {
    const { municipalityId, districtCode } = req.body;

    if (!municipalityId || !districtCode) {
      return res.status(400).json({ error: 'Required: municipalityId, districtCode' });
    }

    const result = await scrapingService.scrapeZoningCode(
      municipalityId as string,
      districtCode as string,
    );

    res.json(result);
  } catch (err: any) {
    console.error('[scrape/zoning]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/property', async (req: Request, res: Response) => {
  try {
    const { address, parcelId, countyFips, countyUrl } = req.body;

    if (!address && !parcelId) {
      return res.status(400).json({ error: 'Required: address or parcelId' });
    }

    if (!countyFips && !countyUrl && !address) {
      return res.status(400).json({ error: 'Required: countyFips or countyUrl (when using parcelId only)' });
    }

    const result = await scrapingService.scrapeProperty({ address, parcelId, countyFips, countyUrl });

    res.json(result);
  } catch (err: any) {
    console.error('[scrape/property]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/municode', async (req: Request, res: Response) => {
  try {
    const { municipalityId, documentType, startYear, endYear, maxItems } = req.body;

    if (!municipalityId) {
      return res.status(400).json({ error: 'Required: municipalityId' });
    }

    let records: any[] = [];
    let warning: string | undefined;

    try {
      records = await scrapingService.scrapeMunicodeRecords(municipalityId as string, {
        documentType,
        startYear: startYear ? parseInt(startYear) : undefined,
        endYear: endYear ? parseInt(endYear) : undefined,
        maxItems: maxItems ? parseInt(maxItems) : 100,
      });
    } catch (scrapeErr: any) {
      console.warn('[scrape/municode] scrape failed, returning empty:', scrapeErr.message);
      warning = scrapeErr.message;
    }

    res.json({
      municipalityId,
      documentType: documentType || 'all',
      count: records.length,
      records,
      ...(warning ? { warning } : {}),
    });
  } catch (err: any) {
    console.error('[scrape/municode]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
