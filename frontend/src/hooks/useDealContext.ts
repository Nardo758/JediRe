/**
 * useDealContext - Convenience hooks for modules
 * 
 * These hooks provide easy access to specific sections of the DealStore.
 * Modules import the specific hook they need instead of the full store.
 * 
 * Example:
 *   const { unitMix, overrideUnit } = useUnitMix();
 *   const { selectedPath, selectPath } = useDevelopmentPaths();
 */

import { shallow } from 'zustand/shallow';
import { useFinancialModelStore } from '../stores/financialModelStore';
import type { UnitMixRow, DevelopmentPath } from '../stores/dealContext.types';

/**
 * Hook for unit mix data (M-PIE primary hook)
 * 
 * Returns resolved unit mix with user overrides applied,
 * plus functions to make changes that trigger cascade.
 */
export function useUnitMix() {
  return useFinancialModelStore(
    (state) => ({
      // Data
      unitMix: state.context?.resolvedUnitMix || [],
      totalUnits: state.context?.summary?.totalUnits || 0,
      developmentPaths: state.context?.development?.paths || [],
      selectedPathId: state.context?.development?.selectedDevelopmentPathId,
      
      // Actions
      overrideUnit: state.overrideUnitMix,
      clearOverrides: state.clearUnitMixOverrides,
      setExistingMix: state.setExistingUnitMix,
      
      // Loading state
      isLoading: state.isLoading,
    }),
    shallow
  );
}

/**
 * Hook for development paths (M03 primary hook)
 * 
 * Returns all paths, selected path, and functions to add/update/select paths.
 * Selecting a path triggers the keystone cascade.
 */
export function useDevelopmentPaths() {
  return useFinancialModelStore(
    (state) => ({
      // Data
      paths: state.context?.development?.paths || [],
      selectedPath: state.context?.development?.paths?.find(
        p => p.id === state.context?.development?.selectedDevelopmentPathId
      ),
      selectedPathId: state.context?.development?.selectedDevelopmentPathId,
      
      // Actions  
      selectPath: state.selectDevelopmentPath,
      addPath: state.addDevelopmentPath,
      updatePath: state.updateDevelopmentPath,
      removePath: state.removeDevelopmentPath,
      
      // Loading state
      isLoading: state.isLoading,
    }),
    shallow
  );
}

/**
 * Hook for financial data (M09 primary hook)
 * 
 * Returns financial assumptions, projections, returns summary.
 * Subscribe to this to react when unit mix or strategy changes.
 */
export function useFinancial() {
  return useFinancialModelStore(
    (state) => ({
      // Data
      assumptions: state.context?.financial?.assumptions,
      projections: state.context?.financial?.projections,
      returns: state.context?.financial?.returns,
      
      // Actions
      updateAssumption: (key: string, value: any) =>
        state.updateLayeredValue(`financial.assumptions.${key}`, value, 'user'),
      
      // Loading state
      isLoading: state.isLoading,
      isStale: state.staleFlags?.financial || false,
    }),
    shallow
  );
}

/**
 * Hook for strategy data (M08 primary hook)
 * 
 * Returns strategy analysis, scores, recommendations.
 */
export function useStrategy() {
  return useFinancialModelStore(
    (state) => ({
      // Data
      strategies: state.context?.strategy?.strategies || [],
      recommendedStrategy: state.context?.strategy?.recommended,
      scores: state.context?.strategy?.scores,
      
      // Actions
      updateStrategyType: (strategyType: string) =>
        state.updateLayeredValue('strategy.recommended.type', strategyType, 'user'),
      
      // Loading state
      isLoading: state.isLoading,
      isStale: state.staleFlags?.strategy || false,
    }),
    shallow
  );
}

/**
 * Hook for property details (M01/Overview)
 * 
 * Returns basic property info, location, existing conditions.
 */
export function usePropertyDetails() {
  return useFinancialModelStore(
    (state) => ({
      // Data
      dealId: state.context?.dealId,
      mode: state.context?.mode,
      stage: state.context?.stage,
      property: state.context?.property,
      location: state.context?.location,
      existing: state.context?.existing,
      
      // Summary metrics
      totalUnits: state.context?.summary?.totalUnits,
      totalSF: state.context?.summary?.totalSF,
      avgRent: state.context?.summary?.avgRent,
      
      // Actions
      updateProperty: (updates: any) => {
        Object.entries(updates).forEach(([key, value]) => {
          state.updateLayeredValue(`property.${key}`, value, 'user');
        });
      },
      
      // Loading state
      isLoading: state.isLoading,
    }),
    shallow
  );
}

/**
 * Hook for JEDI Score and signals (M01/M25)
 * 
 * Returns overall score and breakdown by signal.
 */
export function useJEDIScore() {
  return useFinancialModelStore(
    (state) => ({
      // Data
      score: state.context?.scores?.jedi,
      breakdown: state.context?.scores?.breakdown,
      signals: state.context?.scores?.signals,
      verdict: state.context?.scores?.verdict,
      
      // Loading state
      isLoading: state.isLoading,
      isStale: state.staleFlags?.scores || false,
    }),
    shallow
  );
}

/**
 * Hook for full deal context (use sparingly)
 * 
 * Returns entire context object. Only use when you need multiple sections
 * or are building a dashboard that displays everything.
 */
export function useDealContextFull() {
  return useFinancialModelStore(
    (state) => ({
      context: state.context,
      isLoading: state.isLoading,
      error: state.error,
      staleFlags: state.staleFlags,
      
      // Lifecycle actions
      fetchContext: state.fetchDealContext,
      clearDeal: state.clearDeal,
      refreshSection: state.refreshSection,
    }),
    shallow
  );
}
