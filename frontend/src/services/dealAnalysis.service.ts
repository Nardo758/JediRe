/**
 * Deal Analysis Service
 * Simulates background analysis for deal setup
 * Provides mock data for zoning, comparables, strategy matrix
 */

import { apiClient } from './api.client';

export type AnalysisTaskStatus = 'queued' | 'in_progress' | 'complete' | 'error';

export interface AnalysisTask {
  status: AnalysisTaskStatus;
  progress?: number; // 0-100
  result?: any;
  error?: string;
  itemsFound?: number; // For comparables
  totalItems?: number; // For comparables
  estimatedTimeMs?: number;
}

export interface AnalysisStatus {
  zoningAnalysis: AnalysisTask;
  comparables: AnalysisTask;
  strategies: AnalysisTask;
  financialModels: AnalysisTask;
  startedAt?: string;
  completedAt?: string;
}

export interface PhysicalOption {
  id: string;
  name: string;
  units: number;
  renovationCost?: number;
  constructionCost?: number;
  description: string;
}

export interface InvestmentStrategy {
  id: string;
  name: string;
  holdPeriod: number;
  exitType: 'sale' | 'refinance' | 'hold';
  rentGrowth: number;
  exitCapRate: number;
}

export interface StrategyMatrixCell {
  physicalOptionId: string;
  strategyId: string;
  irr: number;
  roi: number;
  totalInvestment: number;
  exitValue: number;
  timelineMonths: number;
}

export interface StrategyAnalysisResult {
  physicalOptions: PhysicalOption[];
  strategies: InvestmentStrategy[];
  matrix: StrategyMatrixCell[][];
  bestStrategy: {
    physicalOptionId: string;
    strategyId: string;
    irr: number;
    details: {
      units: number;
      renovation?: number;
      construction?: number;
      totalInvestment: number;
      exitValue: number;
      timelineMonths: number;
    };
  };
}

export interface ZoningAnalysisResult {
  maxUnits: number;
  zoning: string;
  heightLimit: number;
  lotCoverage: number;
  parkingRequired: number;
  setbacks?: {
    front: number;
    rear: number;
    side: number;
  };
}

// Mock data generators
const generateMockStrategyMatrix = (
  purchasePrice: number,
  existingUnits: number
): StrategyAnalysisResult => {
  const physicalOptions: PhysicalOption[] = [
    {
      id: 'as-is',
      name: 'As-Is',
      units: existingUnits,
      renovationCost: 0,
      description: 'Keep existing configuration',
    },
    {
      id: 'redevelop',
      name: 'Redevelop',
      units: existingUnits + 4,
      renovationCost: purchasePrice * 0.15,
      constructionCost: 150000 * 4,
      description: 'Add 4 units on vacant portion',
    },
    {
      id: 'rebuild',
      name: 'Rebuild (Max)',
      units: 12,
      constructionCost: purchasePrice * 0.8,
      description: 'Maximum density build',
    },
  ];

  const strategies: InvestmentStrategy[] = [
    {
      id: 'rental-core',
      name: 'Rental (Core)',
      holdPeriod: 120,
      exitType: 'hold',
      rentGrowth: 0.03,
      exitCapRate: 0.05,
    },
    {
      id: 'rental-va',
      name: 'Rental (V-A)',
      holdPeriod: 60,
      exitType: 'sale',
      rentGrowth: 0.045,
      exitCapRate: 0.048,
    },
    {
      id: 'flip',
      name: 'Flip',
      holdPeriod: 18,
      exitType: 'sale',
      rentGrowth: 0,
      exitCapRate: 0.045,
    },
    {
      id: 'build-to-sell',
      name: 'Build-to-Sell',
      holdPeriod: 24,
      exitType: 'sale',
      rentGrowth: 0,
      exitCapRate: 0.04,
    },
  ];

  // Calculate IRR for each combination
  const matrix: StrategyMatrixCell[][] = [];
  let bestIRR = 0;
  let bestCell: StrategyMatrixCell | null = null;

  physicalOptions.forEach((physical) => {
    const row: StrategyMatrixCell[] = [];
    
    strategies.forEach((strategy) => {
      // Skip build-to-sell for as-is
      if (physical.id === 'as-is' && strategy.id === 'build-to-sell') {
        row.push({
          physicalOptionId: physical.id,
          strategyId: strategy.id,
          irr: 0,
          roi: 0,
          totalInvestment: 0,
          exitValue: 0,
          timelineMonths: 0,
        });
        return;
      }

      const totalInvestment = 
        purchasePrice + 
        (physical.renovationCost || 0) + 
        (physical.constructionCost || 0);
      
      // Mock IRR calculation (simplified)
      const baseIRR = strategy.id === 'flip' ? 0.22 : 
                      strategy.id === 'rental-va' ? 0.14 :
                      strategy.id === 'build-to-sell' ? 0.25 : 0.08;
      
      const unitBonus = (physical.units - existingUnits) * 0.02;
      const irr = baseIRR + unitBonus + (Math.random() * 0.03);
      
      const exitMultiple = 1 + (irr * strategy.holdPeriod / 12);
      const exitValue = totalInvestment * exitMultiple;
      
      const cell: StrategyMatrixCell = {
        physicalOptionId: physical.id,
        strategyId: strategy.id,
        irr,
        roi: (exitValue - totalInvestment) / totalInvestment,
        totalInvestment,
        exitValue,
        timelineMonths: strategy.holdPeriod,
      };

      row.push(cell);

      if (irr > bestIRR) {
        bestIRR = irr;
        bestCell = cell;
      }
    });
    
    matrix.push(row);
  });

  const bestPhysical = physicalOptions.find(p => p.id === bestCell?.physicalOptionId);

  return {
    physicalOptions,
    strategies,
    matrix,
    bestStrategy: {
      physicalOptionId: bestCell?.physicalOptionId || 'redevelop',
      strategyId: bestCell?.strategyId || 'flip',
      irr: bestIRR,
      details: {
        units: bestPhysical?.units || existingUnits + 4,
        renovation: bestPhysical?.renovationCost,
        construction: bestPhysical?.constructionCost,
        totalInvestment: bestCell?.totalInvestment || purchasePrice * 1.2,
        exitValue: bestCell?.exitValue || purchasePrice * 2.5,
        timelineMonths: bestCell?.timelineMonths || 18,
      },
    },
  };
};

