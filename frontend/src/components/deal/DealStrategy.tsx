import React, { useEffect, useRef, useState } from 'react';
import { AnalysisResult } from '../../types';
import LeaseRolloverAnalysis from './LeaseRolloverAnalysis';

interface DealStrategyProps {
  dealId: string;
}

export const DealStrategy: React.FC<DealStrategyProps> = ({ dealId }) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
  };

  useEffect(() => {
    fetchLatestAnalysis();
    return () => stopPolling();
  }, [dealId]);

  const fetchLatestAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/deals/${dealId}/analysis/latest`);
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`/api/v1/deals/${dealId}/analysis/trigger`, {
        method: 'POST'
      });
      if (response.ok) {
        pollAnalysisStatus(Date.now());
      }
    } catch (error) {
      console.error('Failed to trigger analysis:', error);
      setIsAnalyzing(false);
    }
  };

  const pollAnalysisStatus = (triggeredAt: number) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/deals/${dealId}/analysis/latest`);
        if (response.ok) {
          const data = await response.json();
          if (new Date(data.createdAt).getTime() > triggeredAt) {
            setAnalysis(data);
            setIsAnalyzing(false);
            stopPolling();
          }
        }
      } catch {
        // swallow — timeout will clean up
      }
    }, 2000);

    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setIsAnalyzing(false);
    }, 120000);
  };

  const getVerdictColor = (verdict: string) => {
    if (verdict.includes('strong')) return 'text-green-600 bg-[#022c22]';
    if (verdict.includes('opportunity')) return 'text-blue-600 bg-[#0d1e3d]';
    if (verdict.includes('caution')) return 'text-yellow-600 bg-[#1a1200]';
    return 'text-[#9EA8B4] bg-[#0F1319]';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-[#9EA8B4]">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-[#E8E6E1] mb-2">
                No Analysis Yet
              </h3>
              <p className="text-[#9EA8B4] mb-6">
                Run a JEDI Score analysis to get insights on this deal's potential,
                market conditions, and strategic recommendations.
              </p>
              <button
                onClick={triggerAnalysis}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </div>
          </div>
          <LeaseRolloverAnalysis dealId={dealId} />
        </div>
      </div>
    );
  }

  const { outputData } = analysis;
  const score = outputData.score || 0;
  const verdict = outputData.verdict || 'unknown';
  const confidence = (Number(analysis.confidence) || 0) * 100;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#E8E6E1]">Strategy Analysis</h2>
            <p className="text-sm text-[#9EA8B4] mt-1">
              Last updated: {new Date(analysis.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={triggerAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 border border-[#253347] rounded-lg hover:bg-[#0F1319] disabled:opacity-50 transition text-sm"
          >
            {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        </div>

        {/* JEDI Score Card */}
        <div className="bg-[#0F1319] rounded-xl shadow-lg p-8 border-2 border-blue-900/50">
          <div className="text-center">
            <div className="text-sm font-semibold text-[#9EA8B4] uppercase tracking-wider mb-2">
              JEDI Score
            </div>
            <div className={`text-7xl font-bold ${getScoreColor(score)} mb-2`}>
              {score}
            </div>
            <div className="text-[#9EA8B4] mb-4">out of 100</div>
            <div className={`inline-block px-4 py-2 rounded-full font-semibold ${getVerdictColor(verdict)}`}>
              {verdict.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div className="mt-4 text-sm text-[#9EA8B4]">
              Confidence: {confidence.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Signal Breakdown */}
        {outputData.signals && (
          <div className="bg-[#0F1319] rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-[#E8E6E1] mb-4">Market Signals</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-[#0F1319] rounded-lg">
                <div className="text-sm text-[#9EA8B4] mb-1">Growth Rate</div>
                <div className="text-2xl font-bold text-[#E8E6E1]">
                  {outputData.signals.growthRate?.toFixed(1)}%
                </div>
              </div>
              <div className="text-center p-4 bg-[#0F1319] rounded-lg">
                <div className="text-sm text-[#9EA8B4] mb-1">Trend</div>
                <div className="text-2xl font-bold text-[#E8E6E1]">
                  {outputData.signals.verdict || 'N/A'}
                </div>
              </div>
              <div className="text-center p-4 bg-[#0F1319] rounded-lg">
                <div className="text-sm text-[#9EA8B4] mb-1">Signal Strength</div>
                <div className="text-2xl font-bold text-[#E8E6E1]">
                  {(outputData.signals.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Capacity Analysis */}
        {outputData.capacity && (
          <div className="bg-[#0F1319] rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-[#E8E6E1] mb-4">Development Capacity</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-[#9EA8B4] mb-1">Maximum Units</div>
                <div className="text-3xl font-bold text-[#E8E6E1]">
                  {outputData.capacity.maxUnits || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#9EA8B4] mb-1">Construction Cost</div>
                <div className="text-3xl font-bold text-[#E8E6E1]">
                  ${((outputData.capacity.constructionCost || 0) / 1000000).toFixed(1)}M
                </div>
              </div>
              <div>
                <div className="text-sm text-[#9EA8B4] mb-1">Potential</div>
                <div className="text-xl font-semibold text-blue-600">
                  {outputData.capacity.potential || 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#9EA8B4] mb-1">Cost per Unit</div>
                <div className="text-xl font-semibold text-[#E8E6E1]">
                  ${((outputData.capacity.constructionCost || 0) / (outputData.capacity.maxUnits || 1)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {outputData.recommendations && outputData.recommendations.length > 0 && (
          <div className="bg-[#0F1319] rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-[#E8E6E1] mb-4">
              Strategic Recommendations
            </h3>
            <ul className="space-y-3">
              {outputData.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0d1e3d] text-blue-600 flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-[#9EA8B4]">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Insights */}
        <div className="bg-[#0d1e3d] rounded-lg p-6 border border-blue-900/50">
          <h3 className="text-lg font-bold text-blue-300 mb-3">Key Insights</h3>
          <ul className="space-y-2 text-blue-300">
            {score >= 80 && (
              <li className="flex items-start gap-2">
                <span className="text-green-500">+</span>
                <span>Strong market conditions favor development</span>
              </li>
            )}
            {outputData.signals?.growthRate > 5 && (
              <li className="flex items-start gap-2">
                <span className="text-green-500">+</span>
                <span>Above-average rent growth indicates high demand</span>
              </li>
            )}
            {outputData.capacity?.maxUnits && (
              <li className="flex items-start gap-2">
                <span className="text-blue-500">i</span>
                <span>
                  Development capacity of {outputData.capacity.maxUnits} units identified
                </span>
              </li>
            )}
          </ul>
        </div>

        <LeaseRolloverAnalysis dealId={dealId} />
      </div>
    </div>
  );
};
