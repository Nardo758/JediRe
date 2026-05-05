import React, { useState, useEffect } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import type { F9ConcessionMonthlyDetail } from './types';

const MONO = BT.font.mono;

const fmt$ = (n: number) => {
  if (n === 0) return '$0';
  const abs = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
};

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

export interface AggregatedConcessionDetail {
  new_lease_count: number;
  new_lease_dollars: number;
  new_lease_earned: number;
  renewal_count: number;
  renewal_dollars: number;
  renewal_earned: number;
  continuing_count: number;
  continuing_dollars: number;
  earliest_commencement?: string;
  latest_commencement?: string;
  methods: string[];
  method_by_type: Record<string, string[]>;
  write_offs: Array<{ amount: number; reason: string; concession_id: string }>;
}

export function aggregateConcessionDetail(
  monthlyDetail: Record<string, F9ConcessionMonthlyDetail> | undefined,
  yyyymms: string[],
): AggregatedConcessionDetail | null {
  if (!monthlyDetail) return null;
  const agg: AggregatedConcessionDetail = {
    new_lease_count: 0, new_lease_dollars: 0, new_lease_earned: 0,
    renewal_count: 0, renewal_dollars: 0, renewal_earned: 0,
    continuing_count: 0, continuing_dollars: 0,
    methods: [], method_by_type: {}, write_offs: [],
  };
  const methodSet = new Set<string>();
  const methodByType: Record<string, Set<string>> = {};
  let hasAny = false;
  for (const key of yyyymms) {
    const d = monthlyDetail[key];
    if (!d) continue;
    hasAny = true;
    agg.new_lease_count    += d.new_lease_count;
    agg.new_lease_dollars  += d.new_lease_dollars;
    agg.new_lease_earned   += d.new_lease_earned ?? 0;
    agg.renewal_count      += d.renewal_count;
    agg.renewal_dollars    += d.renewal_dollars;
    agg.renewal_earned     += d.renewal_earned ?? 0;
    agg.continuing_count   += d.continuing_count;
    agg.continuing_dollars += d.continuing_dollars;
    for (const m of d.methods) methodSet.add(m);
    if (d.method_by_type) {
      for (const [ctype, methods] of Object.entries(d.method_by_type)) {
        if (!methodByType[ctype]) methodByType[ctype] = new Set();
        for (const m of methods) methodByType[ctype].add(m);
      }
    }
    agg.write_offs = [...agg.write_offs, ...d.write_offs];
    if (d.earliest_commencement) {
      if (!agg.earliest_commencement || d.earliest_commencement < agg.earliest_commencement) {
        agg.earliest_commencement = d.earliest_commencement;
      }
    }
    if (d.latest_commencement) {
      if (!agg.latest_commencement || d.latest_commencement > agg.latest_commencement) {
        agg.latest_commencement = d.latest_commencement;
      }
    }
  }
  if (!hasAny) return null;
  agg.methods = Array.from(methodSet);
  for (const [ctype, mSet] of Object.entries(methodByType)) {
    agg.method_by_type[ctype] = Array.from(mSet);
  }
  return agg;
}

interface Props {
  open: boolean;
  onClose: () => void;
  periodLabel: string;
  recognizedAmount: number | null;
  earnedAmount: number | null;
  detail: AggregatedConcessionDetail | null;
  /** Which toggle view to start on when the modal opens. Defaults to 'recognized'. */
  source?: 'earned' | 'recognized';
  calendarYearTotal?: number | null;
  fiscalYearTotal?: number | null;
}

type ViewToggle = 'recognized' | 'earned';

