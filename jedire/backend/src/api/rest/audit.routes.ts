/**
 * Audit Trail API Routes - JEDI RE Phase 2 Component 4
 * RESTful endpoints for audit trail system
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../database/connection';
import { AuditTrailService } from '../../services/audit-trail.service';
import { authenticateToken } from '../../middleware/auth';

const router = Router();
const auditService = new AuditTrailService(pool);

// All routes require authentication
router.use(authenticateToken);

  /**
   * GET /api/v1/audit/assumption/:assumptionId
   * Get complete evidence chain for a specific assumption
   */
  router.get('/assumption/:assumptionId', async (req: Request, res: Response) => {
    try {
      const { assumptionId } = req.params;

      const evidenceChain = await auditService.getAssumptionEvidenceChain(assumptionId);

      if (!evidenceChain) {
        return res.status(404).json({
          success: false,
          error: 'Assumption not found or no evidence chain available',
        });
      }

      res.json({
        success: true,
        data: evidenceChain,
      });
    } catch (error) {
      console.error('Error fetching assumption evidence chain:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch evidence chain',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/audit/deal/:dealId
   * Get full audit trail summary for a deal
   */
  router.get('/deal/:dealId', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;

      const auditSummary = await auditService.getDealAuditTrail(dealId);

      res.json({
        success: true,
        data: auditSummary,
      });
    } catch (error) {
      console.error('Error fetching deal audit trail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deal audit trail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/audit/event/:eventId
   * Get all assumptions affected by a specific news event
   */
  router.get('/event/:eventId', async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;

      const eventImpact = await auditService.getEventImpact(eventId);

      if (!eventImpact) {
        return res.status(404).json({
          success: false,
          error: 'Event not found or no impact recorded',
        });
      }

      res.json({
        success: true,
        data: eventImpact,
      });
    } catch (error) {
      console.error('Error fetching event impact:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch event impact',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/audit/confidence/:dealId
   * Get confidence scores for all assumptions in a deal
   */
  router.get('/confidence/:dealId', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;

      const confidenceScores = await auditService.getDealConfidenceScores(dealId);

      res.json({
        success: true,
        data: confidenceScores,
      });
    } catch (error) {
      console.error('Error fetching confidence scores:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch confidence scores',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/audit/export/:dealId
   * Generate and export audit report
   */
  router.post('/export/:dealId', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const {
        exportType = 'json',
        assumptionIds,
        includeBaseline = true,
        includeCalculations = true,
        confidenceThreshold,
        title,
        description,
      } = req.body;

      // Validate export type
      if (!['pdf', 'excel', 'json'].includes(exportType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid export type. Must be pdf, excel, or json',
        });
      }

      const exportId = await auditService.exportAuditReport({
        dealId,
        exportType,
        assumptionIds,
        includeBaseline,
        includeCalculations,
        confidenceThreshold,
        title,
        description,
        generatedBy: (req as any).user?.id, // Assuming auth middleware adds user
      });

      res.json({
        success: true,
        data: {
          exportId,
          message: `${exportType.toUpperCase()} export generated successfully`,
        },
      });
    } catch (error) {
      console.error('Error generating audit export:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate audit export',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/audit/chain-link
   * Create a new audit chain link
   */
  router.post('/chain-link', async (req: Request, res: Response) => {
    try {
      const {
        dealId,
        assumptionId,
        chainType,
        sourceEntityType,
        sourceEntityId,
        targetEntityType,
        targetEntityId,
        linkConfidence,
        confidenceFactors,
      } = req.body;

      // Validate required fields
      if (!dealId || !assumptionId || !chainType || !sourceEntityType || 
          !sourceEntityId || !targetEntityType || !targetEntityId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      const chainLinkId = await auditService.createAuditChainLink(
        dealId,
        assumptionId,
        chainType,
        sourceEntityType,
        sourceEntityId,
        targetEntityType,
        targetEntityId,
        linkConfidence || 1.0,
        confidenceFactors,
        (req as any).user?.id
      );

      res.status(201).json({
        success: true,
        data: {
          chainLinkId,
          message: 'Audit chain link created successfully',
        },
      });
    } catch (error) {
      console.error('Error creating audit chain link:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create audit chain link',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/audit/assumption-evidence
   * Create assumption evidence record
   */
  router.post('/assumption-evidence', async (req: Request, res: Response) => {
    try {
      const evidence = req.body;

      // Validate required fields
      if (!evidence.dealId || !evidence.assumptionId || !evidence.assumptionName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      const evidenceId = await auditService.createAssumptionEvidence(evidence);

      res.status(201).json({
        success: true,
        data: {
          evidenceId,
          message: 'Assumption evidence created successfully',
        },
      });
    } catch (error) {
      console.error('Error creating assumption evidence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create assumption evidence',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/audit/calculation-log
   * Log a calculation step
   */
  router.post('/calculation-log', async (req: Request, res: Response) => {
    try {
      const log = req.body;

      // Validate required fields
      if (!log.dealId || !log.calculationType || !log.inputParameters) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      const logId = await auditService.logCalculation(log);

      res.status(201).json({
        success: true,
        data: {
          logId,
          message: 'Calculation logged successfully',
        },
      });
    } catch (error) {
      console.error('Error logging calculation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to log calculation',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/audit/corroboration
   * Record event corroboration
   */
  router.post('/corroboration', async (req: Request, res: Response) => {
    try {
      const {
        primaryEventId,
        corroboratingEventId,
        corroborationType,
        corroborationStrength = 1.0,
        details,
      } = req.body;

      // Validate required fields
      if (!primaryEventId || !corroboratingEventId || !corroborationType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      // Validate corroboration type
      if (!['confirms', 'updates', 'contradicts'].includes(corroborationType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid corroboration type',
        });
      }

      await auditService.recordCorroboration(
        primaryEventId,
        corroboratingEventId,
        corroborationType,
        corroborationStrength,
        details
      );

      res.json({
        success: true,
        message: 'Event corroboration recorded successfully',
      });
    } catch (error) {
      console.error('Error recording corroboration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record corroboration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PUT /api/v1/audit/source-credibility/:sourceName
   * Update source credibility based on accuracy
   */
  router.put('/source-credibility/:sourceName', async (req: Request, res: Response) => {
    try {
      const { sourceName } = req.params;
      const { confirmed } = req.body;

      if (typeof confirmed !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'confirmed field must be boolean',
        });
      }

      await auditService.updateSourceCredibility(
        decodeURIComponent(sourceName),
        confirmed
      );

      res.json({
        success: true,
        message: 'Source credibility updated successfully',
      });
    } catch (error) {
      console.error('Error updating source credibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update source credibility',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/audit/export-status/:exportId
   * Get export snapshot status
   */
  router.get('/export-status/:exportId', async (req: Request, res: Response) => {
    try {
      const { exportId } = req.params;

      const result = await pool.query(
        `SELECT * FROM export_snapshots WHERE id = $1`,
        [exportId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Export not found',
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error fetching export status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

export default router;
