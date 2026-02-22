/**
 * Financial Auto-Sync Service
 * Real-time financial model updates from 3D design changes
 */

import { generateProForma, calculateDevelopmentBudget, calculateReturns } from './proFormaGenerator';
import type {
  Design3D,
  FinancialAssumptions,
  ProForma,
  FinancialSyncState,
  FinancialModelChange,
  RentForecast,
  CostBreakdown,
} from '../types/financial.types';

// Debounce delay for 3D changes (500ms)
const DEBOUNCE_DELAY = 500;

type Design3DCallback = (design: Design3D, proForma: ProForma) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Financial Auto-Sync Service
 * Watches 3D design changes and auto-generates financial models
 */
export class FinancialAutoSyncService {
  private watchCallbacks: Map<string, Design3DCallback[]> = new Map();
  private errorCallbacks: Map<string, ErrorCallback[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private syncStates: Map<string, FinancialSyncState> = new Map();
  private lastProFormas: Map<string, ProForma> = new Map();
  private assumptions: Map<string, FinancialAssumptions> = new Map();

  /**
   * Watch 3D design changes for a deal
   */
  watchDesign3D(
    designId: string,
    assumptions: FinancialAssumptions,
    callback: Design3DCallback,
    onError?: ErrorCallback
  ): () => void {
    // Store assumptions
    this.assumptions.set(designId, assumptions);

    // Initialize sync state
    if (!this.syncStates.has(designId)) {
      this.syncStates.set(designId, {
        isCalculating: false,
        lastSync: null,
        pendingChanges: [],
        errors: [],
      });
    }

    // Add callback
    if (!this.watchCallbacks.has(designId)) {
      this.watchCallbacks.set(designId, []);
    }
    this.watchCallbacks.get(designId)!.push(callback);

    if (onError) {
      if (!this.errorCallbacks.has(designId)) {
        this.errorCallbacks.set(designId, []);
      }
      this.errorCallbacks.get(designId)!.push(onError);
    }

    // Return unwatch function
    return () => {
      const callbacks = this.watchCallbacks.get(designId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }

      if (onError) {
        const errorCallbacks = this.errorCallbacks.get(designId);
        if (errorCallbacks) {
          const index = errorCallbacks.indexOf(onError);
          if (index > -1) {
            errorCallbacks.splice(index, 1);
          }
        }
      }
    };
  }

  /**
   * Handle 3D design change with debouncing
   */
  onDesignChange(design: Design3D): void {
    const { id: designId, dealId } = design;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(designId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer
    const timer = setTimeout(() => {
      this.processDesignChange(design);
    }, DEBOUNCE_DELAY);

    this.debounceTimers.set(designId, timer);

    // Update sync state
    const syncState = this.syncStates.get(designId);
    if (syncState) {
      syncState.isCalculating = true;
      this.syncStates.set(designId, syncState);
    }
  }

  /**
   * Process design change and recalculate financials
   */
  private processDesignChange(design: Design3D): void {
    const { id: designId, dealId } = design;

    try {
      const assumptions = this.assumptions.get(designId);
      if (!assumptions) {
        throw new Error(`No assumptions found for design ${designId}`);
      }

      // Generate new pro forma
      const newProForma = generateProForma(design, assumptions, dealId);

      // Detect changes
      const changes = this.detectChanges(designId, newProForma);

      // Update sync state
      const syncState = this.syncStates.get(designId);
      if (syncState) {
        syncState.isCalculating = false;
        syncState.lastSync = new Date().toISOString();
        syncState.pendingChanges = changes;
        syncState.errors = [];
        this.syncStates.set(designId, syncState);
      }

      // Store last pro forma
      this.lastProFormas.set(designId, newProForma);

      // Notify callbacks
      const callbacks = this.watchCallbacks.get(designId) || [];
      callbacks.forEach((callback) => {
        try {
          callback(design, newProForma);
        } catch (error) {
          console.error('Error in watch callback:', error);
        }
      });
    } catch (error) {
      console.error('Error processing design change:', error);

      // Update sync state with error
      const syncState = this.syncStates.get(designId);
      if (syncState) {
        syncState.isCalculating = false;
        syncState.errors.push((error as Error).message);
        this.syncStates.set(designId, syncState);
      }

      // Notify error callbacks
      const errorCallbacks = this.errorCallbacks.get(designId) || [];
      errorCallbacks.forEach((callback) => {
        try {
          callback(error as Error);
        } catch (err) {
          console.error('Error in error callback:', err);
        }
      });
    }
  }

  /**
   * Detect what changed between pro formas
   */
  private detectChanges(designId: string, newProForma: ProForma): FinancialModelChange[] {
    const lastProForma = this.lastProFormas.get(designId);
    if (!lastProForma) {
      return [];
    }

    const changes: FinancialModelChange[] = [];
    const timestamp = new Date().toISOString();

    // Check NOI change
    const oldNOI = lastProForma.operatingProForma.stabilizedYear.cashFlow.netOperatingIncome;
    const newNOI = newProForma.operatingProForma.stabilizedYear.cashFlow.netOperatingIncome;
    if (Math.abs(oldNOI - newNOI) > 0.01) {
      changes.push({
        field: 'netOperatingIncome',
        oldValue: oldNOI,
        newValue: newNOI,
        impact: { noi: newNOI - oldNOI },
        timestamp,
      });
    }

    // Check IRR change
    const oldIRR = lastProForma.returns.leveredIRR;
    const newIRR = newProForma.returns.leveredIRR;
    if (Math.abs(oldIRR - newIRR) > 0.0001) {
      changes.push({
        field: 'leveredIRR',
        oldValue: oldIRR,
        newValue: newIRR,
        impact: { irr: newIRR - oldIRR },
        timestamp,
      });
    }

    // Check total cost change
    const oldCost = lastProForma.developmentBudget.totalDevelopmentCost;
    const newCost = newProForma.developmentBudget.totalDevelopmentCost;
    if (Math.abs(oldCost - newCost) > 0.01) {
      changes.push({
        field: 'totalDevelopmentCost',
        oldValue: oldCost,
        newValue: newCost,
        impact: { totalCost: newCost - oldCost },
        timestamp,
      });
    }

    // Check unit count change
    const oldUnits = lastProForma.design3D.totalUnits;
    const newUnits = newProForma.design3D.totalUnits;
    if (oldUnits !== newUnits) {
      changes.push({
        field: 'totalUnits',
        oldValue: oldUnits,
        newValue: newUnits,
        impact: {},
        timestamp,
      });
    }

    return changes;
  }

  /**
   * Get current sync state for a design
   */
  getSyncState(designId: string): FinancialSyncState | null {
    return this.syncStates.get(designId) || null;
  }

  /**
   * Get last pro forma for a design
   */
  getLastProForma(designId: string): ProForma | null {
    return this.lastProFormas.get(designId) || null;
  }

  /**
   * Update assumptions and recalculate
   */
  updateAssumptions(designId: string, assumptions: FinancialAssumptions): void {
    this.assumptions.set(designId, assumptions);
    
    // Trigger recalculation with last design
    const lastProForma = this.lastProFormas.get(designId);
    if (lastProForma) {
      this.onDesignChange(lastProForma.design3D);
    }
  }

  /**
   * Manually trigger recalculation
   */
  recalculate(design: Design3D): void {
    // Clear debounce and calculate immediately
    const existingTimer = this.debounceTimers.get(design.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    this.processDesignChange(design);
  }

  /**
   * Calculate impact of adding/removing units
   */
  calculateUnitMixImpact(
    design: Design3D,
    assumptions: FinancialAssumptions,
    unitChanges: Partial<Design3D['unitMix']>
  ): {
    revenueImpact: number;
    costImpact: number;
    noiImpact: number;
    irrImpact: number;
  } {
    // Calculate base scenario
    const baseProForma = generateProForma(design, assumptions, design.dealId);

    // Calculate modified scenario
    const modifiedDesign: Design3D = {
      ...design,
      unitMix: {
        ...design.unitMix,
        ...unitChanges,
      },
      totalUnits: Object.values({ ...design.unitMix, ...unitChanges }).reduce((a, b) => a + b, 0),
    };
    const modifiedProForma = generateProForma(modifiedDesign, assumptions, design.dealId);

    return {
      revenueImpact:
        modifiedProForma.operatingProForma.stabilizedYear.revenue.effectiveGrossIncome -
        baseProForma.operatingProForma.stabilizedYear.revenue.effectiveGrossIncome,
      costImpact:
        modifiedProForma.developmentBudget.totalDevelopmentCost -
        baseProForma.developmentBudget.totalDevelopmentCost,
      noiImpact:
        modifiedProForma.operatingProForma.stabilizedYear.cashFlow.netOperatingIncome -
        baseProForma.operatingProForma.stabilizedYear.cashFlow.netOperatingIncome,
      irrImpact: modifiedProForma.returns.leveredIRR - baseProForma.returns.leveredIRR,
    };
  }

  /**
   * Cleanup watchers for a design
   */
  cleanup(designId: string): void {
    // Clear debounce timer
    const timer = this.debounceTimers.get(designId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(designId);
    }

    // Clear callbacks
    this.watchCallbacks.delete(designId);
    this.errorCallbacks.delete(designId);

    // Clear state
    this.syncStates.delete(designId);
    this.lastProFormas.delete(designId);
    this.assumptions.delete(designId);
  }

  // ===== AI INTEGRATION HOOKS =====

  /**
   * AI-powered market rent predictions with Qwen
   * Falls back to null if AI is unavailable
   */
  async predictRents(
    unitMix: Design3D['unitMix'],
    location: { lat: number; lng: number; address: string },
    model: 'qwen' = 'qwen'
  ): Promise<RentForecast[] | null> {
    try {
      // Check if AI service is available
      const statusResponse = await fetch('/api/v1/ai/status');
      const statusData = await statusResponse.json();
      
      if (!statusData.enabled) {
        console.warn('[FinancialAutoSync] AI service not available for rent predictions');
        return null;
      }

      // TODO: Create dedicated rent prediction endpoint
      // For now, return null and use manual inputs
      // When endpoint is created, call it like this:
      /*
      const response = await fetch('/api/v1/ai/predict-rents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitMix, location, marketData })
      });
      
      if (!response.ok) {
        throw new Error('Rent prediction failed');
      }
      
      const result = await response.json();
      return result.data;
      */
      
      console.info('[FinancialAutoSync] Rent prediction endpoint not yet implemented');
      return null;
    } catch (error) {
      console.error('[FinancialAutoSync] Rent prediction error:', error);
      return null;
    }
  }

  /**
   * AI-powered cost estimation from 3D model with Qwen
   * Falls back to null if AI is unavailable
   */
  async estimateCostsWithAI(
    design3D: Design3D,
    model: 'qwen' = 'qwen'
  ): Promise<CostBreakdown | null> {
    try {
      // Check if AI service is available
      const statusResponse = await fetch('/api/v1/ai/status');
      const statusData = await statusResponse.json();
      
      if (!statusData.enabled) {
        console.warn('[FinancialAutoSync] AI service not available for cost estimation');
        return null;
      }

      // TODO: Create dedicated cost estimation endpoint
      // For now, return null and use manual inputs
      // When endpoint is created, call it like this:
      /*
      const response = await fetch('/api/v1/ai/estimate-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design3D })
      });
      
      if (!response.ok) {
        throw new Error('Cost estimation failed');
      }
      
      const result = await response.json();
      return result.data;
      */
      
      console.info('[FinancialAutoSync] Cost estimation endpoint not yet implemented');
      return null;
    } catch (error) {
      console.error('[FinancialAutoSync] Cost estimation error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const financialAutoSync = new FinancialAutoSyncService();
