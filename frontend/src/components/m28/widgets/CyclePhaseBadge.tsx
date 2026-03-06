/**
 * CyclePhaseBadge - Inline badge showing market cycle phase
 * Usage: <CyclePhaseBadge marketId="tampa-msa" />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { CycleSnapshot } from '../../../types/m28.types';

interface CyclePhaseBadgeProps {
  marketId: string;
  showPosition?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const phaseColors = {
  recession: 'bg-red-100 text-red-800 border-red-300',
  recovery: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  expansion: 'bg-green-100 text-green-800 border-green-300',
  hypersupply: 'bg-orange-100 text-orange-800 border-orange-300',
};

const phaseEmoji = {
  recession: '📉',
  recovery: '📈',
  expansion: '🚀',
  hypersupply: '⚠️',
};

export const CyclePhaseBadge: React.FC<CyclePhaseBadgeProps> = ({
  marketId,
  showPosition = true,
  size = 'md',
}) => {
  const [snapshot, setSnapshot] = useState<CycleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCyclePhase = async () => {
      try {
        setLoading(true);
        const data = await m28Client.getCyclePhase(marketId);
        setSnapshot(data);
        setError(null);
      } catch (err) {
        setError('Unable to load cycle data');
        console.error('Error fetching cycle phase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCyclePhase();
  }, [marketId]);

  if (loading) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 animate-pulse">
        Loading...
      </span>
    );
  }

  if (error || !snapshot) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const phase = snapshot.lag_phase;
  const position = Math.round(snapshot.lag_position * 100);
  const colorClass = phaseColors[phase];
  const emoji = phaseEmoji[phase];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border ${colorClass} ${sizeClasses[size]}`}
      title={`Confidence: ${Math.round(snapshot.confidence * 100)}%`}
    >
      <span>{emoji}</span>
      <span className="capitalize">{phase}</span>
      {showPosition && <span className="font-semibold">({position}%)</span>}
    </span>
  );
};
