export interface FinancialInputs {
  totalUnits: number;
  totalSqFt: number;
  floors: number;
  parkingSpaces: number;
  unitMix: Record<string, number>;
  buildingType: string;
  landCost?: number;
  constructionCostPerSqFt?: number;
}

export interface ProForma {
  hardCosts: number;
  softCosts: number;
  totalDevelopmentCost: number;
  grossRevenue: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  yieldOnCost: number;
  costPerUnit: number;
  capRate: number;
  irr: number;
  equityMultiple: number;
}

class DesignToFinancialService {
  async exportDesignData(design3D: any): Promise<FinancialInputs> {
    const config = design3D?.getConfig?.() || {};
    return {
      totalUnits: config.totalUnits || 0,
      totalSqFt: config.totalSqFt || 0,
      floors: config.floors || 0,
      parkingSpaces: config.parkingSpaces || 0,
      unitMix: config.unitMix || {},
      buildingType: config.buildingType || 'multifamily',
      landCost: config.landCost || 0,
      constructionCostPerSqFt: config.constructionCostPerSqFt || 200,
    };
  }

  calculateProForma(inputs: FinancialInputs): ProForma {
    const costPerSqFt = inputs.constructionCostPerSqFt || 200;
    const hardCosts = inputs.totalSqFt * costPerSqFt;
    const softCosts = hardCosts * 0.25;
    const landCost = inputs.landCost || 0;
    const totalDevelopmentCost = hardCosts + softCosts + landCost;
    const avgRentPerUnit = 1500;
    const grossRevenue = inputs.totalUnits * avgRentPerUnit * 12;
    const operatingExpenseRatio = 0.4;
    const operatingExpenses = grossRevenue * operatingExpenseRatio;
    const netOperatingIncome = grossRevenue - operatingExpenses;
    const yieldOnCost = totalDevelopmentCost > 0 ? (netOperatingIncome / totalDevelopmentCost) * 100 : 0;
    const costPerUnit = inputs.totalUnits > 0 ? totalDevelopmentCost / inputs.totalUnits : 0;
    const capRate = 5.5;
    const irr = 15;
    const equityMultiple = 2.0;

    return {
      hardCosts,
      softCosts,
      totalDevelopmentCost,
      grossRevenue,
      operatingExpenses,
      netOperatingIncome,
      yieldOnCost,
      costPerUnit,
      capRate,
      irr,
      equityMultiple,
    };
  }
}

export default DesignToFinancialService;
