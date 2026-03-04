/**
 * M26 Tax + M27 Sale Comps Integration
 * Wires M26 and M27 into existing data flow router
 */

import { taxProjectionService } from '../tax/taxProjection.service';
import { compSetService } from '../saleComps/compSet.service';
import { logger } from '../../utils/logger';

export interface M26TaxOutput {
  projected_total_tax: number;
  projected_tax_per_unit: number;
  effective_tax_rate: number;
  delta_amount: number | null;
  delta_pct: number | null;
  yearly_projections: Array<{
    year: number;
    annual_tax: number;
    tax_per_unit: number;
  }>;
}

export interface M27CompsOutput {
  median_price_per_unit: number;
  median_implied_cap_rate: number | null;
  comp_count: number;
  price_range: {
    min: number;
    max: number;
  };
}

export class M26M27Integration {
  /**
   * Get M26 tax data for ProForma (M09)
   * 
   * Data Flow: M26 → M09
   * Keys: projected_total_tax, projected_tax_per_unit, yearly_tax_projections
   * Strength: required (P0)
   */
  async getTaxForProForma(dealId: string): Promise<M26TaxOutput | null> {
    try {
      const projection = await taxProjectionService.getProjectionByDeal(dealId);
      
      if (!projection) {
        logger.warn(`M26→M09: No tax projection for deal ${dealId}`);
        return null;
      }

      return {
        projected_total_tax: projection.projected_total_tax,
        projected_tax_per_unit: projection.projected_tax_per_unit,
        effective_tax_rate: projection.effective_tax_rate,
        delta_amount: projection.delta_amount,
        delta_pct: projection.delta_pct,
        yearly_projections: projection.yearly_projections
      };
    } catch (error) {
      logger.error('M26→M09 integration error:', error);
      return null;
    }
  }

  /**
   * Get M27 comp data for ProForma (M09)
   * 
   * Data Flow: M27 → M09
   * Keys: exit_cap_rate, median_price_per_unit (for exit value assumptions)
   * Strength: required (P0)
   */
  async getCompsForProForma(dealId: string): Promise<M27CompsOutput | null> {
    try {
      const compSet = await compSetService.getCompSetByDeal(dealId);
      
      if (!compSet) {
        logger.warn(`M27→M09: No comp set for deal ${dealId}`);
        return null;
      }

      return {
        median_price_per_unit: compSet.median_price_per_unit,
        median_implied_cap_rate: compSet.median_implied_cap_rate,
        comp_count: compSet.comp_count,
        price_range: {
          min: compSet.min_price_per_unit,
          max: compSet.max_price_per_unit
        }
      };
    } catch (error) {
      logger.error('M27→M09 integration error:', error);
      return null;
    }
  }

  /**
   * Auto-trigger M26 tax projection when deal purchase price changes
   * 
   * Hook: Deal update → M26 projection
   */
  async triggerTaxProjectionOnPriceChange(
    dealId: string,
    purchasePrice: number,
    units: number,
    parcelId?: string,
    countyId?: string
  ): Promise<M26TaxOutput | null> {
    try {
      logger.info(`M26 auto-trigger: Deal ${dealId} price changed to $${purchasePrice}`);
      
      const projection = await taxProjectionService.calculateProjection({
        deal_id: dealId,
        purchase_price: purchasePrice,
        units,
        parcel_id: parcelId,
        county_id: countyId
      });

      logger.info(`M26 projection complete: Tax $${projection.projected_total_tax} ($${projection.projected_tax_per_unit}/unit)`);
      
      return {
        projected_total_tax: projection.projected_total_tax,
        projected_tax_per_unit: projection.projected_tax_per_unit,
        effective_tax_rate: projection.effective_tax_rate,
        delta_amount: projection.delta_amount,
        delta_pct: projection.delta_pct,
        yearly_projections: projection.yearly_projections
      };
    } catch (error) {
      logger.error('M26 auto-trigger error:', error);
      return null;
    }
  }

