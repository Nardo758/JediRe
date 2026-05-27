/**
 * M08 v2 — Detection-First Strategy UI
 * Full detection-first page using shared V2 components.
 * True detection gating: scoring/evidence/plan are locked until confidence confirmed.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS, PanelHeader, SubTabBar, Bd,
} from '../../components/deal/bloomberg-ui';
import { useStrategyAnalysisV2 } from '../../hooks/useStrategyAnalysisV2';
import { V2FullAnalysis } from '../../components/deal/sections/StrategyV2Components';
import { SignalStabilityTab } from '../../components/deal/sections/SignalStabilityTab';
import { CustomScreenTab } from '../../components/deal/sections/CustomScreenTab';
import { useDealStore } from '../../stores/dealStore';
import { apiClient } from '../../services/api.client';

const MONO = BT.font.mono;
const TAB_LABELS = ['STRATEGY ANALYSIS', 'SIGNAL STABILITY', 'CUSTOM SCREENS'];

// ─── Main Page ────────────────────────────────────────────────────────────────

interface StrategyArbitragePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

/**
 * Maps proformaTemplateId values to human-readable labels for unsupported deal types.
 * These three template IDs have no cashflow engine support — the notice replaces content.
 * Source of truth matches ProFormaSummaryTab.tsx (isFlipTemplate / isStrTemplate / isLandHoldTemplate).
 */
const UNSUPPORTED_TEMPLATE_LABELS: Record<string, string> = {
  flip:          'Flip',
  str_shortterm: 'Short-Term Rental (STR)',
  land_hold:     'Land Hold',
};

export function StrategyArbitragePage({ dealId, deal: _deal, dealType: _dealType }: StrategyArbitragePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';

  const {
    analysis, loading, error, recalculating,
    confirmDetection, overrideClassification, adjustSubStrategy, refresh, triggerRecalc,
  } = useStrategyAnalysisV2(resolvedDealId);

  const [activeTab, setActiveTab] = useState(0);

  // ── Unsupported deal-type detection ──────────────────────────────────────────
  // deal_type column is lossy (Flip→value_add, STR→existing) so we use the same
  // canonical proformaTemplateId signal as ProFormaSummaryTab, fetched from the
  // F9 financials endpoint. This keeps both surfaces in sync.
  const [proformaTemplateId, setProformaTemplateId] = useState<string | null>(null);
  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient
      .get<{ data?: { proformaTemplateId?: string | null } }>(`/api/v1/deals/${resolvedDealId}/financials?hold=5`)
      .then(res => {
        setProformaTemplateId(res?.data?.data?.proformaTemplateId ?? null);
      })
      .catch(() => {});
  }, [resolvedDealId]);
  const unsupportedLabel = proformaTemplateId ? UNSUPPORTED_TEMPLATE_LABELS[proformaTemplateId] ?? null : null;

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

      {/* ── Not-yet-supported full-page notice replaces all tab content ──────────
           Shown instead of the analysis tabs when proformaTemplateId indicates a
           deal type the cashflow + scoring engine does not yet support.
           SubTabBar remains visible (non-blocking) so users can navigate away.  ── */}
      {unsupportedLabel ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '48px 32px', background: BT.bg.terminal, gap: 20,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#1a0f2e', border: '2px solid #7c3aed66',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>⚠</div>
          <div style={{ textAlign: 'center', maxWidth: 460 }}>
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em', marginBottom: 10 }}>
              {unsupportedLabel.toUpperCase()} — NOT YET FULLY SUPPORTED
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
              Strategy scoring and sub-strategy recommendations for{' '}
              <strong style={{ color: '#c4b5fd' }}>{unsupportedLabel}</strong> deals are not yet modeled.
              The detection engine will attempt asset-class classification, but scoring,
              evidence, and plan tabs will produce incomplete or placeholder results.
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#475569', marginTop: 12, lineHeight: 1.5 }}>
              Full support for this deal type is planned for a future release.
              Other deal capsule tabs (zoning, market intelligence, financial model) remain fully functional.
            </div>
          </div>
        </div>
      ) : (
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
          <SignalStabilityTab city={city} state={stateName} />
        )}

        {activeTab === 2 && (
          <CustomScreenTab dealId={resolvedDealId} />
        )}
      </div>
      )}
    </div>
  );
}

export default StrategyArbitragePage;
