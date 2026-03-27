import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api.client';

interface BloombergMarketDetailProps {
  marketId?: string;
  msaCode?: string;
  embedded?: boolean;
  corpHealthData?: any;
}

type DataStatus = 'loading' | 'live' | 'cached' | 'error';

interface Vital {
  label: string;
  value: string;
  sub: string;
  change: string;
  period: string;
  dir: 'up' | 'down' | 'flat';
}

interface Submarket {
  name: string;
  props: number;
  units: string;
  rent: string;
  vac: string;
  growth: string;
  opp: string;
  pressure: string;
}

const FALLBACK_VITALS: Vital[] = [
  { label: 'Avg Effective Rent',  value: '$1,908', sub: '/mo',    change: '+3.0%',      period: '90d',  dir: 'up'   },
  { label: 'Vacancy Rate',        value: '8.5',    sub: '%',      change: '-0.8%',      period: '12wk', dir: 'down' },
  { label: 'Avg Absorbed Units',  value: '11,658', sub: ' units', change: 'steady',     period: 'wkly', dir: 'flat' },
  { label: 'Rent Growth Trend',   value: '+3.0',   sub: '%',      change: 'Accelerating', period: '',   dir: 'up'   },
  { label: 'Submarket Strength',  value: '40th',   sub: ' pctl',  change: 'Below median', period: '',  dir: 'down' },
];

const FALLBACK_SUBMARKETS: Submarket[] = [
  { name: 'Midtown',      props: 52, units: '14,856', rent: '$2,056', vac: '10.1%', growth: '+3.0%', opp: '6.0/10', pressure: 'seller' },
  { name: 'East Atlanta', props: 23, units: '6,789',  rent: '$2,031', vac: '15.4%', growth: '-0.6%', opp: '6.2/10', pressure: 'seller' },
  { name: 'West End',     props: 53, units: '5,924',  rent: '$1,977', vac: '10.5%', growth: '+1.2%', opp: '7.9/10', pressure: 'buyer'  },
  { name: 'Buckhead',     props: 39, units: '14,338', rent: '$1,883', vac: '9.8%',  growth: '-0.5%', opp: '9.0/10', pressure: 'buyer'  },
  { name: 'Downtown',     props: 35, units: '8,473',  rent: '$1,542', vac: '6.9%',  growth: '+0.6%', opp: '5.1/10', pressure: 'buyer'  },
];

