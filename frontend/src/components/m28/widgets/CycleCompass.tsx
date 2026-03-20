/**
 * CycleCompass - 4-market dashboard widget showing all markets on compass
 * Usage: <CycleCompass marketIds={['tampa-msa', 'atlanta-msa', 'orlando-msa', 'miami-msa']} />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { CycleSnapshot, CyclePhase } from '../../../types/m28.types';

interface CycleCompassProps {
  marketIds: string[];
  size?: number;
}

const phasePositions: Record<CyclePhase, { x: number; y: number }> = {
  recession: { x: 25, y: 75 },     // Bottom-left
  recovery: { x: 75, y: 75 },      // Bottom-right
  expansion: { x: 75, y: 25 },     // Top-right
  hypersupply: { x: 25, y: 25 },   // Top-left
};

const phaseColors: Record<CyclePhase, string> = {
  recession: '#EF4444',
  recovery: '#F59E0B',
  expansion: '#10B981',
  hypersupply: '#F97316',
};

const phaseLabels: Record<CyclePhase, string> = {
  recession: 'Recession',
  recovery: 'Recovery',
  expansion: 'Expansion',
  hypersupply: 'Hypersupply',
};

export const CycleCompass: React.FC<CycleCompassProps> = ({
  marketIds,
  size = 400,
}) => {
  const [snapshots, setSnapshots] = useState<CycleSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const data = await Promise.all(
          marketIds.map(id => m28Client.getCyclePhase(id))
        );
        setSnapshots(data);
      } catch (err) {
        console.error('Error fetching cycle phases:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, [marketIds]);

  if (loading) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"
      >
        <span className="text-gray-400">Loading markets...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🧭</span>
        <h3 className="font-semibold text-lg text-gray-900">
          Market Cycle Compass
        </h3>
      </div>

      <svg width={size} height={size} className="mx-auto">
        {/* Grid lines */}
        <line
          x1={size / 2}
          y1={0}
          x2={size / 2}
          y2={size}
          stroke="#E5E7EB"
          strokeWidth="1"
        />
        <line
          x1={0}
          y1={size / 2}
          x2={size}
          y2={size / 2}
          stroke="#E5E7EB"
          strokeWidth="1"
        />

        {/* Quadrant labels */}
        <text x={size * 0.75} y={size * 0.15} textAnchor="middle" className="text-xs fill-green-600 font-semibold">
          {phaseLabels.expansion}
        </text>
        <text x={size * 0.25} y={size * 0.15} textAnchor="middle" className="text-xs fill-orange-600 font-semibold">
          {phaseLabels.hypersupply}
        </text>
        <text x={size * 0.25} y={size * 0.9} textAnchor="middle" className="text-xs fill-red-600 font-semibold">
          {phaseLabels.recession}
        </text>
        <text x={size * 0.75} y={size * 0.9} textAnchor="middle" className="text-xs fill-amber-600 font-semibold">
          {phaseLabels.recovery}
        </text>

        {/* Plot markets */}
        {snapshots.map((snapshot, idx) => {
          const basePos = phasePositions[snapshot.lag_phase];
          const position = snapshot.lag_position;
          
          // Add some variance based on position within phase
          const offsetX = (Math.random() - 0.5) * 50 * position;
          const offsetY = (Math.random() - 0.5) * 50 * position;
          
          const x = (basePos.x / 100) * size + offsetX;
          const y = (basePos.y / 100) * size + offsetY;
          
          const color = phaseColors[snapshot.lag_phase];
          const marketLabel = snapshot.market_id.split('-')[0].toUpperCase();

          return (
            <g key={snapshot.market_id}>
              {/* Market dot */}
              <circle
                cx={x}
                cy={y}
                r={12}
                fill={color}
                opacity={0.9}
                className="cursor-pointer hover:opacity-100"
              />
              
              {/* Market label */}
              <text
                x={x}
                y={y + 25}
                textAnchor="middle"
                className="text-xs font-semibold fill-gray-700"
              >
                {marketLabel}
              </text>
              
              {/* Position percentage */}
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                className="text-[10px] font-bold fill-white"
              >
                {Math.round(position * 100)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {snapshots.map((snapshot) => {
          const marketName = snapshot.market_id.split('-')[0];
          const divergence = snapshot.divergence;
          const signal = divergence > 10 ? 'ACQUIRE' : divergence < -10 ? 'EXIT' : 'HOLD';
          const signalColor = signal === 'ACQUIRE' ? 'text-green-600' : signal === 'EXIT' ? 'text-red-600' : 'text-blue-600';

          return (
            <div key={snapshot.market_id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
              <span className="font-medium capitalize">{marketName}:</span>
              <span className={`font-bold ${signalColor}`}>{signal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
