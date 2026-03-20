import { useEffect } from 'react';
import { useDealStore } from '../stores/dealStore';
import type { M08StrategyScore, M08ArbitrageResult } from '../stores/dealStore';

export interface UseStrategyArbitrageM08Result {
  scores: M08StrategyScore[];
  arbitrage: M08ArbitrageResult | null;
  loading: boolean;
  recalculate: () => void;
}

/**
 * M08 Strategy Arbitrage hook — fetches live scores + arbitrage for a deal on mount.
 * Auto-recalculates if no scores are present.
 */
export function useStrategyArbitrageM08(dealId: string): UseStrategyArbitrageM08Result {
  const strategyScores = useDealStore((s) => s.strategyScores);
  const arbitrageResult = useDealStore((s) => s.arbitrageResult);
  const strategyScoresLoading = useDealStore((s) => s.strategyScoresLoading);
  const fetchStrategyScores = useDealStore((s) => s.fetchStrategyScores);
  const recalculateStrategyScores = useDealStore((s) => s.recalculateStrategyScores);
  const fetchArbitrage = useDealStore((s) => s.fetchArbitrage);

  useEffect(() => {
    if (!dealId) return;
    fetchStrategyScores(dealId).then(() => {
      const currentScores = useDealStore.getState().strategyScores;
      if (!currentScores || currentScores.length === 0) {
        recalculateStrategyScores(dealId);
      }
    });
    fetchArbitrage(dealId);
  }, [dealId]);

  return {
    scores: strategyScores,
    arbitrage: arbitrageResult,
    loading: strategyScoresLoading,
    recalculate: () => recalculateStrategyScores(dealId),
  };
}
