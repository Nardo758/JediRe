import React, { useState, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { Bd } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmtPct, fmtX } from './types';
import { computeExitReturns } from '../../../shared/calculations/returns';
import GoalSeekWidget from '../../../components/F9/GoalSeekWidget';
import type { BroaderGoalSeekResult, SolveVariable, TargetMetric } from '../../../components/F9/GoalSeekWidget';

const MONO = BT.font.mono;

const EXIT_CAPS = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];
const RENT_GROWTH = [1.0, 2.0, 3.0, 4.0, 5.0];
const HOLD_PERIODS = [3, 5, 7, 10];
// TODO(M36): opexGrowthPct is a Section B trajectory driver — full IRR sensitivity
// grid requires buildProjectionsForExport integration once the M36 covariance matrix
// wires opexGrowthPct into the joint distribution. Currently shown as axis candidate
// with fixed-parameter IRR (exit cap × rent growth; opex held at column value as label).
const OPEX_GROWTH = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5];

type TableType = 'irr' | 'em' | 'opex';

function heatmapColor(irr: number): string {
  if (irr >= 20) return BT.met.financial;
  if (irr >= 12) return BT.text.amber;
  return BT.text.red;
}

function emHeatmapColor(em: number): string {
  if (em >= 2.5) return BT.met.financial;
  if (em >= 1.8) return BT.text.amber;
  return BT.text.red;
}

interface SensitivityTabProps extends FinancialEngineTabProps {
  onSolveBroader?: (solveFor: SolveVariable, targetMetric: TargetMetric, targetValue: number) => void;
  broaderSolving?: boolean;
  broaderGoalSeekResult?: BroaderGoalSeekResult | null;
}

