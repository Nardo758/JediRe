import { useEffect, useRef } from 'react';
import { useDealStore } from '../stores/dealStore';
import type { M08StrategyScore, M08ArbitrageResult } from '../stores/dealStore';

export interface UseStrategyArbitrageM08Result {
  scores: M08StrategyScore[];
  arbitrage: M08ArbitrageResult | null;
  loading: boolean;
  recalculate: () => Promise<void>;
}

const RETRY_DELAYS_MS = [2000, 4000, 8000];

/**
 * M08 Strategy Arbitrage hook — fetches live scores + arbitrage for a deal on mount.
 * Auto-recalculates if no scores are present, then polls up to 3 times with backoff
 * to handle async backend scoring that may not complete synchronously.
 * recalculate() triggers recalc and re-fetches arbitrage from backend.
 */
export function useStrategyArbitrage(dealId: string): UseStrategyArbitrageM08Result {
  const strategyScores = useDealStore((s) => s.strategyScores);
  const arbitrageResult = useDealStore((s) => s.arbitrageResult);
  const strategyScoresLoading = useDealStore((s) => s.strategyScoresLoading);
  const fetchStrategyScores = useDealStore((s) => s.fetchStrategyScores);
  const recalculateStrategyScores = useDealStore((s) => s.recalculateStrategyScores);
  const fetchArbitrage = useDealStore((s) => s.fetchArbitrage);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dealId) return;

    let cancelled = false;

    const pollForScores = (retryIndex: number) => {
      if (cancelled || retryIndex >= RETRY_DELAYS_MS.length) return;
      pollingRef.current = setTimeout(async () => {
        if (cancelled) return;
        await fetchStrategyScores(dealId);
        await fetchArbitrage(dealId);
        const scores = useDealStore.getState().strategyScores;
        if (!scores || scores.length === 0) {
          pollForScores(retryIndex + 1);
        }
      }, RETRY_DELAYS_MS[retryIndex]);
    };

    fetchStrategyScores(dealId).then(() => {
      if (cancelled) return;
      const scores = useDealStore.getState().strategyScores;
      if (!scores || scores.length === 0) {
        recalculateStrategyScores(dealId).then(() => {
          if (cancelled) return;
          const afterRecalc = useDealStore.getState().strategyScores;
          if (!afterRecalc || afterRecalc.length === 0) {
            pollForScores(0);
          }
        }).catch(() => {});
      }
    }).catch(() => {});

    fetchArbitrage(dealId).catch(() => {});

    return () => {
      cancelled = true;
      if (pollingRef.current != null) clearTimeout(pollingRef.current);
    };
  // hook intentionally captures fetchArbitrage, fetchStrategyScores, recalculateStrategyScores via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted values are read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const recalculate = async (): Promise<void> => {
    await recalculateStrategyScores(dealId);
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
