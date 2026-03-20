import { T as BT } from '../../deal/bloomberg-tokens';
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../services/api.client';

interface HBUResult {
  propertyType: string;
  maxCapacity: number;
  maxGFA: number;
  annualGrossRevenue: number;
  estimatedNOI: number;
  estimatedValue: number;
  capRate: number;
  expenseRatio: number;
  limitingFactor: string;
  recommended: boolean;
  reasoning: string;
  permissionStatus: 'by-right' | 'conditional' | 'not-permitted' | 'not-classified';
  permissionNote: string;
}

interface UseScore {
  propertyType: string;
  profitabilityScore: number;
  approvalScore: number;
  timelineScore: number;
  compositeScore: number;
  rationale: string;
}

interface MixedUseCombination {
  combination: string;
  rationale: string;
  estimatedUplift: string;
}

interface AIAnalysis {
  recommendation: string;
  recommendedUse: string;
  confidence: string;
  useScores: UseScore[];
  mixedUseCombinations: MixedUseCombination[];
  caveats: string[];
  marketInsight: string;
}

interface BenchmarkContext {
  projectCount: number;
  avgDensityAchieved: number | null;
  avgFarAchieved: number | null;
  projects: Array<{
    name: string;
    type: string;
    units: number;
    stories: number;
    entitlementType: string;
  }>;
}

interface HBUResponse {
  hbu: HBUResult[];
  dealType: string;
  projectType: string;
  districtCode: string;
  constraintSource: string;
  permissions: { permitted: string[]; conditional: string[]; prohibited: string[] };
  benchmarkContext: BenchmarkContext | null;
  aiAnalysis: AIAnalysis | null;
}

interface HighestBestUseTabProps {
  dealId?: string;
  deal?: any;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '--';
  return v.toLocaleString();
}

function fmtDollar(v: number | null | undefined): string {
  if (v == null) return '--';
  return '$' + Math.round(v).toLocaleString();
}

function getLimitingLabel(factor: string | null): string {
  switch (factor) {
    case 'density': return 'Density';
    case 'FAR': return 'FAR';
    case 'height': return 'Height';
    case 'parking': return 'Parking';
    case 'lot_coverage': return 'Lot Coverage';
    default: return factor || '--';
  }
}

function permBadge(status: string) {
  switch (status) {
    case 'by-right':
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: BT.greenBg, color: BT.greenL, border: `1px solid ${BT.green}50` }}>BY-RIGHT</span>
      );
    case 'conditional':
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: BT.amberBg, color: BT.amberL, border: `1px solid ${BT.amber}50` }}>CUP REQ</span>
      );
    case 'not-permitted':
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: BT.redBg, color: BT.redL, border: `1px solid ${BT.red}50` }}>NOT PERMITTED</span>
      );
    case 'not-classified':
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: BT.bgPanel, color: BT.tm, border: `1px solid ${BT.border}` }}>VERIFY</span>
      );
    default:
      return null;
  }
}

function sourceLabel(src: string) {
  switch (src) {
    case 'profile': return 'Zoning Profile';
    case 'database': return 'Municipal Database';
    case 'ai_retrieved': return 'AI-Retrieved';
    default: return src;
  }
}

function confidenceBadge(conf: string) {
  switch (conf) {
    case 'high':
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: BT.greenBg, color: BT.greenL }}>HIGH CONFIDENCE</span>
      );
    case 'medium':
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: BT.amberBg, color: BT.amberL }}>MEDIUM CONFIDENCE</span>
      );
    case 'low':
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: BT.redBg, color: BT.redL }}>LOW CONFIDENCE</span>
      );
    default:
      return null;
  }
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-600';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: BT.border }}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium w-4" style={{ color: BT.tm }}>{score}</span>
    </div>
  );
}

