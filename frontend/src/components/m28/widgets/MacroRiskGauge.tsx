/**
 * MacroRiskGauge - Displays current macro risk score (0-100)
 * Usage: <MacroRiskGauge />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { MacroRiskScore } from '../../../types/m28.types';

const riskColors = {
  low: 'text-green-600 bg-green-50 border-green-300',
  moderate: 'text-blue-600 bg-blue-50 border-blue-300',
  elevated: 'text-orange-600 bg-orange-50 border-orange-300',
  high: 'text-red-600 bg-red-50 border-red-300',
};

const riskEmoji = {
  low: '✅',
  moderate: '⚠️',
  elevated: '🔶',
  high: '🚨',
};

export const MacroRiskGauge: React.FC = () => {
  const [riskScore, setRiskScore] = useState<MacroRiskScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRiskScore = async () => {
      try {
        const data = await m28Client.getMacroRiskScore();
        setRiskScore(data);
      } catch (err) {
        console.error('Error fetching macro risk score:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRiskScore();
    // Refresh every 10 minutes
    const interval = setInterval(fetchRiskScore, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !riskScore) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-20 bg-gray-300 rounded"></div>
      </div>
    );
  }

  const colorClass = riskColors[riskScore.category];
  const emoji = riskEmoji[riskScore.category];

  // Calculate gauge rotation (-90 to 90 degrees, where 0 is center)
  const rotation = (riskScore.score / 100) * 180 - 90;

  return (
    <div className={`border rounded-lg p-4 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h3 className="font-semibold text-sm">Macro Risk</h3>
          <p className="text-xs capitalize opacity-80">{riskScore.category}</p>
        </div>
      </div>

      {/* Gauge Visual */}
      <div className="relative w-32 h-16 mx-auto mb-3">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 50 A 50 50 0 0 1 110 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            opacity="0.2"
          />
          
          {/* Score arc */}
          <path
            d="M 10 50 A 50 50 0 0 1 110 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={`${(riskScore.score / 100) * 157} 157`}
          />
          
          {/* Needle */}
          <line
            x1="60"
            y1="50"
            x2="60"
            y2="15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${rotation} 60 50)`}
          />
          <circle cx="60" cy="50" r="3" fill="currentColor" />
        </svg>

        {/* Score number */}
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-2xl font-bold">
          {riskScore.score}
        </div>
      </div>

      {/* Risk breakdown */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="opacity-70">Rate Shock:</span>
          <span className="font-semibold">{riskScore.rate_shock_risk}/10</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">Recession:</span>
          <span className="font-semibold">{riskScore.recession_risk}/10</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">Policy Uncertainty:</span>
          <span className="font-semibold">{riskScore.policy_uncertainty}/10</span>
        </div>
      </div>

      {riskScore.drivers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-current/20">
          <div className="text-xs opacity-70 mb-1">Key Drivers:</div>
          <div className="flex flex-wrap gap-1">
            {riskScore.drivers.slice(0, 3).map((driver, idx) => (
              <span
                key={idx}
                className="inline-block px-2 py-0.5 bg-current/10 rounded text-[10px]"
              >
                {driver}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
