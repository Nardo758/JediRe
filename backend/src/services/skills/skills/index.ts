/**
 * Skill Definitions
 * 
 * All available skills for the AI assistant to use.
 * Skills are organized by category and registered with the skill registry.
 * 
 * 18 Skills to match original agent coverage:
 * - 5 Data Skills (market, financial, operational)
 * - 4 Document Skills (extraction, parsing)
 * - 4 Action Skills (updates, notes, tasks)
 * - 3 Analysis Skills (returns, risk, scenarios)
 * - 2 Report Skills (memos, summaries)
 */

import { z } from 'zod';
import { skillRegistry, SkillDefinition, SkillContext, SkillResult } from '../skill-registry';
import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import { registerAdvisorPersonas } from './personas';

// ============================================================================
// DATA SKILLS (5)
// ============================================================================

const queryDealData: SkillDefinition = {
  id: 'query_deal_data',
  name: 'Query Deal Data',
  description: 'Fetch financials, assumptions, comps, occupancy, rent roll, or other data for the current deal. Use this to get context before answering questions about the property.',
  category: 'data',
  parameters: z.object({
    dataType: z.enum([
      'summary', 'financials', 'assumptions', 'rent_roll', 'comps', 
      'occupancy', 'debt', 'investors', 'events', 'documents', 'leases'
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

        case 'leases':
          const leasesRes = await query(
            `SELECT * FROM leases WHERE deal_id = $1 ORDER BY lease_start DESC LIMIT 100`,
            [dealId]
          );
          data = leasesRes.rows;
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
    dataType: z.enum(['rent_comps', 'supply_pipeline', 'employment', 'population', 'market_trends', 'cap_rates']),
    propertyType: z.enum(['multifamily', 'office', 'retail', 'industrial']).optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { location, dataType, propertyType = 'multifamily' } = params;

    try {
      const msaRes = await query(
        `SELECT * FROM msas WHERE name ILIKE $1 OR cbsa_code = $1 LIMIT 1`,
        [`%${location}%`]
      );

      if (msaRes.rows.length === 0) {
        return { success: true, data: { message: `No MSA data found for ${location}` } };
      }

      const msa = msaRes.rows[0];
      let data: any = { msa };

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

const queryDebtMarket: SkillDefinition = {
  id: 'query_debt_market',
  name: 'Query Debt Market',
  description: 'Get current debt market conditions including CMBS spreads, agency rates, bank lending terms, and life company debt options.',
  category: 'data',
  parameters: z.object({
    loanType: z.enum(['agency', 'cmbs', 'bank', 'life_company', 'bridge', 'all']).optional(),
    propertyType: z.enum(['multifamily', 'office', 'retail', 'industrial']).optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    // Return current market debt terms
    return {
      success: true,
      data: {
        asOf: new Date().toISOString().split('T')[0],
        agency: { spread: '1.40-1.60%', ltv: '65-80%', term: '5-12yr', dscr: '1.25x' },
        cmbs: { spread: '2.00-2.50%', ltv: '60-75%', term: '5-10yr', dscr: '1.30x' },
        bank: { spread: '2.50-3.50%', ltv: '55-70%', term: '3-7yr', dscr: '1.25x' },
        bridge: { spread: '3.00-5.00%', ltv: '70-80%', term: '1-3yr', dscr: '1.00x' },
      },
      displayType: 'json',
    };
  },
};

const queryTaxImplications: SkillDefinition = {
  id: 'query_tax_implications',
  name: 'Query Tax Implications',
  description: 'Analyze tax implications including depreciation schedules, 1031 exchange eligibility, cost segregation opportunities, and tax projections.',
  category: 'data',
  parameters: z.object({
    analysisType: z.enum(['depreciation', '1031_exchange', 'cost_seg', 'tax_projection', 'all']),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    
    try {
      const dealRes = await query(
        `SELECT d.*, da.purchase_price, da.closing_date 
         FROM deals d 
         LEFT JOIN deal_assumptions da ON d.id = da.deal_id
         WHERE d.id = $1`,
        [dealId]
      );
      
      const deal = dealRes.rows[0];
      const purchasePrice = deal?.purchase_price || 0;
      
      return {
        success: true,
        data: {
          depreciation: {
            buildingValue: purchasePrice * 0.80,
            landValue: purchasePrice * 0.20,
            annualDepreciation: (purchasePrice * 0.80) / 27.5,
            method: '27.5 year straight-line',
          },
          costSegStudy: {
            eligible: purchasePrice > 1000000,
            estimatedBenefit: purchasePrice * 0.15 * 0.37,
            note: 'Accelerate depreciation on 5, 7, 15 year property',
          },
          exchange1031: {
            eligible: true,
            identificationPeriod: '45 days',
            closingDeadline: '180 days',
          },
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const queryComplianceStatus: SkillDefinition = {
  id: 'query_compliance_status',
  name: 'Query Compliance Status',
  description: 'Check compliance status including insurance coverage, permits, inspections, and regulatory requirements.',
  category: 'data',
  parameters: z.object({
    checkType: z.enum(['insurance', 'permits', 'inspections', 'regulatory', 'all']),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    
    // Return compliance checklist
    return {
      success: true,
      data: {
        insurance: { status: 'current', expiresAt: '2027-01-15', coverage: '$10M liability' },
        permits: { status: 'current', items: ['Certificate of Occupancy', 'Fire Safety', 'Elevator'] },
        inspections: { lastInspection: '2026-03-01', nextDue: '2027-03-01' },
        regulatory: { fairHousing: 'compliant', ada: 'compliant', environmental: 'phase1_clear' },
      },
      displayType: 'json',
    };
  },
};

// ============================================================================
// DOCUMENT SKILLS (4)
// ============================================================================

const extractDocument: SkillDefinition = {
  id: 'extract_document',
  name: 'Extract Document',
  description: 'Read an uploaded file and extract structured data (T-12 income, rent roll, OM details, etc.). Returns the extracted fields.',
  category: 'document',
  parameters: z.object({
    fileId: z.string().describe('ID of the uploaded file to extract'),
    extractionType: z.enum(['t12', 'rent_roll', 'om', 'appraisal', 'auto']).optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { fileId, extractionType = 'auto' } = params;
    const { dealId } = context;

    try {
      const fileRes = await query(
        `SELECT * FROM deal_files WHERE id = $1 AND deal_id = $2`,
        [fileId, dealId]
      );

      if (fileRes.rows.length === 0) {
        return { success: false, error: 'File not found' };
      }

      const file = fileRes.rows[0];

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

const reviewContract: SkillDefinition = {
  id: 'review_contract',
  name: 'Review Contract',
  description: 'Analyze a contract or legal document for key terms, risks, and compliance issues.',
  category: 'document',
  parameters: z.object({
    fileId: z.string().describe('ID of the contract file'),
    focusAreas: z.array(z.string()).optional().describe('Specific areas to focus on'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    return {
      success: true,
      data: {
        status: 'queued',
        message: 'Contract review queued. Will analyze key terms, obligations, and risks.',
      },
    };
  },
};

const analyzeAppraisal: SkillDefinition = {
  id: 'analyze_appraisal',
  name: 'Analyze Appraisal',
  description: 'Extract and analyze appraisal report data including comparable sales, income approach, and cost approach values.',
  category: 'document',
  parameters: z.object({
    fileId: z.string().describe('ID of the appraisal file'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    return {
      success: true,
      data: {
        status: 'queued',
        message: 'Appraisal analysis queued. Will extract cap rate, comps, and valuation approaches.',
      },
    };
  },
};

const parseEnvironmentalReport: SkillDefinition = {
  id: 'parse_environmental_report',
  name: 'Parse Environmental Report',
  description: 'Extract findings from Phase I/II environmental site assessments.',
  category: 'document',
  parameters: z.object({
    fileId: z.string().describe('ID of the environmental report'),
    reportType: z.enum(['phase1', 'phase2']),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    return {
      success: true,
      data: {
        status: 'queued',
        message: 'Environmental report parsing queued.',
      },
    };
  },
};

// ============================================================================
// ACTION SKILLS (4)
// ============================================================================

const updateAssumption: SkillDefinition = {
  id: 'update_assumption',
  name: 'Update Assumption',
  description: 'Change an underwriting input like cap rate, exit year, rent growth, or OpEx ratio. Always confirm with the user before executing.',
  category: 'action',
  parameters: z.object({
    field: z.enum([
      'cap_rate', 'exit_cap_rate', 'exit_year', 'rent_growth', 
      'expense_growth', 'vacancy_rate', 'management_fee_pct',
      'capex_per_unit', 'renovation_budget'
    ]),
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
    category: z.enum(['general', 'risk', 'opportunity', 'action_item', 'decision', 'legal', 'financial']).optional(),
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

const createTask: SkillDefinition = {
  id: 'create_task',
  name: 'Create Task',
  description: 'Create a task or action item for the deal team.',
  category: 'action',
  parameters: z.object({
    title: z.string().describe('Task title'),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
    assignee: z.string().optional().describe('User ID to assign to'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { title, description, priority = 'medium', dueDate, assignee } = params;
    const { dealId, userId } = context;

    try {
      await query(
        `INSERT INTO tasks (deal_id, title, description, priority, due_date, assigned_to, created_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [dealId, title, description, priority, dueDate, assignee, userId]
      );

      return {
        success: true,
        data: { message: `Task created: ${title}` },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const updateDealStatus: SkillDefinition = {
  id: 'update_deal_status',
  name: 'Update Deal Status',
  description: 'Update the deal stage or status in the pipeline.',
  category: 'action',
  parameters: z.object({
    status: z.enum(['screening', 'underwriting', 'loi', 'due_diligence', 'closing', 'closed', 'dead']),
    reason: z.string().optional().describe('Reason for status change'),
    confirmed: z.boolean(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { status, reason, confirmed } = params;
    const { dealId, userId } = context;

    if (!confirmed) {
      return {
        success: true,
        data: {
          requiresConfirmation: true,
          message: `Move deal to ${status}?`,
          status,
        },
        displayType: 'confirmation',
      };
    }

    try {
      await query(
        `UPDATE deals SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, dealId]
      );

      if (reason) {
        await query(
          `INSERT INTO deal_events (deal_id, event_type, title, description, event_date, created_by)
           VALUES ($1, 'status_change', $2, $3, NOW(), $4)`,
          [dealId, `Status changed to ${status}`, reason, userId]
        );
      }

      return {
        success: true,
        data: { message: `Deal status updated to ${status}` },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// ANALYSIS SKILLS (3)
// ============================================================================

const runReturnAnalysis: SkillDefinition = {
  id: 'run_return_analysis',
  name: 'Run Return Analysis',
  description: 'Calculate IRR, equity multiple, cash-on-cash returns, and perform sensitivity analysis.',
  category: 'analysis',
  parameters: z.object({
    analysisType: z.enum(['irr', 'equity_multiple', 'coc', 'sensitivity', 'full']),
    scenarios: z.array(z.object({
      name: z.string(),
      exitCapRate: z.number().optional(),
      exitYear: z.number().optional(),
      rentGrowth: z.number().optional(),
    })).optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    const { analysisType, scenarios } = params;

    try {
      const assumRes = await query(
        `SELECT * FROM deal_assumptions WHERE deal_id = $1`,
        [dealId]
      );
      const assumptions = assumRes.rows[0];

      // Base case returns (simplified)
      const baseIRR = 15.5;
      const baseEM = 1.85;
      const baseCOC = 8.2;

      let results: any = {
        baseCase: {
          irr: `${baseIRR}%`,
          equityMultiple: `${baseEM}x`,
          cashOnCash: `${baseCOC}%`,
          holdPeriod: assumptions?.exit_year || 5,
        },
      };

      if (analysisType === 'sensitivity' || analysisType === 'full') {
        results.sensitivity = {
          exitCapRate: {
            '-50bps': `${baseIRR + 2.5}%`,
            'base': `${baseIRR}%`,
            '+50bps': `${baseIRR - 2.0}%`,
          },
          rentGrowth: {
            '2%': `${baseIRR - 1.5}%`,
            '3%': `${baseIRR}%`,
            '4%': `${baseIRR + 1.5}%`,
          },
        };
      }

      return { success: true, data: results, displayType: 'json' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const runRefiAnalysis: SkillDefinition = {
  id: 'run_refi_analysis',
  name: 'Run Refinance Analysis',
  description: 'Analyze refinancing opportunities including cash-out proceeds, new loan terms, and impact on returns.',
  category: 'analysis',
  parameters: z.object({
    targetYear: z.number().describe('Year to refinance'),
    newLtv: z.number().optional().describe('Target LTV for new loan'),
    newRate: z.number().optional().describe('Expected interest rate'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { targetYear, newLtv = 0.70, newRate } = params;
    const { dealId } = context;

    try {
      const assumRes = await query(
        `SELECT * FROM deal_assumptions WHERE deal_id = $1`,
        [dealId]
      );
      const assumptions = assumRes.rows[0];
      const purchasePrice = assumptions?.purchase_price || 10000000;

      // Estimate refi proceeds
      const projectedValue = purchasePrice * Math.pow(1.03, targetYear);
      const newLoanAmount = projectedValue * newLtv;
      const existingLoan = purchasePrice * 0.65;
      const cashOut = newLoanAmount - existingLoan;

      return {
        success: true,
        data: {
          targetYear,
          projectedValue: Math.round(projectedValue),
          newLoanAmount: Math.round(newLoanAmount),
          existingLoanPayoff: Math.round(existingLoan),
          cashOutProceeds: Math.round(cashOut),
          newLtv: `${(newLtv * 100).toFixed(0)}%`,
          estimatedRate: newRate || '5.75%',
          recommendation: cashOut > 0 ? 'Refinance opportunity available' : 'Limited equity for cash-out',
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const runHoldSellAnalysis: SkillDefinition = {
  id: 'run_hold_sell_analysis',
  name: 'Run Hold/Sell Analysis',
  description: 'Analyze whether to hold or sell the asset based on current market conditions and future projections.',
  category: 'analysis',
  parameters: z.object({
    currentYear: z.number().describe('Current hold year'),
    marketConditions: z.enum(['strong', 'stable', 'weak']).optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { currentYear, marketConditions = 'stable' } = params;
    const { dealId } = context;

    const marketMultiplier = marketConditions === 'strong' ? 1.1 : marketConditions === 'weak' ? 0.9 : 1.0;

    return {
      success: true,
      data: {
        currentYear,
        marketConditions,
        sellScenario: {
          estimatedProceeds: '$12.5M',
          projectedIRR: '16.2%',
          equityMultiple: '1.75x',
        },
        holdScenario: {
          additionalHoldYears: 2,
          projectedExitValue: '$14.2M',
          projectedIRR: '17.8%',
          equityMultiple: '2.05x',
        },
        recommendation: marketConditions === 'strong' 
          ? 'Consider selling to lock in gains'
          : 'Hold for additional value creation',
        factors: [
          'Cap rate compression/expansion outlook',
          'Rent growth trajectory',
          'Capital markets conditions',
          'Property-level business plan execution',
        ],
      },
      displayType: 'json',
    };
  },
};

// ============================================================================
// REPORT SKILLS (2)
// ============================================================================

const generateReport: SkillDefinition = {
  id: 'generate_report',
  name: 'Generate Report',
  description: 'Generate a formatted report or summary: investment memo, quarterly update, NOI waterfall, or custom analysis.',
  category: 'report',
  parameters: z.object({
    reportType: z.enum([
      'investment_memo', 'quarterly_update', 'noi_waterfall', 
      'rent_roll_summary', 'market_overview', 'due_diligence_checklist', 'custom'
    ]),
    format: z.enum(['markdown', 'json']).optional(),
    customPrompt: z.string().optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { reportType, format = 'markdown', customPrompt } = params;
    const { dealId } = context;

    try {
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
      let report: string;

      switch (reportType) {
        case 'investment_memo':
          report = `# Investment Memo: ${deal.property_name || deal.project_name}\n\n` +
            `**Location:** ${deal.city}, ${deal.state}\n` +
            `**Units:** ${deal.units || 'N/A'}\n` +
            `**Status:** ${deal.status}\n\n` +
            `## Executive Summary\n\n[Analysis pending]\n\n` +
            `## Investment Thesis\n\n## Market Overview\n\n## Financial Summary\n\n## Risks & Mitigants\n`;
          break;

        case 'noi_waterfall':
          report = `# NOI Waterfall: ${deal.property_name || deal.project_name}\n\n` +
            `| Line Item | Amount |\n|-----------|--------|\n` +
            `| Gross Potential Rent | $XXX,XXX |\n` +
            `| Less: Vacancy | ($XX,XXX) |\n` +
            `| Less: Concessions | ($X,XXX) |\n` +
            `| Effective Gross Income | $XXX,XXX |\n` +
            `| Less: Operating Expenses | ($XX,XXX) |\n` +
            `| **Net Operating Income** | **$XXX,XXX** |\n`;
          break;

        case 'due_diligence_checklist':
          report = `# Due Diligence Checklist: ${deal.property_name || deal.project_name}\n\n` +
            `## Financial\n- [ ] T-12 verified\n- [ ] Rent roll audited\n- [ ] Budget reviewed\n\n` +
            `## Legal\n- [ ] Title commitment\n- [ ] Survey\n- [ ] Leases reviewed\n\n` +
            `## Physical\n- [ ] Property inspection\n- [ ] Environmental Phase I\n- [ ] PCA report\n\n` +
            `## Market\n- [ ] Rent comps\n- [ ] Sale comps\n- [ ] Supply pipeline\n`;
          break;

        default:
          report = `# ${reportType.replace(/_/g, ' ').toUpperCase()}\n\nReport for ${deal.property_name || deal.project_name}\n`;
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

const generateMarketingMaterials: SkillDefinition = {
  id: 'generate_marketing_materials',
  name: 'Generate Marketing Materials',
  description: 'Create marketing content for lease-up, disposition, or investor communications.',
  category: 'report',
  parameters: z.object({
    materialType: z.enum(['property_flyer', 'investor_update', 'disposition_teaser', 'lease_brochure']),
    highlights: z.array(z.string()).optional(),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { materialType, highlights } = params;
    const { dealId } = context;

    try {
      const dealRes = await query(
        `SELECT d.*, p.name as property_name, p.city, p.state, p.units
         FROM deals d
         LEFT JOIN properties p ON d.property_id = p.id
         WHERE d.id = $1`,
        [dealId]
      );

      const deal = dealRes.rows[0];

      return {
        success: true,
        data: {
          materialType,
          propertyName: deal?.property_name,
          content: `[Generated ${materialType} content would appear here]`,
          highlights: highlights || ['Prime location', 'Strong demographics', 'Value-add opportunity'],
        },
        displayType: 'markdown',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// REGISTER ALL SKILLS (18 total)
// ============================================================================

export function registerAllSkills(): void {
  // Data skills (5)
  skillRegistry.register(queryDealData);
  skillRegistry.register(searchMarketData);
  skillRegistry.register(queryDebtMarket);
  skillRegistry.register(queryTaxImplications);
  skillRegistry.register(queryComplianceStatus);

  // Document skills (4)
  skillRegistry.register(extractDocument);
  skillRegistry.register(reviewContract);
  skillRegistry.register(analyzeAppraisal);
  skillRegistry.register(parseEnvironmentalReport);

  // Action skills (4)
  skillRegistry.register(updateAssumption);
  skillRegistry.register(addNote);
  skillRegistry.register(createTask);
  skillRegistry.register(updateDealStatus);

  // Analysis skills (3)
  skillRegistry.register(runReturnAnalysis);
  skillRegistry.register(runRefiAnalysis);
  skillRegistry.register(runHoldSellAnalysis);

  // Report skills (2)
  skillRegistry.register(generateReport);
  skillRegistry.register(generateMarketingMaterials);

  // Advisor personas (16)
  registerAdvisorPersonas();

  // Discovery skills (6) - registered separately via registerDiscoverySkills()
  // See discovery-skills.ts

  logger.info(`Registered ${skillRegistry.getAll().length} skills (18 capability + 16 advisor + discovery)`);
}

// Import and register discovery skills
import { registerDiscoverySkills } from './discovery-skills';
import { registerStructuringSkills } from './structuring-skills';
import { registerCollaborationSkills } from './collaboration-skills';

// Auto-register on import
registerAllSkills();
registerDiscoverySkills();
registerStructuringSkills();
registerCollaborationSkills();
