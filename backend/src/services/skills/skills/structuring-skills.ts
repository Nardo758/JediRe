/**
 * Deal Structuring Skills
 * 
 * Skills for CFO → Legal collaboration on deal structure:
 * - Analyze deal economics for structuring
 * - Generate waterfall recommendations
 * - Recommend contract clauses
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { z } from 'zod';
import { skillRegistry, SkillDefinition, SkillResult } from '../skill-registry';
import { dealStructuringService } from '../../agents/deal-structuring.service';
import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

// ============================================================================
// ANALYZE DEAL FOR STRUCTURING
// ============================================================================

const analyzeDealStructure: SkillDefinition = {
  id: 'analyze_deal_structure',
  name: 'Analyze Deal Structure',
  description: 'Analyze deal economics and generate recommendations for Legal on waterfall structure, contract clauses, and risk mitigations. CFO uses this to advise Legal.',
  category: 'analysis',
  parameters: z.object({
    generateFresh: z.boolean().optional().default(false).describe('Force regenerate even if recent analysis exists'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId, userId } = context;
    const { generateFresh = false } = params;

    if (!dealId) {
      return { success: false, error: 'No deal context provided' };
    }

    try {
      // Check for existing recent analysis
      if (!generateFresh) {
        const existing = await dealStructuringService.getRecommendations(dealId);
        if (existing && (Date.now() - existing.generatedAt.getTime()) < 24 * 60 * 60 * 1000) {
          return {
            success: true,
            data: {
              cached: true,
              recommendations: existing,
            },
            displayType: 'json',
          };
        }
      }

      // Generate new analysis
      const recommendations = await dealStructuringService.analyzeAndRecommend(dealId, userId);

      return {
        success: true,
        data: {
          cached: false,
          recommendations: {
            returnProfile: recommendations.returnProfile,
            waterfallStructure: recommendations.waterfallStructure,
            contractClauses: recommendations.contractClauses,
            loiTerms: recommendations.loiTerms,
            riskMitigations: recommendations.riskMitigations,
            summaryForLegal: recommendations.summaryForLegal,
          },
        },
        displayType: 'json',
      };
    } catch (error: any) {
      logger.error('analyze_deal_structure error:', error);
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// GET STRUCTURING RECOMMENDATIONS
// ============================================================================

const getStructuringRecommendations: SkillDefinition = {
  id: 'get_structuring_recommendations',
  name: 'Get Structuring Recommendations',
  description: 'Retrieve existing CFO structuring recommendations for a deal. Legal uses this to understand how to draft contracts.',
  category: 'data',
  parameters: z.object({}),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;

    if (!dealId) {
      return { success: false, error: 'No deal context provided' };
    }

    try {
      const recommendations = await dealStructuringService.getRecommendations(dealId);

      if (!recommendations) {
        return {
          success: true,
          data: {
            found: false,
            message: 'No structuring analysis found. CFO should run analyze_deal_structure first.',
          },
        };
      }

      return {
        success: true,
        data: {
          found: true,
          generatedAt: recommendations.generatedAt,
          returnProfile: recommendations.returnProfile,
          waterfallStructure: recommendations.waterfallStructure,
          contractClauses: recommendations.contractClauses,
          loiTerms: recommendations.loiTerms,
          riskMitigations: recommendations.riskMitigations,
          summaryForLegal: recommendations.summaryForLegal,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// DRAFT CONTRACT CLAUSE
// ============================================================================

const draftContractClause: SkillDefinition = {
  id: 'draft_contract_clause',
  name: 'Draft Contract Clause',
  description: 'Draft specific contract language based on CFO recommendations. Legal uses this to generate protective clauses.',
  category: 'action',
  parameters: z.object({
    clauseType: z.enum([
      'waterfall',
      'preferred_return',
      'promote',
      'catch_up',
      'clawback',
      'distribution_timing',
      'exit_rights',
      'buy_sell',
      'capital_call',
      'default_provisions',
      'home_run',
      'earnout',
      'custom',
    ]).describe('Type of clause to draft'),
    customDescription: z.string().optional().describe('For custom clauses, describe what you need'),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    const { clauseType, customDescription } = params;

    if (!dealId) {
      return { success: false, error: 'No deal context provided' };
    }

    try {
      // Get existing recommendations for context
      const recommendations = await dealStructuringService.getRecommendations(dealId);
      const waterfall = recommendations?.waterfallStructure;

      // Generate clause based on type
      let clauseLanguage = '';
      let notes = '';

      switch (clauseType) {
        case 'waterfall':
          clauseLanguage = generateWaterfallClause(waterfall);
          notes = 'Full waterfall distribution language based on CFO analysis';
          break;

        case 'preferred_return':
          clauseLanguage = `**Preferred Return.** Limited Partners shall receive a ${waterfall?.preferredReturn || 8}% per annum cumulative, non-compounded preferred return on their Unreturned Capital Contributions, payable quarterly to the extent of available Cash Flow.`;
          notes = `Pref set at ${waterfall?.preferredReturn || 8}% based on deal cash flow profile`;
          break;

        case 'home_run':
          if (waterfall?.tier3Hurdle) {
            clauseLanguage = `**Home Run Promote.** In the event the Internal Rate of Return to Limited Partners exceeds ${waterfall.tier3Hurdle}% ("Home Run Threshold"), distributions above such threshold shall be allocated ${waterfall.tier3Split?.lp}% to Limited Partners and ${waterfall.tier3Split?.gp}% to General Partner, in recognition of exceptional performance.`;
            notes = `Home run kicks in at ${waterfall.tier3Hurdle}% IRR - appropriate for appreciation-heavy deals`;
          } else {
            clauseLanguage = `**Home Run Promote.** In the event the Internal Rate of Return to Limited Partners exceeds 20% ("Home Run Threshold"), distributions above such threshold shall be allocated 50% to Limited Partners and 50% to General Partner.`;
            notes = 'Standard home run threshold at 20% IRR';
          }
          break;

        case 'clawback':
          clauseLanguage = `**Clawback Provision.** Upon final liquidation of the Partnership, if General Partner has received aggregate distributions in excess of amounts to which General Partner would have been entitled based on cumulative Partnership performance, General Partner shall promptly return such excess to the Partnership for redistribution to Limited Partners.`;
          notes = waterfall?.lookbackProvision ? 'Recommended due to deal risk profile' : 'Standard protective provision';
          break;

        case 'catch_up':
          if (waterfall?.catchUpProvision) {
            clauseLanguage = `**GP Catch-Up.** After Limited Partners have received their Preferred Return and return of capital, 100% of subsequent distributions shall be allocated to General Partner until General Partner has received an amount equal to ${waterfall.tier1Split?.gp || 20}% of all distributions made to Limited Partners under this section.`;
            notes = 'Catch-up included per CFO recommendation';
          } else {
            clauseLanguage = `[NO CATCH-UP RECOMMENDED - CFO analysis suggests pari passu distribution above pref is more appropriate for this deal's cash flow profile]`;
            notes = 'No catch-up recommended for cash-flow-heavy deals';
          }
          break;

        case 'distribution_timing':
          const isAssetHeavy = recommendations?.returnProfile === 'appreciation_heavy';
          clauseLanguage = isAssetHeavy 
            ? `**Distributions.** Available Cash Flow shall be distributed to Partners semi-annually, within forty-five (45) days following the end of each semi-annual period. Sale and refinancing proceeds shall be distributed within thirty (30) days of receipt.`
            : `**Distributions.** Available Cash Flow shall be distributed to Partners quarterly, within thirty (30) days following the end of each fiscal quarter. The Manager shall use commercially reasonable efforts to maximize current distributions consistent with prudent reserves.`;
          notes = isAssetHeavy 
            ? 'Semi-annual distributions for appreciation-focused deal'
            : 'Quarterly distributions emphasized for cash-flow deal';
          break;

        default:
          clauseLanguage = `[Draft ${clauseType} clause based on: ${customDescription || 'deal requirements'}]`;
          notes = 'Custom clause - review with counsel';
      }

      // Store the drafted clause
      await query(
        `INSERT INTO deal_contract_clauses (deal_id, clause_type, language, notes, drafted_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [dealId, clauseType, clauseLanguage, notes]
      );

      return {
        success: true,
        data: {
          clauseType,
          language: clauseLanguage,
          notes,
          basedOnCFOAnalysis: !!recommendations,
        },
        displayType: 'markdown',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Generate full waterfall clause
 */
