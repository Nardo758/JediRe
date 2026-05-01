/**
 * Compliance → Legal Collaboration
 * 
 * Compliance spots issues → Legal drafts protective provisions
 * 
 * Key Handoffs:
 * - Environmental Phase I concerns → Environmental indemnity clause
 * - Zoning variance needed → Contingency for zoning approval
 * - Insurance gap → Require specific coverage in PSA
 * - Permit issues → Seller rep & warranty requirements
 * - ADA compliance → Remediation escrow or price adjustment
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ComplianceIssue {
  id: string;
  dealId: string;
  issueType: 'environmental' | 'zoning' | 'insurance' | 'permits' | 'ada' | 'fire_safety' | 'structural' | 'title' | 'survey' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  source: string; // e.g., "Phase I Report", "Zoning Letter", "Insurance Review"
  estimatedCost?: number;
  estimatedTimeline?: string;
  detectedAt: Date;
  status: 'open' | 'mitigated' | 'accepted' | 'deal_breaker';
}

export interface LegalProtection {
  id: string;
  dealId: string;
  generatedAt: Date;
  triggeringIssues: ComplianceIssue[];
  
  // Contract protections
  contractProtections: {
    protectionType: 'contingency' | 'indemnity' | 'escrow' | 'rep_warranty' | 'price_adjustment' | 'termination_right';
    description: string;
    suggestedLanguage: string;
    triggeringIssue: string;
    priority: 'required' | 'recommended' | 'nice_to_have';
  }[];
  
  // Due diligence extensions
  ddExtensions: {
    reason: string;
    additionalDaysRequested: number;
    rationale: string;
  }[];
  
  // Price adjustments
  priceAdjustments: {
    reason: string;
    suggestedReduction: number;
    basis: string;
  }[];
  
  // Escrow requirements
  escrowRequirements: {
    purpose: string;
    amount: number;
    releaseConditions: string;
    holdbackPeriod: string;
  }[];
  
  // Walk-away analysis
  walkAwayAnalysis: {
    shouldWalk: boolean;
    confidence: number;
    rationale: string;
    negotiationLeverage: 'high' | 'medium' | 'low';
  };
  
  summaryForLegal: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// COMPLIANCE → LEGAL SERVICE
// ============================================================================

class ComplianceLegalService {
  
  /**
   * Compliance flags issue, Legal generates protections
   */
  async generateProtections(issues: ComplianceIssue[], dealId: string, userId: string): Promise<LegalProtection> {
    logger.info('Legal generating protections for compliance issues', { dealId, issueCount: issues.length });
    
    // Get deal context
    const dealContext = await this.getDealContext(dealId);
    
    // Get AI recommendations
    const aiAnalysis = await this.getAIRecommendations(issues, dealContext);
    
    const protection: LegalProtection = {
      id: `legal_prot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dealId,
      generatedAt: new Date(),
      triggeringIssues: issues,
      contractProtections: aiAnalysis.contractProtections || [],
      ddExtensions: aiAnalysis.ddExtensions || [],
      priceAdjustments: aiAnalysis.priceAdjustments || [],
      escrowRequirements: aiAnalysis.escrowRequirements || [],
      walkAwayAnalysis: aiAnalysis.walkAwayAnalysis || {
        shouldWalk: false,
        confidence: 50,
        rationale: 'Insufficient data',
        negotiationLeverage: 'medium',
      },
      summaryForLegal: aiAnalysis.summaryForLegal || 'Protections generated',
    };
    
    // Store and notify
    await this.storeProtection(protection);
    await this.notifyLegal(dealId, userId, protection);
    
    return protection;
  }

  /**
   * Get deal context for analysis
   */
  private async getDealContext(dealId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT d.*, p.*, da.*
         FROM deals d
         LEFT JOIN properties p ON d.property_id = p.id
         LEFT JOIN deal_assumptions da ON d.id = da.deal_id
         WHERE d.id = $1`,
        [dealId]
      );
      return result.rows[0] || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Get AI recommendations
   */
  private async getAIRecommendations(issues: ComplianceIssue[], dealContext: any): Promise<any> {
    const issuesSummary = issues.map(i => 
      `- [${i.severity.toUpperCase()}] ${i.issueType}: ${i.description} (Source: ${i.source})${i.estimatedCost ? ` Est. cost: $${i.estimatedCost.toLocaleString()}` : ''}`
    ).join('\n');

    const prompt = `You are a real estate attorney drafting protective contract language based on compliance findings.

DEAL CONTEXT:
- Purchase Price: $${(dealContext.purchase_price || 10000000).toLocaleString()}
- Property Type: ${dealContext.property_type || 'Multifamily'}
- Units: ${dealContext.units || 100}
- Status: ${dealContext.status || 'due_diligence'}

COMPLIANCE ISSUES FLAGGED:
${issuesSummary}

For each issue, draft appropriate legal protections in JSON:
{
  "contractProtections": [
    {
      "protectionType": "contingency|indemnity|escrow|rep_warranty|price_adjustment|termination_right",
      "description": "<what this protection does>",
      "suggestedLanguage": "<actual contract language to insert>",
      "triggeringIssue": "<which issue this addresses>",
      "priority": "required|recommended|nice_to_have"
    }
  ],
  "ddExtensions": [
    {
      "reason": "<what needs more investigation>",
      "additionalDaysRequested": <days>,
      "rationale": "<why needed>"
    }
  ],
  "priceAdjustments": [
    {
      "reason": "<issue>",
      "suggestedReduction": <$>,
      "basis": "<how calculated>"
    }
  ],
  "escrowRequirements": [
    {
      "purpose": "<what it covers>",
      "amount": <$>,
      "releaseConditions": "<when released>",
      "holdbackPeriod": "<e.g., '12 months post-closing'>"
    }
  ],
  "walkAwayAnalysis": {
    "shouldWalk": true/false,
    "confidence": <0-100>,
    "rationale": "<analysis>",
    "negotiationLeverage": "high|medium|low"
  },
  "summaryForLegal": "<executive summary for attorney review>"
}

GUIDANCE BY ISSUE TYPE:
- Environmental: Indemnity + escrow for remediation
- Zoning: Contingency for variance approval
- Insurance: Require coverage in PSA, seller to maintain through closing
- Permits: Rep & warranty that all permits current
- ADA: Escrow for remediation OR price reduction
- Title: Title insurance endorsements required
- Survey: Affirmative coverage for encroachments

Be specific with dollar amounts based on estimated costs. For language, draft actual contract text.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 3500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find(b => b.type === 'text')?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{}');
    } catch (error) {
      logger.warn('AI legal protection analysis failed', { error });
      return {};
    }
  }

  /**
   * Store protection
   */
  private async storeProtection(protection: LegalProtection): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_collaboration_legal_protections
         (id, deal_id, triggering_issues, contract_protections, dd_extensions,
          price_adjustments, escrow_requirements, walk_away_analysis, summary, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          protection.id, protection.dealId, JSON.stringify(protection.triggeringIssues),
          JSON.stringify(protection.contractProtections), JSON.stringify(protection.ddExtensions),
          JSON.stringify(protection.priceAdjustments), JSON.stringify(protection.escrowRequirements),
          JSON.stringify(protection.walkAwayAnalysis), protection.summaryForLegal, protection.generatedAt,
        ]
      );
    } catch (error) {
      logger.warn('Failed to store legal protection', { error });
    }
  }

  /**
   * Notify Legal agent
   */
  private async notifyLegal(dealId: string, userId: string, protection: LegalProtection): Promise<void> {
    const criticalIssues = protection.triggeringIssues.filter(i => i.severity === 'critical');
    const severity = criticalIssues.length > 0 ? 'critical' :
                     protection.walkAwayAnalysis.shouldWalk ? 'warning' : 'info';

    try {
      await query(
        `INSERT INTO agent_notifications 
         (user_id, deal_id, agent_id, type, title, message, channels)
         VALUES ($1, $2, 'legal', $3, $4, $5, $6)`,
        [
          userId, dealId, severity,
          `Compliance Issues Require Contract Protections`,
          protection.summaryForLegal,
          severity === 'critical' ? '["in_app", "email"]' : '["in_app"]',
        ]
      );
    } catch (error) {
      logger.warn('Failed to notify legal', { error });
    }
  }

  /**
   * Store compliance issue (called by Compliance agent)
   */
  async storeIssue(issue: ComplianceIssue): Promise<void> {
    try {
      await query(
        `INSERT INTO deal_compliance_issues
         (id, deal_id, issue_type, severity, description, source, 
          estimated_cost, estimated_timeline, detected_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           severity = EXCLUDED.severity,
           description = EXCLUDED.description,
           estimated_cost = EXCLUDED.estimated_cost,
           status = EXCLUDED.status`,
        [
          issue.id, issue.dealId, issue.issueType, issue.severity, issue.description,
          issue.source, issue.estimatedCost, issue.estimatedTimeline, issue.detectedAt, issue.status,
        ]
      );
    } catch (error) {
      logger.warn('Failed to store compliance issue', { error });
    }
  }

  /**
   * Get open issues for a deal
   */
  async getOpenIssues(dealId: string): Promise<ComplianceIssue[]> {
    const result = await query(
      `SELECT * FROM deal_compliance_issues 
       WHERE deal_id = $1 AND status = 'open' 
       ORDER BY CASE severity 
         WHEN 'critical' THEN 1 
         WHEN 'high' THEN 2 
         WHEN 'medium' THEN 3 
         ELSE 4 END`,
      [dealId]
    );
    return result.rows.map(row => ({
      id: row.id,
      dealId: row.deal_id,
      issueType: row.issue_type,
      severity: row.severity,
      description: row.description,
      source: row.source,
      estimatedCost: row.estimated_cost,
      estimatedTimeline: row.estimated_timeline,
      detectedAt: row.detected_at,
      status: row.status,
    }));
  }

  /**
   * Get protection history
   */
  async getProtectionHistory(dealId: string): Promise<LegalProtection[]> {
    const result = await query(
      `SELECT * FROM agent_collaboration_legal_protections WHERE deal_id = $1 ORDER BY generated_at DESC`,
      [dealId]
    );
    return result.rows.map(row => ({
      id: row.id,
      dealId: row.deal_id,
      generatedAt: row.generated_at,
      triggeringIssues: row.triggering_issues,
      contractProtections: row.contract_protections,
      ddExtensions: row.dd_extensions,
      priceAdjustments: row.price_adjustments,
      escrowRequirements: row.escrow_requirements,
      walkAwayAnalysis: row.walk_away_analysis,
      summaryForLegal: row.summary,
    }));
  }
}

export const complianceLegalService = new ComplianceLegalService();
export default complianceLegalService;
