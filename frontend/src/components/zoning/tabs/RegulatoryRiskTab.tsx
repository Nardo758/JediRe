import { T as BT } from '../../deal/bloomberg-tokens';
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

const LEVEL_CONFIG: Record<RiskLevel, { dot: string; color: string; bg: string; borderColor: string }> = {
  low:      { dot: '🟢', color: BT.greenL,  bg: BT.greenBg,  borderColor: `${BT.green}50` },
  moderate: { dot: '🟡', color: BT.amberL,  bg: BT.amberBg,  borderColor: `${BT.amber}50` },
  elevated: { dot: '🟠', color: BT.orangeL, bg: BT.orangeBg, borderColor: `${BT.orange}50` },
  high:     { dot: '🔴', color: BT.redL,    bg: BT.redBg,    borderColor: `${BT.red}50` },
};

const TREND_ICONS: Record<string, string> = {
  improving: '↓',
  stable: '→',
  worsening: '↑',
};

const STRATEGY_LEVEL_CONFIG: Record<string, { emoji: string; color: string }> = {
  favorable:   { emoji: '🟢', color: BT.greenL },
  moderate:    { emoji: '🟡', color: BT.amberL },
  elevated:    { emoji: '🟠', color: BT.orangeL },
  unfavorable: { emoji: '🔴', color: BT.redL },
};

interface RegulatoryRiskTabProps {
  dealId?: string;
  deal?: any;
}

