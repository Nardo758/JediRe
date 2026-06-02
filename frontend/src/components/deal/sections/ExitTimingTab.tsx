import { useState, useEffect } from 'react';
import {
  ConvergenceChart, RSSBreakdownCards, RSSBreakdown,
  Q_LABELS, RSS_21Y, OPTIMAL_FWD, NOW_IDX as CONV_NOW_IDX,
} from './ConvergenceChart';
import { apiClient } from '../../../services/api.client';

const T2 = {
  mono: '"JetBrains Mono",monospace',
  panel: '#0F1319',
  border: 'rgba(255,255,255,0.06)',
  dim: 'rgba(232,230,225,0.35)',
  muted: 'rgba(232,230,225,0.18)',
};

interface LiveQuarter {
  idx: number;
  label: string;
  rent_growth: number;
  cap_rate: number;
  supply: number;
  t10: number;
  rss: number;
  mw: number;
  re: number;
  sp: number;
  or: number;
  bp: number;
  is_proj: boolean;
}

interface ExitTimingResponse {
  success: boolean;
  quarters: LiveQuarter[];
  optimal_fwd: number;
  now_idx: number;
  submarket_name: string;
}

const ExitTimingTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [liveData, setLiveData] = useState<ExitTimingResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [selectedFwd, setSelectedFwd] = useState(OPTIMAL_FWD);

  // Fetch live market-cycle data from backend
  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    apiClient
      .get<ExitTimingResponse>(`/api/v1/lifecycle/${dealId}/exit-timing`)
      .then(res => {
        if (res.data?.success && res.data.quarters?.length >= 84) {
          setLiveData(res.data);
          setSelectedFwd(res.data.optimal_fwd);
        }
      })
      .catch(() => { /* silently retain hardcoded fallback */ })
      .finally(() => setLoading(false));
  }, [dealId]);

  // Resolve display values — live data takes precedence over hardcoded constants
  const nowIdx  = liveData?.now_idx    ?? CONV_NOW_IDX;
  const optFwd  = liveData?.optimal_fwd ?? OPTIMAL_FWD;
  const selAbsIdx = nowIdx + selectedFwd;

  // RSS breakdown for selected quarter
  const selRSS: RSSBreakdown | undefined = (() => {
    if (liveData) {
      const q = liveData.quarters[selAbsIdx];
      if (q) return { rss: q.rss, mw: q.mw, re: q.re, sp: q.sp, or: q.or, bp: q.bp };
    }
    return RSS_21Y[selAbsIdx];
  })();

  const selLabel = liveData
    ? (liveData.quarters[selAbsIdx]?.label ?? Q_LABELS[selAbsIdx]?.label ?? '')
    : (Q_LABELS[selAbsIdx]?.label ?? '');

  const fwdYears = (selectedFwd / 4).toFixed(1);
  const rssColor = (v: number) => v >= 70 ? '#68D391' : v >= 50 ? '#F6E05E' : '#FC8181';

  // Build chart prop arrays from live data when available
  const chartLiveProps = liveData
    ? {
        rentGrowth21Y: liveData.quarters.map(q => q.rent_growth),
        capRates21Y:   liveData.quarters.map(q => q.cap_rate),
        supply21Y:     liveData.quarters.map(q => q.supply),
        t10_21Y:       liveData.quarters.map(q => q.t10),
        rss21Y:        liveData.quarters.map(q => ({
          rss: q.rss, mw: q.mw, re: q.re, sp: q.sp, or: q.or, bp: q.bp,
        })),
        nowIdx,
      }
    : {};

  return (
    <div style={{ padding: 16, overflowY: 'auto' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: T2.mono, color: '#E8E6E1', letterSpacing: 1 }}>
            21-YEAR CONVERGENCE CHART
          </div>
          <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono, marginTop: 2 }}>
            {liveData
              ? `Live CS data · ${liveData.submarket_name} · Q1 2016 → Q4 2036`
              : 'Rent growth · Cap rate · RSS · Supply — Q1 2016 → Q4 2036'}
          </div>
          {loading && (
            <div style={{ fontSize: 8, color: '#63B3ED80', fontFamily: T2.mono, marginTop: 1 }}>
              loading live data…
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono }}>SELECTED EXIT</div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: T2.mono, color: '#63B3ED' }}>{selLabel}</div>
            <div style={{ fontSize: 9, color: T2.dim, fontFamily: T2.mono }}>{fwdYears}yr from now</div>
          </div>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            border: `3px solid ${rssColor(selRSS?.rss ?? 0)}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(11,14,19,0.8)',
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: T2.mono, color: rssColor(selRSS?.rss ?? 0) }}>
              {selRSS?.rss ?? '--'}
            </div>
            <div style={{ fontSize: 7, color: T2.muted, fontFamily: T2.mono }}>RSS</div>
          </div>
        </div>
      </div>

      {/* RSS breakdown cards */}
      {selRSS && <RSSBreakdownCards rssData={selRSS} />}

      {/* Convergence chart — receives live arrays when available, falls back to hardcoded */}
      <div style={{ background: T2.panel, border: `1px solid ${T2.border}`, borderRadius: 6, padding: 12 }}>
        <ConvergenceChart
          selectedFwd={selectedFwd}
          onSelectFwd={setSelectedFwd}
          optimalFwd={optFwd}
          {...chartLiveProps}
        />
      </div>

      {/* Footer */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono }}>
          Click any projected quarter to inspect exit conditions · RSS = Readiness to Sell Score (0–100)
        </div>
        {liveData && (
          <div style={{ fontSize: 8, color: '#68D39180', fontFamily: T2.mono }}>
            ● live CS data
          </div>
        )}
      </div>
    </div>
  );
};

export default ExitTimingTab;
export { ExitTimingTab };
