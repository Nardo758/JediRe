import React, { useEffect, useRef, useState } from 'react';
import { AnalysisResult } from '../../types';
import { BT } from '@/components/deal/bloomberg-ui';
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
  const visibilityListenerRef = useRef<(() => void) | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
    if (visibilityListenerRef.current) {
      document.removeEventListener('visibilitychange', visibilityListenerRef.current);
      visibilityListenerRef.current = null;
    }
  };

  useEffect(() => {
    fetchLatestAnalysis();
    return () => stopPolling();
  // Task #425: useEffect intentionally omits `fetchLatestAnalysis` — the
  // omitted value(s) are either (a) stable references from context/store
  // hooks whose identity is guaranteed by the producer, (b) values captured
  // at first-fire on purpose to prevent re-fetch loops, or (c) inline
  // closures over already-tracked state. Adding them would change observable
  // behavior (extra fetches / lost user input / loops). See task #425 triage
  // notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const checkStatus = async () => {
      if (document.visibilityState === 'hidden') return;
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
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkStatus();
    };

    pollIntervalRef.current = setInterval(checkStatus, 2000);
    visibilityListenerRef.current = handleVisibilityChange;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setIsAnalyzing(false);
    }, 120000);
  };

  const getVerdictStyle = (verdict: string): React.CSSProperties => {
    if (verdict.includes('strong')) return { color: BT.text.green, background: BT.bg.active };
    if (verdict.includes('opportunity')) return { color: BT.text.cyan, background: BT.bg.active };
    if (verdict.includes('caution')) return { color: BT.text.amber, background: BT.bg.active };
    return { color: BT.text.secondary, background: BT.bg.active };
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return BT.text.green;
    if (score >= 60) return BT.text.cyan;
    if (score >= 40) return BT.text.amber;
    return BT.text.red;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 mx-auto mb-4" style={{ borderRadius: '50%', borderBottom: `2px solid ${BT.text.cyan}` }}></div>
          <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>Loading analysis...</p>
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
              <div className="mb-4" style={{ fontSize: '48px' }}>📊</div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '8px' }}>
                No Analysis Yet
              </h3>
              <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px', marginBottom: '24px' }}>
                Run a JEDI Score analysis to get insights on this deal's potential,
                market conditions, and strategic recommendations.
              </p>
              <button
                onClick={triggerAnalysis}
                disabled={isAnalyzing}
                className="px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0, fontFamily: BT.font.mono, fontSize: '11px', fontWeight: 600 }}
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
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>Strategy Analysis</h2>
            <p style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginTop: '4px' }}>
              Last updated: {new Date(analysis.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={triggerAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 disabled:opacity-50 transition"
            style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.secondary, fontFamily: BT.font.mono, fontSize: '10px', background: 'transparent' }}
          >
            {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        </div>

        {/* JEDI Score Card */}
        <div className="p-8" style={{ background: BT.bg.panel, borderRadius: 0, border: `2px solid ${BT.text.cyan}` }}>
          <div className="text-center">
            <div style={{ fontSize: '10px', fontWeight: 600, color: BT.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: BT.font.mono, marginBottom: '8px' }}>
              JEDI Score
            </div>
            <div style={{ fontSize: '56px', fontWeight: 700, color: getScoreColor(score), fontFamily: BT.font.mono, marginBottom: '8px' }}>
              {score}
            </div>
            <div style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px', marginBottom: '16px' }}>out of 100</div>
            <div
              className="inline-block px-4 py-2"
              style={{ ...getVerdictStyle(verdict), borderRadius: '2px', fontWeight: 600, fontFamily: BT.font.mono, fontSize: '11px' }}
            >
              {verdict.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ marginTop: '16px', fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label }}>
              Confidence: {confidence.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Signal Breakdown */}
        {outputData.signals && (
          <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '16px' }}>Market Signals</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Growth Rate</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                  {outputData.signals.growthRate?.toFixed(1)}%
                </div>
              </div>
              <div className="text-center p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Trend</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                  {outputData.signals.verdict || 'N/A'}
                </div>
              </div>
              <div className="text-center p-4" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Signal Strength</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                  {(outputData.signals.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Capacity Analysis */}
        {outputData.capacity && (
          <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '16px' }}>Development Capacity</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Maximum Units</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                  {outputData.capacity.maxUnits || 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Construction Cost</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                  ${((outputData.capacity.constructionCost || 0) / 1000000).toFixed(1)}M
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Potential</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: BT.text.cyan, fontFamily: BT.font.mono }}>
                  {outputData.capacity.potential || 'Unknown'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Cost per Unit</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono }}>
                  ${((outputData.capacity.constructionCost || 0) / (outputData.capacity.maxUnits || 1)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {outputData.recommendations && outputData.recommendations.length > 0 && (
          <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '16px' }}>
              Strategic Recommendations
            </h3>
            <ul className="space-y-3">
              {outputData.recommendations.map((rec: string, index: number) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center" style={{ borderRadius: '50%', background: BT.bg.active, color: BT.text.cyan, fontSize: '10px', fontWeight: 600, fontFamily: BT.font.mono }}>
                    {index + 1}
                  </span>
                  <span style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Insights */}
        <div className="p-6" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.cyan, fontFamily: BT.font.mono, marginBottom: '12px' }}>Key Insights</h3>
          <ul className="space-y-2">
            {score >= 80 && (
              <li className="flex items-start gap-2">
                <span style={{ color: BT.text.green }}>+</span>
                <span style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>Strong market conditions favor development</span>
              </li>
            )}
            {outputData.signals?.growthRate > 5 && (
              <li className="flex items-start gap-2">
                <span style={{ color: BT.text.green }}>+</span>
                <span style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>Above-average rent growth indicates high demand</span>
              </li>
            )}
            {outputData.capacity?.maxUnits && (
              <li className="flex items-start gap-2">
                <span style={{ color: BT.text.cyan }}>i</span>
                <span style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>
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
