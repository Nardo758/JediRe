import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, SectionPanel, DataRow, Spark, Bd, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { apiClient } from '../../services/api.client';
import CollisionAnalysisSection from '../../components/deal/sections/CollisionAnalysisSection';

interface RiskDDPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

const MONO = BT.font.mono;

interface RiskCategory {
  id: string;
  name: string;
  weight: number;
  score: number;
  label: string;
  severity: 'low' | 'moderate' | 'elevated' | 'high';
  driver: string;
  trend30d: number;
  trendDirection: 'worsening' | 'improving' | 'stable';
  sparkline: number[];
  mitigation: string;
}

const DEFAULT_CATEGORIES: RiskCategory[] = [
  {
    id: 'supply', name: 'Supply Risk', weight: 35, score: 68, label: 'Elevated', severity: 'elevated',
    driver: '1,200 units in pipeline within 3mi radius.',
    trend30d: 8, trendDirection: 'worsening', sparkline: [55,56,58,59,60,62,63,64,65,66,67,68],
    mitigation: 'Accelerate closing before Q3 deliveries.',
  },
  {
    id: 'demand', name: 'Demand Risk', weight: 35, score: 32, label: 'Low', severity: 'low',
    driver: '3 diversified demand drivers active.',
    trend30d: -5, trendDirection: 'improving', sparkline: [40,39,38,38,37,36,35,35,34,33,33,32],
    mitigation: 'Monitor Amazon lease commitment timeline.',
  },
  {
    id: 'regulatory', name: 'Regulatory Risk', weight: 10, score: 45, label: 'Moderate', severity: 'moderate',
    driver: 'City considering zoning overlay changes.',
    trend30d: 0, trendDirection: 'stable', sparkline: [44,45,44,45,45,46,45,44,45,45,45,45],
    mitigation: 'Engage local counsel to monitor proceedings.',
  },
  {
    id: 'market', name: 'Market Risk', weight: 10, score: 38, label: 'Low', severity: 'low',
    driver: 'Cap rate stable. Rent growth accelerating.',
    trend30d: -2, trendDirection: 'improving', sparkline: [42,41,41,40,40,39,39,39,38,38,38,38],
    mitigation: 'Set alert for rate environment changes.',
  },
  {
    id: 'execution', name: 'Execution Risk', weight: 5, score: 55, label: 'Moderate', severity: 'moderate',
    driver: 'Value-add renovation scope adds construction risk.',
    trend30d: 3, trendDirection: 'worsening', sparkline: [50,51,51,52,52,53,53,54,54,54,55,55],
    mitigation: 'Lock GC pricing with 10% contingency.',
  },
  {
    id: 'climate', name: 'Climate Risk', weight: 5, score: 28, label: 'Low', severity: 'low',
    driver: 'Not in flood zone. Low hurricane exposure.',
    trend30d: 0, trendDirection: 'stable', sparkline: [28,28,28,28,28,28,28,28,28,28,28,28],
    mitigation: 'Standard property insurance sufficient.',
  },
];

function classifySeverity(score: number): RiskCategory['severity'] {
  if (score < 35) return 'low';
  if (score < 55) return 'moderate';
  if (score < 70) return 'elevated';
  return 'high';
}

function severityColor(s: RiskCategory['severity']): string {
  if (s === 'low') return BT.text.green;
  if (s === 'moderate') return BT.text.amber;
  if (s === 'elevated') return BT.text.orange;
  return BT.text.red;
}

function trendArrow(d: RiskCategory['trendDirection']): string {
  return d === 'improving' ? '▼' : d === 'worsening' ? '▲' : '●';
}

