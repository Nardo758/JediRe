import type { Design3D } from '../types/financial.types';
import { MarketIntelligence } from './MarketIntelligence';

export interface FinancialInputs {
  // Building Metrics
  totalUnits: number;
  totalSquareFeet: number;
  parkingSpaces: number;
  stories: number;
  efficiency: number;
  
  // Unit Mix
  unitMix: {
    type: string;
    count: number;
    avgSF: number;
    avgRent: number;
  }[];
  
  // Development Costs
  hardCostPerSF: number;
  parkingCostPerSpace: number;
  landCost: number;
  softCostPercent: number;
  
  // Market Data
  market: string;
  submarket?: string;
  avgRentPerSF: number;
  occupancyRate: number;
  
  // Timing
  constructionMonths: number;
  leaseUpMonths: number;
  
  // Source
  sourceDesignId?: string;
  importedAt?: Date;
}

export interface ProForma {
  // Revenue
  grossPotentialRent: number;
  effectiveGrossIncome: number;
  otherIncome: number;
  totalRevenue: number;
  
  // Operating Expenses
  operatingExpenses: number;
  netOperatingIncome: number;
  
  // Development Costs
  hardCosts: number;
  softCosts: number;
  landCost: number;
  totalDevelopmentCost: number;
  
  // Returns
  yieldOnCost: number;
  capRate: number;
  irr?: number;
  profitMargin: number;
  
  // Per Unit Metrics
  costPerUnit: number;
  revenuePerUnit: number;
  noiPerUnit: number;
}

export interface DesignComparison {
  current: {
    units: number;
    sf: number;
    parking: number;
    efficiency: number;
    estimatedCost: number;
    estimatedNOI: number;
  };
  target: {
    minUnits?: number;
    maxCostPerUnit?: number;
    minYieldOnCost?: number;
    maxCostPerSF?: number;
  };
  recommendations: {
    type: 'increase' | 'decrease' | 'optimize';
    metric: string;
    currentValue: number;
    suggestedValue: number;
    impact: string;
  }[];
}

export class DesignToFinancialService {
  private marketIntelligence: MarketIntelligence;
  
  constructor() {
    this.marketIntelligence = new MarketIntelligence();
  }
  
  /**
   * Extract financial inputs from 3D design
   */
  async exportDesignData(design3D: Design3D): Promise<FinancialInputs> {
    const assumptions = await this.getMarketAssumptions('default');

    const unitMix = [
      { type: 'studio', count: design3D.unitMix.studio, avgSF: 500, avgRent: 1200 },
      { type: 'oneBed', count: design3D.unitMix.oneBed, avgSF: 700, avgRent: 1500 },
      { type: 'twoBed', count: design3D.unitMix.twoBed, avgSF: 1000, avgRent: 2000 },
      { type: 'threeBed', count: design3D.unitMix.threeBed, avgSF: 1300, avgRent: 2500 },
    ].filter(u => u.count > 0);

    return {
      totalUnits: design3D.totalUnits,
      totalSquareFeet: design3D.grossSF,
      parkingSpaces: design3D.parkingSpaces,
      stories: design3D.stories,
      efficiency: design3D.efficiency || 0.85,
      unitMix,
      hardCostPerSF: assumptions.hardCostPerSF,
      parkingCostPerSpace: assumptions.parkingCostPerSpace,
      landCost: 0,
      softCostPercent: assumptions.softCostPercent,
      market: 'default',
      submarket: '',
      avgRentPerSF: 2.0,
      occupancyRate: 0.95,
      constructionMonths: this.estimateConstructionTime(design3D.stories, design3D.grossSF),
      leaseUpMonths: 6,
      sourceDesignId: design3D.id,
      importedAt: new Date()
    };
  }
  
  /**
   * Generate pro forma from design data
   */
  async generateProFormaFromDesign(design3D: Design3D): Promise<ProForma> {
    const inputs = await this.exportDesignData(design3D);
    return this.calculateProForma(inputs);
  }
  
  /**
   * Calculate pro forma from financial inputs
   */
  calculateProForma(inputs: FinancialInputs): ProForma {
    // Revenue Calculations
    const grossPotentialRent = inputs.unitMix.reduce(
      (total, unit) => total + (unit.count * unit.avgRent * 12),
      0
    );
    
    const effectiveGrossIncome = grossPotentialRent * inputs.occupancyRate;
    const otherIncome = effectiveGrossIncome * 0.03; // 3% other income
    const totalRevenue = effectiveGrossIncome + otherIncome;
    
    // Operating Expenses (35% of EGI typical)
    const operatingExpenses = effectiveGrossIncome * 0.35;
    const netOperatingIncome = totalRevenue - operatingExpenses;
    
    // Development Costs
    const hardCosts = (inputs.totalSquareFeet * inputs.hardCostPerSF) + 
                     (inputs.parkingSpaces * inputs.parkingCostPerSpace);
    const softCosts = hardCosts * inputs.softCostPercent;
    const totalDevelopmentCost = hardCosts + softCosts + inputs.landCost;
    
    // Returns
    const yieldOnCost = (netOperatingIncome / totalDevelopmentCost) * 100;
    const capRate = 5.5; // Market cap rate
    const profitMargin = ((netOperatingIncome / capRate) - totalDevelopmentCost) / totalDevelopmentCost;
    
    // Per Unit Metrics
    const costPerUnit = totalDevelopmentCost / inputs.totalUnits;
    const revenuePerUnit = totalRevenue / inputs.totalUnits;
    const noiPerUnit = netOperatingIncome / inputs.totalUnits;
    
    return {
      // Revenue
      grossPotentialRent,
      effectiveGrossIncome,
      otherIncome,
      totalRevenue,
      
      // Operating
      operatingExpenses,
      netOperatingIncome,
      
      // Development Costs
      hardCosts,
      softCosts,
      landCost: inputs.landCost,
      totalDevelopmentCost,
      
      // Returns
      yieldOnCost,
      capRate,
      profitMargin: profitMargin * 100,
      
      // Per Unit
      costPerUnit,
      revenuePerUnit,
      noiPerUnit
    };
  }
  
