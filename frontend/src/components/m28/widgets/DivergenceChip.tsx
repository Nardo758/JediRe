/**
 * DivergenceChip - ACQUIRE/HOLD/EXIT signal based on leading/lagging divergence
 * Usage: <DivergenceChip marketId="tampa-msa" />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { DivergenceResult } from '../../../types/m28.types';

interface DivergenceChipProps {
  marketId: string;
  showDivergence?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const signalStyles = {
  ACQUIRE: {
    bg: 'bg-green-600',
    text: 'text-white',
    emoji: '🎯',
    label: 'ACQUIRE',
  },
  HOLD: {
    bg: 'bg-blue-600',
    text: 'text-white',
    emoji: '🤝',
    label: 'HOLD',
  },
  EXIT: {
    bg: 'bg-red-600',
    text: 'text-white',
    emoji: '🚪',
    label: 'EXIT',
  },
};

export const DivergenceChip: React.FC<DivergenceChipProps> = ({
  marketId,
  showDivergence = true,
  size = 'md',
}) => {
  const [divergence, setDivergence] = useState<DivergenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDivergence = async () => {
      try {
        setLoading(true);
        const data = await m28Client.getDivergence(marketId);
        setDivergence(data);
        setError(null);
      } catch (err) {
        setError('Unable to load divergence signal');
        console.error('Error fetching divergence:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDivergence();
  }, [marketId]);

  if (loading) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold bg-gray-200 text-gray-600 animate-pulse">
        ...
      </span>
    );
  }

  if (error || !divergence) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const style = signalStyles[divergence.signal];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-bold ${style.bg} ${style.text} ${sizeClasses[size]} shadow-sm`}
      title={`Divergence: ${divergence.divergence.toFixed(1)}% | Confidence: ${Math.round(divergence.confidence * 100)}%`}
    >
      <span>{style.emoji}</span>
      <span>{style.label}</span>
      {showDivergence && (
        <span className="text-xs opacity-90">
          ({divergence.divergence > 0 ? '+' : ''}
          {divergence.divergence.toFixed(1)}%)
        </span>
      )}
    </span>
  );
};
