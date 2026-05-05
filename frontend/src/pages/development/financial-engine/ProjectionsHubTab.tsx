import React, { useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { ProjectionsTab } from './ProjectionsTab';
import InteractiveProformaTab from './InteractiveProformaTab';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;

type Section = 'projections' | 'interactive';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'projections',  label: 'PROJECTIONS', icon: '⋮≡' },
  { id: 'interactive',  label: 'INTERACTIVE',  icon: '△' },
];

interface ProjectionsHubTabProps extends FinancialEngineTabProps {
  integrityWarning?: boolean;
}

export function ProjectionsHubTab({ integrityWarning, ...props }: ProjectionsHubTabProps) {
  const [section, setSection] = useState<Section>('projections');

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
          PROJECTIONS · M08
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {section === 'projections' && (
          <ProjectionsTab {...props} integrityWarning={integrityWarning} />
        )}
        {section === 'interactive' && <InteractiveProformaTab {...props} />}
      </div>
    </div>
  );
}
