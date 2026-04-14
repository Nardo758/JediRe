/**
 * Strategy Section — M08 v2 Detection-First
 * Full feature parity with StrategyArbitragePage via shared V2 components.
 * All v1 mock data imports removed.
 */

import React, { useState, useCallback } from 'react';
import { Deal } from '../../../types/deal';
import { BT, BT_CSS, Bd } from '../bloomberg-ui';
import { useStrategyAnalysisV2 } from '../../../hooks/useStrategyAnalysisV2';
import { V2FullAnalysis } from './StrategyV2Components';
import { CustomScreenTab } from './CustomScreenTab';

const MONO = BT.font.mono;

export interface StrategySectionProps {
  deal: Deal;
}

type Tab = 'analysis' | 'custom';

const TABS: { id: Tab; label: string }[] = [
  { id: 'analysis', label: 'M08 v2 ANALYSIS' },
  { id: 'custom', label: 'CUSTOM SCREEN' },
];

export const StrategySection: React.FC<StrategySectionProps> = ({ deal }) => {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');

  const {
    analysis, loading, error, recalculating,
    confirmDetection, overrideClassification, refresh, triggerRecalc,
  } = useStrategyAnalysisV2(deal.id);

  const handleConfirm = useCallback(() => confirmDetection(true), [confirmDetection]);
  const handleOverride = useCallback((ac: string) => overrideClassification(ac), [overrideClassification]);

  const isLoading = loading || recalculating;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`, borderTop: `2px solid ${BT.text.amber}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary, letterSpacing: 0.8 }}>
            STRATEGY INTELLIGENCE
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>M08 v2 · DETECTION-FIRST</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isLoading && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, animation: 'bt-pulse 1.2s infinite' }}>
              {recalculating ? 'RECALCULATING...' : 'COMPUTING...'}
            </span>
          )}
          {!isLoading && analysis && <Bd c={BT.text.green}>LIVE</Bd>}
          {!isLoading && error && <Bd c={BT.text.red}>ERROR</Bd>}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{
        display: 'flex', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0, height: 26, alignItems: 'stretch',
      }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            fontFamily: MONO, fontSize: 9, fontWeight: activeTab === tab.id ? 700 : 500,
            padding: '0 14px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? `2px solid ${BT.text.amber}` : '2px solid transparent',
            color: activeTab === tab.id ? BT.text.amber : BT.text.secondary,
            cursor: 'pointer', whiteSpace: 'nowrap' as const, letterSpacing: 0.5,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeTab === 'custom' && <CustomScreenTab dealId={deal.id} />}

        {activeTab === 'analysis' && isLoading && (
          <div style={{ padding: 32, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.amber, animation: 'bt-pulse 1.2s infinite' }}>
            {recalculating ? 'TRIGGERING RECALCULATION...' : 'RUNNING M08 v2 ANALYSIS...'}
          </div>
        )}

        {activeTab === 'analysis' && error && !isLoading && (
          <div style={{ margin: 12, padding: 12, borderLeft: `2px solid ${BT.text.red}`, background: `${BT.text.red}08` }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.red, marginBottom: 4 }}>ANALYSIS ERROR</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{error}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={refresh} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.amber,
                background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
                padding: '3px 10px', cursor: 'pointer',
              }}>RETRY</button>
              <button onClick={triggerRecalc} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.cyan,
                background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
                padding: '3px 10px', cursor: 'pointer',
              }}>TRIGGER RECALC</button>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && !isLoading && !error && !analysis && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>No analysis data available.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button onClick={refresh} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.cyan,
                background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
                padding: '4px 12px', cursor: 'pointer',
              }}>REFRESH</button>
              <button onClick={triggerRecalc} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.amber,
                background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
                padding: '4px 12px', cursor: 'pointer',
              }}>TRIGGER RECALC</button>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && !isLoading && analysis && (
          <V2FullAnalysis
            analysis={analysis}
            onConfirm={handleConfirm}
            onOverride={handleOverride}
            dealId={deal.id}
          />
        )}
      </div>
    </div>
  );
};

export default StrategySection;
