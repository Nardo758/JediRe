/**
 * Custom Screen Tab - Strategy Scoring for Individual Deal
 * Displays user's saved strategies with pass/fail indicators and scores
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../services/api.client';
import { useNavigate } from 'react-router-dom';

interface CustomStrategyScore {
  strategyId: string;
  strategyName: string;
  score: number;
  matched: boolean;
  conditionResults: Array<{
    conditionId: string;
    metricId: string;
    actualValue: number;
    passed: boolean;
    score: number;
  }>;
}

interface CustomScreenTabProps {
  dealId: string;
}

export const CustomScreenTab: React.FC<CustomScreenTabProps> = ({ dealId }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [customStrategies, setCustomStrategies] = useState<CustomStrategyScore[]>([]);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  useEffect(() => {
    const loadCustomStrategies = async () => {
      try {
        setIsLoading(true);
        setIsError(false);

        // Call POST /api/v1/strategies/score-deal/:dealId
        const response = await apiClient.post(`/api/v1/strategies/score-deal/${dealId}`);

        if (response.data.success && response.data.data) {
          setCustomStrategies(response.data.data);
        } else {
          setCustomStrategies([]);
        }
      } catch (error: any) {
        console.error('Error loading custom strategies:', error);
        setIsError(true);
        setErrorMessage(error.response?.data?.error || 'Failed to load custom strategies');
        setCustomStrategies([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (dealId) {
      loadCustomStrategies();
    }
  }, [dealId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Evaluating strategies...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-red-600 text-lg">⚠️</div>
          <div className="flex-1">
            <h4 className="font-semibold text-red-900 mb-1">Failed to Load Strategies</h4>
            <p className="text-sm text-red-800">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (customStrategies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3">📭</div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">No Custom Strategies Yet</h4>
        <p className="text-sm text-gray-600 mb-4 max-w-sm">
          Create your first custom strategy to evaluate this deal against your specific criteria.
        </p>
        <button
          onClick={() => navigate('/strategies')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          + Create Strategy
        </button>
      </div>
    );
  }

  // Separate matched and unmatched strategies
  const matchedStrategies = customStrategies.filter(s => s.matched);
  const unmatchedStrategies = customStrategies.filter(s => !s.matched);

  return (
    <div className="space-y-4">
      {/* Matched Strategies */}
      {matchedStrategies.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            Matched Strategies ({matchedStrategies.length})
          </h4>
          <div className="space-y-2">
            {matchedStrategies.map((strategy) => (
              <StrategyCard
                key={strategy.strategyId}
                strategy={strategy}
                isExpanded={expandedStrategy === strategy.strategyId}
                onToggleExpand={() =>
                  setExpandedStrategy(
                    expandedStrategy === strategy.strategyId ? null : strategy.strategyId
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Unmatched Strategies */}
      {unmatchedStrategies.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-gray-400">✗</span>
            Didn't Match ({unmatchedStrategies.length})
          </h4>
          <div className="space-y-2">
            {unmatchedStrategies.map((strategy) => (
              <StrategyCard
                key={strategy.strategyId}
                strategy={strategy}
                isExpanded={expandedStrategy === strategy.strategyId}
                onToggleExpand={() =>
                  setExpandedStrategy(
                    expandedStrategy === strategy.strategyId ? null : strategy.strategyId
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Strategy CTA */}
      <button
        onClick={() => navigate('/strategies')}
        className="w-full mt-4 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition text-sm font-medium flex items-center justify-center gap-2"
      >
        <span>+</span>
        <span>Create New Strategy</span>
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface StrategyCardProps {
  strategy: CustomStrategyScore;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy, isExpanded, onToggleExpand }) => {
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-emerald-50';
    if (score >= 60) return 'bg-blue-50';
    if (score >= 40) return 'bg-amber-50';
    return 'bg-red-50';
  };

  return (
    <div
      className={`border rounded-lg transition-all cursor-pointer ${
        isExpanded
          ? 'border-blue-300 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Header */}
      <div
        onClick={onToggleExpand}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Pass/Fail Icon */}
          <div className="text-lg">
            {strategy.matched ? (
              <span title="Strategy matched">✓</span>
            ) : (
              <span className="text-gray-300" title="Strategy didn't match">
                ✗
              </span>
            )}
          </div>

          {/* Strategy Name */}
          <div className="flex-1 min-w-0">
            <h5 className="font-semibold text-gray-900 text-sm truncate">
              {strategy.strategyName}
            </h5>
          </div>
        </div>

        {/* Score */}
        {strategy.matched && (
          <div className={`${getScoreBgColor(strategy.score)} ${getScoreColor(strategy.score)} px-3 py-1 rounded font-semibold text-sm`}>
            {strategy.score.toFixed(1)}
          </div>
        )}

        {/* Expand Icon */}
        <div className="ml-2 text-gray-400 flex-shrink-0">
          {isExpanded ? '▲' : '▼'}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && strategy.conditionResults.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
          <h6 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
            Condition Results
          </h6>
          <div className="space-y-1.5">
            {strategy.conditionResults.map((condition) => (
              <div
                key={condition.conditionId}
                className="flex items-center gap-2 text-xs text-gray-600"
              >
                <span className="flex-shrink-0 w-4 text-center">
                  {condition.passed ? (
                    <span className="text-emerald-600 font-bold">✓</span>
                  ) : (
                    <span className="text-red-500 font-bold">✗</span>
                  )}
                </span>
                <span className="flex-1">
                  <span className="font-mono text-gray-500">{condition.metricId}</span>
                  {' = '}
                  <span className="font-semibold text-gray-700">
                    {condition.actualValue.toFixed(2)}
                  </span>
                </span>
                {condition.passed && (
                  <span className={`text-right font-semibold ${getScoreColor(condition.score)}`}>
                    +{condition.score.toFixed(0)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomScreenTab;
