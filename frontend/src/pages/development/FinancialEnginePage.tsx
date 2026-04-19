import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Brain, Send, ChevronUp, ChevronDown } from 'lucide-react';
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
import { TaxesTab } from './financial-engine/TaxesTab';
import { SourcesUsesTab } from './financial-engine/SourcesUsesTab';
import { ReturnsTab } from './financial-engine/ReturnsTab';
import { SensitivityTab } from './financial-engine/SensitivityTab';
import { DecisionTab } from './financial-engine/DecisionTab';
import { CompareTab } from './financial-engine/CompareTab';
import { CostSheetTab } from '../../components/deal/sections/CostSheetTab';
import { exportToExcel } from './financial-engine/excel-export';
import type { ModelAssumptions, ModelResults, ModelVersion, DealType, F9DealFinancials } from './financial-engine/types';
import { fmt$, fmtPct, fmtX } from './financial-engine/types';
import { apiClient } from '../../services/api.client';
import { F9SummaryBar } from '../../components/f9/F9SummaryBar';
import { EvidencePanel } from '../../components/underwriting/EvidencePanel';
import { UnderwritingWalkthrough } from '../../components/f9/UnderwritingWalkthrough';

const MONO = BT.font.mono;

const TAB_LABELS = [
  '⊞ OVERVIEW',
  '≡ PRO FORMA',
  '⋮≡ PROJECTIONS',
  '⊕ ASSUMPTIONS',
  '$ TAXES',
  '⇄ SRC & USES',
  '⊙ DEBT',
  '◈ CAP & WFALL',
  '∿ SENSITIVITY',
  '✓ DECISION',
  '⇔ COMPARE',
  '% RETURNS',
  '₵ COST SHEET',
  '⊟ WALKTHROUGH',
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
  const [opusInput, setOpusInput] = useState('');
  const [opusSending, setOpusSending] = useState(false);
  const [opusMessages, setOpusMessages] = useState<Array<{ role: 'user' | 'opus'; text: string; ts: number }>>([]);
  const [opusExpanded, setOpusExpanded] = useState(false);
  const opusInputRef = useRef<HTMLInputElement>(null);
  const opusScrollRef = useRef<HTMLDivElement>(null);
  // Projections gating: true when Pro Forma integrity checks contain errors
  const [integrityBlocked, setIntegrityBlocked] = useState(false);
  // F9 DealFinancials — fetched here so F1/F8/F10 tabs can consume it
  const [f9Financials, setF9Financials] = useState<F9DealFinancials | null>(null);
  // Evidence system — field click panel + summary bar
  const [evidenceField, setEvidenceField] = useState<{ path: string; label: string } | null>(null);
  const [evidenceSummary, setEvidenceSummary] = useState<{
    collision_summary?: { minor_count: number; material_count: number; severe_count: number };
    confidence_distribution?: { high: number; medium: number; low: number };
    tier_distribution?: { tier1: number; tier2: number; tier3: number; tier4: number };
  } | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState<{ type: 'collision' | 'confidence' | 'tier'; value: string } | null>(null);

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

  // ── F9 DealFinancials — fetched at page level for F1/F8/F10 cross-tab wiring ─
  const [f9Hold, setF9Hold] = useState<number>(5);
  const f9HoldRef = React.useRef(f9Hold);
  f9HoldRef.current = f9Hold;

  const fetchF9Financials = useCallback((hold?: number) => {
    if (!resolvedDealId) return;
    const h = hold ?? f9HoldRef.current;
    apiClient.get<{ success: boolean; data: F9DealFinancials }>(
      `/api/v1/deals/${resolvedDealId}/financials?hold=${h}`,
    ).then(res => {
      if (res.data?.data) setF9Financials(res.data.data);
    }).catch(() => {});
  }, [resolvedDealId]);

  useEffect(() => {
    fetchF9Financials();
  }, [fetchF9Financials]);

  // ── Evidence Summary — fetch collision/confidence/tier stats ─────────────
  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient.get(`/api/v1/deals/${resolvedDealId}/underwriting/evidence-summary`)
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data ?? null;
        if (d) setEvidenceSummary(d);
      })
      .catch(() => {});
  }, [resolvedDealId]);

  // ── Evidence panel trigger — child tabs dispatch 'fe-evidence-click' ──────
  // Usage from any child tab: window.dispatchEvent(new CustomEvent('fe-evidence-click', { detail: { path: 'income.gpr', label: 'Gross Potential Rent' } }))
  useEffect(() => {
    const handler = (e: Event) => {
      const { path, label } = (e as CustomEvent<{ path: string; label: string }>).detail ?? {};
      if (path) setEvidenceField({ path, label: label ?? path });
    };
    window.addEventListener('fe-evidence-click', handler);
    return () => window.removeEventListener('fe-evidence-click', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail;
      if (typeof idx === 'number') setActiveTab(idx);
    };
    window.addEventListener('fe-tab-change', handler);
    return () => window.removeEventListener('fe-tab-change', handler);
  }, []);

  const handleHoldChange = useCallback((years: number) => {
    setF9Hold(years);
    fetchF9Financials(years);
  }, [fetchF9Financials]);

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

  const handleExport = useCallback(async () => {
    if (!resolvedDealId) {
      exportToExcel(assumptions, modelResults, assumptions?.dealInfo?.dealName);
      return;
    }
    try {
      const holdYears = assumptions?.holdPeriod ?? 5;
      const response = await fetch(
        `/api/v1/deals/${resolvedDealId}/financials/export?hold=${holdYears}`,
        { method: 'GET', credentials: 'include' },
      );
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${assumptions?.dealInfo?.dealName ?? 'deal'}_f9_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      exportToExcel(assumptions, modelResults, assumptions?.dealInfo?.dealName);
    }
  }, [resolvedDealId, assumptions, modelResults]);

  const handleAssumptionsChange = useCallback((partial: Partial<ModelAssumptions>) => {
    setAssumptions(prev => prev ? { ...prev, ...partial } : null);
  }, []);

  useEffect(() => {
    if (opusScrollRef.current) {
      opusScrollRef.current.scrollTop = opusScrollRef.current.scrollHeight;
    }
  }, [opusMessages]);

  const handleOpusSend = useCallback(async () => {
    if (!opusInput.trim() || opusSending) return;
    const text = opusInput.trim();
    setOpusInput('');
    setOpusMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }]);
    setOpusSending(true);
    setOpusExpanded(true);

    const context = {
      dealId: resolvedDealId,
      dealType: resolvedDealType,
      hasModel: !!modelResults,
      kpi: kpi ? { irr: kpi.irr, em: kpi.equityMultiple, coc: kpi.cashOnCash, noi: kpi.noi, dscr: kpi.dscr } : null,
      assumptions: assumptions ? {
        purchasePrice: assumptions.purchasePrice,
        units: assumptions.units,
        exitCapRate: assumptions.exitCapRate,
        holdPeriod: assumptions.holdPeriod,
        loanType: assumptions.loanType,
        ltv: assumptions.ltv,
        interestRate: assumptions.interestRate,
      } : null,
    };

    try {
      const res = await apiClient.post('/api/v1/agents/chat', {
        agentCode: 'OPUS',
        message: text,
        dealId: resolvedDealId,
        context: { module: 'financial-engine', ...context },
      });
      const reply = (res as any)?.data?.data?.message || (res as any)?.data?.message || 'Model updated.';
      setOpusMessages(prev => [...prev, { role: 'opus', text: reply, ts: Date.now() }]);

      const actions = (res as any)?.data?.data?.actions || [];
      for (const action of actions) {
        if (action.type === 'update_assumptions' && action.payload) {
          setAssumptions(prev => prev ? { ...prev, ...action.payload } : null);
        }
        if (action.type === 'build_model') {
          handleBuildModel();
        }
        if (action.type === 'switch_tab' && typeof action.payload?.tab === 'number') {
          setActiveTab(action.payload.tab);
        }
      }
    } catch (err: any) {
      setOpusMessages(prev => [...prev, { role: 'opus', text: `Error: ${err?.message || 'Failed to reach Opus'}`, ts: Date.now() }]);
    } finally {
      setOpusSending(false);
    }
  }, [opusInput, opusSending, resolvedDealId, resolvedDealType, modelResults, kpi, assumptions, handleBuildModel]);

  const OPUS_QUICK_PROMPTS = [
    'Build the model',
    'What IRR do I need to hit 2.0x?',
    'Run sensitivity on cap rate',
    'Increase rent growth to 4%',
    'Show debt structure',
    'Compare to market comps',
  ];

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
    onIntegrityChange: setIntegrityBlocked,
    f9Financials,
    onTabChange: setActiveTab,
    onF9Refresh: fetchF9Financials,
    onHoldChange: handleHoldChange,
  }), [resolvedDealId, propDeal, resolvedDealType, assumptions, modelResults, handleAssumptionsChange, handleBuildModel, building, versions, activeVersion, f9Financials, fetchF9Financials, handleHoldChange]);

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
            { label: 'DSCR', value: kpi?.dscr != null ? `${Number(kpi.dscr).toFixed(2)}×` : '—', color: BT.text.green },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>{m.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {evidenceSummary && (
        <F9SummaryBar
          collision_summary={evidenceSummary.collision_summary}
          confidence_distribution={evidenceSummary.confidence_distribution}
          tier_distribution={evidenceSummary.tier_distribution}
          onFilterChange={setEvidenceFilter}
          activeFilter={evidenceFilter}
        />
      )}

      <SubTabBar
        tabs={TAB_LABELS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.met.financial}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── OPUS CHAT PANEL (LEFT) ── */}
        <div style={{
          width: opusExpanded ? 320 : 42,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: BT.bg.panel,
          borderRight: `1px solid ${BT.border.medium}`,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: opusExpanded ? '8px 10px' : '8px 0',
            justifyContent: opusExpanded ? 'flex-start' : 'center',
            borderBottom: `1px solid ${BT.border.subtle}`,
            flexShrink: 0, cursor: 'pointer',
          }} onClick={() => setOpusExpanded(!opusExpanded)}>
            <Brain size={16} color="#8B5CF6" />
            {opusExpanded && (
              <>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6', letterSpacing: 0.8, fontFamily: MONO }}>OPUS</span>
                <Bd c="#8B5CF6">ENGINE CTRL</Bd>
                <div style={{ flex: 1 }} />
                <ChevronDown size={12} color={BT.text.muted} style={{ transform: opusExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
              </>
            )}
          </div>

          {opusExpanded && (
            <>
              {/* Context badge */}
              <div style={{
                padding: '6px 10px', borderBottom: `1px solid ${BT.border.subtle}`,
                display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0,
              }}>
                <Bd c={BT.met.financial}>{resolvedDealType.toUpperCase()}</Bd>
                {kpi ? <Bd c={BT.text.green}>MODEL LIVE</Bd> : <Bd c={BT.text.muted}>NO MODEL</Bd>}
                {kpi?.irr != null && <Bd c={BT.met.financial}>IRR {fmtPct(kpi.irr)}</Bd>}
                {kpi?.dscr != null && <Bd c={BT.text.cyan}>DSCR {Number(kpi.dscr).toFixed(2)}×</Bd>}
              </div>

              {/* Quick prompts */}
              {opusMessages.length === 0 && (
                <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 6, fontFamily: MONO, letterSpacing: 0.5 }}>QUICK COMMANDS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {OPUS_QUICK_PROMPTS.map((p, i) => (
                      <button key={i} onClick={() => { setOpusInput(p); opusInputRef.current?.focus(); }} style={{
                        textAlign: 'left', background: BT.bg.panelAlt || '#0D1117', border: `1px solid ${BT.border.subtle}`,
                        color: BT.text.secondary, fontFamily: MONO, fontSize: 9, padding: '4px 8px',
                        cursor: 'pointer', borderRadius: 3, lineHeight: 1.3,
                      }}>{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              <div ref={opusScrollRef} style={{
                flex: 1, overflowY: 'auto', padding: '8px 0',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                {opusMessages.length === 0 && (
                  <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                    <Brain size={24} color="#8B5CF640" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, lineHeight: 1.5 }}>
                      Opus controls the Financial Engine.<br />
                      Ask questions, adjust assumptions,<br />
                      or run analysis commands.
                    </div>
                  </div>
                )}
                {opusMessages.map((msg, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    borderLeft: msg.role === 'opus' ? '2px solid #8B5CF6' : '2px solid ' + BT.text.amber,
                    marginLeft: msg.role === 'user' ? 20 : 0,
                    marginRight: msg.role === 'opus' ? 10 : 0,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: msg.role === 'opus' ? '#8B5CF6' : BT.text.amber, fontFamily: MONO, marginBottom: 2 }}>
                      {msg.role === 'opus' ? 'OPUS' : 'YOU'}
                    </div>
                    <div style={{ fontSize: 10, color: BT.text.primary, fontFamily: MONO, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {opusSending && (
                  <div style={{ padding: '6px 10px', borderLeft: '2px solid #8B5CF6' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', fontFamily: MONO }}>OPUS</div>
                    <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, animation: 'pulse 1.5s infinite' }}>Analyzing...</div>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div style={{
                padding: '8px 10px', borderTop: `1px solid ${BT.border.medium}`,
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                background: BT.bg.header,
              }}>
                <span style={{ color: '#8B5CF6', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{'>'}</span>
                <input
                  ref={opusInputRef}
                  value={opusInput}
                  onChange={e => setOpusInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleOpusSend(); }}
                  placeholder="Ask Opus..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: MONO, fontSize: 10, color: BT.text.primary, minWidth: 0,
                  }}
                />
                <button
                  onClick={handleOpusSend}
                  disabled={opusSending || !opusInput.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, flexShrink: 0,
                    background: opusInput.trim() ? '#8B5CF6' : 'transparent',
                    color: opusInput.trim() ? '#fff' : BT.text.muted,
                    border: opusInput.trim() ? 'none' : `1px solid ${BT.border.subtle}`,
                    borderRadius: 3, cursor: opusInput.trim() ? 'pointer' : 'default',
                  }}
                >
                  <Send size={11} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── TAB CONTENT (RIGHT) ── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {activeTab === 0  && <BtTabWrapper><OverviewTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 1  && <BtTabWrapper><ProFormaSummaryTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 2  && (
            <BtTabWrapper><ProjectionsTab {...tabProps} integrityWarning={integrityBlocked} /></BtTabWrapper>
          )}
          {activeTab === 3  && <BtTabWrapper><AssumptionsTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 4  && <BtTabWrapper><TaxesTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 5  && <BtTabWrapper><SourcesUsesTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 6  && <BtTabWrapper><DebtTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 7  && <BtTabWrapper><WaterfallTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 8  && <BtTabWrapper><SensitivityTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 9  && <BtTabWrapper><DecisionTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 10 && <BtTabWrapper><CompareTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 11 && <BtTabWrapper><ReturnsTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 12 && (
            <div style={{ height: '100%', overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column' }}>
              <CostSheetTab
                dealId={tabProps.dealId}
                deal={tabProps.deal as Record<string, any> | undefined}
                assumptions={tabProps.assumptions as Record<string, any> | null | undefined}
                f9Financials={tabProps.f9Financials}
              />
            </div>
          )}
          {activeTab === 13 && (
            <BtTabWrapper>
              <UnderwritingWalkthrough dealId={resolvedDealId} />
            </BtTabWrapper>
          )}
        </div>
      </div>

      {/* ── EVIDENCE PANEL OVERLAY ──────────────────────────────────────────── */}
      {evidenceField && (
        <EvidencePanel
          dealId={resolvedDealId}
          fieldPath={evidenceField.path}
          fieldLabel={evidenceField.label}
          onClose={() => setEvidenceField(null)}
          onOverride={(fieldPath, value, reason) => {
            console.log('[EvidencePanel] override', fieldPath, value, reason);
            setEvidenceField(null);
          }}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

export default FinancialEnginePage;
