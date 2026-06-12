import React, { useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { CompareTab } from './CompareTab';
import { UnderwritingWalkthrough } from '../../../components/f9/UnderwritingWalkthrough';
import { ScenarioComparePane } from '../../../components/scenarios/ScenarioComparePane';
import { BtTabWrapper } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;

type Section = 'compare' | 'walkthrough' | 'scenarios';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'compare',     label: 'COMPARE',     icon: '⇔' },
  { id: 'scenarios',   label: 'SCENARIOS',   icon: '◐' },
  { id: 'walkthrough', label: 'WALKTHROUGH',  icon: '⊟' },
];

export function CompareHubTab(props: FinancialEngineTabProps) {
  const [section, setSection] = useState<Section>('compare');

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
                background: active ? `${BT.met.financial}18` : 'transparent',
                color: active ? BT.met.financial : BT.text.muted,
                border: `1px solid ${active ? BT.met.financial : BT.border.subtle}`,
                borderRadius: 2, cursor: 'pointer',
              }}
            >
              {s.icon} {s.label}
            </button>
          );
        })}
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginLeft: 'auto', alignSelf: 'center', letterSpacing: 0.4 }}>
          COMPARE · M08
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {section === 'compare'     && <CompareTab {...props} />}
        {section === 'scenarios'  && <ScenarioComparePane dealId={props.dealId} />}
        {section === 'walkthrough' && (
          <BtTabWrapper>
            <UnderwritingWalkthrough dealId={props.dealId} />
          </BtTabWrapper>
        )}
      </div>
    </div>
  );
}