const generateMockZoningAnalysis = (): ZoningAnalysisResult => {
  return {
    maxUnits: 12,
    zoning: 'R-4',
    heightLimit: 45,
    lotCoverage: 50,
    parkingRequired: 24,
    setbacks: {
      front: 15,
      rear: 20,
      side: 10,
    },
  };
};

// Simulated polling state (in real app, this would be server-side)
const analysisStates = new Map<string, AnalysisStatus>();

export const dealAnalysisService = {
  /**
   * Start analysis when deal is created
   */
  async startAnalysis(dealId: string): Promise<{ analysisId: string; estimatedTime: number }> {
    // Initialize analysis state
    analysisStates.set(dealId, {
      zoningAnalysis: { status: 'queued' },
      comparables: { status: 'queued' },
      strategies: { status: 'queued' },
      financialModels: { status: 'queued' },
      startedAt: new Date().toISOString(),
    });

    // Simulate immediate start of first tasks
    setTimeout(() => {
      const state = analysisStates.get(dealId);
      if (state) {
        state.zoningAnalysis.status = 'in_progress';
        state.zoningAnalysis.progress = 0;
        state.comparables.status = 'in_progress';
        state.comparables.progress = 0;
        state.comparables.itemsFound = 0;
        state.comparables.totalItems = 12;
        analysisStates.set(dealId, state);
      }
    }, 100);

    // Simulate zoning analysis completion
    setTimeout(() => {
      const state = analysisStates.get(dealId);
      if (state) {
        state.zoningAnalysis.status = 'complete';
        state.zoningAnalysis.progress = 100;
        state.zoningAnalysis.result = generateMockZoningAnalysis();
        analysisStates.set(dealId, state);
      }
    }, 8000);

    // Simulate comparables progress
    const comparablesInterval = setInterval(() => {
      const state = analysisStates.get(dealId);
      if (state && state.comparables.status === 'in_progress') {
        const progress = (state.comparables.progress || 0) + 8;
        const itemsFound = Math.floor((progress / 100) * 12);
        
        if (progress >= 100) {
          state.comparables.status = 'complete';
          state.comparables.progress = 100;
          state.comparables.itemsFound = 12;
          state.strategies.status = 'in_progress';
          state.strategies.progress = 0;
          clearInterval(comparablesInterval);
        } else {
          state.comparables.progress = progress;
          state.comparables.itemsFound = itemsFound;
        }
        analysisStates.set(dealId, state);
      }
    }, 1500);

    // Simulate strategy analysis completion
    setTimeout(() => {
      const state = analysisStates.get(dealId);
      if (state) {
        state.strategies.status = 'complete';
        state.strategies.progress = 100;
        state.financialModels.status = 'in_progress';
        state.financialModels.progress = 0;
        analysisStates.set(dealId, state);
      }
    }, 16000);

    // Simulate financial models completion
    setTimeout(() => {
      const state = analysisStates.get(dealId);
      if (state) {
        state.financialModels.status = 'complete';
        state.financialModels.progress = 100;
        state.completedAt = new Date().toISOString();
        analysisStates.set(dealId, state);
      }
    }, 20000);

    return {
      analysisId: `analysis-${dealId}`,
      estimatedTime: 20000, // 20 seconds
    };
  },

  /**
   * Poll for analysis progress
   */
  async getAnalysisStatus(dealId: string): Promise<AnalysisStatus> {
    // Check if analysis exists
    let state = analysisStates.get(dealId);
    
    if (!state) {
      // Initialize if not exists (deal was created before this session)
      await this.startAnalysis(dealId);
      state = analysisStates.get(dealId)!;
    }

    return state;
  },

  /**
   * Get strategy matrix analysis results
   */
  async getStrategyAnalysis(
    dealId: string,
    purchasePrice: number = 1000000,
    existingUnits: number = 4
  ): Promise<StrategyAnalysisResult> {
    // Check if analysis is complete
    const state = analysisStates.get(dealId);
    if (!state || state.strategies.status !== 'complete') {
      throw new Error('Strategy analysis not yet complete');
    }

    // Return mock data
    return generateMockStrategyMatrix(purchasePrice, existingUnits);
  },

  /**
   * Get zoning analysis (for new development)
   */
  async getZoningAnalysis(dealId: string): Promise<ZoningAnalysisResult> {
    const state = analysisStates.get(dealId);
    if (!state || state.zoningAnalysis.status !== 'complete') {
      throw new Error('Zoning analysis not yet complete');
    }

    return state.zoningAnalysis.result || generateMockZoningAnalysis();
  },

  /**
   * Clear analysis state (for testing)
   */
  clearAnalysis(dealId: string): void {
    analysisStates.delete(dealId);
  },
};
