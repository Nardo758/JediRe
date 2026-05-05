import React, { useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SourcesUsesTab } from './SourcesUsesTab';
import { DebtTab } from './DebtTab';
import { WaterfallTab } from './WaterfallTab';
import { CostSheetTab } from '../../../components/deal/sections/CostSheetTab';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;

type Section = 'su' | 'debt' | 'waterfall' | 'costsheet';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'su',        label: 'SRC & USES',  icon: '⇄' },
  { id: 'debt',      label: 'DEBT',        icon: '⊙' },
  { id: 'waterfall', label: 'WATERFALL',   icon: '◈' },
  { id: 'costsheet', label: 'COST SHEET',  icon: '₵' },
];

export function CapitalHubTab(props: FinancialEngineTabProps) {
  const [section, setSection] = useState<Section>('su');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', gap: 2, padding: '4px 10px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        {SECTIONS.map(s => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                fontFamily: MONO, fontSize: 9, fontWeight: active ? 700 : 400,
                letterSpacing: 0.6, padding: '2px 10px',
                background: active ? `${BT.text.cyan}18` : 'transparent',
                color: active ? BT.text.cyan : BT.text.muted,
                border: `1px solid ${active ? BT.text.cyan : BT.border.subtle}`,
                borderRadius: 2, cursor: 'pointer',
              }}
            >
              {s.icon} {s.label}
            </button>
          );
        })}
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginLeft: 'auto', alignSelf: 'center', letterSpacing: 0.4 }}>
          CAPITAL · M08
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {section === 'su'        && <SourcesUsesTab {...props} />}
        {section === 'debt'      && <DebtTab {...props} />}
        {section === 'waterfall' && <WaterfallTab {...props} />}
        {section === 'costsheet' && (
          <div style={{ height: '100%', overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column' }}>
            <CostSheetTab
              dealId={props.dealId}
              deal={props.deal as Record<string, any> | undefined}
              assumptions={props.assumptions as Record<string, any> | null | undefined}
              f9Financials={props.f9Financials}
            />
          </div>
        )}
      </div>
    </div>
  );
}
