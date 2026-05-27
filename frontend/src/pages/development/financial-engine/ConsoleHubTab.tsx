// ============================================================================
// ConsoleHubTab — Console cluster shell (Phase 2, replaces AssumptionsHubTab)
// ============================================================================
//
// ARCHITECTURE RULES:
//   - Two-level max: Console is the parent, sub-tabs are the contents.
//     No further nesting beneath a sub-tab.
//   - Sub-tab bar uses amber as the active color (not financial green).
//     2px amber underline beneath active sub-tab only.
//   - DEBT and WATERFALL are deferred to a later phase; they remain in
//     CapitalHubTab for now.
//   - LEASING is deferred to Phase 3: LeasingAssumptionsTab has its own
//     bespoke prop interface (financials, leaseMode, leasingPathOverrides,
//     onFieldCommit) with hydration state managed inside AssumptionsTab.
//     Promoting it to a top-level Console sub-tab requires extracting that
//     state into a shared store or wrapper — a non-trivial refactor.
//     Until then, LEASING is accessible via INPUTS > AssumptionsTab's
//     built-in LEASING sub-tab.
//   - AssumptionsHubTab is retired — its children (INPUTS/UNIT MIX/TAX)
//     are promoted to peer Console sub-tabs alongside STANCE.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { AssumptionsTab } from './AssumptionsTab';
import { UnitMixTab } from '../../../components/deal/sections/UnitMixTab';
import { OtherIncomeTab } from './OtherIncomeTab';
import { TaxesTab } from './TaxesTab';
import { StanceTab } from './StanceTab';
import { DealTermsTab } from './DealTermsTab';
import { ValidationGridTab } from './ValidationGridTab';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;
const AMBER = BT.text.amber;

type SubTab = 'stance' | 'deal-terms' | 'inputs' | 'unitmix' | 'otherincome' | 'tax' | 'validation';

interface SubTabDef {
  id: SubTab;
  label: string;
  icon: string;
}

const SUB_TABS: SubTabDef[] = [
  { id: 'stance',      label: 'STANCE',       icon: '◈' },
  { id: 'deal-terms',  label: 'DEAL TERMS',   icon: '◇' },
  { id: 'inputs',      label: 'INPUTS',       icon: '⊕' },
  { id: 'unitmix',     label: 'UNIT MIX',     icon: '⊞' },
  { id: 'otherincome', label: 'OTHER INCOME', icon: '⊛' },
  { id: 'tax',         label: 'TAX',          icon: '$' },
  { id: 'validation',  label: 'VALIDATION',   icon: '✓' },
];

export function ConsoleHubTab(props: FinancialEngineTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('stance');

  // Listen for deep-link requests from the Deal Journey overlay.
  // Dispatched by deepLinkToAssumptionsField in DealJourneyOverlay.tsx when a
  // lever row is clicked, switching to the INPUTS sub-tab so the user lands on
  // the right assumptions panel.
  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<{ subTab: SubTab }>).detail;
      if (payload?.subTab && SUB_TABS.some(t => t.id === payload.subTab)) {
        setSubTab(payload.subTab);
      }
    };
    window.addEventListener('fe-console-subtab', handler);
    return () => window.removeEventListener('fe-console-subtab', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Sub-tab bar — amber theme, 2px underline on active ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 0,
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
        paddingLeft: 8,
      }}>
        {SUB_TABS.map(tab => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: MONO, fontSize: 9,
                fontWeight: active ? 700 : 400,
                letterSpacing: 0.6,
                padding: '6px 12px',
                background: active ? `${AMBER}10` : 'transparent',
                color: active ? AMBER : BT.text.muted,
                border: 'none',
                borderBottom: active ? `2px solid ${AMBER}` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.1s, border-color 0.1s',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 10, lineHeight: 1, opacity: active ? 1 : 0.6 }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}

        <span style={{
          fontFamily: MONO, fontSize: 8, color: BT.text.muted,
          marginLeft: 'auto', marginRight: 10, alignSelf: 'center',
          letterSpacing: 0.4,
        }}>
          CONSOLE · M08
        </span>
      </div>

      {/* ── Sub-tab content ── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {subTab === 'stance'     && (
          <StanceTab
            dealId={props.dealId}
            lvCostTreatmentView={props.lvCostTreatmentView}
            onLvTreatmentViewChange={props.onLvTreatmentViewChange}
          />
        )}
        {subTab === 'deal-terms'  && <DealTermsTab {...props} />}
        {subTab === 'inputs'      && <AssumptionsTab {...props} />}
        {subTab === 'unitmix'     && <UnitMixTab {...props} />}
        {subTab === 'otherincome' && <OtherIncomeTab {...props} />}
        {subTab === 'tax'         && <TaxesTab {...props} />}
        {subTab === 'validation'  && <ValidationGridTab {...props} />}
      </div>
    </div>
  );
}
