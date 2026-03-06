/**
 * ExitWindowGauge - Exit timing dial based on M28 divergence
 * Shows optimal exit window (0-100%) derived from RSS Market_Window = 35% of divergence
 * Usage: <ExitWindowGauge marketId="tampa-msa" />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { DivergenceResult } from '../../../types/m28.types';

interface ExitWindowGaugeProps {
  marketId: string;
  size?: number;
}

export const ExitWindowGauge: React.FC<ExitWindowGaugeProps> = ({
  marketId,
  size = 200,
}) => {
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
      <div
        style={{ width: size, height: size }}
        className="bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"
      >
        <span className="text-gray-400 text-sm">Loading...</span>
      </div>
    );
  }

  // Calculate exit window: Market_Window = 35% of RSS Score
  // RSS depends on divergence: positive divergence = lower exit urgency
  // Negative divergence = higher exit urgency
  
  // Normalize divergence to 0-100 scale
  // -20 divergence = 100% exit urgency
  // +20 divergence = 0% exit urgency
  const normalizedDivergence = Math.max(-20, Math.min(20, divergence.divergence));
  const exitUrgency = ((20 - normalizedDivergence) / 40) * 100;
  
  // Market window is inversely related: high urgency = small window
  const marketWindow = 100 - exitUrgency;

  // Gauge rotation: -90 (left/red) to +90 (right/green)
  const rotation = (marketWindow / 100) * 180 - 90;

  // Color coding
  let gaugeColor = '';
  let statusText = '';
  let statusEmoji = '';

  if (marketWindow < 25) {
    gaugeColor = '#EF4444'; // red
    statusText = 'Consider Exit';
    statusEmoji = '🚪';
  } else if (marketWindow < 50) {
    gaugeColor = '#F97316'; // orange
    statusText = 'Monitor Timing';
    statusEmoji = '⏱️';
  } else if (marketWindow < 75) {
    gaugeColor = '#3B82F6'; // blue
    statusText = 'Hold Window Open';
    statusEmoji = '🤝';
  } else {
    gaugeColor = '#10B981'; // green
    statusText = 'Optimal Hold';
    statusEmoji = '✅';
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{statusEmoji}</span>
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Exit Window</h3>
          <p className="text-xs text-gray-500">{statusText}</p>
        </div>
      </div>

      {/* Gauge visual */}
      <div className="relative" style={{ width: size, height: size * 0.6 }}>
        <svg
          width={size}
          height={size * 0.6}
          viewBox={`0 0 ${size} ${size * 0.6}`}
          className="mx-auto"
        >
          {/* Background arc */}
          <path
            d={`M ${size * 0.1} ${size * 0.5} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.9} ${size * 0.5}`}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="20"
            strokeLinecap="round"
          />

          {/* Colored segments */}
          {/* Red zone (0-25%) */}
          <path
            d={`M ${size * 0.1} ${size * 0.5} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.325} ${size * 0.25}`}
            fill="none"
            stroke="#EF4444"
            strokeWidth="20"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Orange zone (25-50%) */}
          <path
            d={`M ${size * 0.325} ${size * 0.25} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.5} ${size * 0.1}`}
            fill="none"
            stroke="#F97316"
            strokeWidth="20"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Blue zone (50-75%) */}
          <path
            d={`M ${size * 0.5} ${size * 0.1} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.675} ${size * 0.25}`}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="20"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Green zone (75-100%) */}
          <path
            d={`M ${size * 0.675} ${size * 0.25} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.9} ${size * 0.5}`}
            fill="none"
            stroke="#10B981"
            strokeWidth="20"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Active arc up to current position */}
          <path
            d={`M ${size * 0.1} ${size * 0.5} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.9} ${size * 0.5}`}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${(marketWindow / 100) * (size * 1.25)} ${size * 1.25}`}
          />

          {/* Needle */}
          <g transform={`translate(${size / 2}, ${size * 0.5})`}>
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={-size * 0.35}
              stroke={gaugeColor}
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${rotation})`}
            />
            <circle cx="0" cy="0" r="6" fill={gaugeColor} />
          </g>

          {/* Scale labels */}
          <text x={size * 0.1} y={size * 0.55} textAnchor="middle" className="text-xs fill-gray-400">
            0%
          </text>
          <text x={size * 0.5} y={size * 0.05} textAnchor="middle" className="text-xs fill-gray-400">
            50%
          </text>
          <text x={size * 0.9} y={size * 0.55} textAnchor="middle" className="text-xs fill-gray-400">
            100%
          </text>
        </svg>

        {/* Center value display */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
          <div className="text-3xl font-bold" style={{ color: gaugeColor }}>
            {Math.round(marketWindow)}%
          </div>
          <div className="text-xs text-gray-500">Market Window</div>
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-gray-500">Divergence</div>
          <div className="font-semibold text-gray-900">
            {divergence.divergence > 0 ? '+' : ''}
            {divergence.divergence.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-gray-500">Confidence</div>
          <div className="font-semibold text-gray-900">
            {Math.round(divergence.confidence * 100)}%
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        Based on RSS Market_Window formula (35% of divergence)
      </div>
    </div>
  );
};