function mapApiToCategories(apiData: Record<string, unknown>): RiskCategory[] {
  const taArray = apiData?.tradeAreaRisks;
  if (!Array.isArray(taArray) || taArray.length === 0) return [];
  const cats = (taArray[0] as Record<string, unknown>)?.categories;
  if (!cats || typeof cats !== 'object') return [];
  const catMap = cats as Record<string, Record<string, unknown>>;
  const result: RiskCategory[] = [];
  for (const key of ['supply', 'demand', 'regulatory', 'market', 'execution', 'climate'] as const) {
    const c = catMap[key];
    if (!c) continue;
    const score = Math.round((c.finalScore as number | undefined) ?? (c.score as number | undefined) ?? 50);
    const sev = classifySeverity(score);
    result.push({
      id: key,
      name: DEFAULT_CATEGORIES.find(d => d.id === key)?.name ?? key,
      weight: DEFAULT_CATEGORIES.find(d => d.id === key)?.weight ?? 10,
      score,
      label: sev.charAt(0).toUpperCase() + sev.slice(1),
      severity: sev,
      driver: (c.driver as string | undefined) ?? (c.description as string | undefined) ?? `${key} risk assessment.`,
      trend30d: (c.trend30d as number | undefined) ?? 0,
      trendDirection: (c.trendDirection as RiskCategory['trendDirection'] | undefined) ?? 'stable',
      sparkline: Array.isArray(c.sparkline) ? (c.sparkline as number[]) : DEFAULT_CATEGORIES.find(d => d.id === key)?.sparkline ?? [],
      mitigation: (c.mitigation as string | undefined) ?? (c.recommendation as string | undefined) ?? 'Monitor periodically.',
    });
  }
  return result;
}

interface CollisionLayerData {
  broker: { rent1br: string; rent2br: string; occupancy: string };
  platform: { rent1br: string; rent2br: string; occupancy: string };
  user: { rent1br: string; rent2br: string; occupancy: string };
  resolved: { rent1br: string; rent2br: string; occupancy: string };
}

