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

// ─── LP Focus Panel (Task #878) ──────────────────────────────────────────────
// Full LP-centric panel: hero metrics + preferred return by year +
// cumulative distribution schedule + downside NOI haircut section.
function LpFocusPanel({ lpIrr, lpEm, prefRate, capData, ret, proj }: {
  lpIrr: number | null;
  lpEm: number | null;
  prefRate: number;
  capData: any;
  ret: any;
  proj: any[];
}) {
  const schedule: any[] = Array.isArray(capData?.schedule) ? capData.schedule : [];
  const overallPrefAchieved = schedule.length > 0
    ? schedule.every((p: any) => (p.prefPaid ?? 0) >= (p.prefAccrued ?? 0) * 0.99)
    : false;

  // Cumulative LP distributions by year
  let cumLpDist = 0;
  const scheduleRows = schedule.map((row: any, i: number) => {
    cumLpDist += row.lpDist ?? 0;
    const gap = (row.prefAccrued ?? 0) - (row.prefPaid ?? 0);
    const covered = gap <= (row.prefAccrued ?? 0) * 0.01;
    return { year: row.year ?? i + 1, prefAccrued: row.prefAccrued ?? 0, prefPaid: row.prefPaid ?? 0, lpDist: row.lpDist ?? 0, cumLpDist, covered, gap };
  });

  // Downside NOI haircut: estimate how much NOI can drop before preferred return shortfalls
  // Use last year NOI from projections or ret data
  const noi1 = ret?.noiYear1 ?? ret?.noi ?? proj[0]?.noi ?? null;
  const equityIn = capData?.equityAtClose ?? ret?.totalEquity ?? null;
  const prefDollar = equityIn != null ? equityIn * prefRate : null;
  const noiFlex = noi1 != null && prefDollar != null
    ? Math.max(0, (noi1 - prefDollar) / noi1)
    : null;

  const TH = ({ children }: { children: React.ReactNode }) => (
    <th style={{ padding: '2px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 600, borderBottom: `1px solid ${BT.border.subtle}`, fontSize: 8, fontFamily: MONO }}>
      {children}
    </th>
  );
  const TD = ({ children, color, bold }: { children: React.ReactNode; color?: string; bold?: boolean }) => (
    <td style={{ padding: '2px 8px', textAlign: 'right', color: color ?? BT.text.primary, fontWeight: bold ? 700 : 400, fontFamily: MONO, fontSize: 9, borderBottom: `1px solid ${BT.border.subtle}20` }}>
      {children}
    </td>
  );

  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
      {/* ─ Hero bar ─────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 14px',
        background: `${BT.text.purple}12`,
        borderBottom: `1px solid ${BT.text.purple}30`,
        borderLeft: `3px solid ${BT.text.purple}`,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.8 }}>
          LP VIEW
        </span>
        {[
          { label: 'LP IRR',      value: fmtIrr(lpIrr),   color: BT.met.financial },
          { label: 'LP EM',       value: fmtEm(lpEm),     color: BT.text.cyan },
          { label: 'PREF RATE',   value: fmtIrr(prefRate), color: BT.text.amber },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{label} </span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color }}>{value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PREF STATUS </span>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: overallPrefAchieved ? BT.text.green : BT.text.red }}>
            {overallPrefAchieved ? '✓ FULLY COVERED' : '✗ SHORTFALL'}
          </span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginLeft: 'auto' }}>
          Limited Partner view — capital structure edits restricted
        </span>
      </div>

      {/* ─ Tables ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: scheduleRows.length > 0 ? '1fr 1fr' : '1fr', gap: 0 }}>

        {/* Preferred return projection by year + cumulative distributions */}
        {scheduleRows.length > 0 && (
          <div>
            <div style={{ padding: '3px 10px 2px', background: `${BT.text.purple}08`, borderBottom: `1px solid ${BT.border.subtle}`, borderRight: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5 }}>
                PREF RETURN BY YEAR · CUMULATIVE DISTRIBUTIONS
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: BT.bg.header }}>
                    <TH>Yr</TH>
                    <TH>Pref Accrued</TH>
                    <TH>Pref Paid</TH>
                    <TH>Gap</TH>
                    <TH>LP Dist</TH>
                    <TH>Cum. Dist</TH>
                    <TH>Status</TH>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map(({ year, prefAccrued, prefPaid, lpDist, cumLpDist, covered, gap }) => (
                    <tr key={year}>
                      <TD color={BT.text.secondary}>{year}</TD>
                      <TD>{fmt$(prefAccrued)}</TD>
                      <TD color={covered ? BT.text.green : BT.text.amber}>{fmt$(prefPaid)}</TD>
                      <TD color={gap > 0 ? BT.text.red : BT.text.muted}>{gap > 0 ? `(${fmt$(gap)})` : '—'}</TD>
                      <TD color={BT.met.financial} bold>{fmt$(lpDist)}</TD>
                      <TD color={BT.text.cyan}>{fmt$(cumLpDist)}</TD>
                      <TD>{covered
                        ? <span style={{ color: BT.text.green, fontSize: 8 }}>✓ OK</span>
                        : <span style={{ color: BT.text.amber, fontSize: 8 }}>⚠ SHORT</span>
                      }</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Downside NOI haircut */}
        <div>
          <div style={{ padding: '3px 10px 2px', background: `${BT.text.purple}08`, borderBottom: `1px solid ${BT.border.subtle}` }}>
            <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5 }}>
              DOWNSIDE / NOI HAIRCUT ANALYSIS
            </span>
          </div>
          <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {noi1 != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>Year-1 NOI (base)</span>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: BT.text.primary }}>{fmt$(noi1)}</span>
              </div>
            )}
            {prefDollar != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>Annual pref $ (equity × {fmtIrr(prefRate)})</span>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: BT.text.amber }}>{fmt$(prefDollar)}</span>
              </div>
            )}
            {noiFlex != null && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${BT.border.subtle}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>NOI buffer above pref</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: noiFlex >= 0.15 ? BT.text.green : noiFlex >= 0.05 ? BT.text.amber : BT.text.red }}>
                    {fmtIrr(noiFlex)}
                  </span>
                </div>
                {([10, 20, 30] as const).map((pct) => {
                  const haircut = noi1! * (pct / 100);
                  const stressed = noi1! - haircut;
                  const prefStillCovered = stressed >= prefDollar!;
                  return (
                    <div key={pct} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>NOI −{pct}% → {fmt$(stressed)}</span>
                      <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 600, color: prefStillCovered ? BT.text.green : BT.text.red }}>
                        {prefStillCovered ? '✓ pref covered' : '✗ pref breach'}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
            {noi1 == null && prefDollar == null && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>Run underwriting to see NOI haircut analysis</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Lender Focus Panel (Task #878) ──────────────────────────────────────────
// Thresholds: DSCR ≥1.30 = green, ≥1.20 = amber, <1.20 = red (lender underwriting standards).
// Includes DSCR by year (min highlighted), LTV trend through hold, exit-cap stress scenarios.
function LenderDscrPanel({ ret, proj }: {
  ret: any; proj: any[];
}) {
  const dscrY1   = ret?.debtMetrics?.coverage?.dscrY1 ?? ret?.minDscr ?? null;
  const dscrMin  = ret?.debtMetrics?.coverage?.dscrMin?.value ?? ret?.minDscr ?? null;
  const dscrMinYr = ret?.debtMetrics?.coverage?.dscrMin?.year ?? ret?.minDscrYear ?? null;
  const dscrAvg  = ret?.debtMetrics?.coverage?.dscrAvg ?? ret?.avgDscr ?? null;
  const ltvClose = ret?.debtMetrics?.structural?.ltvAtClose ?? null;
  const ltvMat   = ret?.debtMetrics?.structural?.ltvAtMaturity ?? ret?.maturityLtv ?? null;
  const ltvStab  = ret?.debtMetrics?.structural?.ltvAtStab ?? null;

  // Correct lender thresholds: ≥1.30 = green, ≥1.20 = amber (warning), <1.20 = red (breach)
  const dscrColor = (v: number | null) => {
    if (v == null) return BT.text.muted;
    if (v >= 1.30) return BT.text.green;
    if (v >= 1.20) return BT.text.amber;
    return BT.text.red;
  };
  const dscrStatus = (v: number) => {
    if (v >= 1.30) return <span style={{ color: BT.text.green, fontSize: 8 }}>✓ OK</span>;
    if (v >= 1.20) return <span style={{ color: BT.text.amber, fontSize: 8 }}>⚠ THIN</span>;
    return <span style={{ color: BT.text.red, fontSize: 8 }}>✗ BREACH</span>;
  };

  // Year-by-year DSCR from projections
  const yearlyDscr = proj.slice(0, 10).map(r => ({ yr: r.year as number, dscr: r.dscr as number | null, ltv: r.ltv as number | null })).filter(r => r.dscr != null);
  // LTV trend from projections (may be sparse)
  const ltvTrend = proj.slice(0, 10).map(r => ({ yr: r.year as number, ltv: r.ltv as number | null })).filter(r => r.ltv != null);
  const hasDscr = yearlyDscr.length > 0;
  const hasLtv  = ltvTrend.length > 0;

  // Exit-cap stress scenarios
  // Use last projection year NOI; test base, +25, +50, +100 bps cap rate expansion
  const lastProj = proj.length > 0 ? proj[proj.length - 1] : null;
  const exitNoi = lastProj?.noi ?? ret?.noiYear1 ?? null;
  const baseExitCap = ret?.capitalStructureOptimization?.exit_cap_rate ?? ret?.exitCapRate ?? null;
  const loanBalance = ret?.debtMetrics?.structural?.remainingBalance ?? null;

  const exitStressRows = baseExitCap != null && exitNoi != null ? (
    [0, 25, 50, 100].map(bps => {
      const capRate = baseExitCap + bps / 10000;
      const saleVal = exitNoi / capRate;
      const stressedLtv = loanBalance != null ? loanBalance / saleVal : null;
      return { bps, capRate, saleVal, stressedLtv };
    })
  ) : [];

  const TH = ({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) => (
    <th style={{ padding: '2px 8px', textAlign: align ?? 'right', color: BT.text.muted, fontWeight: 600, borderBottom: `1px solid ${BT.border.subtle}`, fontSize: 8, fontFamily: MONO }}>
      {children}
    </th>
  );
  const TD = ({ children, color, bold, align }: { children: React.ReactNode; color?: string; bold?: boolean; align?: 'left' | 'right' }) => (
    <td style={{ padding: '2px 8px', textAlign: align ?? 'right', color: color ?? BT.text.primary, fontWeight: bold ? 700 : 400, fontFamily: MONO, fontSize: 9, borderBottom: `1px solid ${BT.border.subtle}20` }}>
      {children}
    </td>
  );

  return (
    <div style={{ margin: '0', borderBottom: `1px solid ${BT.border.subtle}` }}>
      {/* Hero bar */}
      <div style={{
        padding: '6px 14px',
        background: `${BT.text.orange}12`,
        borderBottom: `1px solid ${BT.text.orange}40`,
        borderLeft: `3px solid ${BT.text.orange}`,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.8 }}>
          LENDER VIEW
        </span>
        {[
          { label: 'DSCR Y1',     value: fmtDscr(dscrY1),  color: dscrColor(dscrY1) },
          { label: `DSCR MIN${dscrMinYr ? ` (Yr${dscrMinYr})` : ''}`, value: fmtDscr(dscrMin), color: dscrColor(dscrMin) },
          { label: 'DSCR AVG',    value: fmtDscr(dscrAvg),  color: dscrColor(dscrAvg) },
          { label: 'LTV CLOSE',   value: ltvClose != null ? `${(ltvClose * 100).toFixed(1)}%` : '—',
            color: ltvClose != null && ltvClose > 0.80 ? BT.text.amber : BT.text.primary },
          { label: 'LTV MATURITY', value: ltvMat != null ? `${(ltvMat * 100).toFixed(1)}%` : '—',
            color: ltvMat != null && ltvMat > 0.75 ? BT.text.amber : BT.text.primary },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{label} </span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color }}>{value}</span>
          </div>
        ))}
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginLeft: 'auto' }}>
          Lender view — edit access restricted · thresholds: ≥1.30 OK · ≥1.20 thin · &lt;1.20 breach
        </span>
      </div>

      {/* Three-column grid: DSCR by year | LTV trend | Exit-cap stress */}
      <div style={{ display: 'grid', gridTemplateColumns: [hasDscr, hasLtv || ltvClose != null, exitStressRows.length > 0].filter(Boolean).length > 1 ? '1fr 1fr 1fr' : '1fr', gap: 0 }}>

        {/* DSCR by year */}
        {hasDscr && (
          <div>
            <div style={{ padding: '3px 10px 2px', background: `${BT.text.orange}08`, borderBottom: `1px solid ${BT.border.subtle}`, borderRight: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>DSCR BY YEAR</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: BT.bg.header }}><TH>Yr</TH><TH>DSCR</TH><TH>Status</TH></tr></thead>
              <tbody>
                {yearlyDscr.map(({ yr, dscr }) => {
                  const isMin = yr === dscrMinYr;
                  return (
                    <tr key={yr} style={{ background: isMin ? `${BT.text.amber}08` : undefined }}>
                      <TD color={BT.text.secondary}>{yr}</TD>
                      <TD color={dscrColor(dscr)} bold={isMin}>{fmtDscr(dscr)}</TD>
                      <TD>{dscrStatus(dscr!)}</TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* LTV trend through hold */}
        {(hasLtv || ltvClose != null) && (
          <div>
            <div style={{ padding: '3px 10px 2px', background: `${BT.text.orange}08`, borderBottom: `1px solid ${BT.border.subtle}`, borderRight: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>LTV TREND THROUGH HOLD</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: BT.bg.header }}><TH>Period</TH><TH>LTV</TH><TH>Status</TH></tr></thead>
              <tbody>
                {ltvClose != null && (
                  <tr>
                    <TD color={BT.text.secondary} align="right">Close</TD>
                    <TD color={ltvClose > 0.80 ? BT.text.amber : BT.text.primary} bold>{`${(ltvClose * 100).toFixed(1)}%`}</TD>
                    <TD>{ltvClose > 0.80 ? <span style={{ color: BT.text.amber, fontSize: 8 }}>⚠ HIGH</span> : <span style={{ color: BT.text.green, fontSize: 8 }}>✓ OK</span>}</TD>
                  </tr>
                )}
                {ltvStab != null && (
                  <tr>
                    <TD color={BT.text.secondary} align="right">Stab.</TD>
                    <TD color={ltvStab > 0.75 ? BT.text.amber : BT.text.primary}>{`${(ltvStab * 100).toFixed(1)}%`}</TD>
                    <TD>{ltvStab > 0.75 ? <span style={{ color: BT.text.amber, fontSize: 8 }}>⚠</span> : <span style={{ color: BT.text.green, fontSize: 8 }}>✓</span>}</TD>
                  </tr>
                )}
                {ltvTrend.map(({ yr, ltv }) => (
                  <tr key={yr}>
                    <TD color={BT.text.secondary} align="right">Yr {yr}</TD>
                    <TD color={ltv! > 0.75 ? BT.text.amber : BT.text.primary}>{`${(ltv! * 100).toFixed(1)}%`}</TD>
                    <TD>{ltv! > 0.80 ? <span style={{ color: BT.text.red, fontSize: 8 }}>✗ HIGH</span>
                        : ltv! > 0.75 ? <span style={{ color: BT.text.amber, fontSize: 8 }}>⚠</span>
                        : <span style={{ color: BT.text.green, fontSize: 8 }}>✓</span>}</TD>
                  </tr>
                ))}
                {ltvMat != null && (
                  <tr style={{ background: `${BT.text.orange}06` }}>
                    <TD color={BT.text.secondary} align="right">Maturity</TD>
                    <TD color={ltvMat > 0.75 ? BT.text.amber : BT.text.primary} bold>{`${(ltvMat * 100).toFixed(1)}%`}</TD>
                    <TD>{ltvMat > 0.75 ? <span style={{ color: BT.text.amber, fontSize: 8 }}>⚠ HIGH</span> : <span style={{ color: BT.text.green, fontSize: 8 }}>✓ OK</span>}</TD>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Exit-cap stress scenarios */}
        {exitStressRows.length > 0 && (
          <div>
            <div style={{ padding: '3px 10px 2px', background: `${BT.text.orange}08`, borderBottom: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>EXIT-CAP STRESS SCENARIOS</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: BT.bg.header }}><TH>Shift</TH><TH>Cap</TH><TH>Sale Val</TH><TH>Stress LTV</TH></tr></thead>
              <tbody>
                {exitStressRows.map(({ bps, capRate, saleVal, stressedLtv }) => (
                  <tr key={bps} style={{ background: bps === 0 ? `${BT.text.cyan}06` : undefined }}>
                    <TD color={bps === 0 ? BT.text.cyan : BT.text.secondary}>{bps === 0 ? 'Base' : `+${bps}bps`}</TD>
                    <TD>{`${(capRate * 100).toFixed(2)}%`}</TD>
                    <TD color={BT.text.primary}>{`$${(saleVal / 1e6).toFixed(2)}M`}</TD>
                    <TD color={stressedLtv != null && stressedLtv > 0.80 ? BT.text.red : stressedLtv != null && stressedLtv > 0.75 ? BT.text.amber : BT.text.green} bold>
                      {stressedLtv != null ? `${(stressedLtv * 100).toFixed(1)}%` : '—'}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
            {baseExitCap != null && (
              <div style={{ padding: '3px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                Base exit cap: {(baseExitCap * 100).toFixed(2)}% · Exit NOI: {exitNoi != null ? fmt$(exitNoi) : '—'}
              </div>
            )}
          </div>
        )}

        {/* Coverage thresholds summary (always shown) */}
        {exitStressRows.length === 0 && (
          <div>
            <div style={{ padding: '3px 10px 2px', background: `${BT.text.orange}08`, borderBottom: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5 }}>COVERAGE THRESHOLDS</span>
            </div>
            <div style={{ padding: '4px 10px' }}>
              {([
                { label: 'DSCR Y1 (thr: 1.25)',          value: dscrY1,  threshold: 1.25, reverse: false, isPct: false },
                { label: 'DSCR Min (thr: 1.20)',          value: dscrMin, threshold: 1.20, reverse: false, isPct: false },
                { label: 'DSCR Avg (thr: 1.30)',          value: dscrAvg, threshold: 1.30, reverse: false, isPct: false },
                { label: 'LTV at Close (max 80%)',        value: ltvClose, threshold: 0.80, reverse: true,  isPct: true },
                { label: 'LTV at Maturity (max 75%)',     value: ltvMat,  threshold: 0.75, reverse: true,  isPct: true },
              ] as const).map(({ label, value, threshold, reverse, isPct }) => {
                const pass = value != null ? (reverse ? value <= threshold : value >= threshold) : null;
                const display = value == null ? '—' : isPct ? `${(value * 100).toFixed(1)}%` : fmtDscr(value);
                return (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', borderBottom: `1px solid ${BT.border.subtle}20` }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>{label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: pass == null ? BT.text.muted : pass ? BT.text.green : BT.text.red }}>
                      {display} {pass != null && (pass ? '✓' : '✗')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Main ReturnsTab ─────────────────────────────────────────────────────────
export function ReturnsTab({ f9Financials, onTabChange, dealId, onF9Refresh, platformRole }: FinancialEngineTabProps) {
  const ret    = f9Financials?.returns;
  const cap    = f9Financials?.capitalStack;
  const wf     = f9Financials?.waterfall;
  const capData = f9Financials?.capital;
  const proj   = f9Financials?.projections;

  // Capital structure Apply state
  const [applyState, setApplyState] = useState<'idle' | 'applying' | 'success' | 'error'>('idle');
  const [applyError, setApplyError] = useState<string | null>(null);

  // Apply the agent's recommended capital structure to the deal via the F9
  // override pipeline (PATCH /financials/override). Writes year1 LV override
  // entries for ltvPct, debtRate, gpEquityPct, lpEquityPct, plus scalar column
  // writes for ltcPct and interestRate so composeCapitalStack picks them up.
  const applyCapitalStructure = async (optimalLtv: number, optimalRate: number) => {
    if (!dealId) return;
    setApplyState('applying');
    setApplyError(null);

    const patchField = async (field: string, value: number) => {
      const res = await fetch(`/api/v1/deals/${dealId}/financials/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value, year: null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`${field}: ${(body as { error?: string }).error ?? `HTTP ${res.status}`}`);
      }
    };

    try {
      // Write year1 LayeredValue override-layer entries (F9 data-quality trail)
      await patchField('ltvPct', optimalLtv);
      await patchField('debtRate', optimalRate);
      await patchField('gpEquityPct', 0.10);
      await patchField('lpEquityPct', 0.90);
      // Also write direct scalar columns so composeCapitalStack reads them immediately
      await patchField('ltcPct', optimalLtv);
      await patchField('interestRate', optimalRate);

      setApplyState('success');
      onF9Refresh?.();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Unknown error');
      setApplyState('error');
    }
  };

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

      {/* ── LP Focus Panel ──────────────────────────────────────────────── */}
      {platformRole === 'lp' && (
        <LpFocusPanel
          lpIrr={ret?.lpIrr ?? capData?.metrics?.lpIrr ?? null}
          lpEm={ret?.lpEm ?? null}
          prefRate={prefRate}
          capData={capData}
          ret={ret}
          proj={Array.isArray(proj) ? proj : []}
        />
      )}

      {/* ── Lender DSCR Panel ───────────────────────────────────────────── */}
      {platformRole === 'lender' && (
        <LenderDscrPanel ret={ret} proj={Array.isArray(proj) ? proj : []} />
      )}

      {/* ── Leasing Cost Treatment Banner ──────────────────────────────────── */}
      {(() => {
        const lv = f9Financials?.leaseVelocity ?? null;
        if (!lv) {
          // LV engine not yet connected — IRR comes from legacy model summary,
          // NOT from treatment-aware monthly cash flows.
          return (
            <div style={{
              padding: '5px 16px', background: `${BT.text.muted}08`,
              borderBottom: `1px solid ${BT.border.subtle}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.4 }}>
                COST TREATMENT
              </span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>
                ◌ LV engine pending
              </span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>·</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
                IRR / EM shown above derive from the legacy projection engine (NOI-based, treatment-agnostic).
                Once the Lease Velocity backend engine ships, toggling treatment will shift IRR within one re-fetch cycle.
              </span>
            </div>
          );
        }
        // LV engine is connected — the LP Net IRR and Equity Multiple in the hero
        // strip above ALREADY reflect cost-treatment-aware monthly cash flows from
        // GET /financials (backend reads treatment from operator_stance — Task #646).  The mergeModelIntoFinancials
        // guard preserves these values; they are NOT overwritten by the legacy model.
        const treatColors: Record<string, string> = {
          OPERATING:   BT.met.financial,
          CAPITALIZED: BT.text.cyan,
          HYBRID:      BT.text.amber,
        };
        const treatDesc: Record<string, string> = {
          OPERATING:   'All concessions & marketing stay in operating cash flows — IRR reflects full periodic leasing drag',
          CAPITALIZED: 'Lease-up concessions & marketing removed from ops, capitalized into initial equity — IRR lifts vs OPERATING',
          HYBRID:      'Concessions amortized as effective-rent reduction; marketing stays in ops — blended treatment, IRR between OPER and CAP',
        };
        const t = lv.costTreatmentInEffect;
        const color = treatColors[t] ?? BT.text.muted;
        return (
          <div style={{
            padding: '5px 16px', background: `${color}0A`,
            borderBottom: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.4 }}>COST TREATMENT</span>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color }}>
              {t}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.met.financial }}>
              ✓ IRR & EM above are treatment-adjusted
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
                  · monthly CF sourced from LV engine table
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
              <span style={{ color: BT.text.cyan, cursor: 'pointer' }} onClick={() => onTabChange?.(4)}>
                Configure in Capital →
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
          <KvRow label="LP Equity Share"     value={wf?.lpShare != null ? `${(wf.lpShare * 100).toFixed(0)}%` : '—'} />
          <KvRow label="GP Equity Share"     value={wf?.gpShare != null ? `${(wf.gpShare * 100).toFixed(0)}%` : '—'} />
          <div style={{ padding: '2px 10px 4px', borderBottom: `1px solid ${BT.border.subtle}`, textAlign: 'right' }}>
            <span
              style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, cursor: 'pointer', letterSpacing: 0.3 }}
              onClick={() => onTabChange?.(4)}
            >
              Edit in WATERFALL →
            </span>
          </div>
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
          onClick={() => onTabChange?.(4)}
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

      {/* § 10 — Capital Structure */}
      {(() => {
        const csd  = f9Financials?.capitalStructureDefaults;
        const cso  = f9Financials?.capitalStructureOptimization;
        const confidenceColor = (c: string) =>
          c === 'high' ? BT.text.green : c === 'medium' ? BT.text.amber : BT.text.red;
        const metricLabel = (m: string) =>
          m === 'irr' ? 'IRR' : m === 'cash_on_cash' ? 'Cash-on-Cash' : m === 'stabilized_value' ? 'Stabilized Value' : 'Profit at Exit';
        return (
          <div style={{ margin: '8px 12px 0', border: `1px solid ${BT.text.cyan}30`, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '5px 12px', background: `${BT.text.cyan}12`, borderBottom: `1px solid ${BT.text.cyan}30` }}>
              <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.8 }}>
                § 10  CAPITAL STRUCTURE
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: cso ? '1fr 1fr 1fr' : '1fr 1fr', gap: 0 }}>

              {/* ── Platform Defaults ── */}
              <div style={{ borderRight: `1px solid ${BT.border.subtle}` }}>
                <div style={{ padding: '3px 10px 2px', background: `${BT.text.muted}08`, borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5 }}>PLATFORM DEFAULTS</span>
                </div>
                {csd ? (
                  <>
                    <KvRow label="Debt Rate"            value={`${(csd.debt_rate * 100).toFixed(2)}%`} sub="DGS10 + 200bps" bold />
                    <KvRow label="Default LTV"          value={`${(csd.ltv_pct * 100).toFixed(0)}%`} />
                    <KvRow label="Amortization"         value={`${csd.amortization_years}yr`} />
                    <KvRow label="IO Period"            value={csd.io_period_months > 0 ? `${csd.io_period_months}mo` : 'None'} />
                    <KvRow label="Loan Term"            value={`${csd.loan_term_years}yr`} />
                    <KvRow label="Pref Return"          value={`${(csd.preferred_return_pct * 100).toFixed(0)}%`} />
                    <KvRow label="GP Promote"           value={`${(csd.gp_promote_pct * 100).toFixed(0)}%`} sub={`above ${(csd.gp_promote_threshold_pct * 100).toFixed(0)}%`} />
                    <KvRow label="GP / LP Split"        value={`${(csd.gp_equity_pct * 100).toFixed(0)} / ${(csd.lp_equity_pct * 100).toFixed(0)}`} />
                    <div style={{ padding: '2px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                        Seeded {new Date(csd.seeded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
                    Defaults not yet seeded for this deal.
                  </div>
                )}
              </div>

              {/* ── Agent Recommendation ── (only when optimization exists) */}
              {cso && (
                <div style={{ borderRight: `1px solid ${BT.border.subtle}` }}>
                  <div style={{ padding: '3px 10px 2px', background: `${BT.text.cyan}08`, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>AGENT RECOMMENDATION</span>
                  </div>
                  {cso.infeasible ? (
                    <div style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.red }}>
                      ⚠ Infeasible: {cso.infeasibility_reason ?? 'Constraints cannot be satisfied'}
                    </div>
                  ) : (
                    <>
                      <KvRow label="Optimal LTV"
                        value={cso.optimal_ltv != null ? `${((cso.optimal_ltv as number) * 100).toFixed(1)}%` : '—'}
                        bold color={BT.text.cyan}
                      />
                      <KvRow label="Optimal Debt"
                        value={cso.optimal_debt_amount != null ? `$${Math.round(cso.optimal_debt_amount as number).toLocaleString()}` : '—'}
                      />
                      <KvRow label="Rate"
                        value={cso.optimal_rate != null ? `${((cso.optimal_rate as number) * 100).toFixed(2)}%` : '—'}
                      />
                      <KvRow label={metricLabel(cso.primary_metric as string)}
                        value={(() => {
                          const v = cso.primary_metric_value as number | null;
                          if (v == null) return '—';
                          if (cso.primary_metric === 'irr' || cso.primary_metric === 'cash_on_cash') return `${(v * 100).toFixed(2)}%`;
                          return `$${Math.round(v).toLocaleString()}`;
                        })()}
                        bold color={BT.text.green}
                      />
                      <KvRow label="Min DSCR"
                        value={cso.resulting_dscr_min != null ? `${(cso.resulting_dscr_min as number).toFixed(2)}×` : '—'}
                        color={cso.resulting_dscr_min != null && (cso.resulting_dscr_min as number) < 1.20 ? BT.text.red : undefined}
                      />
                      <KvRow label="Breakeven Occ"
                        value={cso.resulting_breakeven_occ != null ? `${((cso.resulting_breakeven_occ as number) * 100).toFixed(1)}%` : '—'}
                      />
                      <KvRow label="Equity Required"
                        value={cso.equity_at_optimal != null ? `$${Math.round(cso.equity_at_optimal as number).toLocaleString()}` : '—'}
                      />
                      <KvRow label="  GP Equity"
                        value={cso.gp_equity != null ? `$${Math.round(cso.gp_equity as number).toLocaleString()}` : '—'}
                        indent
                      />
                      <KvRow label="  LP Equity"
                        value={cso.lp_equity != null ? `$${Math.round(cso.lp_equity as number).toLocaleString()}` : '—'}
                        indent
                      />
                      <div style={{ padding: '3px 10px', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {typeof cso.confidence === 'string' && (
                          <span style={{ fontFamily: MONO, fontSize: 7, color: confidenceColor(cso.confidence) }}>
                            {cso.confidence.toUpperCase()} CONFIDENCE
                          </span>
                        )}
                        {Array.isArray(cso.constraints_binding) && cso.constraints_binding.length > 0 && (
                          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>
                            ⚠ {(cso.constraints_binding as string[]).join(', ')}
                          </span>
                        )}
                      </div>
                      {typeof cso.evidence_narrative === 'string' && cso.evidence_narrative.length > 0 && (
                        <div style={{ padding: '6px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, lineHeight: 1.5 }}>
                            {cso.evidence_narrative}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Your Structure ── */}
              <div>
                <div style={{ padding: '3px 10px 2px', background: `${BT.text.amber}08`, borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.amber, letterSpacing: 0.5 }}>YOUR STRUCTURE</span>
                </div>
                {f9Financials?.capitalStack ? (
                  <>
                    <KvRow label="Purchase Price"
                      value={f9Financials.capitalStack.purchasePrice != null ? `$${Math.round(f9Financials.capitalStack.purchasePrice).toLocaleString()}` : '—'}
                      bold
                    />
                    <KvRow label="Loan Amount"
                      value={f9Financials.capitalStack.loanAmount != null ? `$${Math.round(f9Financials.capitalStack.loanAmount).toLocaleString()}` : '—'}
                      bold
                    />
                    <KvRow label="LTC"
                      value={f9Financials.capitalStack.ltcPct != null ? `${((f9Financials.capitalStack.ltcPct) * 100).toFixed(1)}%` : '—'}
                    />
                    <KvRow label="Equity at Close"
                      value={f9Financials.capitalStack.equityAtClose != null ? `$${Math.round(f9Financials.capitalStack.equityAtClose).toLocaleString()}` : '—'}
                    />
                    <KvRow label="Interest Rate"
                      value={f9Financials.capitalStack.interestRate != null ? `${((f9Financials.capitalStack.interestRate) * 100).toFixed(2)}%` : '—'}
                    />
                    <div style={{ padding: '2px 10px 4px', borderBottom: `1px solid ${BT.border.subtle}`, textAlign: 'right' }}>
                      <span
                        style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, cursor: 'pointer', letterSpacing: 0.3 }}
                        onClick={() => onTabChange?.(5)}
                      >
                        Edit in DEBT ADVISOR →
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
                    No capital stack configured.{' '}
                    <span style={{ color: BT.text.cyan, cursor: 'pointer' }} onClick={() => onTabChange?.(5)}>
                      Configure in Debt Advisor →
                    </span>
                  </div>
                )}
                {cso && !cso.infeasible && cso.optimal_ltv != null && (
                  <div style={{ padding: '6px 10px', background: `${BT.text.cyan}08`, borderTop: `1px solid ${BT.border.subtle}` }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 4 }}>
                      Agent recommends {((cso.optimal_ltv as number) * 100).toFixed(1)}% LTV at {((cso.optimal_rate as number) * 100).toFixed(2)}% to maximize {metricLabel(cso.primary_metric as string)}.
                    </div>
                    {applyState === 'success' ? (
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green, padding: '4px 0' }}>
                        ✓ Applied — capital stack updated. View results in Debt Advisor.
                      </div>
                    ) : (
                      <>
                        <button
                          disabled={applyState === 'applying'}
                          onClick={() => applyCapitalStructure(
                            cso.optimal_ltv as number,
                            cso.optimal_rate as number,
                          )}
                          style={{
                            width: '100%', padding: '5px 8px',
                            background: applyState === 'applying' ? `${BT.text.muted}18` : `${BT.text.cyan}18`,
                            border: `1px solid ${applyState === 'applying' ? BT.text.muted : BT.text.cyan}`,
                            color: applyState === 'applying' ? BT.text.muted : BT.text.cyan,
                            fontFamily: MONO, fontSize: 9, fontWeight: 600,
                            cursor: applyState === 'applying' ? 'not-allowed' : 'pointer',
                            borderRadius: 3,
                          }}
                        >
                          {applyState === 'applying' ? 'Applying…' : `Apply ${((cso.optimal_ltv as number) * 100).toFixed(1)}% LTV to Deal →`}
                        </button>
                        {applyState === 'error' && applyError && (
                          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.red, marginTop: 3 }}>
                            ⚠ {applyError}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* §11 ALTERNATIVE STRUCTURES — M36 Pareto Frontier */}
            {Array.isArray(cso?.pareto_frontier) && (cso.pareto_frontier as NonNullable<typeof cso.pareto_frontier>).length > 0 && (
              <div style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                <div style={{ padding: '3px 10px 2px', background: `${BT.text.cyan}06`, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>
                    ALTERNATIVE STRUCTURES  ·  M36 PARETO FRONTIER
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                    sorted by {platformRole === 'lender' ? 'DSCR robustness' : platformRole === 'lp' ? 'LP IRR + distribution yield' : 'GP IRR'}
                    {' '}· {(cso.pareto_frontier as NonNullable<typeof cso.pareto_frontier>).length} alternative{(cso.pareto_frontier as NonNullable<typeof cso.pareto_frontier>).length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, padding: '8px 10px', flexWrap: 'wrap' }}>
                  {(() => {
                    // Re-sort Pareto frontier at render time based on the CURRENT VIEWER's
                    // platform role — not the stored role_rank (which was computed at agent
                    // run time for the deal owner and may be wrong for LP/lender collaborators).
                    const rawFrontier = cso.pareto_frontier as NonNullable<typeof cso.pareto_frontier>;
                    const sorted = [...rawFrontier].sort((a, b) => {
                      if (platformRole === 'lp') {
                        const ia = a.lp_irr ?? -Infinity;
                        const ib = b.lp_irr ?? -Infinity;
                        if (Math.abs(ia - ib) > 0.0005) return ib - ia;
                        return (b.lp_distribution_yield ?? 0) - (a.lp_distribution_yield ?? 0);
                      } else if (platformRole === 'lender') {
                        return (b.dscr_min ?? 0) - (a.dscr_min ?? 0);
                      } else {
                        // Sponsor: always sort by GP levered equity IRR regardless of strategy
                        // metric (which may be stabilized_value or profit_at_exit — dollar amounts,
                        // not return rates). Null gp_irr (old persisted runs) → sort to bottom.
                        const ia = a.gp_irr ?? -Infinity;
                        const ib = b.gp_irr ?? -Infinity;
                        return ib - ia;
                      }
                    });
                    return sorted.map((altRaw, sortIdx) => {
                    const alt = { ...altRaw, role_rank: sortIdx + 1 };
                    const bandColor = alt.plausibility_color === 'green' ? BT.text.green
                                    : alt.plausibility_color === 'amber' ? BT.text.amber
                                    : alt.plausibility_color === 'red'   ? BT.text.red
                                    : alt.plausibility_band === 'Realistic' ? BT.text.green
                                    : alt.plausibility_band === 'Stretch' || alt.plausibility_band === 'Aggressive' ? BT.text.amber
                                    : BT.text.red;
                    const metricFmt = alt.primary_metric_value == null ? '—'
                      : (alt.primary_metric === 'irr' || alt.primary_metric === 'cash_on_cash')
                        ? `${(alt.primary_metric_value * 100).toFixed(1)}%`
                        : `$${Math.round(alt.primary_metric_value).toLocaleString()}`;
                    const metricLabel = alt.primary_metric === 'irr' ? 'IRR'
                      : alt.primary_metric === 'cash_on_cash' ? 'CoC'
                      : alt.primary_metric === 'stabilized_value' ? 'Stab. Value'
                      : 'Profit';
                    return (
                      <div key={alt.bundle_id}
                        title={`Click to preview ${alt.bundle_name} structure in the financial engine`}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('capitalStructure:previewBundle', {
                            detail: { bundleId: alt.bundle_id, bundleData: alt },
                          }));
                        }}
                        style={{
                        flex: '1 1 220px', minWidth: 200, maxWidth: 340,
                        border: `1px solid ${BT.text.cyan}30`,
                        borderTop: `3px solid ${bandColor}`,
                        borderRadius: 4,
                        background: alt.feasible ? `${BT.text.cyan}05` : `${BT.text.red}05`,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = alt.feasible ? `${BT.text.cyan}12` : `${BT.text.red}12`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = alt.feasible ? `${BT.text.cyan}05` : `${BT.text.red}05`; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan }}>
                            #{alt.role_rank} {alt.bundle_name}
                          </span>
                          <span style={{
                            fontFamily: MONO, fontSize: 7, fontWeight: 700,
                            color: bandColor,
                            padding: '1px 5px',
                            border: `1px solid ${bandColor}60`,
                            borderRadius: 10,
                            background: `${bandColor}14`,
                          }}>
                            {alt.plausibility_band ?? '—'}
                          </span>
                        </div>
                        {(() => {
                            const lpIrrFmt = alt.lp_irr != null
                              ? `${(alt.lp_irr * 100).toFixed(1)}%`
                              : '—';
                            const lpYieldFmt = alt.lp_distribution_yield != null
                              ? `${(alt.lp_distribution_yield * 100).toFixed(1)}%`
                              : '—';
                            const rows: { l: string; v: string; bold?: boolean }[] = platformRole === 'lp'
                              ? [
                                  { l: 'LTV',               v: alt.optimal_ltv != null ? `${(alt.optimal_ltv * 100).toFixed(1)}%` : '—' },
                                  { l: 'Rate',              v: alt.optimal_rate != null ? `${(alt.optimal_rate * 100).toFixed(2)}%` : '—' },
                                  { l: 'LP IRR',            v: lpIrrFmt, bold: true },
                                  { l: 'LP Yield',          v: lpYieldFmt },
                                  { l: 'Min DSCR',          v: alt.dscr_min != null ? `${alt.dscr_min.toFixed(2)}×` : '—' },
                                  { l: 'GP ' + metricLabel, v: metricFmt },
                                ]
                              : [
                                  { l: 'LTV',        v: alt.optimal_ltv != null ? `${(alt.optimal_ltv * 100).toFixed(1)}%` : '—' },
                                  { l: 'Rate',       v: alt.optimal_rate != null ? `${(alt.optimal_rate * 100).toFixed(2)}%` : '—' },
                                  { l: metricLabel,  v: metricFmt, bold: true },
                                  { l: 'Min DSCR',   v: alt.dscr_min != null ? `${alt.dscr_min.toFixed(2)}×` : '—' },
                                ];
                            return (
                              <div key="metric-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', marginBottom: 5 }}>
                                {rows.map(({ l, v, bold }) => (
                                  <div key={l}>
                                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, display: 'block' }}>{l}</span>
                                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: bold ? 700 : 500, color: BT.text.primary }}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        {!alt.feasible && (
                          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.red, marginBottom: 3 }}>
                            ⚠ Infeasible with current deal economics
                          </div>
                        )}
                        <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, lineHeight: 1.45, marginBottom: 6 }}>
                          {(alt.trade_off_summary ?? '').slice(0, 160)}{(alt.trade_off_summary ?? '').length > 160 ? '…' : ''}
                        </div>
                        {alt.feasible && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent('capitalStructure:applyBundle', {
                                detail: { bundleId: alt.bundle_id, bundleData: alt },
                              }));
                            }}
                            style={{
                              width: '100%',
                              fontFamily: MONO, fontSize: 8, fontWeight: 700,
                              color: BT.text.cyan,
                              background: `${BT.text.cyan}12`,
                              border: `1px solid ${BT.text.cyan}40`,
                              borderRadius: 3,
                              padding: '3px 0',
                              cursor: 'pointer',
                              letterSpacing: 0.5,
                            }}
                          >
                            APPLY STRUCTURE
                          </button>
                        )}
                      </div>
                    );
                  });
                  })()}
                </div>
              </div>
            )}

          </div>
        );
      })()}

      {/* Source footnote */}
      <div style={{ padding: '8px 12px 0', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
        All metrics sourced from backend projection engine (GET /financials?hold=N).
        LP IRR: Newton-Raphson on annual equity cashflows incl. net sale proceeds.
        Unleveraged IRR: NOI cashflows + gross sale / purchase price.
        {' '}
        <span style={{ color: BT.text.cyan, cursor: 'pointer' }} onClick={() => onTabChange?.(3)}>
          View Projections →
        </span>
      </div>
    </div>
  );
}

export default ReturnsTab;
