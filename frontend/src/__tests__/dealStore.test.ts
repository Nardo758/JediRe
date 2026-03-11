/**
 * DealStore Unit Tests
 * 
 * Tests the keystone cascade, unit mix resolution, and state management.
 */

import { renderHook, act } from '@testing-library/react';
import { useFinancialModelStore as useDealStore } from '../stores/financialModelStore';
import type { DevelopmentPath, UnitMixRow } from '../stores/dealContext.types';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('DealStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useDealStore());
    act(() => {
      result.current.clearDeal();
    });
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Initialization', () => {
    it('should initialize with empty context', () => {
      const { result } = renderHook(() => useDealStore());
      
      expect(result.current.context).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Keystone Cascade - Path Selection', () => {
    it('should update resolvedUnitMix when path is selected', () => {
      const { result } = renderHook(() => useDealStore());
      
      // Setup: Add two development paths
      const path1: DevelopmentPath = {
        id: 'path-1',
        name: 'Option A',
        program: [
          { id: 'unit-1', unitType: '1BR', count: 50, avgSF: 700, targetRent: 2000 },
          { id: 'unit-2', unitType: '2BR', count: 30, avgSF: 1000, targetRent: 2500 },
        ],
        totalUnits: 80,
        totalSF: 65000,
        metrics: { efficiency: 0.85, parkingRatio: 1.2 },
        source: 'ai',
      };

      const path2: DevelopmentPath = {
        id: 'path-2',
        name: 'Option B',
        program: [
          { id: 'unit-3', unitType: 'Studio', count: 40, avgSF: 500, targetRent: 1800 },
          { id: 'unit-4', unitType: '1BR', count: 60, avgSF: 700, targetRent: 2100 },
        ],
        totalUnits: 100,
        totalSF: 62000,
        metrics: { efficiency: 0.87, parkingRatio: 1.0 },
        source: 'ai',
      };

      act(() => {
        result.current.addDevelopmentPath(path1);
        result.current.addDevelopmentPath(path2);
      });

      // Initially no path selected
      expect(result.current.context?.development?.selectedDevelopmentPathId).toBeUndefined();
      
      // Select path 1
      act(() => {
        result.current.selectDevelopmentPath('path-1');
      });

      // resolvedUnitMix should now be path 1's program
      expect(result.current.context?.resolvedUnitMix).toEqual(path1.program);
      expect(result.current.context?.summary?.totalUnits).toBe(80);

      // Select path 2
      act(() => {
        result.current.selectDevelopmentPath('path-2');
      });

      // resolvedUnitMix should now be path 2's program
      expect(result.current.context?.resolvedUnitMix).toEqual(path2.program);
      expect(result.current.context?.summary?.totalUnits).toBe(100);
    });

    it('should preserve user overrides when switching paths', () => {
      const { result } = renderHook(() => useDealStore());
      
      const path: DevelopmentPath = {
        id: 'path-1',
        name: 'Test Path',
        program: [
          { id: 'unit-1', unitType: '1BR', count: 50, avgSF: 700, targetRent: 2000 },
        ],
        totalUnits: 50,
        totalSF: 35000,
        metrics: { efficiency: 0.85, parkingRatio: 1.2 },
        source: 'ai',
      };

      act(() => {
        result.current.addDevelopmentPath(path);
        result.current.selectDevelopmentPath('path-1');
      });

      // Apply user override
      act(() => {
        result.current.overrideUnitMix('unit-1', { count: 60, targetRent: 2200 });
      });

      // resolvedUnitMix should show overridden values
      const resolved = result.current.context?.resolvedUnitMix?.[0];
      expect(resolved?.count).toBe(60);
      expect(resolved?.targetRent).toBe(2200);
      
      // But avgSF should still be from base program
      expect(resolved?.avgSF).toBe(700);
    });

    it('should mark downstream modules as stale after path selection', () => {
      const { result } = renderHook(() => useDealStore());
      
      const path: DevelopmentPath = {
        id: 'path-1',
        name: 'Test Path',
        program: [
          { id: 'unit-1', unitType: '1BR', count: 50, avgSF: 700, targetRent: 2000 },
        ],
        totalUnits: 50,
        totalSF: 35000,
        metrics: { efficiency: 0.85, parkingRatio: 1.2 },
        source: 'ai',
      };

      act(() => {
        result.current.addDevelopmentPath(path);
        result.current.selectDevelopmentPath('path-1');
      });

      // Financial, strategy, scores should be marked stale
      expect(result.current.staleFlags?.financial).toBe(true);
      expect(result.current.staleFlags?.strategy).toBe(true);
      expect(result.current.staleFlags?.scores).toBe(true);
    });
  });

  describe('Unit Mix Overrides', () => {
    it('should apply overrides correctly', () => {
      const { result } = renderHook(() => useDealStore());
      
      act(() => {
        result.current.setExistingUnitMix([
          { id: 'unit-1', unitType: '1BR', count: 50, avgSF: 700, targetRent: 2000 },
          { id: 'unit-2', unitType: '2BR', count: 30, avgSF: 1000, targetRent: 2500 },
        ]);
      });

      act(() => {
        result.current.overrideUnitMix('unit-1', { count: 55, targetRent: 2100 });
      });

      const resolved = result.current.context?.resolvedUnitMix;
      expect(resolved?.[0].count).toBe(55);
      expect(resolved?.[0].targetRent).toBe(2100);
      expect(resolved?.[0].avgSF).toBe(700); // Unchanged
      
      // Second unit unchanged
      expect(resolved?.[1].count).toBe(30);
      expect(resolved?.[1].targetRent).toBe(2500);
    });

    it('should clear all overrides', () => {
      const { result } = renderHook(() => useDealStore());
      
      act(() => {
        result.current.setExistingUnitMix([
          { id: 'unit-1', unitType: '1BR', count: 50, avgSF: 700, targetRent: 2000 },
        ]);
        result.current.overrideUnitMix('unit-1', { count: 60 });
      });

      expect(result.current.context?.resolvedUnitMix?.[0].count).toBe(60);

      act(() => {
        result.current.clearUnitMixOverrides();
      });

      expect(result.current.context?.resolvedUnitMix?.[0].count).toBe(50);
    });
  });

  describe('Layered Values', () => {
    it('should update layered values with source tracking', () => {
      const { result } = renderHook(() => useDealStore());
      
      act(() => {
        result.current.updateLayeredValue('financial.assumptions.rentGrowth', 0.03, 'user', 0.9);
      });

      const rentGrowth = result.current.context?.financial?.assumptions?.rentGrowth;
      expect(rentGrowth?.value).toBe(0.03);
      expect(rentGrowth?.source).toBe('user');
      expect(rentGrowth?.confidence).toBe(0.9);
    });
  });

  describe('API Integration', () => {
    it('should fetch deal context from backend', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            dealId: 'deal-123',
            mode: 'development',
            property: { address: '123 Main St' },
            resolvedUnitMix: [
              { id: 'unit-1', unitType: '1BR', count: 50, avgSF: 700, targetRent: 2000 },
            ],
          },
        }),
      });

      const { result } = renderHook(() => useDealStore());

      await act(async () => {
        await result.current.fetchDealContext('deal-123');
      });

      expect(result.current.context?.dealId).toBe('deal-123');
      expect(result.current.context?.property?.address).toBe('123 Main St');
      expect(result.current.context?.resolvedUnitMix).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDealStore());

      await act(async () => {
        await result.current.fetchDealContext('deal-123');
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });
  });
});
