/**
 * M26/M27 ProForma Enhancer
 * Enriches financial model assumptions with M26 tax and M27 comp data
 */

import { m26m27Integration } from './module-wiring/m26-m27-integration';
import { logger } from '../utils/logger';
import type { ProFormaAssumptions } from './financial-model-engine.service';

export interface M26M27EnhancedAssumptions extends ProFormaAssumptions {
  _m26_tax_enriched?: boolean;
  _m27_comps_enriched?: boolean;
  _enhancement_metadata?: {
    tax_source: 'M26' | 'default';
    exit_cap_source: 'M27_transaction_derived' | 'M27_default' | 'assumptions';
    m26_delta_pct?: number;
    m27_comp_count?: number;
  };
}

export class M26M27ProFormaEnhancer {
  /**
   * Enrich ProForma assumptions with M26 tax and M27 comp data
   * 
   * M26 Enhancement:
   * - Replaces expenses.property_tax with projected post-acquisition tax
   * - Uses 10-year projection for multi-year OpEx
   * 
   * M27 Enhancement:
   * - Replaces disposition.exitCapRate with transaction-derived cap rate
   * - Falls back to median or original assumption if no comp data
   */
  async enhanceAssumptions(
    dealId: string,
    baseAssumptions: ProFormaAssumptions
  ): Promise<M26M27EnhancedAssumptions> {
    const enhanced: M26M27EnhancedAssumptions = { ...baseAssumptions };
    const metadata: any = {
      tax_source: 'default',
      exit_cap_source: 'assumptions'
    };

    // M26: Tax Enhancement
    try {
      const taxData = await m26m27Integration.getTaxForProForma(dealId);
      
      if (taxData) {
        // Replace property tax in expenses
        if (!enhanced.expenses) {
          enhanced.expenses = {};
        }
        
        enhanced.expenses.property_tax = {
          amount: taxData.projected_total_tax,
          type: 'fixed',
          growthRate: 0.02 // 2% annual growth (conservative estimate)
        };
        
        enhanced._m26_tax_enriched = true;
        metadata.tax_source = 'M26';
        metadata.m26_delta_pct = taxData.delta_pct;
        
        logger.info(`M26→M09: Tax enriched for deal ${dealId}`, {
          projected_tax: taxData.projected_total_tax,
          tax_per_unit: taxData.projected_tax_per_unit,
          delta_pct: taxData.delta_pct
        });
        
        // If delta > 30%, log warning (should trigger M14 risk flag)
        if (taxData.delta_pct && taxData.delta_pct > 30) {
          logger.warn(`M26→M09: High tax increase detected (${taxData.delta_pct.toFixed(1)}%) for deal ${dealId}`);
        }
      } else {
        logger.warn(`M26→M09: No tax projection for deal ${dealId}, using assumption`);
      }
    } catch (error) {
      logger.error('M26→M09: Tax enrichment error:', error);
    }

    // M27: Exit Cap Rate Enhancement
    try {
      const compData = await m26m27Integration.getCompsForProForma(dealId);
      
      if (compData && compData.median_implied_cap_rate) {
        // Replace exit cap rate in disposition
        if (!enhanced.disposition) {
          enhanced.disposition = {
            exitCapRate: compData.median_implied_cap_rate,
            sellingCosts: baseAssumptions.disposition?.sellingCosts || 0.02,
            saleNOIMethod: baseAssumptions.disposition?.saleNOIMethod || 'year_10'
          };
        } else {
          enhanced.disposition.exitCapRate = compData.median_implied_cap_rate;
        }
        
        enhanced._m27_comps_enriched = true;
        metadata.exit_cap_source = 'M27_transaction_derived';
        metadata.m27_comp_count = compData.comp_count;
        
        logger.info(`M27→M09: Exit cap rate enriched for deal ${dealId}`, {
          exit_cap_rate: compData.median_implied_cap_rate,
          comp_count: compData.comp_count,
          median_price_per_unit: compData.median_price_per_unit
        });
        
        // Log if cap rate is significantly different from assumption
        if (baseAssumptions.disposition?.exitCapRate) {
          const delta = (compData.median_implied_cap_rate - baseAssumptions.disposition.exitCapRate) * 100;
          if (Math.abs(delta) > 0.5) {
            logger.info(`M27→M09: Cap rate delta ${delta.toFixed(1)}bps from assumption`);
          }
        }
      } else {
        logger.warn(`M27→M09: No comp-derived cap rate for deal ${dealId}, using assumption`);
        metadata.exit_cap_source = 'M27_default';
      }
    } catch (error) {
      logger.error('M27→M09: Comp enrichment error:', error);
    }

    enhanced._enhancement_metadata = metadata;
    
    return enhanced;
  }

  /**
   * Get enhancement summary for display
   */
  getEnhancementSummary(enhanced: M26M27EnhancedAssumptions): string {
    const lines: string[] = [];
    
    if (enhanced._m26_tax_enriched) {
      const taxAmount = enhanced.expenses?.property_tax?.amount || 0;
      lines.push(`✅ M26 Tax: $${taxAmount.toLocaleString()} projected (post-acquisition)`);
    } else {
      lines.push(`⚠️  M26 Tax: Using default assumption (no projection available)`);
    }
    
    if (enhanced._m27_comps_enriched) {
      const exitCap = enhanced.disposition?.exitCapRate || 0;
      const compCount = enhanced._enhancement_metadata?.m27_comp_count || 0;
      lines.push(`✅ M27 Exit Cap: ${(exitCap * 100).toFixed(2)}% (${compCount} comps, transaction-derived)`);
    } else {
      lines.push(`⚠️  M27 Exit Cap: Using default assumption (no comp data)`);
    }
    
    return lines.join('\n');
  }
}

export const m26m27ProFormaEnhancer = new M26M27ProFormaEnhancer();
