/**
 * PhaseStrategyBadge - Shows phase-optimal strategy with expected returns
 * Usage: <PhaseStrategyBadge marketId="tampa-msa" />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { PhaseStrategy } from '../../../types/m28.types';

interface PhaseStrategyBadgeProps {
  marketId: string;
  showReturns?: boolean;
}

export const PhaseStrategyBadge: React.FC<PhaseStrategyBadgeProps> = ({
  marketId,
  showReturns = true,
}) => {
  const [strategy, setStrategy] = useState<PhaseStrategy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStrategy = async () => {
      try {
        const data = await m28Client.getPhaseOptimalStrategy(marketId);
        setStrategy(data);
      } catch (err) {
        console.error('Error fetching phase strategy:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStrategy();
  }, [marketId]);

  if (loading || !strategy) {
    return (
      <div className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-100 animate-pulse">
        <div className="h-4 w-32 bg-gray-300 rounded"></div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
      <span className="text-sm">🎯</span>
      
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-medium">
            Phase-Optimal:
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {strategy.optimal_strategy}
          </span>
        </div>
        
        {showReturns && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-600 font-semibold">
              IRR: {strategy.expected_irr.toFixed(1)}%
            </span>
            <span className="text-blue-600 font-semibold">
              EM: {strategy.expected_em.toFixed(2)}x
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
