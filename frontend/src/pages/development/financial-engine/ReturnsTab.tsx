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
    const schedule = Array.isArray(capData.schedule) ? capData.schedule : [];
    const equityTotal = cap?.equityAtClose ?? 0;
    return capData.tranches.filter(t => t.role === 'lp').map(t => {
      const equityIn = equityTotal * (t.pct / 100);
      const distTotal = schedule.reduce((s, p) => s + p.lpDist, 0) * (t.pct / 100);
      const em = equityIn > 0 ? distTotal / equityIn : null;
      const prefAchieved = schedule.length > 0
        ? schedule.every(p => p.prefPaid >= p.prefAccrued * 0.99)
        : false;
      return { id: t.id, label: t.label, pctOfEquity: t.pct, prefRate: t.prefRate, irr: capData.metrics?.lpIrr ?? null, em, prefAchieved };
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

      {/* ── Leasing Cost Treatment Banner ──────────────────────────────────── */}
      {(() => {
        const lv = f9Financials?.leaseVelocity ?? null;
        if (!lv) {
          return (
            <div style={{
              padding: '5px 16px', background: `${BT.text.muted}08`,
              borderBottom: `1px solid ${BT.border.subtle}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                LEASING COST TREATMENT
              </span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>
                ◌ LV engine not connected — IRR uses NOI-based operating cash flows (OPERATING basis assumed).
                Cost-treatment-aware monthly cash flows will load once M07 + backend engine ship.
              </span>
            </div>
          );
        }
        const treatColors: Record<string, string> = {
          OPERATING:   BT.met.financial,
          CAPITALIZED: BT.text.cyan,
          HYBRID:      BT.text.amber,
        };
        const treatDesc: Record<string, string> = {
          OPERATING:   'Concessions & marketing in operating cash flows — IRR reflects full periodic leasing drag',
          CAPITALIZED: 'Lease-up concessions & marketing removed from ops; added to initial equity — boosts in-place IRR',
          HYBRID:      'Concessions amortized as effective-rent reduction; marketing remains in ops — blended treatment',
        };
        const t = lv.costTreatmentInEffect;
        return (
          <div style={{
            padding: '5px 16px', background: `${treatColors[t] ?? BT.text.muted}0A`,
            borderBottom: `1px solid ${(treatColors[t] ?? BT.text.muted)}30`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>LEASING COST TREATMENT</span>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: treatColors[t] ?? BT.text.muted }}>
              {t}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>·</span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
              {treatDesc[t] ?? ''}
            </span>
            {lv.resolvedMode === 'LEASE_UP_NEW_CONSTRUCTION' && (
              <>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>·</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.teal }}>
                  LEASE-UP MODE · {lv.stabilizationMonth != null ? `Mo ${lv.stabilizationMonth} stab` : 'stab month pending'}
                </span>
              </>
            )}
          </div>
        );
      })()}

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
              <span style={{ color: BT.text.cyan, cursor: 'pointer' }} onClick={() => onTabChange?.(8)}>
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

          {/* § 5 — Debt Returns (expanded) */}
          <SectionHeader label="§ 5  DEBT RETURNS" color={BT.text.orange} />

          {/* 5a — Coverage */}
          <div style={{ padding: '3px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}`, background: `${BT.text.orange}08` }}>
            <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>COVERAGE RATIOS</span>
          </div>
          <KvRow label="DSCR (Y1)"
            value={fmtDscr(ret?.debtMetrics?.coverage?.dscrY1 ?? ret?.minDscr ?? null)}
            color={(() => { const v = ret?.debtMetrics?.coverage?.dscrY1 ?? ret?.minDscr; return v != null && v < 1.25 ? BT.text.amber : undefined; })()}
          />
          <KvRow label="DSCR Min"
            value={fmtDscr(ret?.debtMetrics?.coverage?.dscrMin?.value ?? ret?.minDscr ?? null)}
            sub={ret?.debtMetrics?.coverage?.dscrMin?.year != null ? `Yr ${ret.debtMetrics.coverage.dscrMin.year}` : ret?.minDscrYear != null ? `Yr ${ret.minDscrYear}` : undefined}
            color={(() => { const v = ret?.debtMetrics?.coverage?.dscrMin?.value ?? ret?.minDscr; return v != null && v < 1.2 ? BT.text.red : undefined; })()}
            bold
          />
          <KvRow label="DSCR Avg"   value={fmtDscr(ret?.debtMetrics?.coverage?.dscrAvg ?? ret?.avgDscr ?? null)} />
          <KvRow label="Debt Yield (Y1)"
            value={ret?.debtMetrics?.coverage?.dyY1 != null ? fmtCap(ret.debtMetrics.coverage.dyY1) : ret?.minDebtYield != null ? fmtCap(ret.minDebtYield) : '—'}
          />
          <KvRow label="Debt Yield Min"
            value={ret?.debtMetrics?.coverage?.dyMin?.value != null ? fmtCap(ret.debtMetrics.coverage.dyMin.value) : '—'}
            sub={ret?.debtMetrics?.coverage?.dyMin?.year != null ? `Yr ${ret.debtMetrics.coverage.dyMin.year}` : undefined}
          />
          <KvRow label="Interest Coverage (ICR)" value={fmtDscr(ret?.debtMetrics?.coverage?.icr ?? null)} indent />
          <KvRow label="Cash Flow Coverage"      value={fmtDscr(ret?.debtMetrics?.coverage?.cashFlowCoverage ?? null)} indent />
          <KvRow label="Loan Constant"
            value={ret?.debtMetrics?.coverage?.loanConstantBlended != null ? fmtCap(ret.debtMetrics.coverage.loanConstantBlended) : '—'}
            bold
          />

          {/* 5b — Structural */}
          <div style={{ padding: '3px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}`, background: `${BT.text.orange}08` }}>
            <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>STRUCTURAL</span>
          </div>
          <KvRow label="LTV at Close"
            value={fmtCap(ret?.debtMetrics?.structural?.ltvAtClose ?? null)}
            color={ret?.debtMetrics?.structural?.ltvAtClose != null && ret.debtMetrics.structural.ltvAtClose > 0.80 ? BT.text.amber : undefined}
            bold
          />
          <KvRow label="LTV at Stabilization" value={fmtCap(ret?.debtMetrics?.structural?.ltvAtStab ?? null)} />
          <KvRow label="LTV at Maturity"
            value={fmtCap(ret?.debtMetrics?.structural?.ltvAtMaturity ?? ret?.maturityLtv ?? null)}
            color={(() => { const v = ret?.debtMetrics?.structural?.ltvAtMaturity ?? ret?.maturityLtv; return v != null && v > 0.75 ? BT.text.amber : undefined; })()}
          />
          <KvRow label="LTC (Loan-to-Cost)"   value={fmtCap(ret?.debtMetrics?.structural?.ltc ?? null)} indent />
          <KvRow label="LTSV"                  value={fmtCap(ret?.debtMetrics?.structural?.ltsv ?? null)} indent />
          <KvRow label="Refi-Out Probability"
            value={ret?.debtMetrics?.structural?.refiOutProbability != null ? `${(ret.debtMetrics.structural.refiOutProbability * 100).toFixed(0)}%` : '—'}
            color={BT.text.muted}
          />
          <KvRow label="Maturity Risk Score"
            value={ret?.debtMetrics?.structural?.maturityRiskScore != null ? `${ret.debtMetrics.structural.maturityRiskScore.toFixed(1)} / 10` : '—'}
            color={ret?.debtMetrics?.structural?.maturityRiskScore != null && ret.debtMetrics.structural.maturityRiskScore > 7 ? BT.text.red : BT.text.muted}
          />

          {/* 5c — Leverage Position */}
          <div style={{ padding: '3px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}`, background: `${BT.text.orange}08` }}>
            <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>LEVERAGE POSITION</span>
          </div>
          {ret?.debtMetrics?.leverage?.positiveLeverage != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>Leverage</span>
              <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: ret.debtMetrics.leverage.positiveLeverage ? BT.text.green : BT.text.red }}>
                {ret.debtMetrics.leverage.positiveLeverage ? '✓ Positive' : '✗ Negative'}
              </span>
            </div>
          )}
          {!ret?.debtMetrics?.leverage?.positiveLeverage && ret?.debtMetrics?.leverage?.positiveLeverage === false && (
            <div style={{ padding: '4px 10px 6px', background: `${BT.text.red}08`, borderBottom: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.red }}>
                Loan constant exceeds going-in cap. Return depends on appreciation, not cash flow.
              </span>
            </div>
          )}
          <KvRow label="Leverage Spread"
            value={ret?.debtMetrics?.leverage?.leverageSpreadBps != null ? `${ret.debtMetrics.leverage.leverageSpreadBps.toFixed(0)} bps` : '—'}
            color={ret?.debtMetrics?.leverage?.leverageSpreadBps != null && ret.debtMetrics.leverage.leverageSpreadBps < 0 ? BT.text.red : BT.text.green}
          />
          <KvRow label="CoC Spread vs Constant"
            value={ret?.debtMetrics?.leverage?.cashOnCashSpread != null ? fmtCap(ret.debtMetrics.leverage.cashOnCashSpread) : '—'}
          />
          <KvRow label="IRR Lift from Leverage"
            value={ret?.debtMetrics?.leverage?.leverageIrrLiftBps != null ? `${ret.debtMetrics.leverage.leverageIrrLiftBps.toFixed(0)} bps` : '—'}
            color={BT.text.muted}
          />

          {/* 5d — Stress Tests */}
          <div style={{ padding: '3px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}`, background: `${BT.text.orange}08` }}>
            <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>STRESS TESTS</span>
          </div>
          <KvRow label="Breakeven Occupancy"
            value={ret?.debtMetrics?.stress?.breakevenOccupancy != null ? `${(ret.debtMetrics.stress.breakevenOccupancy * 100).toFixed(1)}%` : '—'}
            sub="occ at which NOI = DS"
            bold
          />
          <KvRow label="Breakeven Rent/Unit"
            value={ret?.debtMetrics?.stress?.breakevenRent != null ? `$${Math.round(ret.debtMetrics.stress.breakevenRent).toLocaleString()}/mo` : '—'}
            sub="rent where NOI covers DS"
          />
          <KvRow label="DSCR at −10% NOI"
            value={fmtDscr(ret?.debtMetrics?.stress?.dscrAtMinus10PctNOI ?? null)}
            color={ret?.debtMetrics?.stress?.dscrAtMinus10PctNOI != null && ret.debtMetrics.stress.dscrAtMinus10PctNOI < 1.0 ? BT.text.red : undefined}
            indent
          />
          <KvRow label="DSCR at +200bps Rate"
            value={fmtDscr(ret?.debtMetrics?.stress?.dscrAtPlus200bps ?? null)}
            indent
          />
          <KvRow label="Cash Trap Distance"
            value={ret?.debtMetrics?.stress?.cashTrapDistanceBps != null ? `${ret.debtMetrics.stress.cashTrapDistanceBps.toFixed(0)} bps` : '—'}
            color={ret?.debtMetrics?.stress?.cashTrapDistanceBps != null && ret.debtMetrics.stress.cashTrapDistanceBps < 10 * 100 ? BT.text.amber : undefined}
          />
          <KvRow label="Default Buffer"
            value={ret?.debtMetrics?.stress?.defaultBufferMonths != null ? `${ret.debtMetrics.stress.defaultBufferMonths.toFixed(0)} mo` : '—'}
            sub="months of reserves to cover DS shortfall"
            color={ret?.debtMetrics?.stress?.defaultBufferMonths != null && ret.debtMetrics.stress.defaultBufferMonths < 3 ? BT.text.red : BT.text.muted}
          />

          {/* 5e — Refi Economics */}
          <div style={{ padding: '3px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}`, background: `${BT.text.orange}08` }}>
            <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>REFI ECONOMICS</span>
          </div>
          <KvRow label="Refi Events"
            value={ret?.refiEventCount != null ? `${ret.refiEventCount}` : '—'}
            color={ret?.refiEventCount != null && ret.refiEventCount > 0 ? BT.text.amber : undefined}
          />
          <KvRow label="Defeasance Cost Today" value={ret?.debtMetrics?.refi?.defeasanceCostToday != null ? fmt$(ret.debtMetrics.refi.defeasanceCostToday) : '—'} indent />
          <KvRow label="YM Cost Today"          value={ret?.debtMetrics?.refi?.ymCostToday != null ? fmt$(ret.debtMetrics.refi.ymCostToday) : '—'} indent />
          <KvRow label="Cost-to-Refi-Now"       value={ret?.debtMetrics?.refi?.costToRefiNowBps != null ? `${ret.debtMetrics.refi.costToRefiNowBps.toFixed(0)} bps IRR` : '—'} indent />
          <KvRow label="Interest Rate"    value={cap?.interestRate != null ? fmtCap(cap.interestRate) : '—'} indent />
          <KvRow label="IO Period"        value={cap?.ioPeriodMonths != null ? `${cap.ioPeriodMonths} mo` : '—'} indent />

          {/* Annual CF bar chart */}
          {cfBars.length > 0 && (
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${BT.border.subtle}`, marginTop: 4 }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 6 }}>ANNUAL CASH FLOW BTCF</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52 }}>
                {cfBars.map(bar => {
                  const maxAbs = Math.max(...cfBars.map(b => Math.abs(b.cfbt ?? 0)), 1);
                  const barH = Math.max(3, (Math.abs(bar.cfbt ?? 0) / maxAbs) * 44);
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

      {/* § 8 — Valuation Metrics */}
      <SectionHeader label="§ 8  VALUATION METRICS" color={BT.text.cyan} />
      {!ret?.valuation ? (
        <div style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
          Valuation metrics unavailable — projection engine did not return a valuation block.
          Ensure deal has a purchase price and at least one hold-period projection year.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

            {/* Left: Per-Unit/SF + Income Multiples */}
            <div>
              {/* Per-Unit / SF table */}
              <div style={{ padding: '4px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PRICE PER UNIT / SF</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
                <thead>
                  <tr style={{ background: BT.bg.header }}>
                    {['Metric', 'Going-In', 'Stab', 'Exit', 'Submarket', 'Pctile'].map(h => (
                      <th key={h} style={{ padding: '2px 6px', textAlign: 'right', fontSize: 8, color: BT.text.muted, borderBottom: `1px solid ${BT.border.subtle}`, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '3px 6px', color: BT.text.secondary }}>$/Unit</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.primary, fontWeight: 600 }}>
                      {ret.valuation.perUnit?.goingIn != null ? `$${ret.valuation.perUnit?.goingIn.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.muted }}>
                      {ret.valuation.perUnit?.stabilized != null ? `$${ret.valuation.perUnit?.stabilized.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.amber }}>
                      {ret.valuation.perUnit?.atExit != null ? `$${ret.valuation.perUnit?.atExit.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.muted }}>
                      {ret.valuation.perUnit?.submarketMedian != null ? `$${ret.valuation.perUnit?.submarketMedian.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.muted }}>
                      {ret.valuation.perUnit?.percentile != null ? `${ret.valuation.perUnit?.percentile}p` : '—'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '3px 6px', color: BT.text.secondary }}>$/NR SF</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.primary, fontWeight: 600 }}>
                      {ret.valuation.perSF?.netRentable?.goingIn != null ? `$${ret.valuation.perSF?.netRentable?.goingIn.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.muted }}>—</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.amber }}>
                      {ret.valuation.perSF?.netRentable?.atExit != null ? `$${ret.valuation.perSF?.netRentable?.atExit.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.muted }}>
                      {ret.valuation.perSF?.netRentable?.submarketMedian != null ? `$${ret.valuation.perSF?.netRentable?.submarketMedian.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.muted }}>
                      {ret.valuation.perSF?.netRentable?.percentile != null ? `${ret.valuation.perSF?.netRentable?.percentile}p` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Income Multiples */}
              <div style={{ padding: '4px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>INCOME MULTIPLES</span>
              </div>
              {[
                { label: 'GRM', val: ret.valuation.multiples?.grm?.goingIn, sub: ret.valuation.multiples?.grm?.submarketMedian, fmt: (n: number) => `${n.toFixed(1)}×`, note: ret.valuation.multiples?.grm?.goingIn != null && ret.valuation.multiples?.grm?.goingIn > 12 ? { text: '>12× — high', color: BT.text.red } : null },
                { label: 'GIM', val: ret.valuation.multiples?.gim?.goingIn, sub: ret.valuation.multiples?.gim?.submarketMedian, fmt: (n: number) => `${n.toFixed(1)}×`, note: null },
                { label: 'NIM', val: ret.valuation.multiples?.nim, sub: null, fmt: (n: number) => `${n.toFixed(1)}×`, note: null },
                { label: 'OER (Y1)', val: ret.valuation.multiples?.opexRatio?.y1, sub: null, fmt: (n: number) => `${(n * 100).toFixed(1)}%`, note: null },
                { label: 'CoC (Y1)', val: ret.valuation.multiples?.coc?.y1, sub: null, fmt: (n: number) => `${(n * 100).toFixed(2)}%`, note: null },
                { label: 'YoC (Untrended)', val: ret.valuation.multiples?.yieldOnCost?.untrended, sub: null, fmt: (n: number) => `${(n * 100).toFixed(2)}%`, note: null },
                { label: 'YoC (Trended)', val: ret.valuation.multiples?.yieldOnCost?.trended, sub: null, fmt: (n: number) => `${(n * 100).toFixed(2)}%`, note: null },
                { label: 'Dev Spread', val: ret.valuation.multiples?.devSpread, sub: null, fmt: (n: number) => `${(n * 10000).toFixed(0)} bps`, note: null },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{row.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: row.note ? row.note.color : BT.text.primary }}>
                      {row.val != null ? row.fmt(row.val) : '—'}
                    </span>
                    {row.sub != null && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginLeft: 6 }}>mkt: {row.fmt(row.sub)}</span>}
                    {row.note && <span style={{ fontFamily: MONO, fontSize: 8, color: row.note.color, marginLeft: 6 }}>{row.note.text}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Replacement Cost + Position Matrix */}
            <div style={{ borderLeft: `1px solid ${BT.border.subtle}` }}>
              {/* Replacement Cost */}
              <div style={{ padding: '4px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>REPLACEMENT COST</span>
              </div>
              {ret.valuation.replacementCost?.rcTotal != null ? (
                <>
                  <KvRow label="RC Total" value={fmt$(ret.valuation.replacementCost.rcTotal)} bold />
                  <KvRow label="RC / Unit" value={ret.valuation.replacementCost.rcPerUnit != null ? fmt$(ret.valuation.replacementCost.rcPerUnit) : '—'} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>Price / RC</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.primary }}>
                        {ret.valuation.replacementCost.priceToRC != null ? `${(ret.valuation.replacementCost.priceToRC * 100).toFixed(0)}%` : '—'}
                      </span>
                      {ret.valuation.replacementCost.buildArbitrageFlag === 'buy_existing' && (
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green, background: `${BT.text.green}18`, padding: '1px 4px', borderRadius: 2 }}>Buy&lt;Build</span>
                      )}
                      {ret.valuation.replacementCost.buildArbitrageFlag === 'build_new' && (
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, background: `${BT.text.amber}18`, padding: '1px 4px', borderRadius: 2 }}>Build&lt;Buy</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '8px 10px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
                  Replacement cost not yet seeded — requires construction cost feed.
                </div>
              )}

              {/* Position Matrix — scatter-dot visualization */}
              <div style={{ padding: '4px 10px 2px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>POSITION MATRIX  (Price/SF vs Cap Rate)</span>
              </div>
              {(() => {
                const pm = ret.valuation.positionMatrix ?? null;
                if (!pm) return (
                  <div style={{ padding: '8px 10px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
                    Position matrix unavailable — requires purchase price and cap rate data.
                  </div>
                );
                const qLabels: Record<string, { label: string; color: string; desc: string }> = {
                  value_buy:          { label: 'VALUE BUY', color: BT.text.green, desc: 'Low $/SF + High Cap — the sweet spot' },
                  suspicious:         { label: 'SUSPICIOUS', color: BT.text.amber, desc: 'Low $/SF + Low Cap — why is yield compressed?' },
                  distressed_trophy:  { label: 'DISTRESSED TROPHY', color: BT.text.amber, desc: 'High $/SF + High Cap — premium asset, broken ops' },
                  trophy:             { label: 'TROPHY', color: BT.text.muted, desc: 'High $/SF + Low Cap — premium pricing' },
                };
                const q = pm.quadrant ? qLabels[pm.quadrant] : null;

                // Scatter plot axes: X = Price/SF (0→500), Y = Cap Rate (0→10%)
                // We use a 140×100px canvas-like SVG
                const W = 140; const H = 100;
                const PAD = { l: 20, b: 14, r: 6, t: 6 };
                const plotW = W - PAD.l - PAD.r;
                const plotH = H - PAD.t - PAD.b;
                const sfThreshold = 200; const capThreshold = 0.055;
                // Normalize SF (0–500) and cap rate (0–0.12) to plot coords
                const toX = (sf: number) => PAD.l + Math.min(1, sf / 500) * plotW;
                const toY = (cap: number) => PAD.t + plotH - Math.min(1, cap / 0.12) * plotH;

                // Threshold lines in plot coords
                const threshX = toX(sfThreshold);
                const threshY = toY(capThreshold);

                // Deal dot
                const dealX = pm.priceSF != null ? toX(pm.priceSF) : null;
                const dealY = pm.capRate != null ? toY(pm.capRate) : null;

                return (
                  <div style={{ padding: '8px 10px' }}>
                    {q && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: q.color }}>{q.label}</span>
                        <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginTop: 1 }}>{q.desc}</div>
                      </div>
                    )}
                    {/* SVG scatter plot */}
                    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
                      {/* Quadrant backgrounds */}
                      <rect x={PAD.l} y={PAD.t} width={threshX - PAD.l} height={threshY - PAD.t} fill={`${BT.text.amber}10`} />
                      <rect x={threshX} y={PAD.t} width={PAD.l + plotW - threshX} height={threshY - PAD.t} fill={`${BT.text.muted}08`} />
                      <rect x={PAD.l} y={threshY} width={threshX - PAD.l} height={PAD.t + plotH - threshY} fill={`${BT.text.green}12`} />
                      <rect x={threshX} y={threshY} width={PAD.l + plotW - threshX} height={PAD.t + plotH - threshY} fill={`${BT.text.amber}08`} />
                      {/* Axes */}
                      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + plotH} stroke={BT.border.subtle} strokeWidth={0.5} />
                      <line x1={PAD.l} y1={PAD.t + plotH} x2={PAD.l + plotW} y2={PAD.t + plotH} stroke={BT.border.subtle} strokeWidth={0.5} />
                      {/* Threshold lines */}
                      <line x1={threshX} y1={PAD.t} x2={threshX} y2={PAD.t + plotH} stroke={BT.text.muted} strokeWidth={0.5} strokeDasharray="2,2" />
                      <line x1={PAD.l} y1={threshY} x2={PAD.l + plotW} y2={threshY} stroke={BT.text.muted} strokeWidth={0.5} strokeDasharray="2,2" />
                      {/* Quadrant labels */}
                      <text x={PAD.l + 2} y={PAD.t + 9} fill={BT.text.green} fontSize={5} fontFamily="monospace">VALUE</text>
                      <text x={threshX + 2} y={PAD.t + 9} fill={BT.text.muted} fontSize={5} fontFamily="monospace">TROPHY</text>
                      <text x={PAD.l + 2} y={PAD.t + plotH - 3} fill={BT.text.amber} fontSize={5} fontFamily="monospace">SUSP.</text>
                      <text x={threshX + 2} y={PAD.t + plotH - 3} fill={BT.text.amber} fontSize={5} fontFamily="monospace">DISTRESSED</text>
                      {/* Axis labels */}
                      <text x={PAD.l + plotW / 2} y={H - 1} fill={BT.text.muted} fontSize={5} textAnchor="middle" fontFamily="monospace">$/SF →</text>
                      <text x={4} y={PAD.t + plotH / 2} fill={BT.text.muted} fontSize={5} textAnchor="middle" transform={`rotate(-90,4,${PAD.t + plotH / 2})`} fontFamily="monospace">Cap%↑</text>
                      {/* Comp dots */}
                      {pm.comps.map((c, i) => (
                        <circle key={i} cx={toX(c.priceSF)} cy={toY(c.capRate)} r={2.5} fill={BT.text.muted} opacity={0.5} />
                      ))}
                      {/* Deal dot */}
                      {dealX != null && dealY != null && (
                        <>
                          <circle cx={dealX} cy={dealY} r={4} fill={q ? q.color : BT.text.cyan} opacity={0.9} />
                          <text x={dealX + 5} y={dealY + 4} fill={q ? q.color : BT.text.cyan} fontSize={6} fontFamily="monospace">THIS DEAL</text>
                        </>
                      )}
                      {/* Placeholder cross when no data */}
                      {dealX == null && (
                        <text x={PAD.l + plotW / 2} y={PAD.t + plotH / 2 + 3} fill={BT.text.muted} fontSize={7} textAnchor="middle" fontFamily="monospace">no $/SF data</text>
                      )}
                    </svg>
                    {pm.priceSF != null && (
                      <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginTop: 2 }}>
                        Deal: ${pm.priceSF.toFixed(0)}/SF · {pm.capRate != null ? fmtCap(pm.capRate) : '—'} cap · threshold $200/SF / 5.5%
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
      )}

      {/* § 9 — Strategy Comparison Footer */}
      {ret?.strategyAlternative ? (
        <div style={{ margin: '8px 12px 0', padding: '10px 14px', background: `${BT.text.cyan}08`, border: `1px solid ${BT.text.cyan}30`, borderRadius: 4 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, fontWeight: 700, marginBottom: 6 }}>
            § 9  STRATEGY COMPARISON  (M08 Strategy Arbitrage)
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>Current Strategy</div>
              <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BT.text.primary }}>
                {fmtIrr(ret.lpNetIrr)} IRR · {fmtEm(ret.lpEquityMultiple)}
              </div>
            </div>
            <div style={{ color: BT.text.muted, fontFamily: MONO, fontSize: 14 }}>→</div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan }}>{ret.strategyAlternative.strategy}</div>
              <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BT.text.cyan }}>
                {fmtIrr(ret.strategyAlternative.irr)} IRR · {fmtEm(ret.strategyAlternative.em)}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 6 }}>{ret.strategyAlternative.rationale}</div>
        </div>
      ) : (
        <div style={{ margin: '6px 12px 0', padding: '6px 12px', background: `${BT.text.muted}06`, border: `1px dashed ${BT.border.subtle}`, borderRadius: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            § 9  Strategy comparison not yet run (M08 Strategy Arbitrage module).
          </span>
        </div>
      )}

      {/* Source footnote */}
      <div style={{ padding: '8px 12px 0', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
        All metrics sourced from backend projection engine (GET /financials?hold=N).
        LP IRR: Newton-Raphson on annual equity cashflows incl. net sale proceeds.
        Unleveraged IRR: NOI cashflows + gross sale / purchase price.
        {' '}
        <span style={{ color: BT.text.cyan, cursor: 'pointer' }} onClick={() => onTabChange?.(6)}>
          View Projections →
        </span>
      </div>
    </div>
  );
}

export default ReturnsTab;
