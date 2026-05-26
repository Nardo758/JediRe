import React, { useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { ReturnsTab } from './ReturnsTab';
import { SensitivityTab } from './SensitivityTab';
import type { FinancialEngineTabProps } from './types';
import { UnitMixMismatchBannerConnected } from './UnitMixMismatchBanner';

const MONO = BT.font.mono;

type Section = 'returns' | 'sensitivity';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'returns',     label: 'RETURNS',     icon: '%' },
  { id: 'sensitivity', label: 'SENSITIVITY', icon: '∿' },
];

export function ReturnsHubTab(props: FinancialEngineTabProps) {
  const [section, setSection] = useState<Section>('returns');

  const handleGoToUnitMix = () => {
    props.onTabChange?.(1);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('fe-console-subtab', { detail: { subTab: 'unitmix' } }));
    }, 50);
  };

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
                background: active ? `${BT.text.amber}18` : 'transparent',
                color: active ? BT.text.amber : BT.text.muted,
                border: `1px solid ${active ? BT.text.amber : BT.border.subtle}`,
                borderRadius: 2, cursor: 'pointer',
              }}
            >
              {s.icon} {s.label}
            </button>
          );
        })}
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginLeft: 'auto', alignSelf: 'center', letterSpacing: 0.4 }}>
          RETURNS · M08
        </span>
      </div>

      <UnitMixMismatchBannerConnected
        f9Financials={props.f9Financials}
        deal={props.deal}
        dealId={props.dealId}
        onGoToUnitMix={handleGoToUnitMix}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {section === 'returns'     && <ReturnsTab {...props} />}
        {section === 'sensitivity' && <SensitivityTab {...props} />}
      </div>
    </div>
  );
}