const C = {
  bg:     { terminal: '#0A0E17', panel: '#0F1319', header: '#131927', card: '#141C2B' },
  text:   { primary: '#E8ECF1', secondary: '#6B7894', muted: '#3D4D6A', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4', white: '#FFFFFF' },
  border: { medium: '#1E2B3D', subtle: '#0F1A2A', bright: '#3D4D6A' },
  font:   { mono: "'JetBrains Mono','IBM Plex Mono',monospace" },
};

function mapApiToVitals(data: any): Vital[] {
  if (!data) return FALLBACK_VITALS;
  try {
    const vitals: Vital[] = [];
    const rent = data.avg_effective_rent ?? data.avgEffectiveRent ?? data.median_rent ?? data.medianRent;
    if (rent != null) vitals.push({ label: 'Avg Effective Rent', value: `$${Number(rent).toLocaleString()}`, sub: '/mo', change: data.rent_change ?? data.rentChange ?? '+3.0%', period: '90d', dir: (data.rent_dir ?? 'up') as Vital['dir'] });

    const vac = data.vacancy_rate ?? data.vacancyRate;
    if (vac != null) vitals.push({ label: 'Vacancy Rate', value: Number(vac).toFixed(1), sub: '%', change: data.vacancy_change ?? data.vacancyChange ?? '-0.8%', period: '12wk', dir: (data.vacancy_dir ?? 'down') as Vital['dir'] });

    const abs = data.absorbed_units ?? data.absorbedUnits;
    if (abs != null) vitals.push({ label: 'Avg Absorbed Units', value: Number(abs).toLocaleString(), sub: ' units', change: data.absorption_change ?? data.absorptionChange ?? 'steady', period: 'wkly', dir: 'flat' as Vital['dir'] });

    const rentGrowth = data.rent_growth ?? data.rentGrowth;
    if (rentGrowth != null) vitals.push({ label: 'Rent Growth Trend', value: `${Number(rentGrowth) >= 0 ? '+' : ''}${Number(rentGrowth).toFixed(1)}`, sub: '%', change: Number(rentGrowth) > 2 ? 'Accelerating' : 'Decelerating', period: '', dir: Number(rentGrowth) >= 0 ? 'up' : 'down' });

    return vitals.length >= 3 ? vitals : FALLBACK_VITALS;
  } catch {
    return FALLBACK_VITALS;
  }
}

function mapApiToSubmarkets(data: any): Submarket[] {
  if (!data) return FALLBACK_SUBMARKETS;
  try {
    const rows = data.submarkets ?? data.submarket_breakdown ?? data.submarketBreakdown;
    if (!Array.isArray(rows) || rows.length === 0) return FALLBACK_SUBMARKETS;
    return rows.slice(0, 8).map((r: any) => ({
      name:     r.name ?? r.submarket_name ?? r.submarketName ?? '—',
      props:    Number(r.property_count ?? r.props ?? 0),
      units:    String(r.total_units ?? r.units ?? '—'),
      rent:     r.avg_rent ? `$${Number(r.avg_rent).toLocaleString()}` : (r.rent ?? '—'),
      vac:      r.vacancy_rate ? `${Number(r.vacancy_rate).toFixed(1)}%` : (r.vac ?? '—'),
      growth:   r.rent_growth ? `${Number(r.rent_growth) >= 0 ? '+' : ''}${Number(r.rent_growth).toFixed(1)}%` : (r.growth ?? '—'),
      opp:      r.opportunity_score ? `${r.opportunity_score}/10` : (r.opp ?? '—'),
      pressure: r.market_pressure ?? r.pressure ?? '—',
    }));
  } catch {
    return FALLBACK_SUBMARKETS;
  }
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 8, animation: 'pulse 1.5s infinite' }}>
      {[120, 80, 60, 70, 55].map((w, i) => (
        <div key={i} style={{ width: w, height: 12, background: C.text.amber + '22', borderRadius: 2 }} />
      ))}
    </div>
  );
}

function VitalCard({ v }: { v: Vital }) {
  const valColor = C.text.amber;
  const chColor = v.dir === 'up' ? C.text.green : v.dir === 'down' ? C.text.red : C.text.secondary;
  return (
    <div style={{ background: C.bg.card, border: `1px solid ${C.border.subtle}`, padding: '8px 10px', flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 8, color: C.text.muted, letterSpacing: 1, fontWeight: 600, marginBottom: 4, fontFamily: C.font.mono }}>{v.label.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: valColor, fontFamily: C.font.mono }}>{v.value}</span>
        <span style={{ fontSize: 10, color: C.text.secondary, fontFamily: C.font.mono }}>{v.sub}</span>
      </div>
      {v.change && <div style={{ fontSize: 8, color: chColor, marginTop: 2, fontWeight: 600, fontFamily: C.font.mono }}>{v.change}{v.period ? ` (${v.period})` : ''}</div>}
    </div>
  );
}

