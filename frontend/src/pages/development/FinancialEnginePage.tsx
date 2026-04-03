import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  SubTabBar, Bd, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { OverviewTab } from './financial-engine/OverviewTab';
import { ProFormaSummaryTab } from './financial-engine/ProFormaSummaryTab';
import { ProjectionsTab } from './financial-engine/ProjectionsTab';
import { AssumptionsTab } from './financial-engine/AssumptionsTab';
import { DebtTab } from './financial-engine/DebtTab';
import { WaterfallTab } from './financial-engine/WaterfallTab';
import { SensitivityTab } from './financial-engine/SensitivityTab';
import { DecisionTab } from './financial-engine/DecisionTab';
import { CompareTab } from './financial-engine/CompareTab';
import { exportToExcel } from './financial-engine/excel-export';
import type { ModelAssumptions, ModelResults, ModelVersion, DealType } from './financial-engine/types';
import { fmt$, fmtPct, fmtX } from './financial-engine/types';
import { apiClient } from '../../services/api.client';

const MONO = BT.font.mono;

const TAB_LABELS = [
  '⊞ OVERVIEW',
  '≡ PRO FORMA',
  '⋮≡ PROJECTIONS',
  '⊕ ASSUMPTIONS',
  '⊙ DEBT',
  '◈ WATERFALL',
  '∿ SENSITIVITY',
  '✓ DECISION',
  '⇔ COMPARE',
];

interface FinancialEnginePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

