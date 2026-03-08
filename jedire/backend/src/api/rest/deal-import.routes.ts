/**
 * Deal Import REST Routes
 * Endpoints for importing deals from various sources
 */

import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { DealImportService } from '../../services/deal-import.service';
import { logger } from '../../utils/logger';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const dealImportService = new DealImportService();

/**
 * POST /api/v1/deals/import/json
 * Import deals from JSON payload
 */
router.post('/json', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { deals } = req.body;

    if (!deals || !Array.isArray(deals)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must contain a "deals" array',
      });
    }

    // Validate data
    const validation = await dealImportService.validateImportData(deals);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation Failed',
        errors: validation.errors,
      });
    }

    // Import deals
    const result = await dealImportService.importFromJSON(deals, req.user!.id);

    logger.info('Deals imported via JSON:', {
      userId: req.user!.id,
      imported: result.imported,
      failed: result.failed,
    });

    res.status(result.success ? 200 : 207).json({
      success: result.success,
      message: result.success
        ? `Successfully imported ${result.imported} deal(s)`
        : `Imported ${result.imported} deal(s), ${result.failed} failed`,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
      dealIds: result.dealIds,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/deals/import/csv
 * Import deals from CSV file upload
 */
router.post('/csv', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No file uploaded. Use multipart/form-data with "file" field',
      });
    }

    // Check file type
    if (req.file.mimetype !== 'text/csv' && !req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'File must be a CSV',
      });
    }

    // Check file size (10MB max)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'File size exceeds 10MB limit',
      });
    }

    // Import from CSV
    const result = await dealImportService.importFromCSV(req.file.buffer, req.user!.id);

    logger.info('Deals imported via CSV:', {
      userId: req.user!.id,
      fileName: req.file.originalname,
      imported: result.imported,
      failed: result.failed,
    });

    res.status(result.success ? 200 : 207).json({
      success: result.success,
      message: result.success
        ? `Successfully imported ${result.imported} deal(s) from ${req.file.originalname}`
        : `Imported ${result.imported} deal(s), ${result.failed} failed from ${req.file.originalname}`,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
      dealIds: result.dealIds,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/deals/import/validate
 * Validate import data without actually importing
 */
router.post('/validate', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { deals } = req.body;

    if (!deals || !Array.isArray(deals)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must contain a "deals" array',
      });
    }

    const validation = await dealImportService.validateImportData(deals);

    res.json({
      valid: validation.valid,
      errors: validation.errors,
      count: deals.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/deals/import/template
 * Download CSV template for deal imports
 */
router.get('/template', (req, res) => {
  const csvTemplate = `name,address,city,state,zip_code,project_type,status,budget,target_units,description,lot_size_sqft,tier,deal_category
Sample Multifamily Deal,"123 Main St, Atlanta, GA 30308",Atlanta,GA,30308,multifamily,active,2500000,48,Sample multifamily development,25000,pro,pipeline
Sample Mixed-Use,"456 Peachtree St, Atlanta, GA 30309",Atlanta,GA,30309,mixed_use,qualified,8500000,120,Mixed-use retail + residential,45000,enterprise,pipeline
Sample Townhome Project,"789 Oak Ave, Atlanta, GA 30310",Atlanta,GA,30310,townhome,lead,1800000,18,Townhome development,18000,basic,pipeline`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="deal-import-template.csv"');
  res.send(csvTemplate);
});

export default router;
