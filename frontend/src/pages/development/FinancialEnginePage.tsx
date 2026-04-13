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
import { SensitivityTab } from './financial-engine/SensitivityTab';
import { DecisionTab } from './financial-engine/DecisionTab';
import { CompareTab } from './financial-engine/CompareTab';
import { exportToExcel } from './financial-engine/excel-export';
import type { ModelAssumptions, ModelResults, ModelVersion, DealType, F9DealFinancials } from './financial-engine/types';
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
  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient.get<{ success: boolean; data: F9DealFinancials }>(
      `/api/v1/deals/${resolvedDealId}/financials?hold=5`,
    ).then(res => {
      if (res.data?.data) setF9Financials(res.data.data);
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
  }), [resolvedDealId, propDeal, resolvedDealType, assumptions, modelResults, handleAssumptionsChange, handleBuildModel, building, versions, activeVersion, f9Financials]);

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
          {activeTab === 0 && <BtTabWrapper><OverviewTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 1 && <BtTabWrapper><ProFormaSummaryTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 2 && integrityBlocked ? (
            <BtTabWrapper>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 32 }}>
                <div style={{ background: '#1c0a0a', border: '1px solid #ef4444', borderLeft: '4px solid #ef4444', padding: '12px 16px', borderRadius: 2, maxWidth: 520 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: 0.5, marginBottom: 6 }}>
                    ⛔ PROJECTIONS BLOCKED — INTEGRITY ERROR
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#fca5a5', lineHeight: 1.5 }}>
                    The Pro Forma tab has unresolved integrity errors. Review and correct the flagged fields before running projections.
                  </div>
                  <button
                    onClick={() => setActiveTab(1)}
                    style={{ marginTop: 8, background: 'none', border: '1px solid #ef4444', color: '#ef4444', fontFamily: MONO, fontSize: 9, padding: '3px 8px', cursor: 'pointer', borderRadius: 2 }}
                  >
                    GO TO PRO FORMA →
                  </button>
                </div>
              </div>
            </BtTabWrapper>
          ) : activeTab === 2 ? (
            <BtTabWrapper><ProjectionsTab {...tabProps} /></BtTabWrapper>
          ) : null}
          {activeTab === 3 && <BtTabWrapper><AssumptionsTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 4 && <BtTabWrapper><DebtTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 5 && <BtTabWrapper><WaterfallTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 6 && <BtTabWrapper><SensitivityTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 7 && <BtTabWrapper><DecisionTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 8 && <BtTabWrapper><CompareTab {...tabProps} /></BtTabWrapper>}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

export default FinancialEnginePage;
