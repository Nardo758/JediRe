export class MarketIntelligence {
  async getMarketRents(location: { lat: number; lng: number }) {
    return {
      studio: 1200,
      oneBed: 1500,
      twoBed: 2000,
      threeBed: 2500,
    };
  }

  async getCapRate(propertyType: string, location: { lat: number; lng: number }) {
    const defaultRates: Record<string, number> = {
      multifamily: 0.055,
      office: 0.065,
      retail: 0.06,
      industrial: 0.055,
    };
    return defaultRates[propertyType] || 0.06;
  }

  async getConstructionCosts(location: { lat: number; lng: number }) {
    return {
      hardCostPerSF: 200,
      softCostPercent: 0.25,
      landCostPerSF: 50,
    };
  }

  async getVacancyRate(propertyType: string, location: { lat: number; lng: number }) {
    return 0.05;
  }

  async getExpenseRatio(propertyType: string) {
    return 0.35;
  }
}