export function ConcessionDrilldownModal({
  open, onClose, periodLabel, recognizedAmount, earnedAmount, detail,
  source = 'recognized',
  calendarYearTotal, fiscalYearTotal,
}: Props) {
  const [view, setView] = useState<ViewToggle>(source);

  useEffect(() => {
    if (open) setView(source);
  }, [open, source]);

  if (!open) return null;

  const cohortEarned = detail != null
    ? (detail.new_lease_earned + detail.renewal_earned)
    : null;
  const effectiveEarned = earnedAmount ?? (cohortEarned && cohortEarned > 0 ? cohortEarned : null);

  const total = view === 'recognized' ? recognizedAmount : effectiveEarned;
  const hasCohortData = detail != null && (
    detail.new_lease_count > 0 || detail.renewal_count > 0 || detail.continuing_count > 0
  );
  const totalWriteOffDollars = detail?.write_offs.reduce((s, w) => s + w.amount, 0) ?? 0;
  const hasMethodByType = detail != null && Object.keys(detail.method_by_type).length > 0;

  const AMBER   = BT.text.amber;
  const MUTED   = BT.text.muted;
  const SEC     = BT.text.secondary;
  const PANEL   = BT.bg.panel;
  const BORDER  = BT.border.subtle;
  const TEAL    = '#2DD4BF';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: '#0a0d0f',
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        width: '100%', maxWidth: 520,
        fontFamily: MONO,
        boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        overflow: 'hidden',
      }}>

        {/* Header — "[PERIOD LABEL] — TOTAL CONCESSIONS BREAKDOWN" */}
        <div style={{
          background: PANEL,
          borderBottom: `1px solid ${BORDER}`,
          padding: '8px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10, color: AMBER, fontWeight: 700, letterSpacing: 0.5 }}>
              {periodLabel}
            </div>
            <div style={{ fontSize: 8, color: MUTED, letterSpacing: 1, marginTop: 1 }}>
              TOTAL CONCESSIONS BREAKDOWN
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: MUTED, fontSize: 13, cursor: 'pointer', padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Toggle */}
        <div style={{
          background: '#0c1014',
          borderBottom: `1px solid ${BORDER}`,
          padding: '6px 12px',
          display: 'flex', alignItems: 'center', gap: 0,
        }}>
          {(['recognized', 'earned'] as ViewToggle[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? `${AMBER}15` : 'transparent',
                border: `1px solid ${view === v ? `${AMBER}50` : BORDER}`,
                color: view === v ? AMBER : MUTED,
                fontFamily: MONO, fontSize: 8, cursor: 'pointer',
                padding: '3px 10px', letterSpacing: 0.5,
                borderRadius: v === 'recognized' ? '2px 0 0 2px' : '0 2px 2px 0',
                marginRight: v === 'recognized' ? -1 : 0,
              }}
            >
              {v === 'recognized' ? 'RECOGNIZED (AMORT)' : 'EARNED (CASH)'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 7, color: MUTED }}>
            {view === 'recognized' ? '§14 straight-line' : '§14 cash event'}
          </span>
        </div>

        {/* Total */}
        <div style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${BORDER}`,
          background: '#0c1014',
        }}>
          <div style={{ fontSize: 7, color: MUTED, letterSpacing: 0.5, marginBottom: 4 }}>
            {view === 'recognized' ? 'TOTAL RECOGNIZED' : 'TOTAL EARNED'} · {periodLabel}
          </div>
          <div style={{ fontSize: 18, color: AMBER, fontWeight: 700 }}>
            {total != null ? fmt$(-Math.abs(total)) : '—'}
          </div>
          {view === 'earned' && total == null && (
            <div style={{ fontSize: 7, color: MUTED, marginTop: 4 }}>
              Earned amount not available for this period
            </div>
          )}
          {view === 'earned' && effectiveEarned != null && earnedAmount == null && cohortEarned && cohortEarned > 0 && (
            <div style={{ fontSize: 7, color: `${MUTED}cc`, marginTop: 2 }}>
              Derived from cohort commencement data
            </div>
          )}
        </div>

        {/* Fiscal / Calendar split — shown only when fiscal ≠ calendar for this period */}
        {calendarYearTotal != null && fiscalYearTotal != null &&
         Math.round(calendarYearTotal) !== Math.round(fiscalYearTotal) && (
          <div style={{
            borderBottom: `1px solid ${BORDER}`,
            padding: '6px 14px',
            background: '#0b0f08',
            display: 'flex', gap: 24,
          }}>
            <div>
              <div style={{ fontSize: 7, color: MUTED, letterSpacing: 0.5, marginBottom: 2 }}>CALENDAR YEAR</div>
              <div style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>{fmt$(-Math.abs(calendarYearTotal))}</div>
            </div>
            <div>
              <div style={{ fontSize: 7, color: MUTED, letterSpacing: 0.5, marginBottom: 2 }}>FISCAL YEAR</div>
              <div style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>{fmt$(-Math.abs(fiscalYearTotal))}</div>
            </div>
            <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
              <div style={{ fontSize: 7, color: MUTED, letterSpacing: 0.5, marginBottom: 2 }}>DIFFERENCE</div>
              <div style={{ fontSize: 9, color: Math.abs(calendarYearTotal - fiscalYearTotal) > 0 ? BT.text.amber : MUTED }}>
                {Math.abs(calendarYearTotal) > Math.abs(fiscalYearTotal) ? '-' : '+'}
                {fmt$(Math.abs(Math.abs(calendarYearTotal) - Math.abs(fiscalYearTotal)))}
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '0 0 12px' }}>

          {/* Recognized view: cohort breakdown */}
          {view === 'recognized' && (
            <>
              {hasCohortData ? (
                <>
                  <div style={{ padding: '8px 14px 4px', fontSize: 7, color: MUTED, letterSpacing: 0.5 }}>
                    COHORT BREAKDOWN
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <th style={{ padding: '3px 14px', textAlign: 'left', color: MUTED, fontWeight: 500, fontSize: 7 }}>COHORT</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right', color: MUTED, fontWeight: 500, fontSize: 7 }}>RECORDS</th>
                        <th style={{ padding: '3px 14px', textAlign: 'right', color: MUTED, fontWeight: 500, fontSize: 7 }}>RECOGNIZED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail!.new_lease_count > 0 && (
                        <tr style={{ borderBottom: `1px solid ${BORDER}20` }}>
                          <td style={{ padding: '4px 14px', color: TEAL }}>
                            NEW LEASES SIGNED
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: SEC }}>
                            {detail!.new_lease_count}
                          </td>
                          <td style={{ padding: '4px 14px', textAlign: 'right', color: TEAL, fontWeight: 600 }}>
                            {fmt$(-Math.abs(detail!.new_lease_dollars))}
                          </td>
                        </tr>
                      )}
                      {detail!.renewal_count > 0 && (
                        <tr style={{ borderBottom: `1px solid ${BORDER}20` }}>
                          <td style={{ padding: '4px 14px', color: '#A78BFA' }}>
                            RENEWALS SIGNED
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: SEC }}>
                            {detail!.renewal_count}
                          </td>
                          <td style={{ padding: '4px 14px', textAlign: 'right', color: '#A78BFA', fontWeight: 600 }}>
                            {fmt$(-Math.abs(detail!.renewal_dollars))}
                          </td>
                        </tr>
                      )}
                      {detail!.continuing_count > 0 && (
                        <tr style={{ borderBottom: `1px solid ${BORDER}20` }}>
                          <td style={{ padding: '4px 14px', color: SEC }}>
                            <div>CONTINUING AMORTIZATION</div>
                            {(detail!.earliest_commencement || detail!.latest_commencement) && (
                              <div style={{ fontSize: 7, color: MUTED, marginTop: 1 }}>
                                {fmtDate(detail!.earliest_commencement)}
                                {detail!.earliest_commencement !== detail!.latest_commencement
                                  ? ` — ${fmtDate(detail!.latest_commencement)}`
                                  : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: SEC }}>
                            {detail!.continuing_count}
                          </td>
                          <td style={{ padding: '4px 14px', textAlign: 'right', color: SEC, fontWeight: 600 }}>
                            {fmt$(-Math.abs(detail!.continuing_dollars))}
                          </td>
                        </tr>
                      )}
                      {totalWriteOffDollars > 0 && (
                        <tr style={{ borderBottom: `1px solid ${BORDER}20`, background: `${BT.text.red}06` }}>
                          <td style={{ padding: '4px 14px', color: BT.text.red }}>
                            WRITE-OFFS
                            <span style={{ marginLeft: 6, fontSize: 7, color: MUTED }}>
                              {detail!.write_offs.length} event{detail!.write_offs.length !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: BT.text.red }}>—</td>
                          <td style={{ padding: '4px 14px', textAlign: 'right', color: BT.text.red, fontWeight: 600 }}>
                            {fmt$(-Math.abs(totalWriteOffDollars))}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Method by concession type */}
                  {hasMethodByType ? (
                    <div style={{ padding: '8px 14px 0' }}>
                      <div style={{ fontSize: 7, color: MUTED, letterSpacing: 0.5, marginBottom: 4 }}>AMORTIZATION METHOD BY TYPE</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {Object.entries(detail!.method_by_type).map(([ctype, methods]) => (
                          <div key={ctype} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 7, color: SEC, minWidth: 100 }}>
                              {ctype.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontSize: 7, color: MUTED }}>→</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {methods.map(m => (
                                <span
                                  key={m}
                                  style={{
                                    fontSize: 7, color: AMBER, fontFamily: MONO,
                                    padding: '1px 5px',
                                    border: `1px solid ${AMBER}30`, borderRadius: 2,
                                  }}
                                >
                                  {m.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : detail!.methods.length > 0 && (
                    <div style={{ padding: '8px 14px 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 7, color: MUTED, letterSpacing: 0.5 }}>METHOD:</span>
                      {detail!.methods.map(m => (
                        <span
                          key={m}
                          style={{
                            fontSize: 7, color: AMBER, fontFamily: MONO,
                            padding: '1px 5px',
                            border: `1px solid ${AMBER}30`, borderRadius: 2,
                          }}
                        >
                          {m.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Write-off reason breakdown */}
                  {detail!.write_offs.length > 0 && (
                    <div style={{ padding: '8px 14px 0' }}>
                      <div style={{ fontSize: 7, color: MUTED, letterSpacing: 0.5, marginBottom: 3 }}>WRITE-OFF REASONS</div>
                      {Array.from(new Map(detail!.write_offs.map(w => [w.reason, w]))).map(([reason]) => {
                        const total = detail!.write_offs
                          .filter(w => w.reason === reason)
                          .reduce((s, w) => s + w.amount, 0);
                        const count = detail!.write_offs.filter(w => w.reason === reason).length;
                        return (
                          <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: SEC, padding: '1px 0' }}>
                            <span style={{ color: BT.text.red }}>{reason.replace(/_/g, ' ')}</span>
                            <span>{count}× · {fmt$(-Math.abs(total))}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '16px 14px', fontSize: 8, color: MUTED, textAlign: 'center' }}>
                  {recognizedAmount != null
                    ? 'No per-lease cohort data available for this period'
                    : 'No recognized concessions in this period'}
                </div>
              )}
            </>
          )}

          {/* Earned view: show cohort breakdown of cash concessions signed this period */}
          {view === 'earned' && (
            <>
              {hasCohortData && (detail!.new_lease_earned > 0 || detail!.renewal_earned > 0) ? (
                <>
                  <div style={{ padding: '8px 14px 4px', fontSize: 7, color: MUTED, letterSpacing: 0.5 }}>
                    CASH CONCESSIONS SIGNED THIS PERIOD
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <th style={{ padding: '3px 14px', textAlign: 'left', color: MUTED, fontWeight: 500, fontSize: 7 }}>COHORT</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right', color: MUTED, fontWeight: 500, fontSize: 7 }}>RECORDS</th>
                        <th style={{ padding: '3px 14px', textAlign: 'right', color: MUTED, fontWeight: 500, fontSize: 7 }}>CASH VALUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail!.new_lease_earned > 0 && (
                        <tr style={{ borderBottom: `1px solid ${BORDER}20` }}>
                          <td style={{ padding: '4px 14px', color: TEAL }}>NEW LEASES SIGNED</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: SEC }}>{detail!.new_lease_count}</td>
                          <td style={{ padding: '4px 14px', textAlign: 'right', color: TEAL, fontWeight: 600 }}>{fmt$(-Math.abs(detail!.new_lease_earned))}</td>
                        </tr>
                      )}
                      {detail!.renewal_earned > 0 && (
                        <tr style={{ borderBottom: `1px solid ${BORDER}20` }}>
                          <td style={{ padding: '4px 14px', color: '#A78BFA' }}>RENEWALS SIGNED</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: SEC }}>{detail!.renewal_count}</td>
                          <td style={{ padding: '4px 14px', textAlign: 'right', color: '#A78BFA', fontWeight: 600 }}>{fmt$(-Math.abs(detail!.renewal_earned))}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{ padding: '6px 14px 0', fontSize: 7, color: MUTED, lineHeight: 1.5 }}>
                    Continuing amortization records are excluded — only concessions signed in
                    this period contribute to the earned (cash) total.
                  </div>
                </>
              ) : (
                <div style={{ padding: '12px 14px', fontSize: 8, color: MUTED, lineHeight: 1.7 }}>
                  <div style={{ marginBottom: 4, color: SEC }}>
                    Earned concessions represent the full cash value of concessions committed at
                    lease signing (free rent, move-in allowances, etc.).
                  </div>
                  <div>
                    Per-lease cohort breakdown is available in the Recognized view, which shows
                    straight-line amortization across the lease term.
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${BORDER}`,
          padding: '5px 14px',
          background: PANEL,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 7, color: MUTED }}>§14 EARNED-VS-RECOGNIZED · STRAIGHT_LINE_GAAP</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: `1px solid ${BORDER}`,
              color: MUTED, fontFamily: MONO, fontSize: 7,
              padding: '2px 10px', cursor: 'pointer', borderRadius: 2,
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
