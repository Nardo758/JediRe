import { Request, Response, Router } from 'express';
import { Pool } from 'pg';

interface MarketAssumptions {
  market: string;
  hardCostPerSF: number;
  softCostPercent: number;
  parkingCostPerSpace: number;
  landCostPerSF: number;
  operatingExpensePercent: number;
  vacancyRate: number;
  capRate: number;
  constructionInterestRate: number;
  updatedAt: Date;
}

interface CalculateFromDesignRequest {
  design: {
    totalUnits: number;
    totalSquareFeet: number;
    parkingSpaces: number;
    stories: number;
    efficiency: number;
    unitMix: Array<{
      type: string;
      count: number;
      avgSF: number;
    }>;
    location: {
      market: string;
      submarket?: string;
      address?: string;
    };
  };
  overrides?: Partial<MarketAssumptions>;
}

export class FinancialAssumptionsAPI {
  private pool: Pool;
  private router: Router;
  
  constructor(pool: Pool) {
    this.pool = pool;
    this.router = Router();
    this.setupRoutes();
  }
  
  private setupRoutes() {
    // Get market assumptions
    this.router.get('/api/v1/financial/assumptions', this.getMarketAssumptions.bind(this));
    
    // Update market assumptions
    this.router.put('/api/v1/financial/assumptions/:market', this.updateMarketAssumptions.bind(this));
    
    // Calculate pro forma from design
    this.router.post('/api/v1/financial/calculate-from-design', this.calculateFromDesign.bind(this));
    
    // Get all markets
    this.router.get('/api/v1/financial/markets', this.getAvailableMarkets.bind(this));
  }
  
