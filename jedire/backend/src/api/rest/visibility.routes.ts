import { Router, Request, Response } from 'express';
import { visibilityScoringService } from '../../services/visibility-scoring.service';

const router = Router();

router.post('/assess', async (req: Request, res: Response) => {
  try {
    const { property_id } = req.body;
    if (!property_id) {
      return res.status(400).json({ error: 'property_id is required' });
    }

    const scores = await visibilityScoringService.assessProperty(req.body);

    res.json({
      success: true,
      property_id,
      scores,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Visibility] Assessment failed:', error);
    res.status(500).json({
      error: 'Failed to assess visibility',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/score/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const scores = await visibilityScoringService.getScore(propertyId);

    if (!scores) {
      return res.status(404).json({
        error: 'No visibility assessment found',
        property_id: propertyId,
      });
    }

    res.json({
      success: true,
      ...scores,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Visibility] Score fetch failed:', error);
    res.status(500).json({
      error: 'Failed to fetch visibility score',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/assessment/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const assessment = await visibilityScoringService.getFullAssessment(propertyId);

    if (!assessment) {
      return res.status(404).json({
        error: 'No visibility assessment found',
        property_id: propertyId,
      });
    }

    res.json({
      success: true,
      assessment,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Visibility] Assessment fetch failed:', error);
    res.status(500).json({
      error: 'Failed to fetch assessment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.put('/update/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const input = { ...req.body, property_id: propertyId };

    const scores = await visibilityScoringService.assessProperty(input);

    res.json({
      success: true,
      property_id: propertyId,
      scores,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Visibility] Update failed:', error);
    res.status(500).json({
      error: 'Failed to update visibility assessment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/preview', async (req: Request, res: Response) => {
  try {
    const input = { ...req.body, property_id: req.body.property_id || 'preview' };
    const scores = visibilityScoringService.calculateCompositeScore(input);
    const capture_rate = visibilityScoringService.calculateCaptureRate(scores.overall_visibility_score);

    res.json({
      success: true,
      scores,
      capture_rate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Visibility] Preview failed:', error);
    res.status(500).json({
      error: 'Failed to preview visibility score',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
