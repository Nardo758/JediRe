/**
 * Reporting Package Upload Routes
 * 
 * Handles bulk upload of monthly property management reporting packages.
 * Accepts multiple files (Excel, PDF) and processes them through the extraction pipeline.
 */

import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { processDocument } from '../../services/document-extraction/extraction-pipeline';
import { parseBPIFinancial } from '../../services/document-extraction/parsers/bpi-financial-parser';
import { parseBPIVariance } from '../../services/document-extraction/parsers/bpi-variance-parser';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'reporting-packages');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.pdf', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

interface ProcessingResult {
  filename: string;
  documentType: string;
  success: boolean;
  error?: string;
  rowsInserted?: number;
  warnings: string[];
  extractedData?: any;
}

// Classify file by name pattern
function classifyByFilename(filename: string): string {
  const lower = filename.toLowerCase();
  
  if (/bpi.*financial.*package/i.test(lower)) return 'BPI_FINANCIAL';
  if (/bpi.*variance/i.test(lower)) return 'BPI_VARIANCE';
  if (/bpi.*balance.*sheet/i.test(lower)) return 'BALANCE_SHEET';
  if (/cash.*flow/i.test(lower)) return 'CASH_FLOW';
  if (/general.*ledger/i.test(lower)) return 'GENERAL_LEDGER';
  if (/trial.*balance/i.test(lower)) return 'TRIAL_BALANCE';
  if (/rent.*roll/i.test(lower)) return 'RENT_ROLL';
  if (/aged.*receivable/i.test(lower)) return 'AGED_RECEIVABLES';
  if (/box.*score/i.test(lower)) return 'BOX_SCORE';
  if (/unit.*stat/i.test(lower)) return 'UNIT_STATISTICS';
  if (/bank.*rec/i.test(lower)) return 'BANK_RECONCILIATION';
  if (/bank.*stmt/i.test(lower)) return 'BANK_STATEMENT';
  if (/mtg.*stmt|mortgage.*stmt/i.test(lower)) return 'MORTGAGE_STATEMENT';
  if (/payable.*aging/i.test(lower)) return 'PAYABLES_AGING';
  if (/pricing.*review|lease.*history/i.test(lower)) return 'LEASE_HISTORY';
  if (/deposit.*summary/i.test(lower)) return 'DEPOSIT_SUMMARY';
  if (/transaction.*summary/i.test(lower)) return 'TRANSACTION_SUMMARY';
  if (/resident.*balance/i.test(lower)) return 'RESIDENT_BALANCES';
  if (/t12|trailing.*twelve/i.test(lower)) return 'T12';
  
  return 'UNKNOWN';
}

/**
 * POST /api/v1/reporting-package/upload
 * Upload a monthly reporting package (multiple files)
 */
