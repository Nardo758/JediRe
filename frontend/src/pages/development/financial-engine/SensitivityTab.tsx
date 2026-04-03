import React, { useState, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { Bd } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmtPct, fmtX } from './types';
import { computeExitReturns } from '../../../shared/calculations/returns';

const MONO = BT.font.mono;

const EXIT_CAPS = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];
const RENT_GROWTH = [1.0, 2.0, 3.0, 4.0, 5.0];
const HOLD_PERIODS = [3, 5, 7, 10];

type TableType = 'irr' | 'em';

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

export function SensitivityTab({ dealId, dealType, assumptions }: FinancialEngineTabProps) {
  const [activeTable, setActiveTable] = useState<TableType>('irr');
  const resolvedDealType = dealType || 'existing';

  const irrGrid = useMemo(() => {
    return EXIT_CAPS.map(cap =>
      RENT_GROWTH.map(growth => {
        try {
          const r = computeExitReturns(16, resolvedDealType, growth, cap);
          return r.irr;
        } catch { return 0; }
      })
    );
  }, [resolvedDealType]);

  const emGrid = useMemo(() => {
    return EXIT_CAPS.map(cap =>
      HOLD_PERIODS.map(hold => {
        try {
          const r = computeExitReturns(hold * 4, resolvedDealType, 3.0, cap);
          return r.em;
        } catch { return 0; }
      })
    );
  }, [resolvedDealType]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>TWO-WAY DATA TABLES</span>
        {(['irr', 'em'] as TableType[]).map(t => (
          <button key={t} onClick={() => setActiveTable(t)} style={{
            background: activeTable === t ? BT.bg.active : 'transparent',
            color: activeTable === t ? BT.met.financial : BT.text.muted,
            border: activeTable === t ? `1px solid ${BT.met.financial}40` : '1px solid transparent',
            padding: '2px 10px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
          }}>{t === 'irr' ? 'IRR × EXIT CAP × RENT GROWTH' : 'EM × EXIT CAP × HOLD PERIOD'}</button>
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
    </div>
  );
}

export default SensitivityTab;
