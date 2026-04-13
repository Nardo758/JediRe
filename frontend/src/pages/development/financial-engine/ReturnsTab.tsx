import React, { useState, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPctRaw, fmtX } from './types';

const MONO = BT.font.mono;

// ─── Formatting helpers ────────────────────────────────────────────────────
const fmtIrr  = (n: number | null): string => n == null ? '—' : `${(n * 100).toFixed(2)}%`;
const fmtEm   = (n: number | null): string => n == null ? '—' : `${n.toFixed(2)}×`;
const fmtCap  = (n: number | null): string => n == null ? '—' : `${(n * 100).toFixed(2)}%`;
const fmtDscr = (n: number | null): string => n == null ? '—' : `${n.toFixed(2)}×`;
const fmtYr   = (n: number | null): string => n == null ? '—' : `Yr ${n}`;
const fmtMo   = (n: number | null): string => n == null ? '—' : `${n} mo`;

// ─── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ label, color = BT.met.financial }: { label: string; color?: string }) {
  return (
    <div style={{
      padding: '5px 10px', marginTop: 8,
      background: `${color}12`,
      borderLeft: `3px solid ${color}`,
      borderBottom: `1px solid ${color}30`,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color, letterSpacing: 0.8 }}>{label}</span>
    </div>
  );
}

// ─── Key-value row ──────────────────────────────────────────────────────────
interface KvRowProps {
  label: string; value: string; sub?: string; color?: string; bold?: boolean; indent?: boolean;
}
function KvRow({ label, value, sub, color, bold, indent }: KvRowProps) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '3px 10px', borderBottom: `1px solid ${BT.border.subtle}`,
    }}>
      <span style={{
        fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
        paddingLeft: indent ? 12 : 0, fontWeight: bold ? 600 : 400,
      }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: bold ? 700 : 500, color: color ?? BT.text.primary }}>
          {value}
        </span>
        {sub && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Sparkline SVG ──────────────────────────────────────────────────────────
function Sparkline({ data, color = BT.met.financial, width = 220, height = 32 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const zeroY = height - ((0 - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {min < 0 && max > 0 && (
        <line x1={0} y1={zeroY} x2={width} y2={zeroY}
          stroke={`${BT.text.muted}60`} strokeWidth={0.5} strokeDasharray="2,2" />
      )}
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts} />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return <circle key={i} cx={x} cy={y} r={2} fill={v >= 0 ? color : BT.text.red} />;
      })}
    </svg>
  );
}

