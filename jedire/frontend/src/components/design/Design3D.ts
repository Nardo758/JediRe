export interface Design3DConfig {
  totalUnits?: number;
  totalSqFt?: number;
  floors?: number;
  parkingSpaces?: number;
  unitMix?: Record<string, number>;
  buildingType?: string;
  id?: string;
}

export class Design3D {
  private config: Design3DConfig;
  private id: string;

  constructor(config: Design3DConfig = {}) {
    this.config = config;
    this.id = config.id || `design-${Date.now()}`;
  }

  getConfig(): Design3DConfig {
    return this.config;
  }

  getId(): string {
    return this.id;
  }

  setConfig(config: Partial<Design3DConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
