/**
 * MSASupplyTab - Metro-wide supply pipeline, construction tracker, lease-up
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Hammer, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalSection, DataTable } from '../../TerminalLayouts';
import { MSAData } from '../../MSATerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { apiClient } from '../../../../api/client';
import { SupplyNarrative, SignalCommentary } from '../../commentary';
import { SupplyTimelineSection } from '../../SupplyTimelineSection';

interface SupplySubmarketRow { name: string; units: number; pctOfTotal: number; status: 'HIGH' | 'MOD' | 'LOW'; projectCount?: number; }
interface SupplyApiProject { project: string; submarket?: string; units?: number; class?: string; delivery?: string; }
interface SupplyApiResponse { success: boolean; totalUnits: number; projectCount: number; bySubmarket: SupplySubmarketRow[]; projects: SupplyApiProject[]; }

interface HistoricalQuarterRow {
  quarter: string;
  deliveries: number;
  projectCount: number;
  deliverySource: string | null;
  rentSignal: number | null;
  rentSource: 'effective' | 'asking' | null;
  rentGrowthYoyPct: number | null;
  vacancyPct: number | null;
  rentSampleSize: number;
}
interface HistoricalDeliveriesResponse {
  success: boolean;
  resolved: { msaName: string; cities: string[]; windowQuarters: string[] };
  totals: {
    quarters: number;
    totalDeliveries: number;
    quartersWithRent: number;
    quartersWithDeliveries: number;
  };
  byQuarter: HistoricalQuarterRow[];
  hasRealData: boolean;
}

interface MSASupplyTabProps {
  msaId: string;
  msa: MSAData;
  onPropertySelect?: (propertyId: string, propertyName?: string) => void;
}

export const MSASupplyTab: React.FC<MSASupplyTabProps> = ({ msaId, msa, onPropertySelect }) => {
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);

  const [pipelineBySubmarket, setPipelineBySubmarket] = useState<SupplySubmarketRow[]>([]);
  const [totalPipelineUnits, setTotalPipelineUnits] = useState<number | null>(null);
  const [showExpansion, setShowExpansion] = useState(false);

  // Historical chart (replaces the old hardcoded `deliveryData`).
  const [historical, setHistorical] = useState<HistoricalDeliveriesResponse | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState<boolean>(true);
  const [historicalError, setHistoricalError] = useState<string | null>(null);

  // Neural network hooks
  const { analysis, loading: contextLoading, analyze: analyzeContext } = useContextAnalysis();
  const { data: supplyData, loading: supplyLoading, expand: expandSupply } = useSupplyExpansion(msaId);

  // Auto-analyze context when tab loads
  useEffect(() => {
    analyzeContext({
      context: 'supply_pipeline',
      marketId: msaId,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
  }, [msaId]);

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
  }, [msaId, msaName]);

  useEffect(() => {
    apiClient.get('/georgia/supply/pipeline?state=GA&limit=100')
      .then((data: SupplyApiResponse) => {
        if (data.success) {
          if (Array.isArray(data.bySubmarket) && data.bySubmarket.length > 0) {
            setPipelineBySubmarket(data.bySubmarket);
          }
          if (data.totalUnits) setTotalPipelineUnits(data.totalUnits);
        }
      })
      .catch(() => {});
  }, []);

  // Pull historical quarterly deliveries + rent / vacancy signal from the DB.
  // Empty / error states are first-class so the chart can degrade to a clear
  // placeholder rather than rendering hardcoded numbers.
  useEffect(() => {
    if (!msaId) return;
    let cancelled = false;
    setHistoricalLoading(true);
    setHistoricalError(null);
    apiClient
      .get(`/supply/historical-deliveries?msaId=${encodeURIComponent(msaId)}&quarters=8`)
      .then((res: HistoricalDeliveriesResponse) => {
        if (cancelled) return;
        if (!res?.success) {
          setHistoricalError('Historical data unavailable');
          setHistorical(null);
        } else {
          setHistorical(res);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load historical deliveries';
        setHistoricalError(msg);
        setHistorical(null);
      })
      .finally(() => {
        if (!cancelled) setHistoricalLoading(false);
      });
    return () => { cancelled = true; };
  }, [msaId]);

  const histChartMax = useMemo(() => {
    if (!historical) return 0;
    return historical.byQuarter.reduce((m, q) => Math.max(m, q.deliveries), 0);
  }, [historical]);

  const histVacancyRange = useMemo(() => {
    if (!historical) return { min: 0, max: 0, hasAny: false };
    const vals = historical.byQuarter.map(q => q.vacancyPct).filter((v): v is number => v != null);
    if (vals.length === 0) return { min: 0, max: 0, hasAny: false };
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      hasAny: true,
    };
  }, [historical]);

  const latestRentGrowth = useMemo(() => {
    if (!historical) return null;
    for (let i = historical.byQuarter.length - 1; i >= 0; i--) {
      const q = historical.byQuarter[i];
      if (q.rentGrowthYoyPct != null) return { quarter: q.quarter, value: q.rentGrowthYoyPct };
    }
    return null;
  }, [historical]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ ...terminalStyles.sectionTitle }}>
              {msaName} — Supply Pipeline
            </h2>
            {totalPipelineUnits != null && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green, background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>LIVE · APT LOCATOR</span>
            )}
          </div>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            Construction, deliveries, lease-up tracking
          </span>
        </div>
      </div>

      {/* Context Awareness Indicator */}
      <ContextIndicator
        analysis={analysis}
        loading={contextLoading}
        onTriggerResearch={async (gaps) => {
          try {
            await apiClient.post('/context/trigger-research', { gaps, priority: 'immediate' });
          } catch (e) {}
        }}
        onRefresh={() => analyzeContext({ context: 'supply_pipeline', marketId: msaId })}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div
          style={{ ...terminalStyles.card, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
          onClick={async () => {
            await expandSupply();
            setShowExpansion(true);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = BT.text.amber)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
          title="Click for full supply pipeline details"
        >
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.amber, marginBottom: 8 }}>
            TOTAL PIPELINE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.amber }}>
            {((totalPipelineUnits ?? msa.pipelineUnits) / 1000).toFixed(1)}K
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>
            {(((totalPipelineUnits ?? msa.pipelineUnits) / msa.totalUnits) * 100).toFixed(1)}% of stock
          </div>
          <div style={{ fontSize: 8, color: BT.text.cyan, marginTop: 4 }}>CLICK TO EXPAND ▶</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            LEASE-UP
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            {(msa.pipelineUnits * 0.12 / 1000).toFixed(1)}K
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            <Hammer size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            UNDER CONST.
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {(msa.pipelineUnits * 0.45 / 1000).toFixed(1)}K
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>
            <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            PLANNED
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.muted }}>
            {(msa.pipelineUnits * 0.43 / 1000).toFixed(1)}K
          </div>
        </div>
      </div>

      <TerminalSection
        title="Historical Deliveries vs Rent Trend"
        icon={<TrendingUp size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
      >
        {historicalLoading && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
            Loading historical deliveries…
          </div>
        )}
        {!historicalLoading && historicalError && (
          <div style={{ padding: 16, borderLeft: `3px solid ${BT.accent.red}`, color: BT.text.muted, fontSize: 11 }}>
            Couldn't load historical data: {historicalError}
          </div>
        )}
        {!historicalLoading && !historicalError && historical && !historical.hasRealData && (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: BT.text.muted, marginBottom: 6 }}>
              Not enough historical delivery or rent data for {historical.resolved.msaName} yet.
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>
              Real quarterly data appears here once <code>apartment_supply_pipeline.available_date</code>{' '}
              and <code>market_rent_comps</code> rows are populated for this MSA.
            </div>
          </div>
        )}
        {!historicalLoading && !historicalError && historical && historical.hasRealData && (
          <>
            {/* Header strip: source + headline numbers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              padding: 12,
              borderBottom: `1px solid ${BT.border.subtle}`,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: BT.text.muted, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>QUARTERS</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
                  {historical.totals.quarters}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: BT.text.muted, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>TOTAL DELIVERED</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.amber, fontFamily: "'JetBrains Mono', monospace" }}>
                  {historical.totals.totalDeliveries.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: BT.text.muted, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>YoY RENT GROWTH</div>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: latestRentGrowth ? (latestRentGrowth.value >= 0 ? BT.text.green : BT.accent.red) : BT.text.muted,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {latestRentGrowth ? `${latestRentGrowth.value >= 0 ? '+' : ''}${latestRentGrowth.value.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: BT.text.muted, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>VACANCY RANGE</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.cyan, fontFamily: "'JetBrains Mono', monospace" }}>
                  {histVacancyRange.hasAny
                    ? `${histVacancyRange.min.toFixed(1)}–${histVacancyRange.max.toFixed(1)}%`
                    : '—'}
                </div>
              </div>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: 10,
                color: BT.text.muted,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span>Deliveries (amber bars) · Vacancy (cyan dots)</span>
                <span>Past {historical.byQuarter.length} quarters</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180 }}>
                {historical.byQuarter.map(q => {
                  const barHeight = histChartMax > 0 ? Math.max(2, (q.deliveries / histChartMax) * 140) : 0;
                  // Map vacancy to a 0–140px dot offset from the top of the bar zone.
                  // Higher vacancy → higher dot. We anchor to the local min/max so
                  // small swings stay readable.
                  const vacRange = histVacancyRange.max - histVacancyRange.min;
                  const dotOffset = q.vacancyPct != null && vacRange > 0
                    ? 140 - ((q.vacancyPct - histVacancyRange.min) / vacRange) * 130
                    : null;
                  const sourceLabel = q.deliverySource === 'available_date' ? 'scheduled'
                    : q.deliverySource === 'synced_at' ? 'sync-est.'
                    : q.deliverySource === 'available_date+synced_at' ? 'mixed'
                    : null;
                  return (
                    <div key={q.quarter} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace", height: 12 }}>
                        {q.deliveries > 0 ? q.deliveries.toLocaleString() : ''}
                      </div>
                      <div
                        style={{ width: '100%', height: 140, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                        title={[
                          `${q.quarter}`,
                          `Deliveries: ${q.deliveries.toLocaleString()} units (${q.projectCount} projects${sourceLabel ? `, ${sourceLabel}` : ''})`,
                          q.vacancyPct != null ? `Vacancy: ${q.vacancyPct.toFixed(2)}% (n=${q.rentSampleSize})` : 'Vacancy: n/a',
                          q.rentSignal != null ? `Rent (${q.rentSource}): $${q.rentSignal.toFixed(0)}` : 'Rent: n/a',
                          q.rentGrowthYoyPct != null ? `YoY rent: ${q.rentGrowthYoyPct >= 0 ? '+' : ''}${q.rentGrowthYoyPct.toFixed(1)}%` : '',
                        ].filter(Boolean).join('\n')}
                      >
                        <div style={{
                          width: '60%',
                          height: barHeight,
                          background: BT.text.amber,
                          opacity: 0.85,
                        }} />
                        {dotOffset != null && (
                          <div style={{
                            position: 'absolute',
                            top: dotOffset,
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: BT.text.cyan,
                            border: `1px solid ${BT.bg.cardHover}`,
                          }} />
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                        {q.quarter.replace('-Q', "'").replace(/^20/, '')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '8px 12px', fontSize: 10, color: BT.text.muted, borderTop: `1px solid ${BT.border.subtle}` }}>
              Deliveries from <code>apartment_supply_pipeline</code> (preferring{' '}
              <code>available_date</code>, falling back to <code>synced_at</code>).
              Rent / vacancy from <code>market_rent_comps</code> for {historical.resolved.cities.length} MSA{' '}
              {historical.resolved.cities.length === 1 ? 'city' : 'cities'}.
              {historical.totals.quartersWithRent === 0 && ' Rent overlay unavailable — no market_rent_comps rows yet.'}
            </div>
          </>
        )}
      </TerminalSection>

      <SupplyTimelineSection
        scope="msa"
        msaId={msaId}
        msaName={msaName}
        state={msa.state}
        onPropertySelect={onPropertySelect}
      />

      <TerminalSection title="Active Lease-Up Tracker" icon={<CheckCircle2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: BT.text.muted, marginBottom: 6 }}>No lease-up data available</div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>Lease-up velocity tracking requires occupancy feed integration.</div>
        </div>
      </TerminalSection>

      <TerminalSection title="Pipeline by Submarket" icon={<Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <DataTable>
          <thead>
            <tr>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Submarket</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Pipeline Units</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>% of Total</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Pressure</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', width: 200 }}>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {pipelineBySubmarket.length === 0 && (
              <tr><td colSpan={5} style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted }}>No submarket data available</td></tr>
            )}
            {pipelineBySubmarket.map((sub) => (
              <tr key={sub.name} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{sub.name}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  {sub.units.toLocaleString()}
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.amber }}>
                  {sub.pctOfTotal.toFixed(1)}%
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 6px',
                    fontSize: 9,
                    fontWeight: 700,
                    background: sub.status === 'HIGH' ? `${BT.accent.red}22` : sub.status === 'MOD' ? `${BT.text.amber}22` : `${BT.text.green}22`,
                    color: sub.status === 'HIGH' ? BT.accent.red : sub.status === 'MOD' ? BT.text.amber : BT.text.green,
                  }}>
                    {sub.status}
                  </span>
                </td>
                <td style={{ ...terminalStyles.tableCell }}>
                  <div style={{ height: 8, background: BT.bg.cardHover, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${sub.pctOfTotal * 2}%`, background: BT.text.amber }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TerminalSection>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating supply analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.supplyNarrative && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SupplyNarrative narrative={commentary.supplyNarrative} />
            </div>
          )}
          {commentary.signalCommentary?.supply && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary
                signalKey="supply"
                commentary={commentary.signalCommentary.supply}
              />
            </div>
          )}
        </div>
      )}

      {/* Supply Expansion Panel (full detail modal) */}
      {showExpansion && supplyData && (
        <SupplyExpansionPanel
          data={supplyData}
          marketName={msaName}
          onClose={() => setShowExpansion(false)}
          onTriggerResearch={async (gaps) => {
            try {
              await apiClient.post('/context/trigger-research', { gaps, priority: 'immediate' });
            } catch (e) {}
          }}
        />
      )}
    </div>
  );
};

export default MSASupplyTab;
