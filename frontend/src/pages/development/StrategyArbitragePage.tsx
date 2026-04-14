/**
 * M08 v2 — Detection-First Strategy UI
 * Full detection-first page using shared V2 components.
 * True detection gating: scoring/evidence/plan are locked until confidence confirmed.
 */

import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS, PanelHeader, SubTabBar, Bd,
} from '../../components/deal/bloomberg-ui';
import { useStrategyAnalysisV2 } from '../../hooks/useStrategyAnalysisV2';
import { V2FullAnalysis } from '../../components/deal/sections/StrategyV2Components';
import { useCorrelationReport } from '../../hooks/useCorrelationReport';
import { useDriverAnalysis } from '../../hooks/useDriverAnalysis';
import { useLeadLagRelationships } from '../../hooks/useLeadLagRelationships';
import { CustomScreenTab } from '../../components/deal/sections/CustomScreenTab';
import { useDealStore } from '../../stores/dealStore';

const MONO = BT.font.mono;
const TAB_LABELS = ['M08 v2 ANALYSIS', 'SIGNAL MATRIX', 'CUSTOM SCREENS'];

// ─── Legacy Signal Matrix Tab ─────────────────────────────────────────────────

function LegacySignalMatrixTab({ city, state: st }: { city: string; state: string }) {
  const { report, loading, error } = useCorrelationReport(city, st);
  if (loading) return (
    <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
      Loading signal matrix...
    </div>
  );
  if (error) return (
    <div style={{ padding: 12, fontFamily: MONO, fontSize: 10, color: BT.text.red }}>ERROR: {error}</div>
  );
  if (!report) return (
    <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
      No correlation data available.
    </div>
  );
  const sum = report.summary ?? { bullishSignals: 0, bearishSignals: 0, neutralSignals: 0, insufficientData: 0 };
  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT.border.subtle, marginBottom: 4 }}>
        {[
          { l: 'BULLISH', v: sum.bullishSignals, c: BT.text.green },
          { l: 'BEARISH', v: sum.bearishSignals, c: BT.text.red },
          { l: 'NEUTRAL', v: sum.neutralSignals, c: BT.text.secondary },
          { l: 'INSUFF', v: sum.insufficientData, c: BT.text.muted },
        ].map(item => (
          <div key={item.l} style={{ background: BT.bg.panel, padding: '6px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{item.l}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: item.c }}>{item.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
        {report.market}, {report.state} · {report.metricsComputed} computed · {report.computedAt ? new Date(report.computedAt).toLocaleString() : ''}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface StrategyArbitragePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

export function StrategyArbitragePage({ dealId, deal: _deal, dealType: _dealType }: StrategyArbitragePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';

  const {
    analysis, loading, error, recalculating,
    confirmDetection, overrideClassification, adjustSubStrategy, refresh, triggerRecalc,
  } = useStrategyAnalysisV2(resolvedDealId);

  const [activeTab, setActiveTab] = useState(0);

  const city = useDealStore(s => s.identity.city) || 'Atlanta';
  const stateName = useDealStore(s => s.identity.state) || 'GA';

  const handleConfirm = useCallback(() => confirmDetection(true), [confirmDetection]);
  const handleAdjust = useCallback((ss: string) => adjustSubStrategy(ss), [adjustSubStrategy]);
  const handleOverride = useCallback((ac: string) => overrideClassification(ac), [overrideClassification]);

  const statusBadge = () => {
    if (loading || recalculating) return (
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, animation: 'bt-pulse 1.2s infinite' }}>
        {recalculating ? 'RECALCULATING...' : 'COMPUTING M08 v2...'}
      </span>
    );
    if (analysis) return <Bd c={BT.text.green}>ANALYZED</Bd>;
    if (error) return <Bd c={BT.text.red}>ERROR</Bd>;
    return <Bd c={BT.text.muted}>NOT LOADED</Bd>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="STRATEGY INTELLIGENCE"
        subtitle="M08 v2 · DETECTION-FIRST ARCHITECTURE"
        borderColor={BT.text.amber}
        metrics={[
          { l: 'DETECT', c: BT.text.cyan },
          { l: 'SCORE', c: BT.text.amber },
          { l: 'EVIDENCE', c: BT.text.green },
          { l: 'PLAN', c: BT.text.purple },
        ]}
        right={statusBadge()}
      />

      <SubTabBar tabs={TAB_LABELS} active={activeTab} setActive={setActiveTab} color={BT.text.amber} />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <>
            {(loading || recalculating) && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.amber, animation: 'bt-pulse 1.2s infinite' }}>
                  {recalculating ? 'TRIGGERING M08 v2 RECALCULATION...' : 'RUNNING M08 v2 ANALYSIS...'}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginTop: 8 }}>
                  Detecting asset class · Scoring sub-strategies · Building evidence · Formulating plan
                </div>
              </div>
            )}

            {error && !loading && (
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

            {!loading && !recalculating && !error && !analysis && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>No analysis available.</div>
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

            {!loading && !recalculating && analysis && (
              <>
                <V2FullAnalysis
                  analysis={analysis}
                  onConfirm={handleConfirm}
                  onAdjust={handleAdjust}
                  onOverride={handleOverride}
                  dealId={resolvedDealId}
                />
                <div style={{ height: 24 }} />
              </>
            )}
          </>
        )}

        {activeTab === 1 && (
          <LegacySignalMatrixTab city={city} state={stateName} />
        )}

        {activeTab === 2 && (
          <CustomScreenTab dealId={resolvedDealId} />
        )}
      </div>
    </div>
  );
}

export default StrategyArbitragePage;
