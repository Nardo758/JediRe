import React, { useState, useEffect } from 'react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import axios from 'axios';

type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';

interface RiskCategory {
  category: string;
  label: string;
  level: RiskLevel;
  score: number;
  trend: 'improving' | 'stable' | 'worsening';
  impact: string;
  costImpact: string | null;
  source: string;
}

interface StrategyRow {
  strategy: string;
  level: string;
  description: string;
}

interface RiskAlert {
  severity: 'urgent' | 'watch' | 'opportunity';
  title: string;
  impact: string;
  probability: string;
  source: string;
  timeframe?: string;
}

interface RiskAnalysis {
  dealId: string;
  municipality: string;
  state: string;
  districtCode: string;
  compositeScore: number;
  compositeLevel: RiskLevel;
  categories: RiskCategory[];
  strategyMatrix: StrategyRow[];
  alerts: RiskAlert[];
  mitigationStrategies: string[];
  dataLibraryContext: {
    hasImpactFees: boolean;
    hasConstructionCosts: boolean;
    hasRentComps: boolean;
    recentProjectCount: number;
    permitTimelineCount: number;
  };
  generatedAt: string;
}

const LEVEL_CONFIG: Record<RiskLevel, { dot: string; bg: string; badge: string }> = {
  low: { dot: '\u{1F7E2}', bg: 'text-green-700', badge: 'bg-green-100 text-green-800 border-green-200' },
  moderate: { dot: '\u{1F7E1}', bg: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  elevated: { dot: '\u{1F7E0}', bg: 'text-orange-700', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  high: { dot: '\u{1F534}', bg: 'text-red-700', badge: 'bg-red-100 text-red-800 border-red-200' },
};

const TREND_ICONS: Record<string, string> = {
  improving: '\u2193',
  stable: '\u2192',
  worsening: '\u2191',
};

const STRATEGY_LEVEL_CONFIG: Record<string, { emoji: string; color: string }> = {
  favorable: { emoji: '\u{1F7E2}', color: 'text-green-700' },
  moderate: { emoji: '\u{1F7E1}', color: 'text-yellow-700' },
  elevated: { emoji: '\u{1F7E0}', color: 'text-orange-700' },
  unfavorable: { emoji: '\u{1F534}', color: 'text-red-700' },
};

interface RegulatoryRiskTabProps {
  dealId?: string;
  deal?: any;
}

export default function RegulatoryRiskTab({ dealId, deal }: RegulatoryRiskTabProps = {}) {
  const { setRegulatoryAlerts } = useZoningModuleStore();
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;

    async function fetchAnalysis() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('auth_token') || '';
        const resp = await axios.get(`/api/v1/deals/${dealId}/regulatory-risk-analysis`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          setAnalysis(resp.data);
          if (resp.data.alerts) {
            setRegulatoryAlerts(resp.data.alerts);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'Failed to load regulatory risk analysis');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAnalysis();
    return () => { cancelled = true; };
  }, [dealId, setRegulatoryAlerts]);

  if (!dealId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-sm text-yellow-700">Select a deal to view regulatory risk analysis.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-sm text-gray-500">Analyzing regulatory environment...</p>
        <p className="text-xs text-gray-400 mt-1">Pulling costs from Data Library and consulting AI</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-sm font-medium text-red-700">Regulatory Risk Analysis Error</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">No regulatory risk data available.</p>
      </div>
    );
  }

  const levelCfg = LEVEL_CONFIG[analysis.compositeLevel] || LEVEL_CONFIG.moderate;
  const dlCtx = analysis.dataLibraryContext;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {analysis.municipality}, {analysis.state} &mdash; {analysis.districtCode}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {deal?.name || deal?.address || 'Deal'} &bull; Generated {new Date(analysis.generatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(dlCtx.hasImpactFees || dlCtx.hasConstructionCosts || dlCtx.hasRentComps) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                Data Library
              </span>
            )}
            {dlCtx.recentProjectCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                {dlCtx.recentProjectCount} Benchmarks
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Regulatory Risk Dashboard</h3>
            <p className="text-xs text-gray-500 mt-0.5">Composite Score: {analysis.compositeScore}/100</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${levelCfg.badge}`}>
            {levelCfg.dot} {analysis.compositeLevel.toUpperCase()} RISK
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Risk Category</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Level</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Score</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Trend</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Impact</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Cost Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analysis.categories.map((cat) => {
                const catLevelCfg = LEVEL_CONFIG[cat.level] || LEVEL_CONFIG.moderate;
                return (
                  <tr key={cat.category} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cat.label}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${catLevelCfg.bg}`}>
                        <span>{catLevelCfg.dot}</span>
                        <span className="capitalize">{cat.level}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-mono text-gray-700">{cat.score}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 font-mono">
                      {TREND_ICONS[cat.trend] || '\u2192'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">{cat.impact}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cat.costImpact || <span className="text-gray-400">&mdash;</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {analysis.alerts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Active Regulatory Alerts</h3>
            <p className="text-xs text-gray-500 mt-0.5">{analysis.alerts.length} alerts for this jurisdiction</p>
          </div>
          <div className="divide-y divide-gray-100">
            {analysis.alerts.map((alert, idx) => {
              const severityColor = alert.severity === 'urgent' ? 'text-red-700' :
                alert.severity === 'watch' ? 'text-yellow-700' : 'text-green-700';
              const severityBg = alert.severity === 'urgent' ? 'bg-red-50' :
                alert.severity === 'watch' ? 'bg-yellow-50' : 'bg-green-50';
              return (
                <div key={idx} className={`p-4 hover:bg-gray-50 transition-colors ${idx === 0 && alert.severity === 'urgent' ? severityBg : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-bold uppercase tracking-wide mt-0.5 ${severityColor}`}>
                      {alert.severity === 'urgent' ? 'URGENT' : alert.severity === 'watch' ? 'WATCH' : 'OPPORTUNITY'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 mb-1">{alert.title}</p>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium text-gray-500">Impact:</span> {alert.impact}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <p className="text-xs text-gray-600">
                            <span className="font-medium text-gray-500">Probability:</span> {alert.probability}
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium text-gray-500">Source:</span> {alert.source}
                          </p>
                          {alert.timeframe && (
                            <p className="text-xs text-gray-600">
                              <span className="font-medium text-gray-500">Timeframe:</span> {alert.timeframe}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analysis.strategyMatrix.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Strategy-Specific Regulatory Matrix</h3>
            <p className="text-xs text-gray-500 mt-1">How does this jurisdiction's regulatory environment affect each investment strategy?</p>
          </div>
          <div className="divide-y divide-gray-100">
            {analysis.strategyMatrix.map((row) => {
              const sCfg = STRATEGY_LEVEL_CONFIG[row.level] || STRATEGY_LEVEL_CONFIG.moderate;
              return (
                <div key={row.strategy} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="text-sm font-bold text-gray-900 w-28 flex-shrink-0">{row.strategy}</span>
                  <span className="text-lg flex-shrink-0">{sCfg.emoji}</span>
                  <span className={`text-sm font-semibold w-24 capitalize ${sCfg.color}`}>
                    {row.level}
                  </span>
                  <span className="text-sm text-gray-600">&mdash; {row.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analysis.mitigationStrategies.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Mitigation Strategies</h3>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {analysis.mitigationStrategies.map((strategy, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">&#x2713;</span>
                  <span className="text-sm text-gray-700">{strategy}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