  /**
   * GET /api/v1/financial/assumptions?market=Seattle
   */
  private async getMarketAssumptions(req: Request, res: Response) {
    try {
      const { market } = req.query;
      
      if (!market) {
        return res.status(400).json({ error: 'Market parameter is required' });
      }
      
      // Query database for market assumptions
      const result = await this.pool.query(
        `SELECT * FROM financial_assumptions WHERE market = $1`,
        [market]
      );
      
      if (result.rows.length === 0) {
        // Return default assumptions if market not found
        const defaults = this.getDefaultAssumptions(market as string);
        return res.json(defaults);
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching market assumptions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * PUT /api/v1/financial/assumptions/:market
   */
  private async updateMarketAssumptions(req: Request, res: Response) {
    try {
      const { market } = req.params;
      const updates = req.body;
      
      // Validate inputs
      if (!market) {
        return res.status(400).json({ error: 'Market is required' });
      }
      
      // Upsert market assumptions
      const result = await this.pool.query(
        `INSERT INTO financial_assumptions (
          market,
          hard_cost_per_sf,
          soft_cost_percent,
          parking_cost_per_space,
          land_cost_per_sf,
          operating_expense_percent,
          vacancy_rate,
          cap_rate,
          construction_interest_rate,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (market) 
        DO UPDATE SET
          hard_cost_per_sf = EXCLUDED.hard_cost_per_sf,
          soft_cost_percent = EXCLUDED.soft_cost_percent,
          parking_cost_per_space = EXCLUDED.parking_cost_per_space,
          land_cost_per_sf = EXCLUDED.land_cost_per_sf,
          operating_expense_percent = EXCLUDED.operating_expense_percent,
          vacancy_rate = EXCLUDED.vacancy_rate,
          cap_rate = EXCLUDED.cap_rate,
          construction_interest_rate = EXCLUDED.construction_interest_rate,
          updated_at = NOW()
        RETURNING *`,
        [
          market,
          updates.hardCostPerSF || 200,
          updates.softCostPercent || 0.25,
          updates.parkingCostPerSpace || 30000,
          updates.landCostPerSF || 100,
          updates.operatingExpensePercent || 0.35,
          updates.vacancyRate || 0.05,
          updates.capRate || 5.5,
          updates.constructionInterestRate || 0.065
        ]
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating market assumptions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * POST /api/v1/financial/calculate-from-design
   */
  private async calculateFromDesign(req: Request, res: Response) {
    try {
      const { design, overrides } = req.body as CalculateFromDesignRequest;
      
      // Validate design data
      if (!design || !design.location || !design.location.market) {
        return res.status(400).json({ error: 'Design data with market location is required' });
      }
      
      // Get market assumptions
      const assumptions = await this.getMarketAssumptionsData(design.location.market);
      
      // Apply any overrides
      const finalAssumptions = { ...assumptions, ...overrides };
      
      // Calculate financial metrics
      const proForma = this.calculateProForma(design, finalAssumptions);
      
      // Return calculated pro forma
      res.json({
        inputs: {
          design,
          assumptions: finalAssumptions
        },
        proForma,
        metrics: this.calculateKeyMetrics(proForma, design)
      });
    } catch (error) {
      console.error('Error calculating from design:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * GET /api/v1/financial/markets
   */
  private async getAvailableMarkets(req: Request, res: Response) {
    try {
      const result = await this.pool.query(
        `SELECT DISTINCT market, updated_at FROM financial_assumptions ORDER BY market`
      );
      
      // Include default markets even if not in database
      const defaultMarkets = ['Seattle', 'Portland', 'Denver', 'Phoenix', 'Austin'];
      const dbMarkets = result.rows.map(r => r.market);
      
      const allMarkets = [...new Set([...dbMarkets, ...defaultMarkets])].map(market => {
        const dbEntry = result.rows.find(r => r.market === market);
        return {
          market,
          hasCustomAssumptions: !!dbEntry,
          updatedAt: dbEntry?.updated_at || null
        };
      });
      
      res.json(allMarkets);
    } catch (error) {
      console.error('Error fetching markets:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * Get market assumptions from database or defaults
   */
  private async getMarketAssumptionsData(market: string): Promise<MarketAssumptions> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM financial_assumptions WHERE market = $1`,
        [market]
      );
      
      if (result.rows.length > 0) {
        return this.mapDbToAssumptions(result.rows[0]);
      }
    } catch (error) {
      console.error('Error fetching assumptions from DB:', error);
    }
    
    return this.getDefaultAssumptions(market);
  }
  
  /**
   * Map database row to assumptions object
   */
  private mapDbToAssumptions(dbRow: any): MarketAssumptions {
    return {
      market: dbRow.market,
      hardCostPerSF: dbRow.hard_cost_per_sf,
      softCostPercent: dbRow.soft_cost_percent,
      parkingCostPerSpace: dbRow.parking_cost_per_space,
      landCostPerSF: dbRow.land_cost_per_sf,
      operatingExpensePercent: dbRow.operating_expense_percent,
      vacancyRate: dbRow.vacancy_rate,
      capRate: dbRow.cap_rate,
      constructionInterestRate: dbRow.construction_interest_rate,
      updatedAt: dbRow.updated_at
    };
  }
  
  /**
   * Get default assumptions by market
   */
  private getDefaultAssumptions(market: string): MarketAssumptions {
    const defaults: Record<string, Omit<MarketAssumptions, 'market' | 'updatedAt'>> = {
      'Seattle': {
        hardCostPerSF: 250,
        softCostPercent: 0.25,
        parkingCostPerSpace: 50000,
        landCostPerSF: 150,
        operatingExpensePercent: 0.35,
        vacancyRate: 0.05,
        capRate: 5.0,
        constructionInterestRate: 0.065
      },
      'Portland': {
        hardCostPerSF: 220,
        softCostPercent: 0.22,
        parkingCostPerSpace: 35000,
        landCostPerSF: 100,
        operatingExpensePercent: 0.35,
        vacancyRate: 0.06,
        capRate: 5.5,
        constructionInterestRate: 0.065
      },
      'Denver': {
        hardCostPerSF: 200,
        softCostPercent: 0.20,
        parkingCostPerSpace: 30000,
        landCostPerSF: 80,
        operatingExpensePercent: 0.33,
        vacancyRate: 0.07,
        capRate: 5.75,
        constructionInterestRate: 0.06
      },
      'Phoenix': {
        hardCostPerSF: 180,
        softCostPercent: 0.20,
        parkingCostPerSpace: 25000,
        landCostPerSF: 60,
        operatingExpensePercent: 0.32,
        vacancyRate: 0.08,
        capRate: 6.0,
        constructionInterestRate: 0.06
      },
      'Austin': {
        hardCostPerSF: 190,
        softCostPercent: 0.22,
        parkingCostPerSpace: 30000,
        landCostPerSF: 90,
        operatingExpensePercent: 0.33,
        vacancyRate: 0.06,
        capRate: 5.5,
        constructionInterestRate: 0.065
      }
    };
    
    const marketDefaults = defaults[market] || {
      hardCostPerSF: 180,
      softCostPercent: 0.20,
      parkingCostPerSpace: 25000,
      landCostPerSF: 60,
      operatingExpensePercent: 0.35,
      vacancyRate: 0.07,
      capRate: 6.0,
      constructionInterestRate: 0.06
    };
    
    return {
      market,
      ...marketDefaults,
      updatedAt: new Date()
    };
  }
  
  /**
   * Calculate pro forma from design and assumptions
   */
  private calculateProForma(design: any, assumptions: MarketAssumptions): any {
    // Calculate development costs
    const hardCosts = (design.totalSquareFeet * assumptions.hardCostPerSF) + 
                     (design.parkingSpaces * assumptions.parkingCostPerSpace);
    const softCosts = hardCosts * assumptions.softCostPercent;
    const landCost = (design.totalSquareFeet / design.efficiency) * assumptions.landCostPerSF;
    const totalDevelopmentCost = hardCosts + softCosts + landCost;
    
    // Estimate rents (simplified - in production would use market intelligence)
    const avgRentPerUnit = this.estimateRentPerUnit(design, assumptions.market);
    const grossPotentialRent = design.totalUnits * avgRentPerUnit * 12;
    const effectiveGrossIncome = grossPotentialRent * (1 - assumptions.vacancyRate);
    const otherIncome = effectiveGrossIncome * 0.03; // 3% other income
    const totalRevenue = effectiveGrossIncome + otherIncome;
    
    // Operating expenses
    const operatingExpenses = effectiveGrossIncome * assumptions.operatingExpensePercent;
    const netOperatingIncome = totalRevenue - operatingExpenses;
    
    // Returns
    const yieldOnCost = (netOperatingIncome / totalDevelopmentCost) * 100;
    const estimatedValue = netOperatingIncome / (assumptions.capRate / 100);
    const profitMargin = ((estimatedValue - totalDevelopmentCost) / totalDevelopmentCost) * 100;
    
    return {
      // Revenue
      grossPotentialRent,
      effectiveGrossIncome,
      otherIncome,
      totalRevenue,
      
      // Expenses
      operatingExpenses,
      netOperatingIncome,
      
      // Development Costs
      hardCosts,
      softCosts,
      landCost,
      totalDevelopmentCost,
      
      // Returns
      yieldOnCost,
      capRate: assumptions.capRate,
      estimatedValue,
      profitMargin,
      
      // Per Unit
      costPerUnit: totalDevelopmentCost / design.totalUnits,
      revenuePerUnit: totalRevenue / design.totalUnits,
      noiPerUnit: netOperatingIncome / design.totalUnits
    };
  }
  
  /**
   * Calculate key metrics for summary
   */
  private calculateKeyMetrics(proForma: any, design: any): any {
    return {
      debtCoverageRatio: proForma.netOperatingIncome / (proForma.totalDevelopmentCost * 0.7 * 0.06),
      equityMultiple: proForma.estimatedValue / (proForma.totalDevelopmentCost * 0.3),
      cashOnCashReturn: (proForma.netOperatingIncome - (proForma.totalDevelopmentCost * 0.7 * 0.06)) / 
                       (proForma.totalDevelopmentCost * 0.3) * 100,
      breakEvenOccupancy: (proForma.operatingExpenses + (proForma.totalDevelopmentCost * 0.7 * 0.06)) / 
                         proForma.grossPotentialRent * 100
    };
  }
  
  /**
   * Estimate rent per unit based on market
   */
  private estimateRentPerUnit(design: any, market: string): number {
    // Simplified rent estimation - in production would use MarketIntelligence
    const marketRents: Record<string, number> = {
      'Seattle': 2800,
      'Portland': 2200,
      'Denver': 2000,
      'Phoenix': 1600,
      'Austin': 2100
    };
    
    const baseRent = marketRents[market] || 1800;
    const avgUnitSize = design.totalSquareFeet / design.totalUnits;
    
    // Adjust for unit size
    if (avgUnitSize < 600) return baseRent * 0.7; // Studio
    if (avgUnitSize < 800) return baseRent * 0.85; // 1BR
    if (avgUnitSize < 1100) return baseRent * 1.0; // 2BR
    return baseRent * 1.3; // 3BR+
  }
  
  getRouter(): Router {
    return this.router;
  }
}

// Database migration for financial_assumptions table
export const financialAssumptionsMigration = `
CREATE TABLE IF NOT EXISTS financial_assumptions (
  id SERIAL PRIMARY KEY,
  market VARCHAR(100) UNIQUE NOT NULL,
  hard_cost_per_sf DECIMAL(10,2) NOT NULL,
  soft_cost_percent DECIMAL(5,4) NOT NULL,
  parking_cost_per_space DECIMAL(10,2) NOT NULL,
  land_cost_per_sf DECIMAL(10,2) NOT NULL,
  operating_expense_percent DECIMAL(5,4) NOT NULL,
  vacancy_rate DECIMAL(5,4) NOT NULL,
  cap_rate DECIMAL(5,3) NOT NULL,
  construction_interest_rate DECIMAL(5,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on market for faster lookups
CREATE INDEX idx_financial_assumptions_market ON financial_assumptions(market);

-- Insert default market assumptions
INSERT INTO financial_assumptions (
  market, hard_cost_per_sf, soft_cost_percent, parking_cost_per_space,
  land_cost_per_sf, operating_expense_percent, vacancy_rate, cap_rate,
  construction_interest_rate
) VALUES 
  ('Seattle', 250, 0.25, 50000, 150, 0.35, 0.05, 5.0, 0.065),
  ('Portland', 220, 0.22, 35000, 100, 0.35, 0.06, 5.5, 0.065),
  ('Denver', 200, 0.20, 30000, 80, 0.33, 0.07, 5.75, 0.06),
  ('Phoenix', 180, 0.20, 25000, 60, 0.32, 0.08, 6.0, 0.06),
  ('Austin', 190, 0.22, 30000, 90, 0.33, 0.06, 5.5, 0.065)
ON CONFLICT (market) DO NOTHING;
`;

export default FinancialAssumptionsAPI;