  /**
   * Auto-generate M27 comp set when deal location is set
   * 
   * Hook: Deal location set → M27 comp generation
   */
  async triggerCompSetOnLocationSet(dealId: string): Promise<M27CompsOutput | null> {
    try {
      logger.info(`M27 auto-trigger: Generating comp set for deal ${dealId}`);
      
      const compSet = await compSetService.generateCompSet({
        deal_id: dealId,
        radius_miles: 3.0,
        date_range_months: 24,
        min_units: 50,
        max_units: 500,
        exclude_distress: true,
        arms_length_only: true
      });

      logger.info(`M27 comp set complete: ${compSet.comp_count} comps, median $${compSet.median_price_per_unit}/unit`);
      
      return {
        median_price_per_unit: compSet.median_price_per_unit,
        median_implied_cap_rate: compSet.median_implied_cap_rate,
        comp_count: compSet.comp_count,
        price_range: {
          min: compSet.min_price_per_unit,
          max: compSet.max_price_per_unit
        }
      };
    } catch (error) {
      logger.error('M27 auto-trigger error:', error);
      return null;
    }
  }
}

export const m26m27Integration = new M26M27Integration();

/**
 * Add M26 and M27 to data flow connections
 * (To be merged into data-flow-router.ts DATA_FLOW_CONNECTIONS array)
 */
export const M26_M27_DATA_FLOWS = [
  // M26 Tax → M09 ProForma (P0)
  {
    from: 'M26' as const,
    to: 'M09' as const,
    dataKeys: ['projected_total_tax', 'projected_tax_per_unit', 'yearly_tax_projections'],
    strength: 'required' as const,
    description: 'Post-acquisition tax projection → ProForma OpEx line'
  },
  
  // M26 Tax → M08 Strategy (optional)
  {
    from: 'M26' as const,
    to: 'M08' as const,
    dataKeys: ['effective_tax_rate', 'delta_pct'],
    strength: 'optional' as const,
    description: 'Tax burden → strategy scoring'
  },
  
  // M26 Tax → M14 Risk (optional)
  {
    from: 'M26' as const,
    to: 'M14' as const,
    dataKeys: ['delta_pct', 'delinquency_status'],
    strength: 'optional' as const,
    description: 'Tax increase risk flag (>30% delta)'
  },
  
  // M27 Sale Comps → M09 ProForma (P0)
  {
    from: 'M27' as const,
    to: 'M09' as const,
    dataKeys: ['exit_cap_rate', 'median_price_per_unit'],
    strength: 'required' as const,
    description: 'Transaction-derived cap rate → ProForma exit assumptions'
  },
  
  // M27 Sale Comps → M05 Market (P0)
  {
    from: 'M27' as const,
    to: 'M05' as const,
    dataKeys: ['transaction_volume', 'median_price_per_unit', 'price_trend'],
    strength: 'required' as const,
    description: 'Transaction data enhances market metrics'
  },
  
  // M27 Sale Comps → M08 Strategy (P0)
  {
    from: 'M27' as const,
    to: 'M08' as const,
    dataKeys: ['transaction_velocity', 'buyer_rotation', 'holding_period_trend'],
    strength: 'required' as const,
    description: 'Transaction patterns as momentum signals'
  },
  
  // M27 Sale Comps → M14 Risk (optional)
  {
    from: 'M27' as const,
    to: 'M14' as const,
    dataKeys: ['cap_rate_expansion', 'distress_pct'],
    strength: 'optional' as const,
    description: 'Cap rate expansion + distress trend → risk flags'
  },
  
  // M27 Sale Comps → M15 Competition (optional)
  {
    from: 'M27' as const,
    to: 'M15' as const,
    dataKeys: ['comp_transactions', 'buyer_entities'],
    strength: 'optional' as const,
    description: 'Transaction-enhanced comp data'
  },
  
  // M27 Sale Comps → M12 Exit (optional)
  {
    from: 'M27' as const,
    to: 'M12' as const,
    dataKeys: ['holding_period_trend', 'transaction_velocity'],
    strength: 'optional' as const,
    description: 'Exit timing from transaction patterns'
  }
];