// ─── Editable hurdle input ──────────────────────────────────────────────────
function HurdleInput({ label, value, onChange, isX, isNum }: {
  label: string; value: number; onChange: (v: number) => void; isX?: boolean; isNum?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const display = isNum
    ? (value >= 1e6 ? `$${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(0)}K` : `$${value.toFixed(0)}`)
    : isX ? `${value.toFixed(2)}×` : `${(value * 100).toFixed(1)}%`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{label}</span>
      {editing ? (
        <input autoFocus value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => {
            const n = parseFloat(draft.replace(/[^0-9.-]/g, ''));
            if (!isNaN(n)) onChange(isNum ? n : isX ? n : n / 100);
            setEditing(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const n = parseFloat(draft.replace(/[^0-9.-]/g, ''));
              if (!isNaN(n)) onChange(isNum ? n : isX ? n : n / 100);
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          style={{
            background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}`,
            color: BT.text.amber, fontFamily: MONO, fontSize: 9, width: 64,
            padding: '2px 4px', textAlign: 'center', borderRadius: 2,
          }}
        />
      ) : (
        <span
          onClick={() => { setDraft(isNum ? value.toFixed(0) : isX ? value.toFixed(2) : (value * 100).toFixed(1)); setEditing(true); }}
          title="Click to edit hurdle"
          style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.amber,
            cursor: 'pointer', borderBottom: `1px dashed ${BT.text.amber}66`,
          }}
        >{display}</span>
      )}
    </div>
  );
}

// ─── Hero tile with hurdle color ────────────────────────────────────────────
function HeroTile({ label, value, hurdle, actual, isX, isNum, baseColor }: {
  label: string; value: string; hurdle?: number; actual?: number | null; isX?: boolean; isNum?: boolean; baseColor: string;
}) {
  const aboveHurdle = hurdle != null && actual != null ? actual >= hurdle : null;
  const statusColor = aboveHurdle == null ? baseColor : aboveHurdle ? BT.text.green : BT.text.red;
  const fmtHurdle = (h: number) => {
    if (isNum) return h >= 1e6 ? `$${(h/1e6).toFixed(1)}M` : h >= 1e3 ? `$${(h/1e3).toFixed(0)}K` : `$${h.toFixed(0)}`;
    if (isX)   return `${h.toFixed(2)}×`;
    return `${(h * 100).toFixed(1)}%`;
  };
  return (
    <div style={{
      flex: 1, padding: '10px 14px', textAlign: 'center',
      background: `${statusColor}10`,
      border: `1px solid ${statusColor}40`,
      borderTop: `3px solid ${statusColor}`,
      borderRadius: 4,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: statusColor }}>{value}</div>
      {hurdle != null && (
        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 3 }}>
          hurdle: {fmtHurdle(hurdle)}
          {aboveHurdle != null && (
            <span style={{ marginLeft: 4, color: statusColor }}>
              {aboveHurdle ? '▲ pass' : '▼ miss'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ReturnsTab ─────────────────────────────────────────────────────────
export function ReturnsTab({ f9Financials, onTabChange }: FinancialEngineTabProps) {
  const ret    = f9Financials?.returns;
  const cap    = f9Financials?.capitalStack;
  const wf     = f9Financials?.waterfall;
  const capData = f9Financials?.capital;
  const proj   = f9Financials?.projections;

  // Local hurdle state (no server persistence needed)
  const [irrHurdle,     setIrrHurdle]     = useState(0.12);
  const [emHurdle,      setEmHurdle]      = useState(1.8);
  const [cocHurdle,     setCocHurdle]     = useState(0.07);
  const [promoteHurdle, setPromoteHurdle] = useState(500000);

  const prefRate = wf?.prefRate ?? 0.08;

  // Per-LP-tranche rows built from capital.tranches + schedule
  const lpTranches = useMemo(() => {
    if (!capData?.tranches) return [];
    const equityTotal = cap?.equityAtClose ?? 0;
    return capData.tranches.filter(t => t.role === 'lp').map(t => {
      const equityIn = equityTotal * (t.pct / 100);
      const distTotal = capData.schedule.reduce((s, p) => s + p.lpDist, 0) * (t.pct / 100);
      const em = equityIn > 0 ? distTotal / equityIn : null;
      const prefAchieved = capData.schedule.every(p => p.prefPaid >= p.prefAccrued * 0.99);
      return { id: t.id, label: t.label, pctOfEquity: t.pct, prefRate: t.prefRate, irr: capData.metrics.lpIrr, em, prefAchieved };
    });
  }, [capData, cap]);

  // Annual cashflow bars from projections
  const cfBars = useMemo(() => {
    if (!proj || proj.length === 0) return [];
    return proj.map(r => ({
      yr: r.year,
      cfbt: r.cfbt,
      cfads: r.cfads,
      netSale: r.netSaleProceeds,
      isSale: r.netSaleProceeds != null,
    }));
  }, [proj]);

  if (!f9Financials) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: BT.text.muted, fontFamily: MONO, fontSize: 10 }}>
        Load a deal to see returns analysis.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: BT.bg.terminal, paddingBottom: 24 }}>

      {/* ── Hurdle Settings Bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '8px 16px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.6 }}>
          HURDLE TARGETS
        </span>
        <HurdleInput label="IRR Hurdle"     value={irrHurdle}     onChange={setIrrHurdle} />
        <HurdleInput label="EM Hurdle"      value={emHurdle}      onChange={setEmHurdle}  isX />
        <HurdleInput label="CoC Hurdle"     value={cocHurdle}     onChange={setCocHurdle} />
        <HurdleInput label="Promote Hurdle" value={promoteHurdle} onChange={setPromoteHurdle} isNum />
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          Click values to edit · green = above hurdle · red = below hurdle
        </span>
      </div>

      {/* ── Hero Strip ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 12px 4px' }}>
        <HeroTile
          label="LP NET IRR" value={fmtIrr(ret?.lpNetIrr ?? null)}
          hurdle={irrHurdle} actual={ret?.lpNetIrr ?? null} baseColor={BT.met.financial}
        />
        <HeroTile
          label="LP EQUITY MULTIPLE" value={fmtEm(ret?.lpEquityMultiple ?? null)}
          hurdle={emHurdle} actual={ret?.lpEquityMultiple ?? null} isX baseColor={BT.text.cyan}
        />
        <HeroTile
          label="AVG CASH-ON-CASH" value={fmtIrr(ret?.avgCashOnCash ?? null)}
          hurdle={cocHurdle} actual={ret?.avgCashOnCash ?? null} baseColor={BT.text.purple}
        />
        <HeroTile
          label="GP PROMOTE EARNED" value={ret?.gpPromoteEarned != null ? fmt$(ret.gpPromoteEarned) : '—'}
          hurdle={promoteHurdle} actual={ret?.gpPromoteEarned ?? null} isX={false}
          baseColor={BT.text.orange}
        />
      </div>

      {/* ── Two-column body ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

        {/* ──── LEFT COLUMN ──── */}
        <div>

          {/* § 1 — Property-Level Returns */}
          <SectionHeader label="§ 1  PROPERTY-LEVEL RETURNS" color={BT.met.financial} />
          <KvRow label="Unleveraged IRR"     value={fmtIrr(ret?.unleveragedIrr ?? null)} bold />
          <KvRow label="Unleveraged EM"      value={fmtEm(ret?.unleveragedEm ?? null)} bold />
          <KvRow label="Going-In Cap Rate"   value={fmtCap(ret?.goingInCapRate ?? null)} />
          <KvRow label="Stabilized Cap Rate" value={fmtCap(ret?.stabilizedCapRate ?? null)} />
          <KvRow label="YOC (Untrended)"     value={fmtCap(ret?.yocUntrended ?? null)} indent />
          <KvRow label="YOC (Trended)"       value={fmtCap(ret?.yocTrended ?? null)} indent />
          <KvRow label="Development Spread"
            value={ret?.developmentSpread != null ? `${(ret.developmentSpread * 10000).toFixed(0)} bps` : '—'}
          />
          <KvRow label="Avg NOI Growth"      value={fmtIrr(ret?.avgNoiGrowth ?? null)} />
          <KvRow label="Peak NOI Year"       value={fmtYr(ret?.peakNoiYear ?? null)} />

          {/* § 2 — LP Returns by Tranche */}
          <SectionHeader label="§ 2  LP RETURNS BY TRANCHE" color={BT.text.cyan} />
          {lpTranches.length === 0 ? (
            <div style={{ padding: '8px 10px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
              No LP tranches configured.{' '}
              <span style={{ color: BT.text.cyan, cursor: 'pointer' }} onClick={() => onTabChange?.(7)}>
                Configure in Cap &amp; Wfall →
              </span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, fontFamily: MONO }}>
                <thead>
                  <tr style={{ background: BT.bg.header }}>
                    {['Tranche', '% Eq.', 'Pref', 'IRR', 'EM', 'Avg CoC', 'TWR', 'Tier Hit', 'Pref OK'].map(h => (
                      <th key={h} style={{
                        padding: '3px 6px', textAlign: 'right', color: BT.text.muted,
                        fontWeight: 600, borderBottom: `1px solid ${BT.border.subtle}`, fontSize: 8,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lpTranches.map(t => {
                    const backendT = ret?.lpTrancheReturns?.find(r => r.id === t.id);
                    return (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                        <td style={{ padding: '3px 6px', color: BT.text.secondary, fontSize: 9 }}>{t.label}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.primary }}>{t.pctOfEquity.toFixed(0)}%</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.muted }}>{fmtIrr(t.prefRate)}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.met.financial, fontWeight: 600 }}>{fmtIrr(t.irr)}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.cyan, fontWeight: 600 }}>{fmtEm(t.em)}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.purple }}>
                          {backendT?.avgCoc != null ? fmtIrr(backendT.avgCoc) : '—'}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.amber }}>
                          {backendT?.twr != null ? fmtEm(backendT.twr + 1) : '—'}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                          {backendT?.promoteTierHit == null
                            ? <span style={{ color: BT.text.muted }}>—</span>
                            : <span style={{ color: backendT.promoteTierHit ? BT.text.green : BT.text.red }}>
                                {backendT.promoteTierHit ? '✓ hit' : '✗ miss'}
                              </span>
                          }
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                          <span style={{ color: t.prefAchieved ? BT.text.green : BT.text.red }}>
                            {t.prefAchieved ? '✓' : '✗'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* § 5 — Debt Returns */}
          <SectionHeader label="§ 5  DEBT RETURNS" color={BT.text.orange} />
          <KvRow label="Min DSCR"
            value={fmtDscr(ret?.minDscr ?? null)}
            sub={ret?.minDscrYear != null ? `Yr ${ret.minDscrYear}` : undefined}
            color={ret?.minDscr != null && ret.minDscr < 1.2 ? BT.text.red : undefined}
            bold
          />
          <KvRow label="Avg DSCR"         value={fmtDscr(ret?.avgDscr ?? null)} />
          <KvRow label="Min Debt Yield"
            value={ret?.minDebtYield != null ? fmtCap(ret.minDebtYield) : '—'}
            sub={ret?.minDebtYieldYear != null ? `Yr ${ret.minDebtYieldYear}` : undefined}
            bold
          />
          <KvRow label="Avg Debt Yield"   value={ret?.avgDebtYield != null ? fmtCap(ret.avgDebtYield) : '—'} />
          <KvRow label="Maturity LTV"
            value={fmtCap(ret?.maturityLtv ?? null)}
            color={ret?.maturityLtv != null && ret.maturityLtv > 0.75 ? BT.text.amber : undefined}
          />
          <KvRow label="Refi Events"
            value={ret?.refiEventCount != null ? `${ret.refiEventCount}` : '—'}
            color={ret?.refiEventCount != null && ret.refiEventCount > 0 ? BT.text.amber : undefined}
          />
          <KvRow label="Interest Rate"    value={cap?.interestRate != null ? fmtCap(cap.interestRate) : '—'} indent />
          <KvRow label="IO Period"        value={cap?.ioPeriodMonths != null ? `${cap.ioPeriodMonths} mo` : '—'} indent />

          {/* Annual CF bar chart */}
          {cfBars.length > 0 && (
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${BT.border.subtle}`, marginTop: 4 }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 6 }}>ANNUAL CASH FLOW BTCF</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52 }}>
                {cfBars.map(bar => {
                  const maxAbs = Math.max(...cfBars.map(b => Math.abs(b.cfbt)), 1);
                  const barH = Math.max(3, (Math.abs(bar.cfbt) / maxAbs) * 44);
                  const col  = bar.isSale ? BT.text.amber : bar.cfbt >= 0 ? BT.met.financial : BT.text.red;
                  return (
                    <div key={bar.yr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', height: barH, background: col, borderRadius: 1, opacity: 0.85 }} />
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>Y{bar.yr}{bar.isSale ? '★' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ──── RIGHT COLUMN ──── */}
        <div style={{ borderLeft: `1px solid ${BT.border.subtle}` }}>

          {/* § 3 — LP Aggregate */}
          <SectionHeader label="§ 3  LP AGGREGATE" color={BT.text.purple} />
          <KvRow label="Peak Equity Deployed"   value={ret?.peakEquityDeployed != null ? fmt$(ret.peakEquityDeployed) : '—'} bold />
          <KvRow label="Total LP Distributions" value={ret?.totalLpDistributions != null ? fmt$(ret.totalLpDistributions) : '—'} bold />
          <KvRow label="Equity Recovery Year"   value={fmtYr(ret?.equityRecoveryYear ?? null)} />
          <KvRow label="Pref Accrued (total)"   value={ret?.prefAccrued != null ? fmt$(ret.prefAccrued) : '—'} />
          <KvRow label="Pref Paid (total)"      value={ret?.prefPaid != null ? fmt$(ret.prefPaid) : '—'} />
          {ret?.prefAccrued != null && ret?.prefPaid != null && ret.prefPaid < ret.prefAccrued * 0.99 && (
            <div style={{ padding: '3px 10px', background: `${BT.text.red}10`, borderBottom: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.red }}>
                ⚠ Pref gap: {fmt$(ret.prefAccrued - ret.prefPaid)} unpaid
              </span>
            </div>
          )}

          {/* Cumulative CF sparkline */}
          {ret?.cumulativeCfByYear && ret.cumulativeCfByYear.length > 1 && (
            <div style={{ padding: '8px 10px 4px', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 4 }}>
                CUMULATIVE LP CASHFLOW (CFADS)
              </div>
              <Sparkline data={ret.cumulativeCfByYear} color={BT.text.purple} width={220} height={40} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>Yr 1</span>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>Yr {ret.cumulativeCfByYear.length}</span>
              </div>
            </div>
          )}

          {/* Net distributions by year */}
          {ret?.netDistributionsByYear && ret.netDistributionsByYear.length > 0 && (
            <div style={{ padding: '4px 10px 8px', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 4 }}>NET DISTRIBUTIONS BY YEAR</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ret.netDistributionsByYear.map((v, i) => (
                  <span key={i} style={{ fontFamily: MONO, fontSize: 8, color: v >= 0 ? BT.text.purple : BT.text.red }}>
                    Y{i + 1}: {v >= 0 ? fmt$(v) : `(${fmt$(-v)})`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* § 4 — GP Returns */}
          <SectionHeader label="§ 4  GP RETURNS" color={BT.text.amber} />
          <KvRow label="GP Co-Invest IRR"    value={fmtIrr(ret?.gpCoInvestIrr ?? null)} bold color={BT.text.amber} />
          <KvRow label="GP Co-Invest EM"     value={fmtEm(ret?.gpCoInvestEm ?? null)} bold />
          <KvRow label="GP Equity Share"     value={wf?.gpShare != null ? `${(wf.gpShare * 100).toFixed(0)}%` : '—'} />
          <KvRow label="Preferred Return"    value={prefRate != null ? `${(prefRate * 100).toFixed(1)}%` : '—'} indent />
          <KvRow label="Total GP Fees"       value={ret?.totalGpFees != null ? fmt$(ret.totalGpFees) : '—'} bold />
          <KvRow label="  Acq. Fee"
            value={wf?.fees?.acquisitionFeePct != null ? fmtCap(wf.fees.acquisitionFeePct) : '—'} indent />
          <KvRow label="  Asset Mgmt Fee"
            value={wf?.fees?.assetMgmtFeePct != null ? fmtCap(wf.fees.assetMgmtFeePct) : '—'} indent />
          <KvRow label="  Disposition Fee"
            value={wf?.fees?.dispositionFeePct != null ? fmtCap(wf.fees.dispositionFeePct) : '—'} indent />
          <KvRow label="Total GP Promote"
            value={ret?.totalGpPromote != null ? fmt$(ret.totalGpPromote) : '—'} bold color={BT.text.amber} />
          <KvRow label="GP All-In Multiple"
            value={ret?.gpAllInMultiple != null ? fmtEm(ret.gpAllInMultiple) : '—'}
            color={ret?.gpAllInMultiple != null && ret.gpAllInMultiple >= 2 ? BT.text.green : BT.text.primary}
          />

          {/* Promote tier bar visualization */}
          {wf?.tiers && wf.tiers.length > 0 && (
            <div style={{ padding: '6px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 6 }}>PROMOTE TIER BAR</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {wf.tiers.map((tier, i) => {
                  const gpPct = tier.gpPct * 100;
                  const lpPct = tier.lpPct * 100;
                  const isHit = ret?.lpNetIrr != null && ret.lpNetIrr >= tier.triggerIrr;
                  const barColor = isHit ? BT.text.green : BT.text.muted;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: isHit ? BT.text.green : BT.text.muted }}>
                          {isHit ? '✓' : '○'} ≥ {fmtIrr(tier.triggerIrr)}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                          LP {lpPct.toFixed(0)}% / GP {gpPct.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', height: 8, borderRadius: 2, overflow: 'hidden', background: `${BT.text.muted}20` }}>
                        <div style={{ width: `${lpPct}%`, background: `${barColor}60` }} />
                        <div style={{ width: `${gpPct}%`, background: BT.text.amber, opacity: isHit ? 1 : 0.3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* § 6 — Time-Based */}
          <SectionHeader label="§ 6  TIME-BASED METRICS" color={BT.text.secondary} />
          <KvRow label="Hold Period"               value={fmtMo(ret?.holdMonths ?? null)} bold />
          <KvRow label="Lease-Up Period"           value={ret?.leaseUpMonths != null ? fmtMo(ret.leaseUpMonths) : '—'} />
          <KvRow label="Peak Equity Date"
            value={ret?.peakEquityDateStr ?? '—'}
            sub={ret?.peakEquityDeployed != null ? fmt$(ret.peakEquityDeployed) : undefined}
          />
          <KvRow label="Equity Recovery"
            value={ret?.equityRecoveryYear != null ? fmtYr(ret.equityRecoveryYear) : '—'}
            sub={ret?.equityRecoveryMonths != null ? `≈ ${ret.equityRecoveryMonths} mo` : undefined}
          />
          <KvRow label="Breakeven CF"
            value={ret?.breakevenCfYear != null ? fmtYr(ret.breakevenCfYear) : '—'}
            sub={ret?.breakevenCfDateStr ?? (ret?.breakevenCfMonths != null ? `≈ ${ret.breakevenCfMonths} mo` : undefined)}
          />
          <KvRow label="Pref Accrual Years"
            value={ret?.prefAccrualYears != null ? `${ret.prefAccrualYears} yr${ret.prefAccrualYears !== 1 ? 's' : ''}` : '—'}
            color={ret?.prefAccrualYears != null && ret.prefAccrualYears > 0 ? BT.text.amber : undefined}
          />
          <KvRow label="Preferred Rate"           value={prefRate != null ? `${(prefRate * 100).toFixed(1)}%/yr` : '—'} indent />

        </div>
      </div>

      {/* § 7 — Risk-Adjusted Placeholder */}
      <SectionHeader label="§ 7  RISK-ADJUSTED RETURNS  (M14 Monte Carlo — not yet run)" color={BT.text.muted} />
      <div style={{
        margin: '8px 12px 0',
        padding: '14px 18px',
        background: `${BT.text.muted}08`,
        border: `1px dashed ${BT.border.subtle}`,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 10 }}>
            Monte Carlo engine (M14) has not been run for this deal.
            Probabilistic returns require a simulation pass over the assumption space.
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Prob-Weighted IRR' },
              { label: 'IRR Std Dev' },
              { label: 'Downside IRR (P10)' },
              { label: 'Sharpe Ratio' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{m.label}</div>
                <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: `${BT.text.muted}80` }}>—</div>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => onTabChange?.(8)}
          style={{
            padding: '8px 14px',
            background: `${BT.text.amber}18`,
            border: `1px solid ${BT.text.amber}`,
            color: BT.text.amber,
            fontFamily: MONO, fontSize: 9, fontWeight: 600,
            cursor: 'pointer', borderRadius: 4, whiteSpace: 'nowrap',
          }}
        >
          ⊞ Run Monte Carlo →
        </button>
      </div>

      {/* Source footnote */}
      <div style={{ padding: '8px 12px 0', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
        All metrics sourced from backend projection engine (GET /financials?hold=N).
        LP IRR: Newton-Raphson on annual equity cashflows incl. net sale proceeds.
        Unleveraged IRR: NOI cashflows + gross sale / purchase price.
        {' '}
        <span style={{ color: BT.text.cyan, cursor: 'pointer' }} onClick={() => onTabChange?.(2)}>
          View Projections →
        </span>
      </div>
    </div>
  );
}

export default ReturnsTab;
