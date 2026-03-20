import { useEffect } from 'react';
import { useDealStore } from '../stores/dealStore';
import type { M08StrategyScore, M08ArbitrageResult } from '../stores/dealStore';

export interface UseStrategyArbitrageM08Result {
  scores: M08StrategyScore[];
  arbitrage: M08ArbitrageResult | null;
  loading: boolean;
  recalculate: () => Promise<void>;
}

/**
 * M08 Strategy Arbitrage hook — fetches live scores + arbitrage for a deal on mount.
 * Auto-recalculates if no scores are present.
 * recalculate() triggers recalc and syncs arbitrage from the response.
 */
export function useStrategyArbitrage(dealId: string): UseStrategyArbitrageM08Result {
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
        recalculateStrategyScores(dealId).then(() => {
          // recalculate already syncs arbitrage from response
        });
      }
    });
    fetchArbitrage(dealId);
  }, [dealId]);

  const recalculate = async (): Promise<void> => {
    await recalculateStrategyScores(dealId);
    // arbitrage already updated from recalculate response
    // additionally re-fetch in case backend returns fresher arbitrage
    await fetchArbitrage(dealId);
  };

  return {
    scores: strategyScores,
    arbitrage: arbitrageResult,
    loading: strategyScoresLoading,
    recalculate,
  };
}

export const useStrategyArbitrageM08 = useStrategyArbitrage;