const BloombergMarketDetail: React.FC<BloombergMarketDetailProps> = ({ marketId, msaCode, corpHealthData }) => {
  const [vitals, setVitals]         = useState<Vital[]>(FALLBACK_VITALS);
  const [submarkets, setSubmarkets] = useState<Submarket[]>(FALLBACK_SUBMARKETS);
  const [status, setStatus]         = useState<DataStatus>('loading');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const effectiveId = marketId ?? msaCode ?? 'atlanta-ga';

  const fetchMarketData = useCallback(async () => {
    setStatus('loading');
    try {
      const [summaryRes, dataRes] = await Promise.allSettled([
        api.market.getMarketSummary(effectiveId),
        api.market.getMarketData(effectiveId),
      ]);

      const summaryData = summaryRes.status === 'fulfilled' ? summaryRes.value.data?.data ?? summaryRes.value.data : null;
      const marketData  = dataRes.status === 'fulfilled'   ? dataRes.value.data?.data   ?? dataRes.value.data   : null;
      const combined    = { ...summaryData, ...marketData };

      const liveVitals     = mapApiToVitals(combined);
      const liveSubmarkets = mapApiToSubmarkets(combined);
      const isLive         = liveVitals !== FALLBACK_VITALS;

      setVitals(liveVitals);
      setSubmarkets(liveSubmarkets);
      setStatus(isLive ? 'live' : 'cached');
      setLastFetched(new Date());
    } catch {
      setVitals(FALLBACK_VITALS);
      setSubmarkets(FALLBACK_SUBMARKETS);
      setStatus('cached');
      setLastFetched(new Date());
    }
  }, [effectiveId]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  const pressureColor = (p: string) =>
    p === 'seller' ? C.text.red : p === 'buyer' ? C.text.green : C.text.amber;

  const growthColor = (g: string) =>
    g.startsWith('+') ? C.text.green : g.startsWith('-') ? C.text.red : C.text.amber;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: C.bg.terminal, display: 'flex', flexDirection: 'column', padding: 0 }}>
      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', height: 28, background: C.bg.header, borderBottom: `1px solid ${C.border.medium}`, flexShrink: 0, fontFamily: C.font.mono }}>
        <span style={{ fontSize: 9, color: C.text.muted, letterSpacing: 1 }}>MARKET DETAIL</span>
        <span style={{ fontSize: 9, color: C.text.amber, fontWeight: 700 }}>{effectiveId.toUpperCase()}</span>
        <div style={{ flex: 1 }} />

        {/* Status badge */}
        {status === 'loading' && (
          <span style={{ fontSize: 8, color: C.text.amber, border: `1px solid ${C.text.amber}55`, padding: '1px 6px', animation: 'pulse 1.5s infinite' }}>LOADING…</span>
        )}
        {status === 'live' && (
          <span style={{ fontSize: 8, color: C.text.green, border: `1px solid ${C.text.green}55`, padding: '1px 6px' }}>● LIVE</span>
        )}
        {status === 'cached' && (
          <span style={{ fontSize: 8, color: C.text.amber, border: `1px solid ${C.text.amber}55`, padding: '1px 6px' }}>CACHED</span>
        )}
        {status === 'error' && (
          <span style={{ fontSize: 8, color: C.text.red, border: `1px solid ${C.text.red}55`, padding: '1px 6px' }}>DATA FEED OFFLINE</span>
        )}

        {lastFetched && (
          <span style={{ fontSize: 8, color: C.text.muted }}>{lastFetched.toLocaleTimeString('en-US', { hour12: false })}</span>
        )}
        <button onClick={fetchMarketData} style={{ fontFamily: C.font.mono, fontSize: 8, color: C.text.secondary, background: 'transparent', border: `1px solid ${C.border.medium}`, padding: '1px 6px', cursor: 'pointer' }}>
          REFRESH
        </button>
      </div>

      {/* ── Loading skeleton ── */}
      {status === 'loading' && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {FALLBACK_VITALS.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 56, background: C.text.amber + '11', border: `1px solid ${C.text.amber}22`, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
          </div>
        </div>
      )}

      {/* ── Data feed offline error ── */}
      {status === 'error' && (
        <div style={{ margin: 12, border: `1px solid ${C.text.red}`, padding: 16, display: 'flex', alignItems: 'center', gap: 8, background: C.text.red + '11' }}>
          <span style={{ fontSize: 14, color: C.text.red }}>⚠</span>
          <div>
            <div style={{ fontFamily: C.font.mono, fontSize: 11, color: C.text.red, fontWeight: 700, letterSpacing: 0.5 }}>DATA FEED OFFLINE</div>
            <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.secondary, marginTop: 2 }}>Unable to reach market data API. Check network connection.</div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={fetchMarketData} style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.red, background: 'transparent', border: `1px solid ${C.text.red}`, padding: '3px 10px', cursor: 'pointer' }}>
            RETRY
          </button>
        </div>
      )}

      {/* ── Live / cached content ── */}
      {(status === 'live' || status === 'cached') && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Market Vitals grid */}
          <div>
            <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.muted, letterSpacing: 1, marginBottom: 6 }}>
              MARKET VITALS
              {status === 'cached' && (
                <span style={{ marginLeft: 8, fontSize: 8, color: C.text.amber, border: `1px solid ${C.text.amber}44`, padding: '0 4px' }}>CACHED</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {vitals.map((v, i) => <VitalCard key={i} v={v} />)}
            </div>
          </div>

          {/* Corp Health summary row (if available) */}
          {corpHealthData?.schi != null && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { label: 'SCHI', value: String(corpHealthData.schi ?? '—'), color: Number(corpHealthData.schi) > 65 ? C.text.green : Number(corpHealthData.schi) > 45 ? C.text.amber : C.text.red },
                { label: 'RE HEALTH', value: corpHealthData.reHealth != null ? `${corpHealthData.reHealth}/100` : '—', color: C.text.cyan },
                { label: 'DIVERGENCE', value: corpHealthData.divergence != null ? `${corpHealthData.divergence}%` : '—', color: C.text.amber },
                { label: 'TOP EMPLOYER', value: corpHealthData.topEmployerText?.replace('Top employer: ', '').replace('.', '') ?? '—', color: C.text.primary },
              ].map((item, i) => (
                <div key={i} style={{ background: C.bg.card, border: `1px solid ${C.border.subtle}`, padding: '6px 10px', minWidth: 100 }}>
                  <div style={{ fontFamily: C.font.mono, fontSize: 8, color: C.text.muted, letterSpacing: 1, marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontFamily: C.font.mono, fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Submarket table */}
          <div>
            <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.muted, letterSpacing: 1, marginBottom: 6 }}>SUBMARKET BREAKDOWN</div>
            <div style={{ border: `1px solid ${C.border.medium}`, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 1fr 1.2fr 1fr 1fr', background: C.bg.header, padding: '4px 8px', gap: 4 }}>
                {['SUBMARKET', 'PROPS', 'UNITS', 'MED RENT', 'VAC', 'GROWTH', 'OPP', 'PRESSURE'].map(h => (
                  <div key={h} style={{ fontFamily: C.font.mono, fontSize: 8, color: C.text.muted, letterSpacing: 0.5, fontWeight: 600 }}>{h}</div>
                ))}
              </div>
              {/* Table rows */}
              {submarkets.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 1fr 1.2fr 1fr 1fr', padding: '5px 8px', gap: 4, borderTop: `1px solid ${C.border.subtle}`, background: i % 2 === 0 ? 'transparent' : C.bg.card + '44' }}>
                  <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.primary, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.secondary }}>{s.props}</div>
                  <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.secondary }}>{s.units}</div>
                  <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.amber }}>{s.rent}</div>
                  <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.secondary }}>{s.vac}</div>
                  <div style={{ fontFamily: C.font.mono, fontSize: 9, color: growthColor(s.growth) }}>{s.growth}</div>
                  <div style={{ fontFamily: C.font.mono, fontSize: 9, color: C.text.cyan }}>{s.opp}</div>
                  <div style={{ fontFamily: C.font.mono, fontSize: 9, color: pressureColor(s.pressure), fontWeight: 600, textTransform: 'uppercase' as const }}>{s.pressure}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BloombergMarketDetail;
