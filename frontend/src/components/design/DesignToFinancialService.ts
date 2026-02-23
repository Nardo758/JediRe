import { Design3D } from './Design3D';

interface FinancialInputs {
  totalUnits: number;
  totalSqFt: number;
  floors: number;
  parkingSpaces: number;
  unitMix: Record<string, number>;
  buildingType: string;
}

interface ProFormaResult {
  hardCosts: number;
  totalDevelopmentCost: number;
  netOperatingIncome: number;
  yieldOnCost: number;
  costPerUnit: number;
}

class DesignToFinancialService {
  async exportDesignData(design3D: Design3D): Promise<FinancialInputs> {
    const config = design3D?.getConfig?.() || {};
    return {
      totalUnits: config.totalUnits || 0,
      totalSqFt: config.totalSqFt || 0,
      floors: config.floors || 0,
      parkingSpaces: config.parkingSpaces || 0,
      unitMix: config.unitMix || {},
      buildingType: config.buildingType || 'multifamily',
    };
  }

  calculateProForma(inputs: FinancialInputs): ProFormaResult {
    const costPerSqFt = 200;
    const hardCosts = inputs.totalSqFt * costPerSqFt;
    const softCostMultiplier = 1.3;
    const totalDevelopmentCost = hardCosts * softCostMultiplier;
    const avgRentPerUnit = 1500;
    const grossRevenue = inputs.totalUnits * avgRentPerUnit * 12;
    const operatingExpenseRatio = 0.4;
    const netOperatingIncome = grossRevenue * (1 - operatingExpenseRatio);
    const yieldOnCost = totalDevelopmentCost > 0 ? (netOperatingIncome / totalDevelopmentCost) * 100 : 0;
    const costPerUnit = inputs.totalUnits > 0 ? totalDevelopmentCost / inputs.totalUnits : 0;

    return {
      hardCosts,
      totalDevelopmentCost,
      netOperatingIncome,
      yieldOnCost,
      costPerUnit,
    };
  }
}

export default DesignToFinancialService;
