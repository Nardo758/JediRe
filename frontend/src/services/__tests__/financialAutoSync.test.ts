/**
 * Financial Auto-Sync Service Tests
 */

import { financialAutoSync, FinancialAutoSyncService } from '../financialAutoSync.service';
import { generateProForma } from '../proFormaGenerator';
import type { Design3D, FinancialAssumptions } from '../../types/financial.types';

// Mock 3D Design
const mockDesign3D: Design3D = {
  id: 'design-test-123',
  dealId: 'deal-test-456',
  totalUnits: 287,
  unitMix: {
    studio: 43,
    oneBed: 130,
    twoBed: 86,
    threeBed: 28,
  },
  rentableSF: 175000,
  grossSF: 213415,
  efficiency: 0.82,
  parkingSpaces: 315,
  parkingType: 'structured',
  amenitySF: 15000,
  stories: 8,
  farUtilized: 4.2,
  farMax: 5.0,
  lastModified: new Date().toISOString(),
};

// Mock Financial Assumptions
const mockAssumptions: FinancialAssumptions = {
  landCost: 8500000,
  marketRents: {
    studio: 1450,
    oneBed: 1850,
    twoBed: 2450,
    threeBed: 3250,
  },
  constructionCosts: {
    residentialPerSF: 300,
    parkingSurface: 5000,
    parkingStructured: 15000,
    parkingUnderground: 25000,
    amenityPerSF: 150,
    siteWork: 2300000,
    contingency: 0.05,
  },
  softCosts: {
    architectureEngineering: 0.05,
    legalPermitting: 0.03,
    financing: 0.03,
    marketing: 500,
    developerFee: 0.05,
  },
  operating: {
    vacancyRate: 0.05,
    managementFee: 0.03,
    operatingExpensesPerUnit: 4000,
    propertyTaxRate: 0.012,
    insurancePerUnit: 500,
    utilitiesPerUnit: 600,
    repairsMaintenancePerUnit: 800,
    payrollPerUnit: 500,
  },
  debt: {
    loanToValue: 0.65,
    interestRate: 0.0825,
    loanTerm: 10,
    amortization: 30,
    constructionLoanRate: 0.085,
    constructionPeriod: 24,
  },
  exitCapRate: 0.055,
  holdPeriod: 5,
  rentGrowth: 0.03,
  expenseGrowth: 0.025,
  leaseUpMonths: 18,
};

