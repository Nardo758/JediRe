/**
 * Deal Consistency Validation Tests
 * 
 * Tests cross-module data consistency validation
 */

import { validateDealConsistency } from '../services/deal-consistency-validator.service';
import { query } from '../database/connection';

jest.mock('../database/connection');

describe('Deal Consistency Validator', () => {
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Acreage Consistency', () => {
    it('should detect acres mismatch between database and description', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              id: 'deal-123',
              acres: 30.83, // WRONG
              description: 'New 300-unit development on 4.81-acre site',
              targetUnits: 300,
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'ACRES_MISMATCH',
          severity: 'critical',
          expected: 4.81,
          actual: 30.83,
        })
      );
    });

    it('should pass when acres match', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              id: 'deal-123',
              acres: 4.81,
              description: 'New 300-unit development on 4.81-acre site',
              targetUnits: 300,
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      const acresErrors = result.errors.filter(e => e.code === 'ACRES_MISMATCH');
      expect(acresErrors).toHaveLength(0);
    });
  });

  describe('Unit Mix Consistency', () => {
    it('should detect unit count mismatch across modules', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              id: 'deal-123',
              targetUnits: 300,
              acres: 4.81,
            }]
          };
        }
        if (sql.includes('building_designs_3d')) {
          return {
            rows: [{
              id: 'design-1',
              building_sections: JSON.stringify([
                { id: 'section-1', units: 280 } // MISMATCH!
              ]),
              stories: 5,
              far: 1.22,
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'UNIT_COUNT_MISMATCH',
          severity: 'critical',
        })
      );
    });

    it('should detect missing unit mix breakdown', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              id: 'deal-123',
              targetUnits: 300,
              acres: 4.81,
              module_outputs: {},
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'UNIT_MIX_MISSING',
          severity: 'warning',
        })
      );
    });

    it('should detect unit type count mismatches (Studios/1BR/2BR/3BR)', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              id: 'deal-123',
              targetUnits: 300,
              module_outputs: {
                unitMix: {
                  program: [
                    { unitType: 'Studio', count: 45 },
                    { unitType: '1BR', count: 135 },
                    { unitType: '2BR', count: 105 },
                    { unitType: '3BR', count: 15 },
                  ]
                }
              },
            }]
          };
        }
        if (sql.includes('financial_models')) {
          return {
            rows: [{
              assumptions: {
                unitMix: [
                  { unitType: 'Studio', count: 50 }, // MISMATCH!
                  { unitType: '1BR', count: 135 },
                  { unitType: '2BR', count: 100 }, // MISMATCH!
                  { unitType: '3BR', count: 15 },
                ]
              }
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.errors.filter(e => e.code === 'UNIT_MIX_MISMATCH').length).toBeGreaterThan(0);
    });
  });

  describe('Zoning Compliance', () => {
    it('should detect height violations', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              id: 'deal-123',
              targetUnits: 300,
              module_outputs: {
                zoningIntelligence: {
                  maxStories: 5,
                  maxUnits: 313,
                  maxFAR: 4.0,
                }
              }
            }]
          };
        }
        if (sql.includes('building_designs_3d')) {
          return {
            rows: [{
              stories: 8, // VIOLATION!
              units: 300,
              far: 1.22,
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'ZONING_HEIGHT_VIOLATION',
          severity: 'critical',
          expected: '5 stories max',
          actual: '8 stories',
        })
      );
    });

    it('should detect density violations', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              module_outputs: {
                zoningIntelligence: {
                  maxUnits: 300,
                }
              }
            }]
          };
        }
        if (sql.includes('building_designs_3d')) {
          return {
            rows: [{
              units: 350, // VIOLATION!
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'ZONING_DENSITY_VIOLATION',
        })
      );
    });
  });

  describe('Parking Requirements', () => {
    it('should detect unnecessary parking (BeltLine scenario)', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              module_outputs: {
                zoningIntelligence: {
                  parkingRequired: 0, // Zero parking required
                }
              }
            }]
          };
        }
        if (sql.includes('building_designs_3d')) {
          return {
            rows: [{
              parkingSpaces: 450, // Unnecessary!
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'PARKING_UNNECESSARY',
          severity: 'warning',
        })
      );
    });

    it('should detect insufficient parking', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              targetUnits: 300,
              module_outputs: {
                zoningIntelligence: {
                  parkingRatio: 1.5,
                }
              }
            }]
          };
        }
        if (sql.includes('building_designs_3d')) {
          return {
            rows: [{
              units: 300,
              parkingSpaces: 300, // Should be 450!
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PARKING_INSUFFICIENT',
        })
      );
    });
  });

  describe('FAR Utilization', () => {
    it('should flag severe underutilization', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM deals')) {
          return {
            rows: [{
              module_outputs: {
                zoningIntelligence: {
                  maxFAR: 4.0,
                }
              }
            }]
          };
        }
        if (sql.includes('building_designs_3d')) {
          return {
            rows: [{
              far: 1.22, // Only 30% of allowed!
            }]
          };
        }
        if (sql.includes('property_boundaries')) {
          return {
            rows: [{
              parcel_area_sf: 209584,
            }]
          };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.info).toContainEqual(
        expect.objectContaining({
          code: 'FAR_UNDERUTILIZED',
          severity: 'info',
        })
      );
    });
  });

  describe('Financial Assumptions', () => {
    it('should detect unit count mismatch between financial model and design', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('financial_models')) {
          return {
            rows: [{
              totalUnits: 290, // Mismatch!
            }]
          };
        }
        if (sql.includes('building_designs_3d')) {
          return {
            rows: [{
              units: 300,
            }]
          };
        }
        if (sql.includes('FROM deals')) {
          return { rows: [{ targetUnits: 300 }] };
        }
        return { rows: [] };
      });

      const result = await validateDealConsistency('deal-123');

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'FINANCIAL_UNITS_MISMATCH',
        })
      );
    });
  });

  describe('Summary Generation', () => {
    it('should generate correct summary for valid deal', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await validateDealConsistency('deal-123');

      expect(result.summary).toContain('All modules are consistent');
    });

    it('should generate correct summary with mixed issues', async () => {
      // Mock will return data that triggers 2 errors and 1 warning
      const result = await validateDealConsistency('deal-123');

      expect(result.summary).toMatch(/Found.*error.*warning/);
    });
  });
});