function generateWaterfallClause(waterfall: any): string {
  if (!waterfall) {
    return '[WATERFALL STRUCTURE NOT ANALYZED - Run CFO analysis first]';
  }

  let clause = `**Distribution Waterfall.** Available Cash Flow and Net Sale Proceeds shall be distributed as follows:

(a) **First**, 100% to the Limited Partners until they have received a cumulative ${waterfall.preferredReturn}% per annum preferred return on their Unreturned Capital Contributions;

(b) **Second**, 100% to the Limited Partners until they have received a return of their Capital Contributions;

`;

  if (waterfall.catchUpProvision) {
    clause += `(c) **Third**, 100% to the General Partner until the General Partner has received ${waterfall.tier1Split?.gp || 20}% of all amounts distributed pursuant to subsections (a) and (b) above (the "GP Catch-Up");

`;
  }

  clause += `(${waterfall.catchUpProvision ? 'd' : 'c'}) **${waterfall.catchUpProvision ? 'Fourth' : 'Third'}**, ${waterfall.tier1Split?.lp || 80}% to the Limited Partners and ${waterfall.tier1Split?.gp || 20}% to the General Partner until the Limited Partners have achieved a ${waterfall.tier1Hurdle || 12}% Internal Rate of Return;

`;

  if (waterfall.tier2Hurdle) {
    clause += `(${waterfall.catchUpProvision ? 'e' : 'd'}) **${waterfall.catchUpProvision ? 'Fifth' : 'Fourth'}**, ${waterfall.tier2Split?.lp || 70}% to the Limited Partners and ${waterfall.tier2Split?.gp || 30}% to the General Partner until the Limited Partners have achieved a ${waterfall.tier2Hurdle}% Internal Rate of Return;

`;
  }

  if (waterfall.tier3Hurdle) {
    clause += `(${waterfall.catchUpProvision ? 'f' : 'e'}) **${waterfall.catchUpProvision ? 'Sixth' : 'Fifth'}**, ${waterfall.tier3Split?.lp || 50}% to the Limited Partners and ${waterfall.tier3Split?.gp || 50}% to the General Partner thereafter (the "Home Run Split").
`;
  } else {
    clause += `Thereafter, all remaining distributions shall be made ${waterfall.tier2Split?.lp || waterfall.tier1Split?.lp || 70}% to Limited Partners and ${waterfall.tier2Split?.gp || waterfall.tier1Split?.gp || 30}% to General Partner.
`;
  }

  return clause;
}

// ============================================================================
// REGISTER STRUCTURING SKILLS
// ============================================================================

export function registerStructuringSkills(): void {
  skillRegistry.register(analyzeDealStructure);
  skillRegistry.register(getStructuringRecommendations);
  skillRegistry.register(draftContractClause);

  logger.info('Registered 3 structuring skills');
}