export function FinancialEnginePage({ dealId, deal: propDeal, dealType: propDealType }: FinancialEnginePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';
  const resolvedDealType: DealType = (propDealType as DealType) || 'existing';

  const [activeTab, setActiveTab] = useState(0);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [assumptions, setAssumptions] = useState<ModelAssumptions | null>(null);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<ModelVersion | null>(null);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [saveVersionName, setSaveVersionName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const kpi = useMemo(() => modelResults?.summary ?? null, [modelResults]);

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    setKpiLoading(true);

    Promise.allSettled([
      apiClient.get(`/api/v1/financial-dashboard/${resolvedDealId}/summary`),
      apiClient.get(`/api/v1/financial-model/${resolvedDealId}/latest`),
    ]).then(([summaryRes, modelRes]) => {
      if (cancelled) return;

      if (summaryRes.status === 'fulfilled') {
        const s = (summaryRes.value as any)?.data?.data?.model?.scenarios?.base;
        if (s && typeof s.irr === 'number') {
          setModelResults(prev => ({
            ...(prev ?? { annualCashFlow: [], sourcesAndUses: { sources: [], uses: [] }, debtMetrics: null, sensitivityAnalysis: null, waterfallDistributions: [] }),
            summary: {
              irr: s.irr,
              equityMultiple: s.equityMultiple ?? 0,
              cashOnCash: s.cashOnCash ?? 0,
              noi: s.noi ?? 0,
              dscr: s.dscr ?? 0,
            },
          }));
        }
      }

      if (modelRes.status === 'fulfilled') {
        const model = (modelRes.value as any)?.data?.data;
        if (model?.results) {
          setModelResults(model.results);
        }
        if (model?.assumptions) {
          setAssumptions(model.assumptions);
        }
      }

      setKpiLoading(false);
    }).catch(() => setKpiLoading(false));

    return () => { cancelled = true; };
  }, [resolvedDealId]);

  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient.get(`/api/v1/financial-model/${resolvedDealId}/versions`).then((res: any) => {
      const data = res?.data?.data ?? res?.data ?? [];
      if (Array.isArray(data)) setVersions(data);
    }).catch(() => {});
  }, [resolvedDealId]);

  const handleBuildModel = useCallback(async () => {
    if (!resolvedDealId || !assumptions) return;
    setBuilding(true);
    try {
      const res = await apiClient.post('/api/v1/financial-model/build', { dealId: resolvedDealId, assumptions });
      const data = (res as any)?.data;
      if (data?.data) setModelResults(data.data);
      else if (data) setModelResults(data);
    } catch (e) {
      console.error('Model build failed:', e);
    } finally {
      setBuilding(false);
    }
  }, [resolvedDealId, assumptions]);

  const handleSaveVersion = useCallback(async () => {
    if (!resolvedDealId || !assumptions) return;
    const name = saveVersionName.trim() || `v${versions.length + 1}`;
    const version: ModelVersion = {
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now(),
      source: 'user',
      dealType: resolvedDealType,
      assumptions,
      results: modelResults ?? undefined,
    };
    setVersions(prev => [...prev, version]);
    setActiveVersion(version);
    setShowSaveDialog(false);
    setSaveVersionName('');

    try {
      await apiClient.post(`/api/v1/financial-model/${resolvedDealId}/versions`, version);
    } catch {}
  }, [resolvedDealId, assumptions, modelResults, saveVersionName, versions.length, resolvedDealType]);

  const handleLoadVersion = useCallback((version: ModelVersion) => {
    setActiveVersion(version);
    setAssumptions(version.assumptions);
    if (version.results) setModelResults(version.results);
    setShowVersionDropdown(false);
  }, []);

  const handleExport = useCallback(() => {
    exportToExcel(assumptions, modelResults, assumptions?.dealInfo?.dealName);
  }, [assumptions, modelResults]);

  const handleAssumptionsChange = useCallback((partial: Partial<ModelAssumptions>) => {
    setAssumptions(prev => prev ? { ...prev, ...partial } : null);
  }, []);

  const tabProps = useMemo(() => ({
    dealId: resolvedDealId,
    deal: propDeal,
    dealType: resolvedDealType,
    assumptions,
    modelResults,
    onAssumptionsChange: handleAssumptionsChange,
    onBuildModel: handleBuildModel,
    building,
    versions,
    activeVersion,
  }), [resolvedDealId, propDeal, resolvedDealType, assumptions, modelResults, handleAssumptionsChange, handleBuildModel, building, versions, activeVersion]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        borderTop: `2px solid ${BT.met.financial}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8, fontFamily: MONO }}>FINANCIAL ENGINE</span>
          <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>M08 · v3.1</span>
          {kpiLoading
            ? <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>LOADING...</span>
            : kpi
              ? <Bd c={BT.met.financial}>LIVE MODEL</Bd>
              : <Bd c={BT.text.secondary}>NO MODEL</Bd>
          }
          <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>
            {resolvedDealType}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowVersionDropdown(!showVersionDropdown)}
              style={{
                background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
                fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {activeVersion ? activeVersion.name : `v1 Base`} ▾
            </button>
            {showVersionDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
                minWidth: 180, maxHeight: 200, overflow: 'auto', borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {versions.length > 0 ? versions.map(v => (
                  <button key={v.id} onClick={() => handleLoadVersion(v)} style={{
                    display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                    border: 'none', color: v.id === activeVersion?.id ? BT.met.financial : BT.text.primary,
                    fontFamily: MONO, fontSize: 9, padding: '4px 8px', cursor: 'pointer',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                  }}>
                    {v.name}
                    <span style={{ float: 'right', color: BT.text.muted, fontSize: 8 }}>
                      {v.source === 'user' ? 'User' : v.source}
                    </span>
                  </button>
                )) : (
                  <div style={{ padding: '8px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No saved versions</div>
                )}
              </div>
            )}
          </div>

          {showSaveDialog ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                value={saveVersionName}
                onChange={e => setSaveVersionName(e.target.value)}
                placeholder="Version name..."
                style={{
                  background: BT.bg.input, border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
                  fontFamily: MONO, fontSize: 9, padding: '2px 6px', width: 120, borderRadius: 2,
                }}
                onKeyDown={e => e.key === 'Enter' && handleSaveVersion()}
                autoFocus
              />
              <button onClick={handleSaveVersion} style={{
                background: BT.met.financial, border: 'none', color: BT.bg.terminal,
                fontFamily: MONO, fontSize: 9, padding: '2px 6px', cursor: 'pointer', borderRadius: 2, fontWeight: 700,
              }}>SAVE</button>
              <button onClick={() => setShowSaveDialog(false)} style={{
                background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
                fontFamily: MONO, fontSize: 9, padding: '2px 6px', cursor: 'pointer', borderRadius: 2,
              }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowSaveDialog(true)} style={{
              background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
              fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
            }}>SAVE VERSION</button>
          )}

          <button onClick={handleExport} style={{
            background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
            fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
          }}>EXPORT XLSX</button>

          <button onClick={handleBuildModel} disabled={building || !assumptions} style={{
            background: building ? BT.bg.active : BT.met.financial,
            border: 'none', color: building ? BT.text.muted : BT.bg.terminal,
            fontFamily: MONO, fontSize: 9, padding: '2px 10px', cursor: building ? 'default' : 'pointer',
            borderRadius: 2, fontWeight: 700, opacity: !assumptions ? 0.4 : 1,
          }}>{building ? 'BUILDING...' : 'BUILD MODEL'}</button>

          <div style={{ width: 1, height: 14, background: BT.border.medium }} />

          {[
            { label: 'IRR', value: kpi?.irr != null ? fmtPct(kpi.irr) : '—', color: BT.met.financial },
            { label: 'EM', value: kpi?.equityMultiple != null ? fmtX(kpi.equityMultiple) : '—', color: BT.text.amber },
            { label: 'CoC', value: kpi?.cashOnCash != null ? fmtPct(kpi.cashOnCash) : '—', color: BT.met.occupancy },
            { label: 'NOI', value: kpi?.noi != null ? fmt$(kpi.noi) : '—', color: BT.text.cyan },
            { label: 'DSCR', value: kpi?.dscr != null ? `${kpi.dscr.toFixed(2)}×` : '—', color: BT.text.green },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>{m.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      <SubTabBar
        tabs={TAB_LABELS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.met.financial}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <BtTabWrapper><OverviewTab {...tabProps} /></BtTabWrapper>
        )}
        {activeTab === 1 && (
          <BtTabWrapper><ProFormaSummaryTab {...tabProps} /></BtTabWrapper>
        )}
        {activeTab === 2 && (
          <BtTabWrapper><ProjectionsTab {...tabProps} /></BtTabWrapper>
        )}
        {activeTab === 3 && (
          <BtTabWrapper><AssumptionsTab {...tabProps} /></BtTabWrapper>
        )}
        {activeTab === 4 && (
          <BtTabWrapper><DebtTab {...tabProps} /></BtTabWrapper>
        )}
        {activeTab === 5 && (
          <BtTabWrapper><WaterfallTab {...tabProps} /></BtTabWrapper>
        )}
        {activeTab === 6 && (
          <BtTabWrapper><SensitivityTab {...tabProps} /></BtTabWrapper>
        )}
        {activeTab === 7 && (
          <BtTabWrapper><DecisionTab {...tabProps} /></BtTabWrapper>
        )}
        {activeTab === 8 && (
          <BtTabWrapper><CompareTab {...tabProps} /></BtTabWrapper>
        )}
      </div>
    </div>
  );
}

export default FinancialEnginePage;
