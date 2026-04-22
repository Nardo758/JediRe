/**
 * Skill Definitions
 * 
 * All available skills for the AI assistant to use.
 * Skills are organized by category and registered with the skill registry.
 */

import { z } from 'zod';
import { skillRegistry, SkillDefinition, SkillContext, SkillResult } from '../skill-registry';
import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

// ============================================================================
// DATA SKILLS - Fetch and query deal data
// ============================================================================

const queryDealData: SkillDefinition = {
  id: 'query_deal_data',
  name: 'Query Deal Data',
  description: 'Fetch financials, assumptions, comps, occupancy, rent roll, or other data for the current deal. Use this to get context before answering questions about the property.',
  category: 'data',
  parameters: z.object({
    dataType: z.enum([
      'summary', 'financials', 'assumptions', 'rent_roll', 'comps', 
      'occupancy', 'debt', 'investors', 'events', 'documents'
    ]).describe('Type of data to fetch'),
    months: z.number().optional().describe('For financials, number of months to fetch (default 12)'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    const { dataType, months = 12 } = params;

    try {
      let data: any;

      switch (dataType) {
        case 'summary':
          const summaryRes = await query(
            `SELECT d.*, p.name as property_name, p.address, p.city, p.state, p.units
             FROM deals d
             LEFT JOIN properties p ON d.property_id = p.id
             WHERE d.id = $1`,
            [dealId]
          );
          data = summaryRes.rows[0];
          break;

        case 'financials':
          const finRes = await query(
            `SELECT * FROM deal_monthly_actuals 
             WHERE deal_id = $1 AND is_budget = false AND is_proforma = false
             ORDER BY report_month DESC LIMIT $2`,
            [dealId, months]
          );
          data = finRes.rows;
          break;

        case 'assumptions':
          const assumRes = await query(
            `SELECT * FROM deal_assumptions WHERE deal_id = $1`,
            [dealId]
          );
          data = assumRes.rows[0];
          break;

        case 'rent_roll':
          const rrRes = await query(
            `SELECT * FROM rent_roll_units 
             WHERE deal_id = $1 
             ORDER BY as_of_date DESC, unit_number
             LIMIT 500`,
            [dealId]
          );
          data = rrRes.rows;
          break;

        case 'comps':
          const compsRes = await query(
            `SELECT * FROM deal_comp_sets WHERE deal_id = $1`,
            [dealId]
          );
          data = compsRes.rows;
          break;

        case 'occupancy':
          const occRes = await query(
            `SELECT report_month, occupancy_rate, occupied_units, total_units
             FROM deal_monthly_actuals 
             WHERE deal_id = $1 AND is_budget = false
             ORDER BY report_month DESC LIMIT $2`,
            [dealId, months]
          );
          data = occRes.rows;
          break;

        case 'debt':
          const debtRes = await query(
            `SELECT * FROM debt_positions WHERE deal_id = $1 ORDER BY created_at DESC`,
            [dealId]
          );
          data = debtRes.rows;
          break;

        case 'investors':
          const invRes = await query(
            `SELECT * FROM investor_commitments WHERE deal_id = $1`,
            [dealId]
          );
          data = invRes.rows;
          break;

        case 'events':
          const eventsRes = await query(
            `SELECT * FROM deal_events WHERE deal_id = $1 ORDER BY event_date DESC LIMIT 50`,
            [dealId]
          );
          data = eventsRes.rows;
          break;

        case 'documents':
          const docsRes = await query(
            `SELECT id, original_filename, category, file_size, created_at 
             FROM deal_files WHERE deal_id = $1 AND deleted_at IS NULL
             ORDER BY created_at DESC LIMIT 50`,
            [dealId]
          );
          data = docsRes.rows;
          break;

        default:
          return { success: false, error: `Unknown data type: ${dataType}` };
      }

      return { success: true, data, displayType: 'json' };
    } catch (error: any) {
      logger.error('query_deal_data error:', error);
      return { success: false, error: error.message };
    }
  },
};

const searchMarketData: SkillDefinition = {
  id: 'search_market_data',
  name: 'Search Market Data',
  description: 'Look up MSA-level metrics, rent comps, supply pipeline, employment data, or market trends for a location.',
  category: 'data',
  parameters: z.object({
    location: z.string().describe('City, MSA, or state to search'),
    dataType: z.enum(['rent_comps', 'supply_pipeline', 'employment', 'population', 'market_trends']),
    propertyType: z.enum(['multifamily', 'office', 'retail', 'industrial']).optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { location, dataType, propertyType = 'multifamily' } = params;

    try {
      // Search MSA data
      const msaRes = await query(
        `SELECT * FROM msas WHERE name ILIKE $1 OR cbsa_code = $1 LIMIT 1`,
        [`%${location}%`]
      );

      if (msaRes.rows.length === 0) {
        return { success: true, data: { message: `No MSA data found for ${location}` } };
      }

      const msa = msaRes.rows[0];
      let data: any = { msa };

      // Get relevant data based on type
      if (dataType === 'supply_pipeline') {
        const supplyRes = await query(
          `SELECT * FROM supply_pipeline WHERE msa_id = $1 ORDER BY delivery_date`,
          [msa.id]
        );
        data.supply = supplyRes.rows;
      }

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// DOCUMENT SKILLS - Extract and process documents
// ============================================================================

const extractDocument: SkillDefinition = {
  id: 'extract_document',
  name: 'Extract Document',
  description: 'Read an uploaded file and extract structured data (T-12 income, rent roll, OM details, etc.). Returns the extracted fields.',
  category: 'document',
  parameters: z.object({
    fileId: z.string().describe('ID of the uploaded file to extract'),
    extractionType: z.enum(['t12', 'rent_roll', 'om', 'appraisal', 'auto']).optional()
      .describe('Type of extraction to perform. Use "auto" to detect automatically.'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { fileId, extractionType = 'auto' } = params;
    const { dealId } = context;

    try {
      // Get file info
      const fileRes = await query(
        `SELECT * FROM deal_files WHERE id = $1 AND deal_id = $2`,
        [fileId, dealId]
      );

      if (fileRes.rows.length === 0) {
        return { success: false, error: 'File not found' };
      }

      const file = fileRes.rows[0];

      // TODO: Call extraction pipeline
      // For now, return placeholder
      return {
        success: true,
        data: {
          fileId,
          filename: file.original_filename,
          status: 'queued',
          message: `Extraction queued for ${file.original_filename}. Type: ${extractionType}`,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// ACTION SKILLS - Modify deal data
// ============================================================================

const updateAssumption: SkillDefinition = {
  id: 'update_assumption',
  name: 'Update Assumption',
  description: 'Change an underwriting input like cap rate, exit year, rent growth, or OpEx ratio. Always confirm with the user before executing.',
  category: 'action',
  parameters: z.object({
    field: z.enum([
      'cap_rate', 'exit_cap_rate', 'exit_year', 'rent_growth', 
      'expense_growth', 'vacancy_rate', 'management_fee_pct'
    ]).describe('The assumption field to update'),
    value: z.number().describe('New value for the field'),
    confirmed: z.boolean().describe('Whether the user has confirmed this change'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { field, value, confirmed } = params;
    const { dealId, userId } = context;

    if (!confirmed) {
      return {
        success: true,
        data: {
          requiresConfirmation: true,
          message: `Please confirm: Update ${field} to ${value}?`,
          field,
          value,
        },
        displayType: 'confirmation',
      };
    }

    try {
      await query(
        `UPDATE deal_assumptions SET ${field} = $1, updated_at = NOW(), updated_by = $2 WHERE deal_id = $3`,
        [value, userId, dealId]
      );

      return {
        success: true,
        data: { message: `Updated ${field} to ${value}` },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const addNote: SkillDefinition = {
  id: 'add_note',
  name: 'Add Note',
  description: 'Add an analyst note or comment to the deal timeline.',
  category: 'action',
  parameters: z.object({
    content: z.string().describe('The note content'),
    category: z.enum(['general', 'risk', 'opportunity', 'action_item', 'decision']).optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { content, category = 'general' } = params;
    const { dealId, userId } = context;

    try {
      await query(
        `INSERT INTO deal_events (deal_id, event_type, title, description, event_date, created_by)
         VALUES ($1, 'note', $2, $3, NOW(), $4)`,
        [dealId, `${category.toUpperCase()} NOTE`, content, userId]
      );

      return {
        success: true,
        data: { message: 'Note added to deal timeline' },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// ANALYSIS SKILLS - Run calculations and analysis
// ============================================================================

const runAnalysis: SkillDefinition = {
  id: 'run_analysis',
  name: 'Run Analysis',
  description: 'Run a specific analysis on the deal: IRR sensitivity, refi scenarios, hold period optimization, or comparable sale analysis.',
  category: 'analysis',
  parameters: z.object({
    analysisType: z.enum(['irr_sensitivity', 'refi_scenario', 'hold_optimization', 'comp_analysis']),
    parameters: z.record(z.any()).optional().describe('Analysis-specific parameters'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { analysisType, parameters = {} } = params;
    const { dealId } = context;

    try {
      // TODO: Implement actual analysis logic
      return {
        success: true,
        data: {
          analysisType,
          dealId,
          status: 'completed',
          results: { message: `${analysisType} analysis completed` },
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// REPORT SKILLS - Generate reports and summaries
// ============================================================================

const generateReport: SkillDefinition = {
  id: 'generate_report',
  name: 'Generate Report',
  description: 'Generate a formatted report or summary: investment memo, quarterly update, NOI waterfall, or custom analysis.',
  category: 'report',
  parameters: z.object({
    reportType: z.enum(['investment_memo', 'quarterly_update', 'noi_waterfall', 'rent_roll_summary', 'custom']),
    format: z.enum(['markdown', 'json']).optional(),
    customPrompt: z.string().optional().describe('For custom reports, the specific request'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { reportType, format = 'markdown', customPrompt } = params;
    const { dealId } = context;

    try {
      // Fetch deal data for report
      const dealRes = await query(
        `SELECT d.*, p.name as property_name, p.address, p.city, p.state, p.units
         FROM deals d
         LEFT JOIN properties p ON d.property_id = p.id
         WHERE d.id = $1`,
        [dealId]
      );

      if (dealRes.rows.length === 0) {
        return { success: false, error: 'Deal not found' };
      }

      const deal = dealRes.rows[0];

      // Generate report based on type
      let report: string;

      switch (reportType) {
        case 'investment_memo':
          report = `# Investment Memo: ${deal.property_name || deal.project_name}\n\n` +
            `**Location:** ${deal.city}, ${deal.state}\n` +
            `**Units:** ${deal.units || 'N/A'}\n` +
            `**Status:** ${deal.status}\n\n` +
            `## Executive Summary\n\n[Analysis pending - more data needed]\n`;
          break;

        case 'noi_waterfall':
          report = `# NOI Waterfall: ${deal.property_name || deal.project_name}\n\n` +
            `[Fetching financial data...]\n`;
          break;

        default:
          report = `# ${reportType.replace('_', ' ').toUpperCase()}\n\n` +
            `Report for ${deal.property_name || deal.project_name}\n`;
      }

      return {
        success: true,
        data: { report, reportType },
        displayType: 'markdown',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// REGISTER ALL SKILLS
// ============================================================================

export function registerAllSkills(): void {
  // Data skills
  skillRegistry.register(queryDealData);
  skillRegistry.register(searchMarketData);

  // Document skills
  skillRegistry.register(extractDocument);

  // Action skills
  skillRegistry.register(updateAssumption);
  skillRegistry.register(addNote);

  // Analysis skills
  skillRegistry.register(runAnalysis);

  // Report skills
  skillRegistry.register(generateReport);

  logger.info(`Registered ${skillRegistry.getAll().length} skills`);
}

// Auto-register on import
registerAllSkills();
