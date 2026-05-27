import React, { useState } from 'react';
import { BT, SectionPanel } from '../bloomberg-ui';
import type { SubStrategyScore, SignalScores, StrategyAnalysisV2 } from '../../../hooks/useStrategyAnalysisV2';
import { MONO, SS_COLORS } from './strategy-v2.utils';

const SIGNAL_LABELS = ['DEMAND', 'SUPPLY', 'MOMENTUM', 'POSITION', 'RISK'];

function heatColor(v: number): string {
  if (v >= 80) return BT.text.green;
  if (v >= 50) return BT.text.amber;
  return BT.text.red;
}

type SignalKey = Exclude<keyof SignalScores, 'confidence'>;
const TYPED_SIGNAL_KEYS: SignalKey[] = ['demand', 'supply', 'momentum', 'position', 'risk'];

const SS_SIGNAL_WEIGHTS: Record<string, Partial<Record<SignalKey, number>>> = {
  mf_value_add_standard:   { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  mf_deep_value_add:       { demand: 0.25, supply: 0.20, momentum: 0.25, position: 0.15, risk: 0.15 },
  mf_core:                 { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  mf_core_plus:            { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
  mf_distressed:           { demand: 0.20, supply: 0.15, momentum: 0.15, position: 0.20, risk: 0.30 },
  mf_lease_up:             { demand: 0.35, supply: 0.30, momentum: 0.15, position: 0.10, risk: 0.10 },
  mf_bts_ground_up:        { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  mf_str:                  { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_fix_flip:            { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  sfr_brrrr:               { demand: 0.20, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.15 },
  sfr_hold:                { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  sfr_portfolio_agg:       { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  sfr_btr:                 { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  sfr_str:                 { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_mtr:                 { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_wholesale:           { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  retail_nnn_core:         { demand: 0.20, supply: 0.10, momentum: 0.10, position: 0.35, risk: 0.25 },
  retail_grocery_anchored: { demand: 0.25, supply: 0.15, momentum: 0.15, position: 0.30, risk: 0.15 },
  retail_value_add:        { demand: 0.30, supply: 0.15, momentum: 0.20, position: 0.25, risk: 0.10 },
  retail_last_mile:        { demand: 0.30, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.10 },
  office_adaptive_reuse:   { demand: 0.35, supply: 0.20, momentum: 0.15, position: 0.15, risk: 0.15 },
  office_medical:          { demand: 0.30, supply: 0.20, momentum: 0.15, position: 0.20, risk: 0.15 },
  office_tenant_rollup:    { demand: 0.15, supply: 0.20, momentum: 0.25, position: 0.20, risk: 0.20 },
  industrial_last_mile:    { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.20, risk: 0.05 },
  industrial_core:         { demand: 0.20, supply: 0.25, momentum: 0.15, position: 0.25, risk: 0.15 },
  hospitality_reflag:      { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.25, risk: 0.10 },
  hospitality_extended_stay: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
};
const SS_WEIGHT_AVG = 0.20;

function getSignalWeight(ss: SubStrategyScore, sig: string): number {
  return ss.signalWeights?.[sig]
    ?? SS_SIGNAL_WEIGHTS[ss.key]?.[sig as SignalKey]
    ?? SS_WEIGHT_AVG;
}

const SIGNAL_SOURCE_TAB: Record<SignalKey, string> = {
  demand:   'market',
  supply:   'supply',
  momentum: 'market',
  position: 'overview',
  risk:     'risk',
};

export function SignalHeatmap({ subStrategies, signalScores }: {
  subStrategies: SubStrategyScore[];
  signalScores: StrategyAnalysisV2['signalScores'];
}) {
  const [tooltip, setTooltip] = useState<{
    sig: SignalKey; ssName: string; signalScore: number; w: number; val: number; x: number; y: number;
  } | null>(null);

  if (!subStrategies || subStrategies.length === 0) return null;

  const navigateToEvidence = (ssKey: string) => {
    const el = document.getElementById(`evidence-${ssKey}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navigateToSourceModule = (sig: SignalKey, ssKey: string) => {
    const targetTab = SIGNAL_SOURCE_TAB[sig];
    if (targetTab) {
      window.dispatchEvent(new CustomEvent('deal-tab-change', { detail: targetTab }));
    }
    setTimeout(() => {
      const el = document.getElementById(`evidence-${ssKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  };

  return (
    <SectionPanel title="SIGNAL × STRATEGY HEATMAP" borderColor={BT.text.purple} style={{ marginBottom: 1 }}>
      <div style={{ overflowX: 'auto', position: 'relative' }}>
        {tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 72,
            background: BT.bg.panelAlt, border: `1px solid ${BT.border.medium}`,
            padding: '6px 10px', zIndex: 9999, pointerEvents: 'none', minWidth: 220,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3 }}>
              {tooltip.sig.toUpperCase()} × {tooltip.ssName.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>
              {tooltip.signalScore} × ({tooltip.w.toFixed(2)} ÷ {SS_WEIGHT_AVG.toFixed(2)}) = <b>{tooltip.val}</b>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginTop: 3 }}>
              signal_score={tooltip.signalScore} · weight={tooltip.w.toFixed(2)} (API: ss.signalWeights)
            </div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.cyan, marginTop: 2 }}>▲ click → navigate to {tooltip ? SIGNAL_SOURCE_TAB[tooltip.sig].toUpperCase() : ''} module tab</div>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 300 }}>
          <thead>
            <tr style={{ background: BT.bg.header }}>
              <th style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 8px', textAlign: 'left', borderRight: `1px solid ${BT.border.subtle}`, width: 90 }}>
                SIGNAL
              </th>
              {subStrategies.map((ss, i) => (
                <th key={ss.key} style={{ fontFamily: MONO, fontSize: 8, color: SS_COLORS[i % SS_COLORS.length], padding: '4px 8px', textAlign: 'center', borderRight: `1px solid ${BT.border.subtle}`, maxWidth: 90, cursor: 'pointer' }}
                  onClick={() => navigateToEvidence(ss.key)}
                  title={`Click to jump to evidence for ${ss.name || ss.key}`}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(ss.name || ss.key).replace(/_/g, ' ').toUpperCase().slice(0, 14)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>→ evid</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPED_SIGNAL_KEYS.map((sig, sIdx) => {
              const signalScore = signalScores?.[sig] ?? 50;
              return (
                <tr key={sig} style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: sIdx % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt }}>
                  <td style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: '5px 8px', borderRight: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>
                    {SIGNAL_LABELS[sIdx]}
                    <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.secondary }}>{signalScore}</div>
                  </td>
                  {subStrategies.map((ss) => {
                    const w = getSignalWeight(ss, sig);
                    const val = Math.round(Math.min(99, Math.max(10, signalScore * (w / SS_WEIGHT_AVG))));
                    const c = heatColor(val);
                    return (
                      <td
                        key={ss.key}
                        style={{ textAlign: 'center', padding: '5px 8px', borderRight: `1px solid ${BT.border.subtle}`, cursor: 'pointer' }}
                        onMouseMove={e => setTooltip({ sig, ssName: ss.name || ss.key, signalScore, w, val, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => navigateToSourceModule(sig, ss.key)}
                      >
                        <span style={{
                          fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c,
                          background: `${c}18`, padding: '1px 6px', display: 'inline-block',
                        }}>{val}</span>
                        <div style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted }}>w={w.toFixed(2)}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          {[{ v: '≥80 STRONG', c: BT.text.green }, { v: '50-79 WATCH', c: BT.text.amber }, { v: '<50 WEAK', c: BT.text.red }].map(item => (
            <div key={item.v} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, background: item.c, opacity: 0.8 }} />
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{item.v}</span>
            </div>
          ))}
          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginLeft: 'auto', fontStyle: 'italic' }}>hover=formula · click=jump to evidence</span>
        </div>
      </div>
    </SectionPanel>
  );
}