  /**
   * Compare design to financial targets
   */
  async compareDesignToTargets(
    design3D: Design3D, 
    targets: DesignComparison['target']
  ): Promise<DesignComparison> {
    const inputs = await this.exportDesignData(design3D);
    const proForma = this.calculateProForma(inputs);
    
    const current = {
      units: design3D.totalUnits,
      sf: design3D.grossSF,
      parking: design3D.parkingSpaces,
      efficiency: design3D.efficiency || 0.85,
      estimatedCost: proForma.totalDevelopmentCost,
      estimatedNOI: proForma.netOperatingIncome
    };
    
    const recommendations: DesignComparison['recommendations'] = [];
    
    // Check unit count
    if (targets.minUnits && current.units < targets.minUnits) {
      recommendations.push({
        type: 'increase',
        metric: 'Total Units',
        currentValue: current.units,
        suggestedValue: targets.minUnits,
        impact: `Would increase revenue by ~$${((targets.minUnits - current.units) * proForma.revenuePerUnit).toLocaleString()}/year`
      });
    }
    
    // Check cost per unit
    if (targets.maxCostPerUnit && proForma.costPerUnit > targets.maxCostPerUnit) {
      const reductionNeeded = proForma.costPerUnit - targets.maxCostPerUnit;
      const percentReduction = (reductionNeeded / proForma.costPerUnit) * 100;
      
      recommendations.push({
        type: 'decrease',
        metric: 'Cost per Unit',
        currentValue: proForma.costPerUnit,
        suggestedValue: targets.maxCostPerUnit,
        impact: `Reduce costs by ${percentReduction.toFixed(1)}% through value engineering or unit mix optimization`
      });
    }
    
    // Check yield on cost
    if (targets.minYieldOnCost && proForma.yieldOnCost < targets.minYieldOnCost) {
      const noiNeeded = (targets.minYieldOnCost / 100) * proForma.totalDevelopmentCost;
      const additionalNOI = noiNeeded - proForma.netOperatingIncome;
      
      recommendations.push({
        type: 'optimize',
        metric: 'Yield on Cost',
        currentValue: proForma.yieldOnCost,
        suggestedValue: targets.minYieldOnCost,
        impact: `Need $${additionalNOI.toLocaleString()} more NOI - add units or increase rents`
      });
    }
    
    // Check cost per SF
    if (targets.maxCostPerSF && (proForma.hardCosts / current.sf) > targets.maxCostPerSF) {
      recommendations.push({
        type: 'decrease',
        metric: 'Hard Cost per SF',
        currentValue: proForma.hardCosts / current.sf,
        suggestedValue: targets.maxCostPerSF,
        impact: 'Consider simpler materials or more efficient layout'
      });
    }
    
    return {
      current,
      target: targets,
      recommendations
    };
  }
  
  /**
   * Get market-specific assumptions
   */
  private async getMarketAssumptions(market: string): Promise<{
    hardCostPerSF: number;
    parkingCostPerSpace: number;
    landCostPerSF: number;
    softCostPercent: number;
  }> {
    // In production, this would query the database
    // For now, return market-based defaults
    const marketAssumptions = {
      'Seattle': {
        hardCostPerSF: 250,
        parkingCostPerSpace: 50000,
        landCostPerSF: 150,
        softCostPercent: 0.25
      },
      'Portland': {
        hardCostPerSF: 220,
        parkingCostPerSpace: 35000,
        landCostPerSF: 100,
        softCostPercent: 0.22
      },
      'Denver': {
        hardCostPerSF: 200,
        parkingCostPerSpace: 30000,
        landCostPerSF: 80,
        softCostPercent: 0.20
      },
      'default': {
        hardCostPerSF: 180,
        parkingCostPerSpace: 25000,
        landCostPerSF: 60,
        softCostPercent: 0.20
      }
    };
    
    return marketAssumptions[market] || marketAssumptions.default;
  }
  
  /**
   * Estimate construction time based on building size
   */
  private estimateConstructionTime(stories: number, totalSF: number): number {
    // Base time + additional time per story + size factor
    const baseMonths = 12;
    const monthsPerStory = 1.5;
    const sizeFactor = Math.log10(totalSF / 10000) * 2;
    
    return Math.round(baseMonths + (stories * monthsPerStory) + sizeFactor);
  }
  
  /**
   * Store design-financial link for navigation
   */
  async linkDesignToFinancial(designId: string, financialId: string): Promise<void> {
    // In production, this would update the database
    // Store the relationship for bi-directional navigation
    localStorage.setItem(`design-financial-${designId}`, financialId);
    localStorage.setItem(`financial-design-${financialId}`, designId);
  }
  
  /**
   * Get linked financial model from design
   */
  async getLinkedFinancialId(designId: string): Promise<string | null> {
    return localStorage.getItem(`design-financial-${designId}`);
  }
  
  /**
   * Get source design from financial model
   */
  async getSourceDesignId(financialId: string): Promise<string | null> {
    return localStorage.getItem(`financial-design-${financialId}`);
  }
}

export default DesignToFinancialService;