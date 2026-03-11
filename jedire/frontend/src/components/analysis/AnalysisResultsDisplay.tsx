import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.client';

interface AnalysisResultsDisplayProps {
  dealId: string;
}

interface AnalysisResult {
  id: string;
  dealId: string;
  jedi_score: number;
  verdict: 'STRONG_OPPORTUNITY' | 'OPPORTUNITY' | 'NEUTRAL' | 'CAUTION' | 'AVOID';
  confidence: number;
  development_score: number;
  market_score: number;
  quality_score: number;
  location_score: number;
  recommendations: string[];
  estimated_units: number;
  estimated_cost: number;
  estimated_timeline_months: number;
  created_at: string;
}

const verdictConfig = {
  STRONG_OPPORTUNITY: {
    color: 'bg-green-600',
    textColor: 'text-green-700',
    bgLight: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'STRONG OPPORTUNITY',
    emoji: '🎯',
    description: 'Excellent conditions for development'
  },
  OPPORTUNITY: {
    color: 'bg-blue-600',
    textColor: 'text-blue-700',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'OPPORTUNITY',
    emoji: '✅',
    description: 'Good potential with favorable conditions'
  },
  NEUTRAL: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'NEUTRAL',
    emoji: '⚖️',
    description: 'Mixed signals - proceed with caution'
  },
  CAUTION: {
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    bgLight: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'CAUTION',
    emoji: '⚠️',
    description: 'Challenging conditions - significant risks'
  },
  AVOID: {
    color: 'bg-red-600',
    textColor: 'text-red-700',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'AVOID',
    emoji: '🚫',
    description: 'Unfavorable conditions - not recommended'
  }
};

export const AnalysisResultsDisplay: React.FC<AnalysisResultsDisplayProps> = ({ dealId }) => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestAnalysis();
  }, [dealId]);

  const fetchLatestAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.analysis.latest(dealId);
      setResult(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // No analysis exists yet - not an error
        setResult(null);
      } else {
        const errorMsg = err.response?.data?.message || 'Failed to fetch analysis';
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    setIsTriggering(true);
    setError(null);

    try {
      await api.analysis.trigger(dealId);
      // Wait a bit for analysis to complete, then fetch results
      setTimeout(() => {
        fetchLatestAnalysis();
        setIsTriggering(false);
      }, 2000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to trigger analysis';
      setError(errorMsg);
      setIsTriggering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analysis results...</p>
        </div>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-gray-900 font-semibold mb-2">Failed to load analysis</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchLatestAnalysis}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analysis Yet</h3>
          <p className="text-gray-600 mb-6">
            Run an analysis to calculate the JEDI Score and get AI-powered recommendations for this deal.
          </p>
          <button
            onClick={triggerAnalysis}
            disabled={isTriggering}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTriggering ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Running Analysis...
              </>
            ) : (
              '▶️ Run Analysis'
            )}
          </button>
        </div>
      </div>
    );
  }

  const config = verdictConfig[result.verdict];
  const jediScore = Math.round(result.jedi_score);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {new Date(result.created_at).toLocaleString()}
          </span>
          <button
            onClick={triggerAnalysis}
            disabled={isTriggering}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
          >
            {isTriggering ? '⏳ Running...' : '🔄 Re-run Analysis'}
          </button>
        </div>
      </div>

      {/* JEDI Score Card */}
      <div className={`${config.bgLight} ${config.borderColor} border-2 rounded-xl p-8`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl">{config.emoji}</span>
              <div>
                <h3 className={`text-2xl font-bold ${config.textColor}`}>
                  {config.label}
                </h3>
                <p className="text-gray-600">{config.description}</p>
              </div>
            </div>
          </div>
          
          {/* JEDI Score Circle */}
          <div className="flex flex-col items-center">
            <div className="relative w-32 h-32">
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(jediScore / 100) * 351.86} 351.86`}
                  className={config.textColor}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-4xl font-bold ${config.textColor}`}>{jediScore}</div>
                <div className="text-xs text-gray-600 font-medium">JEDI Score</div>
              </div>
            </div>
            <div className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${
              result.confidence >= 0.7 ? 'bg-green-100 text-green-700' :
              result.confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {Math.round(result.confidence * 100)}% Confidence
            </div>
          </div>
        </div>

        {/* Component Scores */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(result.development_score)}
            </div>
            <div className="text-xs text-gray-600 mt-1">Development</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(result.market_score)}
            </div>
            <div className="text-xs text-gray-600 mt-1">Market</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(result.quality_score)}
            </div>
            <div className="text-xs text-gray-600 mt-1">Quality</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(result.location_score)}
            </div>
            <div className="text-xs text-gray-600 mt-1">Location</div>
          </div>
        </div>
      </div>

      {/* Project Estimates */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Estimates</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Estimated Units</div>
            <div className="text-2xl font-bold text-gray-900">
              {result.estimated_units.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Estimated Cost</div>
            <div className="text-2xl font-bold text-gray-900">
              ${(result.estimated_cost / 1000000).toFixed(1)}M
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Timeline</div>
            <div className="text-2xl font-bold text-gray-900">
              {result.estimated_timeline_months} months
            </div>
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🤖 AI Recommendations
        </h3>
        {result.recommendations.length > 0 ? (
          <div className="space-y-3">
            {result.recommendations.map((rec, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                  {idx + 1}
                </div>
                <p className="text-gray-700 flex-1">{rec}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No specific recommendations at this time.</p>
        )}
      </div>

      {/* Error Display (if any during re-run) */}
      {error && result && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">⚠️ {error}</p>
        </div>
      )}
    </div>
  );
};