router.post('/upload', requireAuth, upload.array('files', 30), async (req: AuthenticatedRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const { dealId, reportMonth } = req.body;
  
  if (!dealId) {
    return res.status(400).json({ success: false, error: 'dealId is required' });
  }
  
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded' });
  }
  
  const results: ProcessingResult[] = [];
  const extractedMonthlyData: any = {};
  
  try {
    // Verify deal ownership
    const dealCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    
    // Process each file
    for (const file of files) {
      const docType = classifyByFilename(file.originalname);
      let result: ProcessingResult = {
        filename: file.originalname,
        documentType: docType,
        success: false,
        warnings: [],
      };
      
      try {
        const buffer = fs.readFileSync(file.path);
        
        // Use specialized parsers for BPI files
        if (docType === 'BPI_FINANCIAL') {
          const parsed = parseBPIFinancial(buffer, file.originalname);
          result.success = parsed.success;
          result.warnings = parsed.warnings || [];
          result.error = parsed.error;
          if (parsed.success && parsed.data) {
            result.extractedData = parsed.data;
            Object.assign(extractedMonthlyData, parsed.data);
          }
        } else if (docType === 'BPI_VARIANCE') {
          const parsed = parseBPIVariance(buffer, file.originalname);
          result.success = parsed.success;
          result.warnings = parsed.warnings || [];
          result.error = parsed.error;
          if (parsed.success && parsed.data) {
            result.extractedData = { varianceLineItems: parsed.data.lineItems?.length || 0 };
            extractedMonthlyData.variance = parsed.data;
          }
        } else if (docType !== 'UNKNOWN') {
          // Use existing extraction pipeline for known types
          const pipelineResult = await processDocument(
            file.path,
            file.originalname,
            dealId,
            req.user!.userId
          );
          result.documentType = pipelineResult.documentType;
          result.success = pipelineResult.success;
          result.error = pipelineResult.error;
          result.rowsInserted = pipelineResult.rowsInserted;
          result.warnings = pipelineResult.alerts || [];
        } else {
          result.warnings.push('Unknown document type - stored but not parsed');
          result.success = true; // Still store the file
        }
        
        // Store document reference
        await query(`
          INSERT INTO documents (deal_id, filename, file_path, file_type, document_type, uploaded_by, processed, processed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (deal_id, filename) DO UPDATE SET
            file_path = EXCLUDED.file_path,
            processed = EXCLUDED.processed,
            processed_at = NOW()
        `, [
          dealId,
          file.originalname,
          file.path,
          path.extname(file.originalname).slice(1),
          docType,
          req.user!.userId,
          result.success,
        ]);
        
      } catch (err: any) {
        result.error = err.message;
        result.warnings.push(`Processing error: ${err.message}`);
        logger.error('File processing error', { filename: file.originalname, error: err.message });
      }
      
      results.push(result);
    }
    
    // If we extracted financial data, upsert to monthly_actuals
    if (extractedMonthlyData.noi || extractedMonthlyData.grossPotentialRent) {
      const month = extractedMonthlyData.reportMonth || reportMonth || new Date().toISOString().slice(0, 7) + '-01';
      
      await query(`
        INSERT INTO deal_monthly_actuals (
          deal_id, report_month, 
          gross_potential_rent, loss_to_lease, vacancy_loss, concessions, bad_debt, other_income, effective_gross_income,
          payroll, repairs_maintenance, turnover_costs, contract_services, utilities, marketing, admin_general,
          management_fee, property_tax, insurance, total_opex,
          noi, debt_service, capex, cash_flow_before_tax,
          total_units, occupied_units, occupancy_rate, avg_effective_rent, avg_market_rent,
          source, updated_at
        ) VALUES (
          $1, $2,
          $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27, $28, $29,
          'reporting_package', NOW()
        )
        ON CONFLICT (deal_id, report_month) DO UPDATE SET
          gross_potential_rent = COALESCE(EXCLUDED.gross_potential_rent, deal_monthly_actuals.gross_potential_rent),
          loss_to_lease = COALESCE(EXCLUDED.loss_to_lease, deal_monthly_actuals.loss_to_lease),
          vacancy_loss = COALESCE(EXCLUDED.vacancy_loss, deal_monthly_actuals.vacancy_loss),
          concessions = COALESCE(EXCLUDED.concessions, deal_monthly_actuals.concessions),
          bad_debt = COALESCE(EXCLUDED.bad_debt, deal_monthly_actuals.bad_debt),
          other_income = COALESCE(EXCLUDED.other_income, deal_monthly_actuals.other_income),
          effective_gross_income = COALESCE(EXCLUDED.effective_gross_income, deal_monthly_actuals.effective_gross_income),
          payroll = COALESCE(EXCLUDED.payroll, deal_monthly_actuals.payroll),
          repairs_maintenance = COALESCE(EXCLUDED.repairs_maintenance, deal_monthly_actuals.repairs_maintenance),
          turnover_costs = COALESCE(EXCLUDED.turnover_costs, deal_monthly_actuals.turnover_costs),
          contract_services = COALESCE(EXCLUDED.contract_services, deal_monthly_actuals.contract_services),
          utilities = COALESCE(EXCLUDED.utilities, deal_monthly_actuals.utilities),
          marketing = COALESCE(EXCLUDED.marketing, deal_monthly_actuals.marketing),
          admin_general = COALESCE(EXCLUDED.admin_general, deal_monthly_actuals.admin_general),
          management_fee = COALESCE(EXCLUDED.management_fee, deal_monthly_actuals.management_fee),
          property_tax = COALESCE(EXCLUDED.property_tax, deal_monthly_actuals.property_tax),
          insurance = COALESCE(EXCLUDED.insurance, deal_monthly_actuals.insurance),
          total_opex = COALESCE(EXCLUDED.total_opex, deal_monthly_actuals.total_opex),
          noi = COALESCE(EXCLUDED.noi, deal_monthly_actuals.noi),
          debt_service = COALESCE(EXCLUDED.debt_service, deal_monthly_actuals.debt_service),
          capex = COALESCE(EXCLUDED.capex, deal_monthly_actuals.capex),
          cash_flow_before_tax = COALESCE(EXCLUDED.cash_flow_before_tax, deal_monthly_actuals.cash_flow_before_tax),
          total_units = COALESCE(EXCLUDED.total_units, deal_monthly_actuals.total_units),
          occupied_units = COALESCE(EXCLUDED.occupied_units, deal_monthly_actuals.occupied_units),
          occupancy_rate = COALESCE(EXCLUDED.occupancy_rate, deal_monthly_actuals.occupancy_rate),
          avg_effective_rent = COALESCE(EXCLUDED.avg_effective_rent, deal_monthly_actuals.avg_effective_rent),
          avg_market_rent = COALESCE(EXCLUDED.avg_market_rent, deal_monthly_actuals.avg_market_rent),
          source = 'reporting_package',
          updated_at = NOW()
      `, [
        dealId, month,
        extractedMonthlyData.grossPotentialRent, extractedMonthlyData.lossToLease, extractedMonthlyData.vacancyLoss,
        extractedMonthlyData.concessions, extractedMonthlyData.badDebt, extractedMonthlyData.otherIncome,
        extractedMonthlyData.effectiveGrossIncome,
        extractedMonthlyData.payroll, extractedMonthlyData.repairsMaintenance, extractedMonthlyData.turnoverCosts,
        extractedMonthlyData.contractServices, extractedMonthlyData.utilities, extractedMonthlyData.marketing,
        extractedMonthlyData.adminGeneral,
        extractedMonthlyData.managementFee, extractedMonthlyData.propertyTax, extractedMonthlyData.insurance,
        extractedMonthlyData.totalOpex,
        extractedMonthlyData.noi, extractedMonthlyData.debtService, extractedMonthlyData.capex,
        extractedMonthlyData.cashFlowBeforeTax,
        extractedMonthlyData.totalUnits, extractedMonthlyData.occupiedUnits, extractedMonthlyData.occupancyRate,
        extractedMonthlyData.avgEffectiveRent, extractedMonthlyData.avgMarketRent,
      ]);
    }
    
    // Store variance data if extracted
    if (extractedMonthlyData.variance?.lineItems?.length > 0) {
      const varData = extractedMonthlyData.variance;
      const month = varData.reportMonth || reportMonth || new Date().toISOString().slice(0, 7) + '-01';
      
      // Clear existing variance for this month
      await query('DELETE FROM deal_variance_items WHERE deal_id = $1 AND report_month = $2', [dealId, month]);
      
      // Insert new variance items
      for (const item of varData.lineItems) {
        await query(`
          INSERT INTO deal_variance_items (
            deal_id, report_month, line_item, category,
            actual, budget, variance, variance_pct, variance_type,
            ytd_actual, ytd_budget, ytd_variance, ytd_variance_pct
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          dealId, month, item.lineItem, item.category,
          item.actual, item.budget, item.variance, item.variancePct, item.varianceType,
          item.ytdActual, item.ytdBudget, item.ytdVariance, item.ytdVariancePct,
        ]);
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      summary: {
        total: files.length,
        successful,
        failed,
        extractedMonth: extractedMonthlyData.reportMonth || reportMonth,
      },
      results,
    });
    
  } catch (err: any) {
    logger.error('Reporting package upload error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/reporting-package/history
 * Get upload history for a deal
 */
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId, limit = 12 } = req.query;
  
  if (!dealId) {
    return res.status(400).json({ success: false, error: 'dealId is required' });
  }
  
  try {
    const result = await query(`
      SELECT 
        report_month,
        COUNT(*) as document_count,
        array_agg(DISTINCT document_type) as document_types,
        MAX(processed_at) as last_processed
      FROM documents
      WHERE deal_id = $1 AND document_type IS NOT NULL
      GROUP BY report_month
      ORDER BY report_month DESC
      LIMIT $2
    `, [dealId, parseInt(limit as string)]);
    
    res.json({ success: true, packages: result.rows });
  } catch (err: any) {
    logger.error('Reporting package history error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/reporting-package/variance
 * Get variance data for a deal
 */
router.get('/variance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId, reportMonth } = req.query;
  
  if (!dealId) {
    return res.status(400).json({ success: false, error: 'dealId is required' });
  }
  
  try {
    let sql = `
      SELECT * FROM deal_variance_items
      WHERE deal_id = $1
    `;
    const params: any[] = [dealId];
    
    if (reportMonth) {
      sql += ' AND report_month = $2';
      params.push(reportMonth);
    }
    
    sql += ' ORDER BY report_month DESC, category, line_item';
    
    const result = await query(sql, params);
    
    // Group by month
    const byMonth: Record<string, any[]> = {};
    for (const row of result.rows) {
      const month = row.report_month;
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(row);
    }
    
    res.json({ success: true, variance: byMonth });
  } catch (err: any) {
    logger.error('Variance fetch error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
