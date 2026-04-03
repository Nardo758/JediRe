import React from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtX } from './types';

const MONO = BT.font.mono;

interface RiskFlag {
  severity: 'high' | 'medium' | 'low';
  label: string;
  detail: string;
}

function deriveRiskFlags(assumptions: FinancialEngineTabProps['assumptions'], results: FinancialEngineTabProps['modelResults']): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const s = results?.summary;
  const a = assumptions;

  if (s?.irr != null && s.irr < 12) flags.push({ severity: 'high', label: 'LOW IRR', detail: `IRR of ${fmtPct(s.irr)} is below the 12% institutional threshold` });
  if (s?.dscr != null && s.dscr < 1.25) flags.push({ severity: 'high', label: 'TIGHT DSCR', detail: `DSCR of ${s.dscr.toFixed(2)}× is below the 1.25× minimum for most lenders` });
  if (a?.revenue?.stabilizedOccupancy != null && a.revenue.stabilizedOccupancy < 0.90) flags.push({ severity: 'medium', label: 'LOW OCCUPANCY', detail: `Stabilized occupancy of ${fmtPct(a.revenue.stabilizedOccupancy * 100)} is aggressive` });
  if (a?.disposition?.exitCapRate != null && a.disposition.exitCapRate < 0.045) flags.push({ severity: 'medium', label: 'AGGRESSIVE EXIT CAP', detail: `Exit cap of ${fmtPct(a.disposition.exitCapRate * 100)} assumes significant cap rate compression` });
  if (a?.revenue?.rentGrowth?.[0] != null && a.revenue.rentGrowth[0] > 0.04) flags.push({ severity: 'low', label: 'HIGH RENT GROWTH', detail: `Year 1 rent growth of ${fmtPct(a.revenue.rentGrowth[0] * 100)} exceeds typical market growth` });
  if (s?.equityMultiple != null && s.equityMultiple < 1.5) flags.push({ severity: 'medium', label: 'LOW EM', detail: `Equity multiple of ${fmtX(s.equityMultiple)} may not meet LP return expectations` });

  if (flags.length === 0) flags.push({ severity: 'low', label: 'NO FLAGS', detail: 'No risk flags identified — model assumptions appear within normal ranges' });

  return flags;
}

const SEVERITY_COLORS = {
  high: BT.text.red,
  medium: BT.text.amber,
  low: BT.met.financial,
};

export function DecisionTab({ dealId, assumptions, modelResults }: FinancialEngineTabProps) {
  const summary = modelResults?.summary;
  const flags = deriveRiskFlags(assumptions, modelResults);
  const highFlags = flags.filter(f => f.severity === 'high');
  const medFlags = flags.filter(f => f.severity === 'medium');

  const verdict = highFlags.length > 0 ? 'CAUTION' : medFlags.length > 0 ? 'PROCEED WITH REVIEW' : 'FAVORABLE';
  const verdictColor = highFlags.length > 0 ? BT.text.red : medFlags.length > 0 ? BT.text.amber : BT.met.financial;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>AI RATIONALE · RISK FLAGS · RECOMMENDED ACTIONS</span>
        <Bd c={verdictColor}>{verdict}</Bd>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>SOURCE: AI</span>
      </div>

      <SectionPanel title="DEAL VERDICT" subtitle="AI-generated recommendation" borderColor={verdictColor}>
        <div style={{ padding: '8px 10px', fontFamily: MONO, fontSize: 10, color: BT.text.primary, lineHeight: 1.6 }}>
          {summary ? (
            <>
              <div style={{ marginBottom: 8 }}>
                Based on the current model assumptions, this deal shows a{' '}
                <span style={{ color: BT.met.financial, fontWeight: 700 }}>{summary.irr != null ? fmtPct(summary.irr) : '—'} IRR</span>{' '}
                with a{' '}
                <span style={{ color: BT.text.amber, fontWeight: 700 }}>{summary.equityMultiple != null ? fmtX(summary.equityMultiple) : '—'} equity multiple</span>{' '}
                over the projected hold period.
              </div>
              <div>
                DSCR coverage is{' '}
                <span style={{ color: summary.dscr != null && summary.dscr >= 1.25 ? BT.met.financial : BT.text.red, fontWeight: 700 }}>
                  {summary.dscr != null ? `${summary.dscr.toFixed(2)}×` : '—'}
                </span>
                {summary.dscr != null && summary.dscr >= 1.25 ? ', meeting lender requirements.' : ', which may be tight for most lenders.'}
              </div>
            </>
          ) : (
            <span style={{ color: BT.text.muted }}>Build the financial model to generate AI-powered deal analysis and recommendations.</span>
          )}
        </div>
      </SectionPanel>

      <SectionPanel title="RISK FLAGS" subtitle={`${flags.length} flag${flags.length !== 1 ? 's' : ''} identified`} borderColor={BT.text.amber}>
        {flags.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px',
            borderBottom: i < flags.length - 1 ? `1px solid ${BT.border.subtle}` : 'none',
            borderLeft: `3px solid ${SEVERITY_COLORS[f.severity]}`,
          }}>
            <Bd c={SEVERITY_COLORS[f.severity]}>{f.severity.toUpperCase()}</Bd>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, fontWeight: 600 }}>{f.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginTop: 2 }}>{f.detail}</div>
            </div>
          </div>
        ))}
      </SectionPanel>

      <SectionPanel title="RECOMMENDED ACTIONS" subtitle="AI-suggested next steps" borderColor={BT.met.financial}>
        {[
          { action: 'Run sensitivity analysis on exit cap rate', priority: 'HIGH', color: BT.text.red },
          { action: 'Validate rent growth assumptions against market comps', priority: 'HIGH', color: BT.text.red },
          { action: 'Compare debt scenarios to optimize DSCR', priority: 'MEDIUM', color: BT.text.amber },
          { action: 'Review CapEx budget against property inspection', priority: 'MEDIUM', color: BT.text.amber },
          { action: 'Stress test occupancy at -5% from stabilized', priority: 'LOW', color: BT.met.financial },
        ].map((a, i) => (
          <DataRow key={i} label={a.action} value={<Bd c={a.color}>{a.priority}</Bd>} valueColor={a.color} border={i < 4} />
        ))}
      </SectionPanel>
    </div>
  );
}

export default DecisionTab;