export default function HighestBestUseTab({ dealId, deal }: HighestBestUseTabProps) {
  const [data, setData] = useState<HBUResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rezoneOpportunity, setRezoneOpportunity] = useState<any>(null);
  const [loadingRezone, setLoadingRezone] = useState(false);

  const loadHBU = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/scenarios/hbu`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load HBU analysis');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  const loadRezoneOpportunity = useCallback(async () => {
    if (!dealId) return;
    setLoadingRezone(true);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/rezone-analysis`);
      const opportunities = res.data.opportunities || [];
      if (opportunities.length > 0) {
        setRezoneOpportunity(opportunities[0]);
      }
    } catch {
    } finally {
      setLoadingRezone(false);
    }
  }, [dealId]);

  useEffect(() => {
    loadHBU();
    loadRezoneOpportunity();
  }, [loadHBU, loadRezoneOpportunity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: BT.blue }} />
        <span className="ml-3 text-sm" style={{ color: BT.tm }}>Analyzing highest & best use across 6 property types...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-6 text-center" style={{ background: BT.amberBg, border: `1px solid ${BT.amber}50` }}>
        <svg className="mx-auto h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: BT.amberL }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm" style={{ color: BT.amberL }}>{error}</p>
        <button onClick={() => { setError(null); loadHBU(); }} className="mt-3 text-xs underline" style={{ color: BT.blueL }}>
          Try again
        </button>
      </div>
    );
  }

  if (!data || data.hbu.length === 0) {
    return (
      <div className="rounded-lg p-8 text-center" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
        <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: BT.tm }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-sm mb-2" style={{ color: BT.tm }}>No HBU analysis available.</p>
        <p className="text-xs" style={{ color: BT.td }}>Ensure a zoning profile has been resolved for this deal in the Development Capacity tab.</p>
      </div>
    );
  }

  const { hbu, aiAnalysis, benchmarkContext, constraintSource, districtCode } = data;
  const sortedResults = [...hbu].sort((a, b) => b.estimatedValue - a.estimatedValue);
  const bestUse = hbu.find(r => r.recommended);
  const aiScoreMap = new Map<string, UseScore>();
  if (aiAnalysis?.useScores) {
    aiAnalysis.useScores.forEach(s => aiScoreMap.set(s.propertyType.toLowerCase(), s));
  }

  return (
    <div className="space-y-5">

      {aiAnalysis && (
        <div className="rounded-lg px-5 py-4" style={{ background: BT.violBg, border: `1px solid ${BT.violet}50` }}>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: BT.violL }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
              style={{ background: `${BT.violet}30`, color: BT.violL }}>AI Recommendation</span>
            {confidenceBadge(aiAnalysis.confidence)}
          </div>
          <p className="text-sm font-medium leading-relaxed" style={{ color: BT.violL }}>{aiAnalysis.recommendation}</p>

          {aiAnalysis.mixedUseCombinations && aiAnalysis.mixedUseCombinations.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BT.violet}40` }}>
              <p className="text-[10px] uppercase tracking-wide font-bold mb-1.5" style={{ color: BT.violL }}>Mixed-Use Combinations</p>
              {aiAnalysis.mixedUseCombinations.map((mix, i) => (
                <div key={i} className="flex items-start gap-2 mb-1">
                  <span className="mt-0.5" style={{ color: BT.violL }}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </span>
                  <div>
                    <span className="text-xs font-semibold" style={{ color: BT.violL }}>{mix.combination}</span>
                    <span className="text-xs ml-1" style={{ color: BT.violet }}>— {mix.rationale}</span>
                    {mix.estimatedUplift && (
                      <span className="ml-1 text-[10px] font-medium" style={{ color: BT.greenL }}>({mix.estimatedUplift} uplift)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {aiAnalysis.caveats && aiAnalysis.caveats.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BT.violet}40` }}>
              <p className="text-[10px] uppercase tracking-wide font-bold mb-1" style={{ color: BT.amberL }}>Watch Items</p>
              {aiAnalysis.caveats.map((c, i) => (
                <p key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: BT.amberL }}>
                  <span className="mt-px" style={{ color: BT.amber }}>!</span>
                  {c}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {!aiAnalysis && bestUse && (
        <div className="rounded-lg px-5 py-4" style={{ background: BT.amberBg, border: `1px solid ${BT.amber}50` }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
              style={{ background: `${BT.amber}30`, color: BT.amberL }}>Best Use</span>
            <span className="text-base font-bold capitalize" style={{ color: BT.amberL }}>{bestUse.propertyType}</span>
            <span className="ml-auto text-sm font-semibold" style={{ color: BT.amberL }}>{fmtDollar(bestUse.estimatedValue)}</span>
          </div>
          <p className="text-sm" style={{ color: BT.amberL }}>{bestUse.reasoning}</p>
          <div className="mt-3 grid grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: BT.amber }}>Max Capacity</p>
              <p className="text-sm font-semibold" style={{ color: BT.amberL }}>{fmt(bestUse.maxCapacity)} units</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: BT.amber }}>Max GFA</p>
              <p className="text-sm font-semibold" style={{ color: BT.amberL }}>{fmt(Math.round(bestUse.maxGFA))} SF</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: BT.amber }}>Annual NOI</p>
              <p className="text-sm font-semibold" style={{ color: BT.amberL }}>{fmtDollar(bestUse.estimatedNOI)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: BT.amber }}>Limiting Factor</p>
              <p className="text-sm font-semibold" style={{ color: BT.redL }}>{getLimitingLabel(bestUse.limitingFactor)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg overflow-hidden" style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BT.border}`, background: BT.bgPanel }}>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: BT.text }}>Use Comparison</h3>
            <p className="text-xs mt-0.5" style={{ color: BT.td }}>
              6 property types ranked by estimated value under {districtCode || 'current'} zoning
              {constraintSource !== 'profile' && (
                <span className="ml-1 text-[10px]" style={{ color: BT.violL }}>(constraints: {sourceLabel(constraintSource)})</span>
              )}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border}`, background: BT.bgPanel }}>
                {['Type', 'Permission', ...(aiAnalysis ? ['AI Score'] : []), 'Capacity', 'Max GFA', 'Revenue', 'NOI', 'Value', 'Constraint'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider ${i === 0 ? 'text-left px-4' : i >= 3 && i <= 6 ? 'text-right' : i === 7 ? 'text-right' : 'text-center'}`}
                    style={{ color: BT.td }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result, idx) => {
                const isNotPermitted = result.permissionStatus === 'not-permitted';
                const aiScore = aiScoreMap.get(result.propertyType.toLowerCase());

                let rowBgColor = 'transparent';
                if (result.recommended) rowBgColor = `${BT.amber}15`;
                else if (result.permissionStatus === 'by-right') rowBgColor = `${BT.green}0a`;
                else if (result.permissionStatus === 'conditional') rowBgColor = `${BT.amber}0a`;
                else rowBgColor = `${BT.red}08`;

                const textColor = isNotPermitted ? BT.td : BT.text;

                return (
                  <tr key={result.propertyType} style={{ borderBottom: `1px solid ${BT.border}`, background: rowBgColor }}
                    onMouseEnter={e => (e.currentTarget.style.background = BT.bgPanel)}
                    onMouseLeave={e => (e.currentTarget.style.background = rowBgColor)}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium w-4" style={{ color: BT.td }}>#{idx + 1}</span>
                        <span className="text-xs font-semibold capitalize"
                          style={{ color: result.recommended ? BT.amberL : textColor, textDecoration: isNotPermitted ? 'line-through' : 'none' }}>
                          {result.propertyType}
                        </span>
                        {result.recommended && (
                          <span className="text-[8px] px-1 py-0.5 rounded font-bold"
                            style={{ background: `${BT.amber}30`, color: BT.amberL }}>BEST</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center px-3 py-2">{permBadge(result.permissionStatus)}</td>
                    {aiAnalysis && (
                      <td className="px-3 py-2">
                        {aiScore ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-bold" style={{ color: BT.text }}>{aiScore.compositeScore}/10</span>
                            <div className="flex gap-2">
                              <div className="text-center" title="Profitability">
                                <span className="text-[8px] block" style={{ color: BT.td }}>P</span>
                                <ScoreBar score={aiScore.profitabilityScore} />
                              </div>
                              <div className="text-center" title="Approval">
                                <span className="text-[8px] block" style={{ color: BT.td }}>A</span>
                                <ScoreBar score={aiScore.approvalScore} />
                              </div>
                              <div className="text-center" title="Timeline">
                                <span className="text-[8px] block" style={{ color: BT.td }}>T</span>
                                <ScoreBar score={aiScore.timelineScore} />
                              </div>
                            </div>
                          </div>
                        ) : <span className="text-xs" style={{ color: BT.td }}>--</span>}
                      </td>
                    )}
                    <td className="text-right px-3 py-2 text-xs" style={{ color: textColor, textDecoration: isNotPermitted ? 'line-through' : 'none' }}>{fmt(result.maxCapacity)}</td>
                    <td className="text-right px-3 py-2 text-xs" style={{ color: textColor, textDecoration: isNotPermitted ? 'line-through' : 'none' }}>{fmt(Math.round(result.maxGFA))} SF</td>
                    <td className="text-right px-3 py-2 text-xs" style={{ color: textColor, textDecoration: isNotPermitted ? 'line-through' : 'none' }}>{fmtDollar(result.annualGrossRevenue)}</td>
                    <td className="text-right px-3 py-2 text-xs" style={{ color: textColor, textDecoration: isNotPermitted ? 'line-through' : 'none' }}>{fmtDollar(result.estimatedNOI)}</td>
                    <td className="text-right px-3 py-2 text-xs font-semibold"
                      style={{ color: result.recommended ? BT.amberL : textColor, textDecoration: isNotPermitted ? 'line-through' : 'none' }}>
                      {fmtDollar(result.estimatedValue)}
                    </td>
                    <td className="text-center px-3 py-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border"
                        style={{ background: isNotPermitted ? BT.bgPanel : BT.redBg, color: isNotPermitted ? BT.td : BT.redL, borderColor: isNotPermitted ? BT.border : `${BT.red}50` }}>
                        {getLimitingLabel(result.limitingFactor)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {aiAnalysis?.marketInsight && (
        <div className="rounded-lg px-5 py-3" style={{ background: BT.blueBg, border: `1px solid ${BT.blue}40` }}>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: BT.blue }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-[10px] uppercase tracking-wide font-bold" style={{ color: BT.blueL }}>Market Insight</span>
            {benchmarkContext && (
              <span className="text-[10px]" style={{ color: BT.blue }}>({benchmarkContext.projectCount} benchmark project{benchmarkContext.projectCount !== 1 ? 's' : ''})</span>
            )}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: BT.blueL }}>{aiAnalysis.marketInsight}</p>
          {benchmarkContext && (benchmarkContext.avgDensityAchieved || benchmarkContext.avgFarAchieved) && (
            <div className="mt-2 flex gap-4">
              {benchmarkContext.avgDensityAchieved && (
                <div>
                  <span className="text-[10px] font-medium" style={{ color: BT.blue }}>Avg Density Achieved:</span>
                  <span className="text-xs font-semibold ml-1" style={{ color: BT.blueL }}>{benchmarkContext.avgDensityAchieved} units/acre</span>
                </div>
              )}
              {benchmarkContext.avgFarAchieved && (
                <div>
                  <span className="text-[10px] font-medium" style={{ color: BT.blue }}>Avg FAR Achieved:</span>
                  <span className="text-xs font-semibold ml-1" style={{ color: BT.blueL }}>{benchmarkContext.avgFarAchieved}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {rezoneOpportunity && (
        <div className="rounded-lg overflow-hidden" style={{ background: BT.bgCard, border: `1px solid ${BT.blue}40` }}>
          <div className="px-5 py-3" style={{ borderBottom: `1px solid ${BT.blue}40`, background: BT.blueBg }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                style={{ background: `${BT.blue}30`, color: BT.blueL }}>Rezone Opportunity</span>
              <h3 className="text-sm font-bold" style={{ color: BT.blueL }}>
                {rezoneOpportunity.targetDistrictCode || 'Higher-Density District'}
              </h3>
            </div>
            <p className="text-xs mt-1" style={{ color: BT.blue }}>
              Rezoning to {rezoneOpportunity.targetDistrictCode} could unlock a better HBU result
            </p>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            {rezoneOpportunity.additionalUnits != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: BT.td }}>Additional Units</p>
                <p className="text-sm font-semibold" style={{ color: BT.greenL }}>+{fmt(rezoneOpportunity.additionalUnits)}</p>
              </div>
            )}
            {rezoneOpportunity.additionalGFA != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: BT.td }}>Additional GFA</p>
                <p className="text-sm font-semibold" style={{ color: BT.greenL }}>+{fmt(Math.round(rezoneOpportunity.additionalGFA))} SF</p>
              </div>
            )}
            {rezoneOpportunity.revenueUplift != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: BT.td }}>Revenue Uplift</p>
                <p className="text-sm font-semibold" style={{ color: BT.greenL }}>+{fmtDollar(rezoneOpportunity.revenueUplift)}</p>
              </div>
            )}
          </div>
          {rezoneOpportunity.sourceUrl && (
            <div className="px-5 pb-3">
              <a
                href={rezoneOpportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] underline"
                style={{ color: BT.violL }}
              >
                View target district zoning code
              </a>
            </div>
          )}
        </div>
      )}

      {loadingRezone && !rezoneOpportunity && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: BT.blue }} />
          <span className="ml-2 text-xs" style={{ color: BT.td }}>Checking rezone opportunities...</span>
        </div>
      )}
    </div>
  );
}
