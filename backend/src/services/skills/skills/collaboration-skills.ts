/**
 * Agent Collaboration Skills
 * 
 * Skills that enable cross-agent intelligence sharing
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { z } from 'zod';
import { skillRegistry, SkillDefinition, SkillResult } from '../skill-registry';
import { logger } from '../../../utils/logger';

// Import collaboration services
import { cfoLenderService } from '../../agents/collaborations/cfo-lender.service';
import { assetManagerCFOService } from '../../agents/collaborations/asset-manager-cfo.service';
import { researchAcquisitionsService } from '../../agents/collaborations/research-acquisitions.service';
import { leasingRevenueService } from '../../agents/collaborations/leasing-revenue.service';
import { complianceLegalService } from '../../agents/collaborations/compliance-legal.service';
import { taxCFOService } from '../../agents/collaborations/tax-cfo.service';

// ============================================================================
// CFO → LENDER SKILLS
// ============================================================================

const analyzeDebtStructure: SkillDefinition = {
  id: 'analyze_debt_structure',
  name: 'Analyze Debt Structure',
  description: 'CFO analyzes deal and generates optimal debt structure recommendations for Lender. Includes IRR by LTV, target DSCR, rate structure, and refi timing.',
  category: 'analysis',
  parameters: z.object({
    purchasePrice: z.number().optional().describe('Override purchase price'),
    noi: z.number().optional().describe('Override NOI'),
    targetIRR: z.number().optional().default(15).describe('Target IRR for optimization'),
    holdPeriod: z.number().optional().default(5).describe('Hold period in years'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId, userId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      // Would get from deal data if not provided
      const recommendation = await cfoLenderService.analyzeAndRecommend({
        dealId,
        userId,
        purchasePrice: params.purchasePrice || 10000000,
        noi: params.noi || 600000,
        capRate: 0.06,
        targetIRR: params.targetIRR,
        holdPeriod: params.holdPeriod,
      });

      return {
        success: true,
        data: {
          recommendedLTV: recommendation.recommendedLTV,
          targetDSCR: recommendation.targetDSCR,
          rateStructure: recommendation.rateStructure,
          refiRecommendation: recommendation.refiRecommendation,
          breakpoints: recommendation.breakpoints,
          summaryForLender: recommendation.summaryForLender,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const getDebtRecommendation: SkillDefinition = {
  id: 'get_debt_recommendation',
  name: 'Get Debt Recommendation',
  description: 'Lender retrieves CFO debt structure recommendations for a deal.',
  category: 'data',
  parameters: z.object({}),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const rec = await cfoLenderService.getRecommendation(dealId);
      if (!rec) {
        return { success: true, data: { found: false, message: 'No debt recommendation. CFO should run analyze_debt_structure first.' } };
      }
      return { success: true, data: rec, displayType: 'json' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// ASSET MANAGER → CFO SKILLS
// ============================================================================

const reportVariance: SkillDefinition = {
  id: 'report_variance',
  name: 'Report Variance',
  description: 'Asset Manager reports operational variance. CFO will analyze return impact.',
  category: 'action',
  parameters: z.object({
    varianceType: z.enum(['occupancy', 'rent', 'opex', 'noi', 'capex']).describe('Type of variance'),
    metric: z.string().describe('Specific metric name'),
    proformaValue: z.number().describe('Proforma/budgeted value'),
    actualValue: z.number().describe('Actual value'),
    period: z.string().describe('Period (e.g., 2026-Q1)'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId, userId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const variancePercent = ((params.actualValue - params.proformaValue) / params.proformaValue) * 100;
      
      const analysis = await assetManagerCFOService.analyzeVarianceImpact({
        dealId,
        userId,
        varianceType: params.varianceType,
        metric: params.metric,
        proformaValue: params.proformaValue,
        actualValue: params.actualValue,
        variancePercent,
        period: params.period,
      });

      return {
        success: true,
        data: {
          variancePercent: variancePercent.toFixed(1) + '%',
          returnImpact: analysis.returnImpact,
          riskImpact: analysis.riskImpact,
          recommendation: analysis.recommendation,
          summary: analysis.summaryForUser,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const getVarianceHistory: SkillDefinition = {
  id: 'get_variance_history',
  name: 'Get Variance History',
  description: 'Get history of variance impact analyses for a deal.',
  category: 'data',
  parameters: z.object({}),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const history = await assetManagerCFOService.getVarianceHistory(dealId);
      return { success: true, data: { count: history.length, analyses: history }, displayType: 'json' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// RESEARCH → ACQUISITIONS SKILLS
// ============================================================================

const reportMarketSignal: SkillDefinition = {
  id: 'report_market_signal',
  name: 'Report Market Signal',
  description: 'Research reports market signal. Will auto-adjust Acquisitions screening criteria.',
  category: 'action',
  parameters: z.object({
    signalType: z.enum(['cap_rate', 'supply', 'interest_rate', 'rent_growth', 'employment', 'population']).describe('Type of signal'),
    market: z.string().describe('Market/MSA name'),
    direction: z.enum(['up', 'down', 'stable']).describe('Direction of change'),
    magnitude: z.number().describe('Magnitude of change (% or bps)'),
    source: z.string().describe('Data source'),
    confidence: z.number().min(0).max(100).describe('Confidence level 0-100'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { userId } = context;

    try {
      const signal = {
        id: `sig_${Date.now()}`,
        signalType: params.signalType,
        market: params.market,
        direction: params.direction,
        magnitude: params.magnitude,
        source: params.source,
        confidence: params.confidence,
        detectedAt: new Date(),
      };

      const adjustment = await researchAcquisitionsService.processMarketSignal(signal, userId);

      return {
        success: true,
        data: {
          signalProcessed: true,
          marketAdjustments: adjustment.marketAdjustments,
          underwritingAdjustments: adjustment.underwritingAdjustments,
          pipelineAlerts: adjustment.pipelineAlerts,
          summary: adjustment.summaryForAcquisitions,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const getScreeningAdjustments: SkillDefinition = {
  id: 'get_screening_adjustments',
  name: 'Get Screening Adjustments',
  description: 'Acquisitions retrieves recent Research-driven screening adjustments.',
  category: 'data',
  parameters: z.object({
    limit: z.number().optional().default(10),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { userId } = context;

    try {
      const history = await researchAcquisitionsService.getAdjustmentHistory(userId, params.limit);
      return { success: true, data: { count: history.length, adjustments: history }, displayType: 'json' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// LEASING → REVENUE MANAGEMENT SKILLS
// ============================================================================

const reportLeasingMetrics: SkillDefinition = {
  id: 'report_leasing_metrics',
  name: 'Report Leasing Metrics',
  description: 'Leasing reports traffic/conversion data. Revenue Management will generate pricing recommendations.',
  category: 'action',
  parameters: z.object({
    period: z.string().describe('Period (e.g., 2026-W16)'),
    totalTraffic: z.number().describe('Total traffic count'),
    tours: z.number().describe('Tours conducted'),
    applications: z.number().describe('Applications received'),
    currentOccupancy: z.number().min(0).max(1).describe('Current occupancy (0-1)'),
    availableUnits: z.number().describe('Available units'),
    waitListCount: z.number().optional().default(0).describe('Wait list count'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId, userId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const metrics = {
        dealId,
        period: params.period,
        totalTraffic: params.totalTraffic,
        qualifiedLeads: Math.round(params.totalTraffic * 0.6),
        tours: params.tours,
        applications: params.applications,
        tourToAppRate: params.tours > 0 ? params.applications / params.tours : 0,
        appToLeaseRate: 0.7, // Would calculate from actual data
        overallConversionRate: params.totalTraffic > 0 ? (params.applications * 0.7) / params.totalTraffic : 0,
        avgDaysToLease: 14,
        leasesThisPeriod: Math.round(params.applications * 0.7),
        cancellationsThisPeriod: 0,
        currentOccupancy: params.currentOccupancy,
        preLeasedUnits: 0,
        availableUnits: params.availableUnits,
        waitListCount: params.waitListCount || 0,
      };

      // Store and analyze
      await leasingRevenueService.storeMetrics(metrics);
      const recommendation = await leasingRevenueService.analyzeAndRecommend(metrics, userId);

      return {
        success: true,
        data: {
          demandSignal: recommendation.demandSignal,
          pricingPower: recommendation.pricingPower,
          urgency: recommendation.urgency,
          rentAdjustments: recommendation.rentAdjustments,
          concessionRecommendations: recommendation.concessionRecommendations,
          projectedImpact: recommendation.projectedImpact,
          summary: recommendation.summaryForRevenueManager,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const getPricingRecommendations: SkillDefinition = {
  id: 'get_pricing_recommendations',
  name: 'Get Pricing Recommendations',
  description: 'Get Revenue Management pricing recommendations for a property.',
  category: 'data',
  parameters: z.object({}),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const history = await leasingRevenueService.getPricingHistory(dealId);
      const latest = history[0];
      return { 
        success: true, 
        data: latest || { found: false, message: 'No pricing recommendations. Leasing should report metrics first.' },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// COMPLIANCE → LEGAL SKILLS
// ============================================================================

const reportComplianceIssue: SkillDefinition = {
  id: 'report_compliance_issue',
  name: 'Report Compliance Issue',
  description: 'Compliance flags an issue. Legal will generate protective contract provisions.',
  category: 'action',
  parameters: z.object({
    issueType: z.enum(['environmental', 'zoning', 'insurance', 'permits', 'ada', 'fire_safety', 'structural', 'title', 'survey', 'other']),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    description: z.string().describe('Description of the issue'),
    source: z.string().describe('Source document or inspection'),
    estimatedCost: z.number().optional().describe('Estimated remediation cost'),
    estimatedTimeline: z.string().optional().describe('Estimated timeline to resolve'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId, userId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const issue = {
        id: `issue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        dealId,
        issueType: params.issueType,
        severity: params.severity,
        description: params.description,
        source: params.source,
        estimatedCost: params.estimatedCost,
        estimatedTimeline: params.estimatedTimeline,
        detectedAt: new Date(),
        status: 'open' as const,
      };

      // Store issue
      await complianceLegalService.storeIssue(issue);

      // Generate legal protections
      const protection = await complianceLegalService.generateProtections([issue], dealId, userId);

      return {
        success: true,
        data: {
          issueId: issue.id,
          contractProtections: protection.contractProtections,
          priceAdjustments: protection.priceAdjustments,
          escrowRequirements: protection.escrowRequirements,
          walkAwayAnalysis: protection.walkAwayAnalysis,
          summary: protection.summaryForLegal,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const getLegalProtections: SkillDefinition = {
  id: 'get_legal_protections',
  name: 'Get Legal Protections',
  description: 'Legal retrieves protective provisions generated from Compliance issues.',
  category: 'data',
  parameters: z.object({}),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const protections = await complianceLegalService.getProtectionHistory(dealId);
      const openIssues = await complianceLegalService.getOpenIssues(dealId);
      return { 
        success: true, 
        data: { 
          openIssues: openIssues.length,
          issues: openIssues,
          protections: protections,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// TAX → CFO SKILLS
// ============================================================================

const analyzeAfterTaxReturns: SkillDefinition = {
  id: 'analyze_after_tax_returns',
  name: 'Analyze After-Tax Returns',
  description: 'Tax Strategist calculates after-tax returns for CFO. Includes cost seg analysis, OZ comparison, and exit taxes.',
  category: 'analysis',
  parameters: z.object({
    purchasePrice: z.number().describe('Purchase price'),
    landValue: z.number().optional().describe('Land value (non-depreciable)'),
    depreciationMethod: z.enum(['straight_line', 'cost_seg']).optional().default('straight_line'),
    opportunityZone: z.boolean().optional().default(false),
    must1031: z.boolean().optional().default(false),
    investorTaxBracket: z.number().optional().default(0.37).describe('Investor marginal tax rate'),
    stateIncomeTaxRate: z.number().optional().default(0.05).describe('State income tax rate'),
    capitalGainsRate: z.number().optional().default(0.20).describe('Capital gains tax rate'),
    entityType: z.enum(['llc_partnership', 'llc_scorp', 'c_corp', 'reit']).optional().default('llc_partnership'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId, userId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const analysis = await taxCFOService.calculateAfterTaxReturns({
        dealId,
        userId,
        purchasePrice: params.purchasePrice,
        landValue: params.landValue || params.purchasePrice * 0.2,
        buildingValue: params.purchasePrice - (params.landValue || params.purchasePrice * 0.2),
        depreciationMethod: params.depreciationMethod,
        costSegStudyAvailable: params.depreciationMethod === 'cost_seg',
        bonusDepreciationEligible: true,
        section179Eligible: false,
        opportunityZone: params.opportunityZone,
        must1031: params.must1031,
        entityType: params.entityType,
        investorTaxBracket: params.investorTaxBracket,
        stateIncomeTaxRate: params.stateIncomeTaxRate,
        capitalGainsRate: params.capitalGainsRate,
      });

      return {
        success: true,
        data: {
          preTaxIRR: analysis.preTaxIRR,
          afterTaxIRR: analysis.afterTaxIRR,
          irrDifference: (analysis.afterTaxIRR - analysis.preTaxIRR).toFixed(1) + '%',
          taxBenefits: analysis.taxBenefits,
          costSegAnalysis: analysis.costSegAnalysis,
          ozComparison: analysis.ozComparison,
          exitTaxAnalysis: analysis.exitTaxAnalysis,
          summary: analysis.summaryForCFO,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

const getAfterTaxReturns: SkillDefinition = {
  id: 'get_after_tax_returns',
  name: 'Get After-Tax Returns',
  description: 'CFO retrieves Tax Strategist after-tax return analysis.',
  category: 'data',
  parameters: z.object({}),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    if (!dealId) return { success: false, error: 'No deal context' };

    try {
      const result = await taxCFOService.getAfterTaxReturns(dealId);
      if (!result) {
        return { success: true, data: { found: false, message: 'No after-tax analysis. Tax Strategist should run analyze_after_tax_returns first.' } };
      }
      return { success: true, data: result, displayType: 'json' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// REGISTER ALL COLLABORATION SKILLS
// ============================================================================

export function registerCollaborationSkills(): void {
  // CFO → Lender
  skillRegistry.register(analyzeDebtStructure);
  skillRegistry.register(getDebtRecommendation);
  
  // Asset Manager → CFO
  skillRegistry.register(reportVariance);
  skillRegistry.register(getVarianceHistory);
  
  // Research → Acquisitions
  skillRegistry.register(reportMarketSignal);
  skillRegistry.register(getScreeningAdjustments);
  
  // Leasing → Revenue Management
  skillRegistry.register(reportLeasingMetrics);
  skillRegistry.register(getPricingRecommendations);
  
  // Compliance → Legal
  skillRegistry.register(reportComplianceIssue);
  skillRegistry.register(getLegalProtections);
  
  // Tax → CFO
  skillRegistry.register(analyzeAfterTaxReturns);
  skillRegistry.register(getAfterTaxReturns);

  logger.info('Registered 12 collaboration skills');
}