describe('FinancialAutoSyncService', () => {
  let service: FinancialAutoSyncService;

  beforeEach(() => {
    service = new FinancialAutoSyncService();
  });

  afterEach(() => {
    service.cleanup(mockDesign3D.id);
  });

  describe('watchDesign3D', () => {
    it('should register a callback and trigger calculation', (done) => {
      const callback = jest.fn((design, proForma) => {
        expect(design).toEqual(mockDesign3D);
        expect(proForma).toBeDefined();
        expect(proForma.developmentBudget.totalDevelopmentCost).toBeGreaterThan(0);
        done();
      });

      service.watchDesign3D(mockDesign3D.id, mockAssumptions, callback);
      service.onDesignChange(mockDesign3D);
    });

    it('should return unwatch function that removes callback', () => {
      const callback = jest.fn();
      const unwatch = service.watchDesign3D(mockDesign3D.id, mockAssumptions, callback);

      unwatch();
      service.onDesignChange(mockDesign3D);

      // Wait for debounce
      setTimeout(() => {
        expect(callback).not.toHaveBeenCalled();
      }, 600);
    });
  });

  describe('onDesignChange', () => {
    it('should debounce rapid changes', (done) => {
      const callback = jest.fn();
      service.watchDesign3D(mockDesign3D.id, mockAssumptions, callback);

      // Trigger multiple rapid changes
      service.onDesignChange(mockDesign3D);
      service.onDesignChange(mockDesign3D);
      service.onDesignChange(mockDesign3D);

      // Should only call callback once after debounce
      setTimeout(() => {
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      }, 600);
    });

    it('should set isCalculating state during calculation', () => {
      service.watchDesign3D(mockDesign3D.id, mockAssumptions, jest.fn());
      service.onDesignChange(mockDesign3D);

      const syncState = service.getSyncState(mockDesign3D.id);
      expect(syncState?.isCalculating).toBe(true);
    });
  });

  describe('recalculate', () => {
    it('should calculate immediately without debounce', (done) => {
      const callback = jest.fn((design, proForma) => {
        expect(proForma).toBeDefined();
        done();
      });

      service.watchDesign3D(mockDesign3D.id, mockAssumptions, callback);
      service.recalculate(mockDesign3D);
    });
  });

  describe('updateAssumptions', () => {
    it('should update assumptions and trigger recalculation', (done) => {
      let callCount = 0;
      const callback = jest.fn((design, proForma) => {
        callCount++;
        if (callCount === 2) {
          // Second call after assumption update
          expect(proForma.assumptions.marketRents.oneBed).toBe(2000);
          done();
        }
      });

      service.watchDesign3D(mockDesign3D.id, mockAssumptions, callback);
      service.onDesignChange(mockDesign3D);

      setTimeout(() => {
        const newAssumptions = {
          ...mockAssumptions,
          marketRents: {
            ...mockAssumptions.marketRents,
            oneBed: 2000,
          },
        };
        service.updateAssumptions(mockDesign3D.id, newAssumptions);
      }, 600);
    });
  });

  describe('calculateUnitMixImpact', () => {
    it('should calculate impact of adding units', () => {
      const impact = service.calculateUnitMixImpact(
        mockDesign3D,
        mockAssumptions,
        { oneBed: mockDesign3D.unitMix.oneBed + 10 }
      );

      expect(impact.revenueImpact).toBeGreaterThan(0);
      expect(impact.costImpact).toBeGreaterThan(0);
      expect(impact.noiImpact).toBeGreaterThan(0);
    });

    it('should calculate impact of removing units', () => {
      const impact = service.calculateUnitMixImpact(
        mockDesign3D,
        mockAssumptions,
        { studio: mockDesign3D.unitMix.studio - 5 }
      );

      expect(impact.revenueImpact).toBeLessThan(0);
      expect(impact.costImpact).toBeLessThan(0);
      expect(impact.noiImpact).toBeLessThan(0);
    });
  });

  describe('getSyncState', () => {
    it('should return null for unwatched design', () => {
      const state = service.getSyncState('non-existent-design');
      expect(state).toBeNull();
    });

    it('should return sync state for watched design', () => {
      service.watchDesign3D(mockDesign3D.id, mockAssumptions, jest.fn());
      const state = service.getSyncState(mockDesign3D.id);

      expect(state).toBeDefined();
      expect(state?.isCalculating).toBe(false);
      expect(state?.pendingChanges).toEqual([]);
      expect(state?.errors).toEqual([]);
    });
  });

  describe('getLastProForma', () => {
    it('should return null before any calculation', () => {
      const proForma = service.getLastProForma(mockDesign3D.id);
      expect(proForma).toBeNull();
    });

    it('should return last calculated pro forma', (done) => {
      service.watchDesign3D(mockDesign3D.id, mockAssumptions, () => {
        const proForma = service.getLastProForma(mockDesign3D.id);
        expect(proForma).toBeDefined();
        expect(proForma?.design3D).toEqual(mockDesign3D);
        done();
      });

      service.onDesignChange(mockDesign3D);
    });
  });

  describe('error handling', () => {
    it('should call error callback on calculation failure', (done) => {
      const errorCallback = jest.fn((error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('assumptions');
        done();
      });

      // Don't set assumptions - should fail
      service.watchDesign3D(mockDesign3D.id, mockAssumptions, jest.fn(), errorCallback);
      
      // Force error by clearing assumptions
      (service as any).assumptions.delete(mockDesign3D.id);
      service.recalculate(mockDesign3D);
    });

    it('should update sync state with errors', (done) => {
      service.watchDesign3D(mockDesign3D.id, mockAssumptions, jest.fn());
      
      // Force error
      (service as any).assumptions.delete(mockDesign3D.id);
      service.recalculate(mockDesign3D);

      setTimeout(() => {
        const state = service.getSyncState(mockDesign3D.id);
        expect(state?.errors.length).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe('cleanup', () => {
    it('should remove all watchers and state', () => {
      service.watchDesign3D(mockDesign3D.id, mockAssumptions, jest.fn());
      service.onDesignChange(mockDesign3D);

      service.cleanup(mockDesign3D.id);

      expect(service.getSyncState(mockDesign3D.id)).toBeNull();
      expect(service.getLastProForma(mockDesign3D.id)).toBeNull();
    });
  });
});

describe('Integration Tests', () => {
  it('should generate complete pro forma from 3D design', () => {
    const proForma = generateProForma(mockDesign3D, mockAssumptions, mockDesign3D.dealId);

    // Check structure
    expect(proForma.id).toBeDefined();
    expect(proForma.dealId).toBe(mockDesign3D.dealId);
    expect(proForma.design3D).toEqual(mockDesign3D);
    expect(proForma.assumptions).toEqual(mockAssumptions);

    // Check development budget
    expect(proForma.developmentBudget.totalDevelopmentCost).toBeGreaterThan(0);
    expect(proForma.developmentBudget.landAcquisition).toBe(8500000);
    expect(proForma.developmentBudget.costPerUnit).toBeGreaterThan(0);

    // Check operating pro forma
    expect(proForma.operatingProForma.stabilizedYear.cashFlow.netOperatingIncome).toBeGreaterThan(0);

    // Check returns
    expect(proForma.returns.leveredIRR).toBeGreaterThan(0);
    expect(proForma.returns.leveredIRR).toBeLessThan(1); // Should be reasonable
    expect(proForma.returns.leveredEquityMultiple).toBeGreaterThan(1);

    // Check sensitivity
    expect(proForma.sensitivity?.variables.length).toBeGreaterThan(0);
    expect(proForma.sensitivity?.mostSensitive).toBeDefined();
  });

  it('should handle design changes realistically', (done) => {
    const service = new FinancialAutoSyncService();
    let firstProForma: any = null;

    service.watchDesign3D(mockDesign3D.id, mockAssumptions, (design, proForma) => {
      if (!firstProForma) {
        firstProForma = proForma;

        // Change design - add 10 units
        const modifiedDesign = {
          ...mockDesign3D,
          totalUnits: mockDesign3D.totalUnits + 10,
          unitMix: {
            ...mockDesign3D.unitMix,
            oneBed: mockDesign3D.unitMix.oneBed + 10,
          },
        };

        service.onDesignChange(modifiedDesign);
      } else {
        // Second callback after design change
        expect(proForma.design3D.totalUnits).toBe(mockDesign3D.totalUnits + 10);
        expect(proForma.developmentBudget.totalDevelopmentCost).toBeGreaterThan(
          firstProForma.developmentBudget.totalDevelopmentCost
        );
        expect(proForma.operatingProForma.stabilizedYear.cashFlow.netOperatingIncome).toBeGreaterThan(
          firstProForma.operatingProForma.stabilizedYear.cashFlow.netOperatingIncome
        );

        service.cleanup(mockDesign3D.id);
        done();
      }
    });

    service.onDesignChange(mockDesign3D);
  });
});

describe('Performance Tests', () => {
  it('should calculate pro forma in reasonable time', () => {
    const start = Date.now();
    const proForma = generateProForma(mockDesign3D, mockAssumptions, mockDesign3D.dealId);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100); // Should complete in <100ms
    expect(proForma).toBeDefined();
  });

  it('should handle multiple concurrent calculations', async () => {
    const service = new FinancialAutoSyncService();
    const designs = Array.from({ length: 10 }, (_, i) => ({
      ...mockDesign3D,
      id: `design-${i}`,
      dealId: `deal-${i}`,
    }));

    const promises = designs.map(
      (design) =>
        new Promise((resolve) => {
          service.watchDesign3D(design.id, mockAssumptions, (d, proForma) => {
            resolve(proForma);
          });
          service.recalculate(design);
        })
    );

    const start = Date.now();
    const results = await Promise.all(promises);
    const elapsed = Date.now() - start;

    expect(results.length).toBe(10);
    expect(elapsed).toBeLessThan(500); // All should complete in <500ms

    designs.forEach((design) => service.cleanup(design.id));
  });
});
