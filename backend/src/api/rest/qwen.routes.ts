import { Router, Request, Response } from 'express';
import multer from 'multer';
import { qwenService } from '../../services/qwen.service';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/v1/ai/image-to-terrain
 * Convert site photo to 3D terrain data
 */
router.post('/image-to-terrain', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!qwenService.isEnabled()) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'Qwen AI is not configured. Please set HF_TOKEN environment variable.',
      });
    }

    const imageUrl = req.body.imageUrl;
    
    if (!imageUrl && !req.file) {
      return res.status(400).json({ error: 'Image URL or file is required' });
    }

    // If file uploaded, convert to base64 data URL
    let finalImageUrl = imageUrl;
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      finalImageUrl = `data:${req.file.mimetype};base64,${base64}`;
    }

    const terrainData = await qwenService.imageToTerrain(finalImageUrl);

    res.json({
      success: true,
      data: terrainData,
    });
  } catch (error) {
    console.error('[QwenRoutes] Image to terrain error:', error);
    res.status(500).json({
      error: 'Failed to analyze terrain',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/analyze-compliance
 * Check 3D design for zoning compliance
 */
router.post('/analyze-compliance', async (req: Request, res: Response) => {
  try {
    if (!qwenService.isEnabled()) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'Qwen AI is not configured. Please set HF_TOKEN environment variable.',
      });
    }

    const { design3D, renderUrl } = req.body;

    if (!design3D || !renderUrl) {
      return res.status(400).json({ error: 'design3D and renderUrl are required' });
    }

    const complianceReport = await qwenService.analyzeDesignCompliance(design3D, renderUrl);

    res.json({
      success: true,
      data: complianceReport,
    });
  } catch (error) {
    console.error('[QwenRoutes] Compliance analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze compliance',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/analyze-aerial
 * Analyze aerial/satellite imagery for site context
 */
router.post('/analyze-aerial', async (req: Request, res: Response) => {
  try {
    if (!qwenService.isEnabled()) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'Qwen AI is not configured. Please set HF_TOKEN environment variable.',
      });
    }

    const { coords, satelliteUrl } = req.body;

    if (!coords || !satelliteUrl) {
      return res.status(400).json({ error: 'coords and satelliteUrl are required' });
    }

    if (!coords.lat || !coords.lng) {
      return res.status(400).json({ error: 'coords must include lat and lng' });
    }

    const siteContext = await qwenService.analyzeSiteFromAerial(coords, satelliteUrl);

    res.json({
      success: true,
      data: siteContext,
    });
  } catch (error) {
    console.error('[QwenRoutes] Aerial analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze aerial imagery',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/owner-disposition
 * Predict owner's likelihood of selling
 */
router.post('/owner-disposition', async (req: Request, res: Response) => {
  try {
    if (!qwenService.isEnabled()) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'Qwen AI is not configured. Please set HF_TOKEN environment variable.',
      });
    }

    const { ownerProfile } = req.body;

    if (!ownerProfile) {
      return res.status(400).json({ error: 'ownerProfile is required' });
    }

    const dispositionScore = await qwenService.predictOwnerDisposition(ownerProfile);

    res.json({
      success: true,
      data: dispositionScore,
    });
  } catch (error) {
    console.error('[QwenRoutes] Owner disposition error:', error);
    res.status(500).json({
      error: 'Failed to analyze owner disposition',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/auto-tag-photos
 * Auto-tag construction photos to 3D locations
 */
router.post('/auto-tag-photos', upload.array('photos', 10), async (req: Request, res: Response) => {
  try {
    if (!qwenService.isEnabled()) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'Qwen AI is not configured. Please set HF_TOKEN environment variable.',
      });
    }

    let photos = [];

    // Handle uploaded files
    if (req.files && Array.isArray(req.files)) {
      photos = req.files.map((file: Express.Multer.File, index: number) => ({
        id: `photo-${Date.now()}-${index}`,
        url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        uploadedAt: new Date().toISOString(),
      }));
    }

    // Handle photo URLs from body
    if (req.body.photos && Array.isArray(req.body.photos)) {
      photos = req.body.photos;
    }

    if (photos.length === 0) {
      return res.status(400).json({ error: 'Photos array or files are required' });
    }

    const photoTags = await qwenService.autoTagPhotos(photos);

    res.json({
      success: true,
      data: photoTags,
    });
  } catch (error) {
    console.error('[QwenRoutes] Auto-tag photos error:', error);
    res.status(500).json({
      error: 'Failed to tag photos',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/estimate-progress
 * Estimate construction progress from photos
 */
router.post('/estimate-progress', upload.array('photos', 5), async (req: Request, res: Response) => {
  try {
    if (!qwenService.isEnabled()) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'Qwen AI is not configured. Please set HF_TOKEN environment variable.',
      });
    }

    let photos = [];
    const section = req.body.section || 'general';

    // Handle uploaded files
    if (req.files && Array.isArray(req.files)) {
      photos = req.files.map((file: Express.Multer.File, index: number) => ({
        id: `photo-${Date.now()}-${index}`,
        url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        uploadedAt: new Date().toISOString(),
      }));
    }

    // Handle photo URLs from body
    if (req.body.photos && Array.isArray(req.body.photos)) {
      photos = req.body.photos;
    }

    if (photos.length === 0) {
      return res.status(400).json({ error: 'Photos array or files are required' });
    }

    const progressEstimate = await qwenService.estimateProgress(photos, section);

    res.json({
      success: true,
      data: progressEstimate,
    });
  } catch (error) {
    console.error('[QwenRoutes] Estimate progress error:', error);
    res.status(500).json({
      error: 'Failed to estimate progress',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/negotiation-strategy
 * Generate land assemblage negotiation strategy
 */
router.post('/negotiation-strategy', async (req: Request, res: Response) => {
  try {
    if (!qwenService.isEnabled()) {
      return res.status(503).json({
        error: 'AI service not available',
        message: 'Qwen AI is not configured. Please set HF_TOKEN environment variable.',
      });
    }

    const { neighbors } = req.body;

    if (!neighbors || !Array.isArray(neighbors)) {
      return res.status(400).json({ error: 'neighbors array is required' });
    }

    const strategy = await qwenService.generateNegotiationStrategy(neighbors);

    res.json({
      success: true,
      data: strategy,
    });
  } catch (error) {
    console.error('[QwenRoutes] Negotiation strategy error:', error);
    res.status(500).json({
      error: 'Failed to generate strategy',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/ai/status
 * Check if AI service is available
 */
router.get('/status', (req: Request, res: Response) => {
  const enabled = qwenService.isEnabled();
  
  res.json({
    enabled,
    message: enabled 
      ? 'Qwen AI service is available' 
      : 'Qwen AI service is not configured. Please set HF_TOKEN environment variable.',
    model: process.env.QWEN_MODEL || 'Qwen/Qwen3.5-397B-A17B:novita',
  });
});

export default router;
