import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { ZoningVerificationService } from '../../services/zoning-verification.service';

const router = Router();
const verificationService = new ZoningVerificationService();

router.post('/verify', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { parcelId, gisZoning, jurisdictionId, dealId } = req.body;

    if (!gisZoning || !jurisdictionId) {
      return res.status(400).json({ error: 'gisZoning and jurisdictionId are required' });
    }

    const result = await verificationService.verify({
      parcelId,
      gisZoning,
      jurisdictionId,
      dealId
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/verify/:verificationId/confirm', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { verificationId } = req.params;
    const result = await verificationService.confirmVerification(verificationId);

    if (!result) {
      return res.status(404).json({ error: 'Verification record not found' });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/verify/:verificationId/flag', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { verificationId } = req.params;
    const result = await verificationService.flagVerification(verificationId);

    if (!result) {
      return res.status(404).json({ error: 'Verification record not found' });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/verify/:verificationId/correct', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { verificationId } = req.params;
    const { correctionDetail, newDesignation } = req.body;

    if (!correctionDetail) {
      return res.status(400).json({ error: 'correctionDetail is required' });
    }

    const result = await verificationService.correctVerification(
      verificationId,
      correctionDetail,
      newDesignation
    );

    if (!result) {
      return res.status(404).json({ error: 'Verification record not found' });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/verify/deal/:dealId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { dealId } = req.params;
    const result = await verificationService.getVerificationForDeal(dealId);

    res.json(result || { status: 'none', message: 'No verification found for this deal' });
  } catch (error) {
    next(error);
  }
});

router.get('/citations/:jurisdictionId/:districtCode', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { jurisdictionId, districtCode } = req.params;
    const citations = await verificationService.getCitationsForDistrict(jurisdictionId, districtCode);

    res.json({ citations });
  } catch (error) {
    next(error);
  }
});

router.get('/citations/:jurisdictionId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { jurisdictionId } = req.params;
    const citations = await verificationService.getCitationsByJurisdiction(jurisdictionId);

    res.json({ citations });
  } catch (error) {
    next(error);
  }
});

router.get('/sources/:jurisdictionId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { jurisdictionId } = req.params;
    const source = await verificationService.resolveSource(jurisdictionId);

    if (!source) {
      return res.status(404).json({ error: 'No source mapping found for this jurisdiction' });
    }

    res.json(source);
  } catch (error) {
    next(error);
  }
});

export default router;