function buildLayerData(deal: Record<string, unknown> | null): CollisionLayerData | null {
  if (!deal) return null;
  const l1 = deal.layer1 as Record<string, unknown> | undefined;
  const l2 = deal.layer2 as Record<string, unknown> | undefined;
  const l3 = deal.layer3 as Record<string, unknown> | undefined;
  if (!l1 && !l2 && !l3) return null;
  const fmtRent = (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : '—';
  const fmtOcc  = (v: unknown) => v != null ? `${Number(v).toFixed(0)}%` : '—';
  return {
    broker:   { rent1br: fmtRent(l1?.avg_rent_1br), rent2br: fmtRent(l1?.avg_rent_2br), occupancy: fmtOcc(l1?.occupancy) },
    platform: { rent1br: fmtRent(l2?.avg_rent_1br), rent2br: fmtRent(l2?.avg_rent_2br), occupancy: fmtOcc(l2?.occupancy) },
    user:     { rent1br: fmtRent(l3?.adjusted_rent_1br), rent2br: fmtRent(l3?.adjusted_rent_2br), occupancy: fmtOcc(l3?.adjusted_occupancy) },
    resolved: {
      rent1br: fmtRent(l3?.adjusted_rent_1br ?? l2?.avg_rent_1br ?? l1?.avg_rent_1br),
      rent2br: fmtRent(l3?.adjusted_rent_2br ?? l2?.avg_rent_2br ?? l1?.avg_rent_2br),
      occupancy: fmtOcc(l3?.adjusted_occupancy ?? l2?.occupancy ?? l1?.occupancy),
    },
  };
}


const RISK_TAB_LABELS = ['RISK ASSESSMENT', 'COLLISION ANALYSIS'];

export function RiskDDPage({ dealId: propDealId, deal: propDeal }: RiskDDPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const [activeTab, setActiveTab] = useState(0);
  const [categories, setCategories] = useState<RiskCategory[]>(DEFAULT_CATEGORIES);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dealData, setDealData] = useState<Record<string, unknown> | null>(propDeal ?? null);

  interface NarrativeData {
    executiveSummary: string;
    categoryNarratives: Array<{
      categoryId: string;
      title: string;
      narrative: string;
      keyDataPoints: string[];
      conflictsWithAssumptions: string | null;
      mitigationStrategy: string;
    }>;
    crossCuttingRisks: string;
    recommendation: string;
  }
  const [narrative, setNarrative] = useState<NarrativeData | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeStream, setNarrativeStream] = useState('');
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const streamRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    setIsLoading(true);

    const riskFetch = apiClient.get(`/api/v1/risk/comprehensive/${resolvedDealId}`)
      .then(res => {
        if (cancelled) return;
        const data = res.data?.data as Record<string, unknown> | undefined;
        if (data) {
          const mapped = mapApiToCategories(data);
          if (mapped.length > 0) { setCategories(mapped); setIsLive(true); }
        }
      })
      .catch(() => {});

    const dealFetch = (!propDeal)
      ? apiClient.get(`/api/v1/deals/${resolvedDealId}`)
          .then(res => { if (!cancelled) setDealData(res.data?.deal ?? res.data ?? null); })
          .catch(() => {})
      : Promise.resolve();

    Promise.all([riskFetch, dealFetch])
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [resolvedDealId, propDeal]);

  const compositeScore = useMemo(
    () => categories.reduce((sum, c) => sum + c.score * (c.weight / 100), 0),
    [categories],
  );

  const compColor = compositeScore < 40 ? BT.text.green : compositeScore < 60 ? BT.text.amber : BT.text.red;
  const layerData = buildLayerData(dealData);

  const generateNarrative = useCallback(async () => {
    if (!resolvedDealId || narrativeLoading) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setNarrativeLoading(true);
    setNarrative(null);
    setNarrativeStream('');
    setNarrativeError(null);
    streamRef.current = '';

    try {
      const resp = await fetch(`/api/v1/risk/narrative/${resolvedDealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories, compositeScore }),
        signal: controller.signal,
      });

      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'chunk') {
              streamRef.current += evt.text;
              setNarrativeStream(streamRef.current);
            } else if (evt.type === 'done') {
              if (evt.narrative) {
                setNarrative(evt.narrative);
              } else {
                setNarrativeError('AI returned a non-structured response. Please try again.');
              }
            } else if (evt.type === 'error') {
              setNarrativeError(evt.message);
            }
          } catch (_e) {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setNarrativeError(err.message || 'Failed to generate assessment');
    } finally {
      setNarrativeLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [resolvedDealId, categories, compositeScore, narrativeLoading]);

  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="RISK ANALYSIS"
        subtitle="M09 · JEDI INTELLIGENCE ENGINE + CLAUDE OPUS"
        borderColor={BT.text.red}
        metrics={[
          { l: 'RISK', c: BT.text.red },
          { l: 'DD', c: BT.text.orange },
        ]}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isLoading && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>LOADING...</span>}
            <Bd c={compColor}>COMPOSITE {compositeScore.toFixed(0)}</Bd>
            {isLive && <Bd c={BT.text.green}>LIVE</Bd>}
          </div>
        }
      />

      <SubTabBar
        tabs={RISK_TAB_LABELS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.text.red}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

        {activeTab === 0 && (() => {
          const verdictText = compositeScore < 35 ? 'LOW RISK — PROCEED'
            : compositeScore < 50 ? 'MANAGEABLE — PROCEED WITH MONITORING'
            : compositeScore < 65 ? 'ELEVATED — ACTIVE MITIGATION REQUIRED'
            : 'HIGH RISK — REASSESS THESIS';
          const verdictColor = compositeScore < 35 ? BT.text.green
            : compositeScore < 50 ? BT.text.amber
            : compositeScore < 65 ? BT.text.orange
            : BT.text.red;

          const catColorForId = (id: string) => {
            const cat = categories.find(c => c.id === id);
            return cat ? severityColor(cat.severity) : BT.text.muted;
          };

          return (
            <div style={{ padding: 1 }}>

              <div style={{ background: BT.bg.panel, borderLeft: `3px solid ${verdictColor}`, padding: '8px 14px', marginBottom: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800, color: verdictColor }}>{compositeScore.toFixed(0)}</span>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: verdictColor, letterSpacing: 0.8 }}>{verdictText}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginTop: 1 }}>Composite Risk Score · weighted across {categories.length} categories</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {categories.map(c => {
                        const bc = severityColor(c.severity);
                        return (
                          <div key={c.id} style={{ textAlign: 'center', padding: '2px 5px', background: BT.bg.terminal }}>
                            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: bc }}>{c.score}</div>
                            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>{c.id.slice(0, 3).toUpperCase()}</div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={generateNarrative}
                      disabled={narrativeLoading}
                      style={{
                        fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                        padding: '6px 14px', cursor: narrativeLoading ? 'wait' : 'pointer',
                        background: narrativeLoading ? BT.bg.header : BT.text.cyan,
                        color: narrativeLoading ? BT.text.muted : BT.bg.terminal,
                        border: 'none', borderRadius: 0,
                      }}
                    >
                      {narrativeLoading ? 'JEDI ANALYZING...' : narrative ? 'REGENERATE ASSESSMENT' : 'GENERATE JEDI ASSESSMENT'}
                    </button>
                  </div>
                </div>
              </div>

              {narrativeError && (
                <div style={{ background: BT.bg.panel, borderLeft: `3px solid ${BT.text.red}`, padding: '8px 12px', marginBottom: 1 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.red }}>{narrativeError}</span>
                </div>
              )}

              {narrativeLoading && !narrative && (
                <div style={{ background: BT.bg.panel, padding: '12px 14px', marginBottom: 1, borderLeft: `3px solid ${BT.text.cyan}` }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.8, marginBottom: 6 }}>
                    JEDI INTELLIGENCE ENGINE · GENERATING RISK NARRATIVE
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {narrativeStream || 'Gathering deal data, market intelligence, pro forma assumptions, and supply pipeline...'}
                    <span style={{ animation: 'blink 1s step-end infinite', color: BT.text.cyan }}>▊</span>
                  </div>
                  <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
                </div>
              )}

              {narrative && (
                <>
                  <div style={{ background: BT.bg.panel, padding: '10px 14px', marginBottom: 1, borderLeft: `3px solid ${BT.text.cyan}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.8 }}>EXECUTIVE SUMMARY</div>
                      <Bd c={BT.text.cyan}>JEDI AI</Bd>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.primary, lineHeight: 1.7 }}>
                      {narrative.executiveSummary}
                    </div>
                  </div>

                  {narrative.categoryNarratives.map(cn => {
                    const bc = catColorForId(cn.categoryId);
                    const cat = categories.find(c => c.id === cn.categoryId);
                    return (
                      <div key={cn.categoryId} style={{ background: BT.bg.panel, borderLeft: `3px solid ${bc}`, padding: '8px 12px', marginBottom: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {cat && <Bd c={bc}>{cat.severity.toUpperCase()}</Bd>}
                            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.white }}>{cn.title}</span>
                            {cat && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>Score {cat.score}/100</span>}
                          </div>
                          {cat && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Spark data={cat.sparkline} color={bc} w={48} h={14} />
                              <span style={{ fontFamily: MONO, fontSize: 9, color: cat.trendDirection === 'improving' ? BT.text.green : cat.trendDirection === 'worsening' ? BT.text.red : BT.text.muted }}>
                                {trendArrow(cat.trendDirection)} {cat.trend30d !== 0 ? (cat.trend30d > 0 ? '+' : '') + cat.trend30d : 'flat'} 30d
                              </span>
                            </div>
                          )}
                        </div>

                        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, lineHeight: 1.7, marginBottom: 4 }}>
                          {cn.narrative}
                        </div>

                        {cn.keyDataPoints && cn.keyDataPoints.length > 0 && (
                          <div style={{ marginBottom: 4 }}>
                            {cn.keyDataPoints.map((dp, i) => (
                              <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, lineHeight: 1.5, paddingLeft: 8, borderLeft: `1px solid ${BT.border.subtle}` }}>
                                ▸ {dp}
                              </div>
                            ))}
                          </div>
                        )}

                        {cn.conflictsWithAssumptions && (
                          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.red, lineHeight: 1.5, padding: '4px 8px', background: `${BT.text.red}10`, marginBottom: 4 }}>
                            ⚠ ASSUMPTION CONFLICT: {cn.conflictsWithAssumptions}
                          </div>
                        )}

                        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.green, lineHeight: 1.5 }}>
                          MITIGATION: {cn.mitigationStrategy}
                        </div>
                      </div>
                    );
                  })}

                  {narrative.crossCuttingRisks && (
                    <div style={{ background: BT.bg.panel, borderLeft: `3px solid ${BT.text.orange}`, padding: '8px 12px', marginBottom: 1 }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.8, marginBottom: 4 }}>CROSS-CUTTING RISKS</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, lineHeight: 1.7 }}>{narrative.crossCuttingRisks}</div>
                    </div>
                  )}

                  <div style={{ background: BT.bg.panel, padding: '8px 12px', borderTop: `2px solid ${verdictColor}` }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: verdictColor, letterSpacing: 0.8, marginBottom: 4 }}>RECOMMENDATION</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, lineHeight: 1.7 }}>{narrative.recommendation}</div>
                  </div>
                </>
              )}

              {!narrative && !narrativeLoading && (
                <div style={{ background: BT.bg.panel, padding: '20px 14px', textAlign: 'center' }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted, marginBottom: 8 }}>
                    {categories.map(c => {
                      const bc = severityColor(c.severity);
                      return (
                        <span key={c.id} style={{ display: 'inline-block', margin: '0 6px', padding: '4px 8px', background: BT.bg.terminal, borderLeft: `2px solid ${bc}` }}>
                          <span style={{ color: bc, fontWeight: 700 }}>{c.score}</span>
                          <span style={{ color: BT.text.muted }}> {c.name}</span>
                          <span style={{ color: c.trendDirection === 'improving' ? BT.text.green : c.trendDirection === 'worsening' ? BT.text.red : BT.text.muted, marginLeft: 4 }}>
                            {trendArrow(c.trendDirection)}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6 }}>
                    Click <span style={{ color: BT.text.cyan, fontWeight: 600 }}>GENERATE JEDI ASSESSMENT</span> to produce an AI-powered risk narrative
                    that synthesizes market data, your pro forma assumptions, supply pipeline, strategy analysis, and rent comps
                    into a comprehensive risk assessment for this deal.
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {activeTab === 1 && (
          <div>
            <div style={{ padding: 1, background: BT.border.subtle }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: BT.border.subtle }}>
                {(
                  [
                    { key: 'broker',   label: 'BROKER',   color: BT.text.cyan,   data: layerData?.broker },
                    { key: 'platform', label: 'PLATFORM', color: BT.text.purple, data: layerData?.platform },
                    { key: 'user',     label: 'USER',     color: BT.text.amber,  data: layerData?.user },
                    { key: 'resolved', label: 'RESOLVED', color: BT.text.green,  data: layerData?.resolved },
                  ] as Array<{key: string; label: string; color: string; data: {rent1br: string; rent2br: string; occupancy: string} | undefined}>
                ).map(src => (
                  <SectionPanel
                    key={src.key}
                    title={src.label}
                    subtitle="data layer"
                    borderColor={src.color}
                    right={<Bd c={src.color}>{src.label}</Bd>}
                  >
                    <DataRow label="1BR RENT"   value={src.data?.rent1br   ?? '—'} valueColor={src.color} />
                    <DataRow label="2BR RENT"   value={src.data?.rent2br   ?? '—'} valueColor={src.color} />
                    <DataRow label="OCCUPANCY"  value={src.data?.occupancy ?? '—'} valueColor={src.color} />
                  </SectionPanel>
                ))}
              </div>
            </div>
            <BtTabWrapper>
              <CollisionAnalysisSection />
            </BtTabWrapper>
          </div>
        )}


      </div>
    </div>
  );
}

export default RiskDDPage;
