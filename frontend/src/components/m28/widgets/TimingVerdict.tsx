/**
 * TimingVerdict - Shows leading/lagging gap and acquisition window status
 * Usage: <TimingVerdict marketId="tampa-msa" />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { DivergenceResult } from '../../../types/m28.types';

interface TimingVerdictProps {
  marketId: string;
}

export const TimingVerdict: React.FC<TimingVerdictProps> = ({ marketId }) => {
  const [divergence, setDivergence] = useState<DivergenceResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDivergence = async () => {
      try {
        const data = await m28Client.getDivergence(marketId);
        setDivergence(data);
      } catch (err) {
        console.error('Error fetching divergence:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDivergence();
  }, [marketId]);

  if (loading || !divergence) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  const isLeadingAhead = divergence.divergence > 0;
  const isAligned = Math.abs(divergence.divergence) < 5;
  
  let statusColor = '';
  let statusIcon = '';
  let statusText = '';
  let actionText = '';

  if (isLeading Ahead && divergence.divergence > 10) {
    statusColor = 'bg-green-50 border-green-300 text-green-800';
    statusIcon = '🟢';
    statusText = `Leading +${divergence.divergence.toFixed(1)}% ahead`;
    actionText = 'Acquisition window OPEN';
  } else if (isLeadingAhead) {
    statusColor = 'bg-blue-50 border-blue-300 text-blue-800';
    statusIcon = '🔵';
    statusText = `Leading +${divergence.divergence.toFixed(1)}% ahead`;
    actionText = 'Monitor for opportunities';
  } else if (isAligned) {
    statusColor = 'bg-gray-50 border-gray-300 text-gray-800';
    statusIcon = '⚪';
    statusText = 'Aligned (±5%)';
    actionText = 'Normal market conditions';
  } else {
    statusColor = 'bg-red-50 border-red-300 text-red-800';
    statusIcon = '🔴';
    statusText = `Lagging ${Math.abs(divergence.divergence).toFixed(1)}% behind`;
    actionText = 'Consider exit timing';
  }

  return (
    <div className={`border rounded-lg p-4 ${statusColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{statusIcon}</span>
            <h4 className="font-semibold text-sm">{statusText}</h4>
          </div>
          <p className="text-xs opacity-90">{actionText}</p>
        </div>
        
        <div className="text-right text-xs">
          <div className="font-medium">Confidence</div>
          <div className="text-lg font-bold">
            {Math.round(divergence.confidence * 100)}%
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-current/20 grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="opacity-70">Lagging Phase</div>
          <div className="font-semibold capitalize">{divergence.lag_phase}</div>
          <div className="text-[10px] opacity-60">
            {Math.round(divergence.lag_position * 100)}% through
          </div>
        </div>
        
        <div>
          <div className="opacity-70">Leading Phase</div>
          <div className="font-semibold capitalize">{divergence.lead_phase}</div>
          <div className="text-[10px] opacity-60">
            {Math.round(divergence.lead_position * 100)}% through
          </div>
        </div>
      </div>
    </div>
  );
};