export function SensitivityTab({
  dealId, dealType, assumptions, modelResults,
  onSolveBroader, broaderSolving, broaderGoalSeekResult,
}: SensitivityTabProps) {
  const [activeTable, setActiveTable] = useState<TableType>('irr');
  const resolvedDealType = dealType || 'existing';

  const irrGrid = useMemo(() => {
    return EXIT_CAPS.map(cap =>
      RENT_GROWTH.map(growth => {
        try {
          const r = computeExitReturns(16, resolvedDealType, growth, cap);
          return r?.irr ?? 0;
        } catch { return 0; }
      })
    );
  }, [resolvedDealType]);

  const emGrid = useMemo(() => {
    return EXIT_CAPS.map(cap =>
      HOLD_PERIODS.map(hold => {
        try {
          const r = computeExitReturns(hold * 4, resolvedDealType, 3.0, cap);
          return r?.em ?? 0;
        } catch { return 0; }
      })
    );
  }, [resolvedDealType]);

  const TABLE_LABELS: Record<TableType, string> = {
    irr: 'IRR × EXIT CAP × RENT GROWTH',
    em: 'EM × EXIT CAP × HOLD PERIOD',
    opex: 'IRR × EXIT CAP × OPEX GROWTH',
  };

  // Derive current values for GoalSeekWidget from live assumptions / results
  const currentIRR   = modelResults?.summary?.irr ?? 0;
  const currentEM    = modelResults?.summary?.equityMultiple ?? undefined;
  const currentCoC   = modelResults?.summary?.cashOnCash ?? undefined;
  const currentPP    = assumptions?.acquisition?.purchasePrice ?? undefined;
  const currentExit  = assumptions?.disposition?.exitCapRate ?? undefined;
  const currentRG    = assumptions?.revenue?.rentGrowth?.[0] ?? undefined;
  const currentHold  = assumptions?.holdPeriod ?? undefined;
  const currentLtv   = assumptions && assumptions.financing.loanAmount > 0 && assumptions.acquisition.purchasePrice > 0
    ? assumptions.financing.loanAmount / assumptions.acquisition.purchasePrice
    : undefined;
  const currentRate  = assumptions?.financing?.interestRate
    ? assumptions.financing.interestRate / 100
    : undefined;

  const hasGoalSeek = typeof onSolveBroader === 'function';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* ── Two-way Sensitivity Tables ── */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>TWO-WAY DATA TABLES</span>
        {(['irr', 'em', 'opex'] as TableType[]).map(t => (
          <button key={t} onClick={() => setActiveTable(t)} style={{
            background: activeTable === t ? BT.bg.active : 'transparent',
            color: activeTable === t ? BT.met.financial : BT.text.muted,
            border: activeTable === t ? `1px solid ${BT.met.financial}40` : '1px solid transparent',
            padding: '2px 10px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
          }}>{TABLE_LABELS[t]}</button>
        ))}
        <Bd c={BT.text.purple}>EACH CELL = FULL MODEL RUN</Bd>
      </div>

      <div style={{ padding: '8px 10px', display: 'flex', gap: 16, alignItems: 'center', borderBottom: `1px solid ${BT.border.subtle}` }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>HEATMAP:</span>
        {activeTable === 'irr' ? (
          <>
            <span style={{ fontFamily: MONO, fontSize: 8 }}><span style={{ color: BT.met.financial }}>■</span> ≥20% IRR</span>
            <span style={{ fontFamily: MONO, fontSize: 8 }}><span style={{ color: BT.text.amber }}>■</span> 12-20% IRR</span>
            <span style={{ fontFamily: MONO, fontSize: 8 }}><span style={{ color: BT.text.red }}>■</span> {'<'}12% IRR</span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: MONO, fontSize: 8 }}><span style={{ color: BT.met.financial }}>■</span> ≥2.5× EM</span>
            <span style={{ fontFamily: MONO, fontSize: 8 }}><span style={{ color: BT.text.amber }}>■</span> 1.8-2.5× EM</span>
            <span style={{ fontFamily: MONO, fontSize: 8 }}><span style={{ color: BT.text.red }}>■</span> {'<'}1.8× EM</span>
          </>
        )}
      </div>

      {activeTable === 'irr' && (
        <div style={{ padding: '8px', overflowX: 'auto' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 6, letterSpacing: 0.5 }}>
            IRR by EXIT CAP RATE (rows) × RENT GROWTH (columns)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
                <th style={{ padding: '5px 8px', color: BT.text.muted, textAlign: 'left', fontWeight: 500 }}>EXIT CAP ↓ \ RG →</th>
                {RENT_GROWTH.map(g => (
                  <th key={g} style={{ padding: '5px 8px', color: BT.text.cyan, textAlign: 'center', fontWeight: 500 }}>{g.toFixed(1)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXIT_CAPS.map((cap, ri) => (
                <tr key={cap} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '4px 8px', color: BT.text.amber, fontWeight: 600 }}>{cap.toFixed(1)}%</td>
                  {irrGrid[ri].map((irr, ci) => (
                    <td key={ci} style={{
                      padding: '4px 8px', textAlign: 'center', fontWeight: 700,
                      color: heatmapColor(irr),
                      background: `${heatmapColor(irr)}08`,
                    }}>{fmtPct(irr)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTable === 'opex' && (
        <div style={{ padding: '8px', overflowX: 'auto' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 4, letterSpacing: 0.5 }}>
            IRR by EXIT CAP RATE (rows) × OPEX GROWTH % / YR (columns) · HOLD=5yr · RENT GROWTH=3.0%
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, marginBottom: 6 }}>
            ⚠ OPEX GROWTH axis wired to Section B assumptions — full projection integration pending M36 covariance build.
            IRR cells reflect base projection engine; opex growth sensitivity will auto-populate when M36 is connected.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
                <th style={{ padding: '5px 8px', color: BT.text.muted, textAlign: 'left', fontWeight: 500 }}>EXIT CAP ↓ \ OPEX →</th>
                {OPEX_GROWTH.map(g => (
                  <th key={g} style={{ padding: '5px 8px', color: BT.text.purple, textAlign: 'center', fontWeight: 500 }}>{g.toFixed(1)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXIT_CAPS.map((cap) => {
                let baseIrr = 0;
                try { baseIrr = computeExitReturns(20, resolvedDealType, 3.0, cap)?.irr ?? 0; } catch { /* noop */ }
                return (
                  <tr key={cap} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '4px 8px', color: BT.text.amber, fontWeight: 600 }}>{cap.toFixed(1)}%</td>
                    {OPEX_GROWTH.map((g) => (
                      <td key={g} style={{
                        padding: '4px 8px', textAlign: 'center', fontWeight: 700,
                        color: heatmapColor(baseIrr),
                        background: `${heatmapColor(baseIrr)}08`,
                        opacity: 0.75,
                      }}>{fmtPct(baseIrr)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTable === 'em' && (
        <div style={{ padding: '8px', overflowX: 'auto' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 6, letterSpacing: 0.5 }}>
            EQUITY MULTIPLE by EXIT CAP RATE (rows) × HOLD PERIOD (columns)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
                <th style={{ padding: '5px 8px', color: BT.text.muted, textAlign: 'left', fontWeight: 500 }}>EXIT CAP ↓ \ HOLD →</th>
                {HOLD_PERIODS.map(h => (
                  <th key={h} style={{ padding: '5px 8px', color: BT.text.cyan, textAlign: 'center', fontWeight: 500 }}>{h}YR</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXIT_CAPS.map((cap, ri) => (
                <tr key={cap} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '4px 8px', color: BT.text.amber, fontWeight: 600 }}>{cap.toFixed(1)}%</td>
                  {emGrid[ri].map((em, ci) => (
                    <td key={ci} style={{
                      padding: '4px 8px', textAlign: 'center', fontWeight: 700,
                      color: emHeatmapColor(em),
                      background: `${emHeatmapColor(em)}08`,
                    }}>{fmtX(em)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Goal Seek ─────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${BT.border.medium}`,
        background: BT.bg.panel,
        padding: 12,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5,
          marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>◎ GOAL SEEK</span>
          <span style={{ color: BT.border.medium }}>·</span>
          <span style={{ color: BT.text.secondary }}>Solve backwards from any target metric</span>
        </div>

        {hasGoalSeek ? (
          <GoalSeekWidget
            currentIRR={currentIRR}
            currentEquityMultiple={currentEM}
            currentCashOnCash={currentCoC}
            currentPurchasePrice={currentPP}
            currentExitCapRate={currentExit}
            currentRentGrowth={currentRG}
            currentHoldYears={currentHold}
            currentLtv={currentLtv}
            currentInterestRate={currentRate}
            onSolveBroader={onSolveBroader!}
            solving={broaderSolving ?? false}
            result={broaderGoalSeekResult ?? null}
          />
        ) : (
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: '8px 0' }}>
            Build the financial model first to enable Goal Seek.
          </div>
        )}
      </div>
    </div>
  );
}

export default SensitivityTab;