export default function RegulatoryRiskTab({ dealId, deal }: RegulatoryRiskTabProps = {}) {
  const { setRegulatoryAlerts } = useZoningModuleStore();
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;

    async function fetchAnalysis() {
      setLoading(true);
      setQueued(false);
      setError(null);
      try {
        const token = localStorage.getItem('auth_token') || '';
        const resp = await axios.get(`/api/v1/deals/${dealId}/regulatory-risk-analysis`, {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: (status) => status < 500,
        });
        if (!cancelled) {
          if (resp.status === 202 || !resp.data?.compositeScore) {
            setQueued(true);
            setAnalysis(null);
          } else {
            setAnalysis(resp.data);
            if (resp.data.alerts) {
              setRegulatoryAlerts(resp.data.alerts);
            }
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
      <div className="rounded-lg p-6 text-center" style={{ background: BT.amberBg, border: `1px solid ${BT.amber}40` }}>
        <p className="text-sm" style={{ color: BT.amberL }}>Select a deal to view regulatory risk analysis.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 mb-4" style={{ borderColor: BT.blue }}></div>
        <p className="text-sm" style={{ color: BT.td }}>Analyzing regulatory environment...</p>
        <p className="text-xs mt-1" style={{ color: BT.td }}>Pulling costs from Data Library and consulting AI</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-6" style={{ background: BT.redBg, border: `1px solid ${BT.red}40` }}>
        <p className="text-sm font-medium" style={{ color: BT.redL }}>Regulatory Risk Analysis Error</p>
        <p className="text-xs mt-1" style={{ color: BT.redL }}>{error}</p>
      </div>
    );
  }

  if (queued) {
    return (
      <div className="rounded-lg p-8 text-center" style={{ background: BT.blueBg, border: `1px solid ${BT.blue}40` }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: BT.blue }}></div>
        <p className="text-sm font-medium" style={{ color: BT.blueL }}>Regulatory risk analysis in progress</p>
        <p className="text-xs mt-1" style={{ color: BT.blue }}>AI is analyzing the regulatory environment. Check back in 30–60 seconds.</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-lg p-6 text-center" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
        <p className="text-sm" style={{ color: BT.td }}>No regulatory risk data available.</p>
      </div>
    );
  }

  const levelCfg = LEVEL_CONFIG[analysis.compositeLevel] || LEVEL_CONFIG.moderate;
  const dlCtx = analysis.dataLibraryContext || { hasImpactFees: false, hasConstructionCosts: false, hasRentComps: false, recentProjectCount: 0, permitTimelineCount: 0 };

  return (
    <div className="space-y-6">
      <div className="rounded-lg p-4" style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: BT.text }}>
              {analysis.municipality}, {analysis.state} &mdash; {analysis.districtCode}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: BT.td }}>
              {deal?.name || deal?.address || 'Deal'} &bull; Generated {new Date(analysis.generatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(dlCtx.hasImpactFees || dlCtx.hasConstructionCosts || dlCtx.hasRentComps) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                style={{ background: BT.blueBg, color: BT.blueL, border: `1px solid ${BT.blue}40` }}>
                Data Library
              </span>
            )}
            {dlCtx.recentProjectCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                style={{ background: BT.violBg, color: BT.violL, border: `1px solid ${BT.violet}40` }}>
                {dlCtx.recentProjectCount} Benchmarks
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${BT.border}` }}>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: BT.text }}>Regulatory Risk Dashboard</h3>
            <p className="text-xs mt-0.5" style={{ color: BT.td }}>Composite Score: {analysis.compositeScore}/100</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
            style={{ background: levelCfg.bg, color: levelCfg.color, borderColor: levelCfg.borderColor }}>
            {levelCfg.dot} {analysis.compositeLevel.toUpperCase()} RISK
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: BT.bgPanel }}>
                {['Risk Category', 'Level', 'Score', 'Trend', 'Impact', 'Cost Impact'].map((h, i) => (
                  <th key={h} className={`${i === 0 ? 'text-left' : i <= 3 ? 'text-center' : 'text-left'} text-xs font-medium uppercase tracking-wide px-4 py-3`}
                    style={{ color: BT.td }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.categories.map((cat) => {
                const catLevelCfg = LEVEL_CONFIG[cat.level] || LEVEL_CONFIG.moderate;
                return (
                  <tr key={cat.category} style={{ borderTop: `1px solid ${BT.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = BT.bgPanel)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: BT.text }}>{cat.label}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: catLevelCfg.color }}>
                        <span>{catLevelCfg.dot}</span>
                        <span className="capitalize">{cat.level}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-mono" style={{ color: BT.tm }}>{cat.score}</td>
                    <td className="px-4 py-3 text-center text-sm font-mono" style={{ color: BT.tm }}>
                      {TREND_ICONS[cat.trend] || '→'}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs" style={{ color: BT.tm }}>{cat.impact}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: BT.tm }}>
                      {cat.costImpact || <span style={{ color: BT.td }}>&mdash;</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {analysis.alerts.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
          <div className="p-4" style={{ borderBottom: `1px solid ${BT.border}` }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: BT.text }}>Active Regulatory Alerts</h3>
            <p className="text-xs mt-0.5" style={{ color: BT.td }}>{analysis.alerts.length} alerts for this jurisdiction</p>
          </div>
          <div>
            {analysis.alerts.map((alert, idx) => {
              const severityColor = alert.severity === 'urgent' ? BT.redL : alert.severity === 'watch' ? BT.amberL : BT.greenL;
              const severityBg   = alert.severity === 'urgent' ? BT.redBg : alert.severity === 'watch' ? BT.amberBg : BT.greenBg;
              return (
                <div key={idx} className="p-4 transition-colors"
                  style={{ borderTop: idx > 0 ? `1px solid ${BT.border}` : 'none', background: idx === 0 && alert.severity === 'urgent' ? severityBg : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = BT.bgPanel)}
                  onMouseLeave={e => (e.currentTarget.style.background = idx === 0 && alert.severity === 'urgent' ? severityBg : 'transparent')}>
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide mt-0.5" style={{ color: severityColor }}>
                      {alert.severity === 'urgent' ? 'URGENT' : alert.severity === 'watch' ? 'WATCH' : 'OPPORTUNITY'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1" style={{ color: BT.text }}>{alert.title}</p>
                      <div className="space-y-1">
                        <p className="text-xs" style={{ color: BT.tm }}>
                          <span className="font-medium" style={{ color: BT.td }}>Impact:</span> {alert.impact}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <p className="text-xs" style={{ color: BT.tm }}>
                            <span className="font-medium" style={{ color: BT.td }}>Probability:</span> {alert.probability}
                          </p>
                          <p className="text-xs" style={{ color: BT.tm }}>
                            <span className="font-medium" style={{ color: BT.td }}>Source:</span> {alert.source}
                          </p>
                          {alert.timeframe && (
                            <p className="text-xs" style={{ color: BT.tm }}>
                              <span className="font-medium" style={{ color: BT.td }}>Timeframe:</span> {alert.timeframe}
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
        <div className="rounded-lg overflow-hidden" style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
          <div className="p-4" style={{ borderBottom: `1px solid ${BT.border}` }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: BT.text }}>Strategy-Specific Regulatory Matrix</h3>
            <p className="text-xs mt-1" style={{ color: BT.td }}>How does this jurisdiction's regulatory environment affect each investment strategy?</p>
          </div>
          <div>
            {analysis.strategyMatrix.map((row, idx) => {
              const sCfg = STRATEGY_LEVEL_CONFIG[row.level] || STRATEGY_LEVEL_CONFIG.moderate;
              return (
                <div key={row.strategy} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: idx > 0 ? `1px solid ${BT.border}` : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = BT.bgPanel)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span className="text-sm font-bold w-28 flex-shrink-0" style={{ color: BT.text }}>{row.strategy}</span>
                  <span className="text-lg flex-shrink-0">{sCfg.emoji}</span>
                  <span className="text-sm font-semibold w-24 capitalize" style={{ color: sCfg.color }}>{row.level}</span>
                  <span className="text-sm" style={{ color: BT.tm }}>&mdash; {row.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analysis.mitigationStrategies.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
          <div className="p-4" style={{ borderBottom: `1px solid ${BT.border}` }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: BT.text }}>Mitigation Strategies</h3>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {analysis.mitigationStrategies.map((strategy, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0" style={{ color: BT.blue }}>✓</span>
                  <span className="text-sm" style={{ color: BT.tm }}>{strategy}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
