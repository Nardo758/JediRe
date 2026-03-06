/**
 * PredictedJEDIScore - Forward-looking JEDI score projection (6-12 months)
 * Uses M28 cycle momentum to predict future JEDI score
 * Usage: <PredictedJEDIScore marketId="tampa-msa" currentJEDI={75} />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { CycleSnapshot } from '../../../types/m28.types';

interface PredictedJEDIScoreProps {
  marketId: string;
  currentJEDI: number;
  dealId?: string;
}

export const PredictedJEDIScore: React.FC<PredictedJEDIScoreProps> = ({
  marketId,
  currentJEDI,
  dealId,
}) => {
  const [snapshot, setSnapshot] = useState<CycleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCyclePhase = async () => {
      try {
        const data = await m28Client.getCyclePhase(marketId);
        setSnapshot(data);
      } catch (err) {
        console.error('Error fetching cycle phase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCyclePhase();
  }, [marketId]);

  if (loading || !snapshot) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-24 bg-gray-300 rounded"></div>
      </div>
    );
  }

  // Calculate predicted JEDI based on cycle momentum
  // Momentum signal (F04) = leading position - lagging position
  const momentum = snapshot.lead_position - snapshot.lag_position;
  
  // Predict JEDI change based on:
  // - Positive momentum → JEDI increases
  // - Negative momentum → JEDI decreases
  // - Scale: ±20 points max swing
  const momentumImpact = momentum * 20;
  
  // Phase-specific multipliers
  const phaseMultipliers = {
    expansion: 1.2,   // Expansion phase amplifies gains
    recovery: 1.1,    // Recovery provides modest boost
    recession: 0.8,   // Recession dampens scores
    hypersupply: 0.7, // Hypersupply significantly dampens
  };
  
  const phaseMultiplier = phaseMultipliers[snapshot.lag_phase];
  const rawPrediction = currentJEDI + (momentumImpact * phaseMultiplier);
  
  // Clamp to 0-100 range
  const predictedJEDI = Math.max(0, Math.min(100, Math.round(rawPrediction)));
  
  const change = predictedJEDI - currentJEDI;
  const isPositive = change > 0;
  const isSignificant = Math.abs(change) > 5;

  // Trend indicators
  const trendEmoji = isPositive ? '📈' : change < 0 ? '📉' : '➡️';
  const trendColor = isPositive ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600';
  const bgColor = isPositive ? 'bg-green-50 border-green-200' : change < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';

  return (
    <div className={`border rounded-lg p-4 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{trendEmoji}</span>
        <div>
          <h3 className="font-semibold text-sm text-gray-900">
            Predicted JEDI Score
          </h3>
          <p className="text-xs text-gray-500">6-12 Month Forecast</p>
        </div>
      </div>

      {/* Score comparison */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Current */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Current</div>
          <div className="text-2xl font-bold text-gray-900">{currentJEDI}</div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <span className={`text-3xl ${trendColor}`}>
            {isPositive ? '→' : change < 0 ? '→' : '→'}
          </span>
        </div>

        {/* Predicted */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Predicted</div>
          <div className={`text-2xl font-bold ${trendColor}`}>
            {predictedJEDI}
          </div>
        </div>
      </div>

      {/* Change indicator */}
      <div className="bg-white/50 rounded-lg p-3 text-center mb-3">
        <div className="text-xs text-gray-600 mb-1">Expected Change</div>
        <div className={`text-lg font-bold ${trendColor}`}>
          {change > 0 ? '+' : ''}{change} points
          {isSignificant && ' 🔥'}
        </div>
        {isSignificant && (
          <div className="text-xs text-gray-500 mt-1">
            Significant movement expected
          </div>
        )}
      </div>

      {/* Momentum breakdown */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Cycle Momentum:</span>
          <span className="font-semibold text-gray-900">
            {momentum > 0 ? '+' : ''}{(momentum * 100).toFixed(1)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Phase Impact:</span>
          <span className="font-semibold text-gray-900 capitalize">
            {snapshot.lag_phase} (×{phaseMultiplier})
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Confidence:</span>
          <span className="font-semibold text-gray-900">
            {Math.round(snapshot.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Warning for low momentum */}
      {Math.abs(momentum) < 0.1 && (
        <div className="mt-3 pt-3 border-t border-current/20 text-xs text-gray-500 text-center">
          ⚠️ Low momentum - score expected to remain stable
        </div>
      )}

      {/* Recommendation */}
      {isSignificant && (
        <div className="mt-3 pt-3 border-t border-current/20">
          <div className="text-xs font-medium text-gray-700 mb-1">
            Recommendation:
          </div>
          <div className="text-xs text-gray-600">
            {isPositive ? (
              <>Monitor for upside opportunities. Favorable cycle momentum supports deal performance.</>
            ) : (
              <>Review deal assumptions. Cycle headwinds may pressure returns.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
