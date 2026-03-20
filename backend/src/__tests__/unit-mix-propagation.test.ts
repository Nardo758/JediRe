/**
 * Unit Mix Propagation Tests
 * 
 * Tests that unit mix data flows correctly from Unit Mix Intelligence
 * to all dependent modules (Financial Model, 3D Design, etc.)
 */

import { 
  propagateUnitMix, 
  getUnitMixStatus,
  setManualUnitMix 
} from '../services/unit-mix-propagation.service';
import { query } from '../database/connection';

jest.mock('../database/connection');

describe('Unit Mix Propagation Service', () => {
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('propagateUnitMix', () => {
    it('should propagate unit mix from Unit Mix Intelligence to all modules', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        // Get authoritative unit mix
        if (sql.includes('unitMix')) {
          return {
            rows: [{
              unit_mix_data: {
                program: [
                  { unitType: 'Studio', count: 45, avgSF: 550 },
                  { unitType: '1BR', count: 135, avgSF: 750 },
                  { unitType: '2BR', count: 105, avgSF: 1000 },
                  { unitType: '3BR', count: 15, avgSF: 1600 },
                ]
              }
            }]
          };
        }
        
        // Financial model
        if (sql.includes('financial_models')) {
          return {
            rows: [{
              id: 'fm-1',
              assumptions: {}
            }]
          };
        }
        
        // 3D design
        if (sql.includes('building_designs_3d')) {
          return {
            rows: [{
              id: 'design-1',
              building_sections: []
            }]
          };
        }
        
        // UPDATE queries
        if (sql.includes('UPDATE')) {
          return { rows: [] };
        }
        
        return { rows: [] };
      });

      const result = await propagateUnitMix('deal-123', 'intelligence');

      expect(result.success).toBe(true);
      expect(result.modulesUpdated).toContain('financial_model');
      expect(result.modulesUpdated).toContain('3d_design');
      expect(result.modulesUpdated).toContain('development_capacity');
      expect(result.unitMix.total).toBe(300);
      expect(result.unitMix.studio.count).toBe(45);
      expect(result.unitMix.oneBR.count).toBe(135);
      expect(result.unitMix.twoBR.count).toBe(105);
      expect(result.unitMix.threeBR.count).toBe(15);
    });

    it('should prioritize manual override over intelligence output', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        // Manual override exists
        if (sql.includes('unitMixOverride')) {
          return {
            rows: [{
              override_data: {
                program: [
                  { unitType: 'Studio', count: 50 }, // Different from intelligence
                  { unitType: '1BR', count: 140 },
                  { unitType: '2BR', count: 100 },
                  { unitType: '3BR', count: 10 },
                ]
              }
            }]
          };
        }
        
        if (sql.includes('UPDATE')) {
          return { rows: [] };
        }
        
        return { rows: [] };
      });

      const result = await propagateUnitMix('deal-123', 'manual');

      expect(result.unitMix.studio.count).toBe(50); // Uses override, not intelligence
      expect(result.unitMix.total).toBe(300);
    });

    it('should update financial model assumptions with unit mix', async () => {
      let updatedAssumptions: any = null;

      (query as jest.Mock).mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('unitMix')) {
          return {
            rows: [{
              unit_mix_data: {
                program: [
                  { unitType: 'Studio', count: 45, avgSF: 550 },
                  { unitType: '1BR', count: 135, avgSF: 750 },
                  { unitType: '2BR', count: 105, avgSF: 1000 },
                  { unitType: '3BR', count: 15, avgSF: 1600 },
                ]
              }
            }]
          };
        }
        
        if (sql.includes('financial_models') && sql.includes('SELECT')) {
          return {
            rows: [{
              id: 'fm-1',
              assumptions: { existingKey: 'value' }
            }]
          };
        }
        
        // Capture UPDATE
        if (sql.includes('UPDATE financial_models')) {
          updatedAssumptions = JSON.parse(params![0]);
          return { rows: [] };
        }
        
        if (sql.includes('UPDATE')) {
          return { rows: [] };
        }
        
        return { rows: [] };
      });

      await propagateUnitMix('deal-123', 'intelligence');

      expect(updatedAssumptions).toBeDefined();
      expect(updatedAssumptions.unitMix).toHaveLength(4);
      expect(updatedAssumptions.unitMix[0]).toEqual({
        unitType: 'Studio',
        count: 45,
        avgSF: 550,
        percent: 15,
      });
      expect(updatedAssumptions.totalUnits).toBe(300);
      expect(updatedAssumptions.existingKey).toBe('value'); // Preserves existing data
    });

    it('should update 3D design metadata with unit mix', async () => {
      let designMetadata: any = null;

      (query as jest.Mock).mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('unitMix')) {
          return {
            rows: [{
              unit_mix_data: {
                program: [
                  { unitType: 'Studio', count: 45, avgSF: 550 },
                  { unitType: '1BR', count: 135, avgSF: 750 },
                  { unitType: '2BR', count: 105, avgSF: 1000 },
                  { unitType: '3BR', count: 15, avgSF: 1600 },
                ]
              }
            }]
          };
        }
        
        if (sql.includes('building_designs_3d') && sql.includes('SELECT')) {
          return {
            rows: [{
              id: 'design-1',
              building_sections: []
            }]
          };
        }
        
        // Capture UPDATE
        if (sql.includes('UPDATE building_designs_3d')) {
          designMetadata = JSON.parse(params![0]);
          return { rows: [] };
        }
        
        if (sql.includes('UPDATE')) {
          return { rows: [] };
        }
        
        return { rows: [] };
      });

      await propagateUnitMix('deal-123', 'intelligence');

      expect(designMetadata).toBeDefined();
      expect(designMetadata.total).toBe(300);
      expect(designMetadata.studio.count).toBe(45);
      expect(designMetadata.updatedAt).toBeDefined();
    });

    it('should handle missing modules gracefully', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('unitMix')) {
          return {
            rows: [{
              unit_mix_data: {
                program: [{ unitType: 'Studio', count: 100 }]
              }
            }]
          };
        }
        
        // No financial model or 3D design exists
        if (sql.includes('financial_models') || sql.includes('building_designs_3d')) {
          return { rows: [] };
        }
        
        if (sql.includes('UPDATE')) {
          return { rows: [] };
        }
        
        return { rows: [] };
      });

      const result = await propagateUnitMix('deal-123', 'intelligence');

      // Should succeed even if modules don't exist yet
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors from failed module updates', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('unitMix')) {
          return {
            rows: [{
              unit_mix_data: {
                program: [{ unitType: 'Studio', count: 100 }]
              }
            }]
          };
        }
        
        if (sql.includes('financial_models')) {
          throw new Error('Database connection failed');
        }
        
        if (sql.includes('UPDATE')) {
          return { rows: [] };
        }
        
        return { rows: [] };
      });

      const result = await propagateUnitMix('deal-123', 'intelligence');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Financial model update failed');
    });
  });

  describe('setManualUnitMix', () => {
    it('should set manual override and propagate', async () => {
      (query as jest.Mock).mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('UPDATE') && sql.includes('unitMixOverride')) {
          // Capture the override
          const override = JSON.parse(params![0]);
          expect(override.program).toHaveLength(4);
          return { rows: [] };
        }
        
        // Then propagate (mock the queries from propagateUnitMix)
        if (sql.includes('unitMixOverride') && sql.includes('SELECT')) {
          return {
            rows: [{
              override_data: {
                program: [
                  { unitType: 'Studio', count: 60 },
                  { unitType: '1BR', count: 120 },
                  { unitType: '2BR', count: 100 },
                  { unitType: '3BR', count: 20 },
                ]
              }
            }]
          };
        }
        
        if (sql.includes('UPDATE')) {
          return { rows: [] };
        }
        
        return { rows: [] };
      });

      const result = await setManualUnitMix('deal-123', {
        studio: { count: 60, avgSF: 550 },
        oneBR: { count: 120, avgSF: 750 },
        twoBR: { count: 100, avgSF: 1000 },
        threeBR: { count: 20, avgSF: 1600 },
      });

      expect(result.success).toBe(true);
      expect(result.unitMix.total).toBe(300);
    });
  });

  describe('getUnitMixStatus', () => {
    it('should return status when unit mix exists', async () => {
      (query as jest.Mock).mockResolvedValue({
        rows: [{
          status: {
            applied: true,
            source: 'intelligence',
            appliedAt: '2026-03-10T18:00:00Z'
          },
          unit_mix_data: {
            program: [{ unitType: 'Studio', count: 100 }]
          }
        }]
      });

      const status = await getUnitMixStatus('deal-123');

      expect(status.hasUnitMix).toBe(true);
      expect(status.source).toBe('intelligence');
      expect(status.appliedAt).toBe('2026-03-10T18:00:00Z');
      expect(status.unitMix).toBeDefined();
    });

    it('should return empty status when no unit mix exists', async () => {
      (query as jest.Mock).mockResolvedValue({
        rows: [{}]
      });

      const status = await getUnitMixStatus('deal-123');

      expect(status.hasUnitMix).toBe(false);
      expect(status.source).toBeNull();
      expect(status.appliedAt).toBeNull();
      expect(status.unitMix).toBeNull();
    });
  });

  describe('Unit Mix Parsing', () => {
    it('should parse different unit mix formats correctly', async () => {
      // Test with different input formats
      const formats = [
        // Format 1: program array
        {
          program: [
            { unitType: 'Studio', count: 45, avgSF: 550 },
            { unitType: '1BR', count: 135 },
          ]
        },
        // Format 2: breakdown object
        {
          breakdown: [
            { type: 'studio', units: 45, sf: 550 },
            { type: '1-bedroom', units: 135 },
          ]
        },
      ];

      for (const format of formats) {
        (query as jest.Mock).mockImplementation((sql: string) => {
          if (sql.includes('unitMix')) {
            return { rows: [{ unit_mix_data: format }] };
          }
          if (sql.includes('UPDATE')) {
            return { rows: [] };
          }
          return { rows: [] };
        });

        const result = await propagateUnitMix('deal-123', 'intelligence');
        
        expect(result.unitMix.studio.count).toBeGreaterThan(0);
        expect(result.unitMix.total).toBeGreaterThan(0);
      }
    });
  });

  describe('Percentage Calculations', () => {
    it('should calculate percentages correctly', async () => {
      (query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('unitMix')) {
          return {
            rows: [{
              unit_mix_data: {
                program: [
                  { unitType: 'Studio', count: 50 },
                  { unitType: '1BR', count: 150 },
                  { unitType: '2BR', count: 100 },
                ]
              }
            }]
          };
        }
        if (sql.includes('UPDATE')) return { rows: [] };
        return { rows: [] };
      });

      const result = await propagateUnitMix('deal-123', 'intelligence');

      expect(result.unitMix.total).toBe(300);
      expect(result.unitMix.studio.percent).toBeCloseTo(16.67, 1);
      expect(result.unitMix.oneBR.percent).toBeCloseTo(50.0, 1);
      expect(result.unitMix.twoBR.percent).toBeCloseTo(33.33, 1);
    });
  });
});
