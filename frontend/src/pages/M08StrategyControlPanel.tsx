/**
 * M08 Strategy Control Panel
 * Create, edit, clone, and delete M08 arbitrage strategies.
 * 5-tab editor: Weights · Gates · Financial · Location · Execution
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Gate {
  metric: string;
  operator?: string;
  value?: any;
  threshold?: number;
  hard: boolean;
  penalty?: number;
}

interface M08Strategy {
  id: string;
  name: string;
  description?: string;
  is_system_template: boolean;
  is_active: boolean;
  signal_weights: Record<string, number>;
  property_gates: Gate[];
  risk_gates: Gate[];
  execution_profile: {
    hold_period_years?: number;
    exit_strategy?: string;
    target_irr?: number;
    capital_recycling?: boolean;
    stabilization_months?: number;
  };
  financial_criteria?: {
    min_irr?: number;
    min_coc?: number;
    min_equity_multiple?: number;
    max_payback_years?: number;
    min_dscr?: number;
    max_ltv?: number;
    min_yield_on_cost?: number;
  };
  location_weights?: Record<string, { weight: number; radius_miles: number }>;
  sort_order: number;
  version: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNALS = [
  { key: 'supply_pressure',  label: 'Supply Pressure', invert: true },
  { key: 'demand_growth',    label: 'Demand Growth',   invert: false },
  { key: 'rent_momentum',    label: 'Rent Momentum',   invert: false },
  { key: 'job_growth',       label: 'Job Growth',      invert: false },
  { key: 'cap_rate_spread',  label: 'Cap Rate Spread', invert: false },
  { key: 'irr_potential',    label: 'IRR Potential',   invert: false },
  { key: 'risk_score',       label: 'Risk (penalty)',  invert: true },
];

const EXIT_STRATEGIES = ['sale', 'hold', 'hold_or_sell', 'refi', 'refi_or_sell', 'hold_indefinitely', '1031'];

const GATE_FIELDS = [
  { key: 'product_type',        label: 'Product Type',       type: 'enum',   options: ['MULTIFAMILY','STR','OFFICE','RETAIL','MIXED'] },
  { key: 'unit_count',          label: 'Unit Count',         type: 'number' },
  { key: 'year_built',          label: 'Year Built',         type: 'number' },
  { key: 'zoning_utilization',  label: 'Zoning Utilization', type: 'number' },
  { key: 'str_regulations',     label: 'STR Regulations',    type: 'enum',   options: ['permitted','restricted','banned'] },
  { key: 'occupancy_rate',      label: 'Occupancy Rate (%)', type: 'number' },
  { key: 'cap_rate',            label: 'Cap Rate (%)',        type: 'number' },
  { key: 'irr',                 label: 'IRR (%)',             type: 'number' },
  { key: 'lot_size_sf',         label: 'Lot Size (SF)',       type: 'number' },
];

const NUM_OPERATORS  = ['>=','<=','==','>','<','between'];
const ENUM_OPERATORS = ['in','not_in','=='];

const AMENITY_WEIGHTS = [
  { key: 'employment_centers', label: 'Employment Centers' },
  { key: 'transit_access',     label: 'Transit Access' },
  { key: 'schools',            label: 'Schools' },
  { key: 'retail_amenities',   label: 'Retail / Dining' },
  { key: 'parks',              label: 'Parks & Recreation' },
  { key: 'hospitals',          label: 'Hospitals / Medical' },
  { key: 'universities',       label: 'Universities' },
  { key: 'highway_access',     label: 'Highway Access' },
];

const SYSTEM_TEMPLATES = [
  { name: 'Growth Market BTS', description: 'Prioritize demand + supply constraint for build-to-suit', weights: { supply_pressure: 0.20, demand_growth: 0.25, rent_momentum: 0.20, job_growth: 0.20, cap_rate_spread: 0.10, irr_potential: 0.10, risk_score: -0.05 } },
  { name: 'Value-Add Flip',    description: 'Cap rate spread + IRR momentum; tolerates supply',       weights: { supply_pressure: 0.05, demand_growth: 0.15, rent_momentum: 0.20, job_growth: 0.10, cap_rate_spread: 0.25, irr_potential: 0.25, risk_score: -0.05 } },
  { name: 'STR Arbitrage',     description: 'Demand growth + rent momentum in tourist corridors',     weights: { supply_pressure: 0.10, demand_growth: 0.30, rent_momentum: 0.30, job_growth: 0.10, cap_rate_spread: 0.10, irr_potential: 0.15, risk_score: -0.05 } },
  { name: 'Yield & Hold',      description: 'Stable income: low risk, high occupancy markets',        weights: { supply_pressure: 0.15, demand_growth: 0.15, rent_momentum: 0.15, job_growth: 0.10, cap_rate_spread: 0.20, irr_potential: 0.20, risk_score: -0.15 } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  const positiveSum = entries.filter(([, v]) => v > 0).reduce((a, [, v]) => a + v, 0);
  if (positiveSum === 0) return weights;
  const result: Record<string, number> = {};
  for (const [k, v] of entries) {
    result[k] = v > 0 ? Math.round((v / positiveSum) * 1000) / 1000 : v;
  }
  return result;
}

function autoNormalize(weights: Record<string, number>, changedKey: string, newVal: number): Record<string, number> {
  const next = { ...weights, [changedKey]: newVal };
  const posKeys = Object.keys(next).filter(k => k !== changedKey && next[k] > 0);
  const othersSum = posKeys.reduce((a, k) => a + next[k], 0);
  const remaining = 1 - Math.abs(newVal) - Math.abs(weights.risk_score ?? 0) * (changedKey !== 'risk_score' ? 1 : 0);
  if (posKeys.length > 0 && othersSum > 0 && remaining > 0) {
    const scale = remaining / othersSum;
    for (const k of posKeys) {
      next[k] = Math.round(next[k] * scale * 1000) / 1000;
    }
  }
  return next;
}

function defaultWeights(): Record<string, number> {
  return { supply_pressure: 0.10, demand_growth: 0.20, rent_momentum: 0.20, job_growth: 0.15, cap_rate_spread: 0.15, irr_potential: 0.15, risk_score: -0.05 };
}

function defaultLocationWeights(): Record<string, { weight: number; radius_miles: number }> {
  return Object.fromEntries(AMENITY_WEIGHTS.map(a => [a.key, { weight: 0.5, radius_miles: 1.0 }]));
}

function defaultFinancial() {
  return { min_irr: 12, min_coc: 8, min_equity_multiple: 1.5, max_payback_years: 8, min_dscr: 1.25, max_ltv: 75, min_yield_on_cost: 5 };
}

// ─── Radar Chart (CSS-based) ──────────────────────────────────────────────────

function RadarChart({ weights }: { weights: Record<string, number> }) {
  const keys = SIGNALS.filter(s => !s.invert).slice(0, 5).map(s => s.key);
  const size = 80;
  const cx = size / 2, cy = size / 2, r = 30;
  const n = keys.length;
  const points = keys.map((k, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const val = Math.abs(weights[k] ?? 0) * 5;
    return { x: cx + Math.cos(angle) * r * val, y: cy + Math.sin(angle) * r * val };
  });
  const polyPoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const gridPoints = keys.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  }).join(' ');
  const axisLines = keys.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `M ${cx} ${cy} L ${cx + Math.cos(angle) * r} ${cy + Math.sin(angle) * r}`;
  }).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={gridPoints} fill="none" stroke="#1e2a3d" strokeWidth="1" />
      <path d={axisLines} stroke="#1e2a3d" strokeWidth="0.5" fill="none" />
      <polygon points={polyPoints} fill="#F5A623" fillOpacity="0.2" stroke="#F5A623" strokeWidth="1.2" />
    </svg>
  );
}

// ─── Mini weight bar visualization ────────────────────────────────────────────

function WeightMiniBar({ weights }: { weights: Record<string, number> }) {
  const total = Object.values(weights).filter(v => v > 0).reduce((a, v) => a + v, 0) || 1;
  const colors = ['#F5A623','#00D26A','#00BCD4','#A78BFA','#FF8C42','#FF4757'];
  const posEntries = SIGNALS.filter(s => !s.invert && (weights[s.key] ?? 0) > 0);
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', width: '100%' }}>
      {posEntries.map((s, i) => (
        <div key={s.key} style={{ flex: (weights[s.key] ?? 0) / total, background: colors[i % colors.length] }} />
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type EditorTab = 'weights' | 'gates' | 'financial' | 'location' | 'execution';

export const M08StrategyControlPanel: React.FC = () => {
  const navigate = useNavigate();

  // List state
  const [strategies, setStrategies] = useState<M08Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<M08Strategy | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);

  // Editor state
  const [activeTab, setActiveTab] = useState<EditorTab>('weights');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editWeights, setEditWeights] = useState<Record<string, number>>(defaultWeights());
  const [editGates, setEditGates] = useState<Gate[]>([]);
  const [editFinancial, setEditFinancial] = useState(defaultFinancial());
  const [editLocation, setEditLocation] = useState(defaultLocationWeights());
  const [editHoldYears, setEditHoldYears] = useState(5);
  const [editExitStrategy, setEditExitStrategy] = useState('sale');
  const [editTargetIrr, setEditTargetIrr] = useState(15);
  const [editCapitalRecycling, setEditCapitalRecycling] = useState(false);
  const [editStabilizationMonths, setEditStabilizationMonths] = useState(12);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchStrategies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/v1/strategies');
      if (res.data?.strategies) setStrategies(res.data.strategies);
      else if (Array.isArray(res.data)) setStrategies(res.data);
    } catch {
      setStrategies([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStrategies(); }, [fetchStrategies]);

  const populateEditor = (s: M08Strategy) => {
    setSelected(s);
    setEditName(s.name);
    setEditDesc(s.description ?? '');
    setEditWeights(s.signal_weights ?? defaultWeights());
    setEditGates([...(s.property_gates ?? []), ...(s.risk_gates ?? [])]);
    setEditFinancial({ ...defaultFinancial(), ...(s.financial_criteria ?? {}) });
    setEditLocation(s.location_weights ?? defaultLocationWeights());
    setEditHoldYears(s.execution_profile?.hold_period_years ?? 5);
    setEditExitStrategy(s.execution_profile?.exit_strategy ?? 'sale');
    setEditTargetIrr(s.execution_profile?.target_irr ?? 15);
    setEditCapitalRecycling(s.execution_profile?.capital_recycling ?? false);
    setEditStabilizationMonths(s.execution_profile?.stabilization_months ?? 12);
    setActiveTab('weights');
  };

  const handleNew = () => {
    setIsCreating(true);
    setSelected(null);
    setEditName('');
    setEditDesc('');
    setEditWeights(defaultWeights());
    setEditGates([]);
    setEditFinancial(defaultFinancial());
    setEditLocation(defaultLocationWeights());
    setEditHoldYears(5);
    setEditExitStrategy('sale');
    setEditTargetIrr(15);
    setEditCapitalRecycling(false);
    setEditStabilizationMonths(12);
    setActiveTab('weights');
    setSaveMsg(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const payload = {
        name: editName.trim(),
        description: editDesc.trim(),
        signal_weights: editWeights,
        property_gates: editGates.filter(g => g.metric),
        risk_gates: [],
        financial_criteria: editFinancial,
        location_weights: editLocation,
        execution_profile: {
          hold_period_years: editHoldYears,
          exit_strategy: editExitStrategy,
          target_irr: editTargetIrr,
          capital_recycling: editCapitalRecycling,
          stabilization_months: editStabilizationMonths,
        },
      };

      if (isCreating) {
        const res = await apiClient.post('/api/v1/strategies', payload);
        if (res.data?.success) {
          setIsCreating(false);
          await fetchStrategies();
          if (res.data.strategy) populateEditor(res.data.strategy);
          setSaveMsg({ type: 'ok', text: 'Strategy created' });
        }
      } else if (selected && !selected.is_system_template) {
        const res = await apiClient.put(`/api/v1/strategies/${selected.id}`, payload);
        if (res.data?.success) {
          await fetchStrategies();
          if (res.data.strategy) populateEditor(res.data.strategy);
          setSaveMsg({ type: 'ok', text: 'Saved' });
        }
      }
    } catch (e: any) {
      setSaveMsg({ type: 'err', text: e?.response?.data?.error || 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClone = async () => {
    if (!selected) return;
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await apiClient.post(`/api/v1/strategies/${selected.id}/clone`);
      if (res.data?.success) {
        await fetchStrategies();
        if (res.data.strategy) populateEditor(res.data.strategy);
        setIsCreating(false);
        setSaveMsg({ type: 'ok', text: 'Cloned' });
      }
    } catch (e: any) {
      setSaveMsg({ type: 'err', text: e?.response?.data?.error || 'Clone failed' });
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected || selected.is_system_template) return;
    if (!window.confirm(`Delete "${selected.name}"?`)) return;
    setIsSaving(true);
    try {
      await apiClient.delete(`/api/v1/strategies/${selected.id}`);
      await fetchStrategies();
      setSelected(null);
      setIsCreating(false);
      setSaveMsg({ type: 'ok', text: 'Deleted' });
    } catch (e: any) {
      setSaveMsg({ type: 'err', text: e?.response?.data?.error || 'Delete failed' });
    } finally { setIsSaving(false); }
  };

  const handleCloneTemplate = async (tpl: typeof SYSTEM_TEMPLATES[0]) => {
    setShowTemplateGallery(false);
    setIsCreating(true);
    setSelected(null);
    setEditName(`${tpl.name} (copy)`);
    setEditDesc(tpl.description);
    setEditWeights({ ...tpl.weights });
    setEditGates([]);
    setEditFinancial(defaultFinancial());
    setEditLocation(defaultLocationWeights());
    setEditHoldYears(5);
    setEditExitStrategy('sale');
    setEditTargetIrr(15);
    setEditCapitalRecycling(false);
    setEditStabilizationMonths(12);
    setActiveTab('weights');
    setSaveMsg(null);
  };

  const handleWeightChange = (key: string, raw: number, invert: boolean) => {
    const newVal = invert ? -raw : raw;
    const next = autoNormalize(editWeights, key, newVal);
    setEditWeights(next);
  };

  const weightSum = Object.values(editWeights).reduce((a, v) => a + Math.abs(v), 0);
  const isReadOnly = !isCreating && (selected?.is_system_template ?? true);

  const TABS: { id: EditorTab; label: string }[] = [
    { id: 'weights',   label: 'WEIGHTS' },
    { id: 'gates',     label: 'GATES' },
    { id: 'financial', label: 'FINANCIAL' },
    { id: 'location',  label: 'LOCATION' },
    { id: 'execution', label: 'EXECUTION' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#c8cdd4]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <div className="border-b border-[#1a2233] px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-[10px] text-[#7f8ea3] hover:text-[#F5A623] transition">
          ← BACK
        </button>
        <span className="text-xs font-bold text-[#F5A623]">M08 STRATEGY CONTROL PANEL</span>
        <span className="text-[10px] text-[#4a5568]">ARBITRAGE ENGINE</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowTemplateGallery(true)}
          className="text-[10px] border border-[#A78BFA]/40 text-[#A78BFA] px-3 py-1 rounded hover:bg-[#A78BFA]/10 transition"
        >
          BROWSE TEMPLATES
        </button>
        <button
          onClick={handleNew}
          className="text-[10px] border border-[#F5A623]/40 text-[#F5A623] px-3 py-1 rounded hover:bg-[#F5A623]/10 transition"
        >
          + NEW STRATEGY
        </button>
      </div>

      <div className="flex h-[calc(100vh-49px)]">
        {/* Left: Strategy List */}
        <div className="w-64 border-r border-[#1a2233] flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-[#1a2233]">
            <span className="text-[10px] text-[#7f8ea3]">STRATEGIES ({strategies.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-4 h-4 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              strategies.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setIsCreating(false); populateEditor(s); setSaveMsg(null); }}
                  className={`px-4 py-3 cursor-pointer border-l-2 transition-all ${
                    selected?.id === s.id && !isCreating
                      ? 'border-[#F5A623] bg-[#F5A623]/5'
                      : 'border-transparent hover:border-[#1e2a3d] hover:bg-[#0d1424]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {s.is_system_template && (
                      <span className="text-[9px] text-[#7f8ea3] border border-[#1e2a3d] px-1 rounded">SYS</span>
                    )}
                    <span className={`text-xs font-medium ${selected?.id === s.id && !isCreating ? 'text-[#F5A623]' : 'text-[#c8cdd4]'}`}>
                      {s.name}
                    </span>
                  </div>
                  {s.signal_weights && (
                    <div className="mt-1">
                      <WeightMiniBar weights={s.signal_weights} />
                    </div>
                  )}
                  {s.description && (
                    <p className="text-[10px] text-[#4a5568] line-clamp-1 mt-1">{s.description}</p>
                  )}
                </div>
              ))
            )}
            {isCreating && (
              <div className="px-4 py-3 border-l-2 border-[#27ae60] bg-[#27ae60]/5">
                <span className="text-xs text-[#27ae60]">NEW STRATEGY *</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor */}
        <div className="flex-1 overflow-y-auto">
          {!selected && !isCreating ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-xs text-[#4a5568] mb-2">SELECT A STRATEGY OR CREATE NEW</p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setShowTemplateGallery(true)}
                  className="text-[10px] border border-[#A78BFA]/40 text-[#A78BFA] px-4 py-2 rounded hover:bg-[#A78BFA]/10 transition"
                >
                  BROWSE TEMPLATES
                </button>
                <button
                  onClick={handleNew}
                  className="text-[10px] border border-[#F5A623]/40 text-[#F5A623] px-4 py-2 rounded hover:bg-[#F5A623]/10 transition"
                >
                  + NEW STRATEGY
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-8 py-6 space-y-5">
              {/* Meta */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {selected?.is_system_template && (
                    <span className="text-[9px] bg-[#1a2233] text-[#7f8ea3] px-2 py-0.5 rounded border border-[#1e2a3d]">
                      SYSTEM TEMPLATE (READ-ONLY)
                    </span>
                  )}
                  {isCreating && (
                    <span className="text-[9px] bg-[#27ae60]/10 text-[#27ae60] px-2 py-0.5 rounded border border-[#27ae60]/30">
                      NEW STRATEGY
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-[#7f8ea3] block mb-1">NAME</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full bg-[#0d1424] border border-[#1a2233] rounded px-3 py-2 text-sm text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50"
                    placeholder="Strategy name..."
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#7f8ea3] block mb-1">DESCRIPTION</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    disabled={isReadOnly}
                    rows={2}
                    className="w-full bg-[#0d1424] border border-[#1a2233] rounded px-3 py-2 text-xs text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50 resize-none"
                    placeholder="Brief description..."
                  />
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-[#1a2233]">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`text-[10px] px-4 py-2 border-b-2 transition font-medium ${
                      activeTab === t.id
                        ? 'border-[#F5A623] text-[#F5A623]'
                        : 'border-transparent text-[#7f8ea3] hover:text-[#c8cdd4]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── WEIGHTS TAB ── */}
              {activeTab === 'weights' && (
                <WeightsTab
                  weights={editWeights}
                  onChange={(key, raw, invert) => handleWeightChange(key, raw, invert)}
                  onNormalize={() => setEditWeights(normalizeWeights(editWeights))}
                  weightSum={weightSum}
                  isReadOnly={isReadOnly}
                />
              )}

              {/* ── GATES TAB ── */}
              {activeTab === 'gates' && (
                <GatesTab
                  gates={editGates}
                  onChange={setEditGates}
                  isReadOnly={isReadOnly}
                />
              )}

              {/* ── FINANCIAL TAB ── */}
              {activeTab === 'financial' && (
                <FinancialTab
                  values={editFinancial}
                  onChange={setEditFinancial}
                  isReadOnly={isReadOnly}
                />
              )}

              {/* ── LOCATION TAB ── */}
              {activeTab === 'location' && (
                <LocationTab
                  values={editLocation}
                  onChange={setEditLocation}
                  isReadOnly={isReadOnly}
                />
              )}

              {/* ── EXECUTION TAB ── */}
              {activeTab === 'execution' && (
                <ExecutionTab
                  holdYears={editHoldYears}
                  exitStrategy={editExitStrategy}
                  targetIrr={editTargetIrr}
                  capitalRecycling={editCapitalRecycling}
                  stabilizationMonths={editStabilizationMonths}
                  onHoldYears={setEditHoldYears}
                  onExitStrategy={setEditExitStrategy}
                  onTargetIrr={setEditTargetIrr}
                  onCapitalRecycling={setEditCapitalRecycling}
                  onStabilizationMonths={setEditStabilizationMonths}
                  isReadOnly={isReadOnly}
                />
              )}

              {/* Save message */}
              {saveMsg && (
                <div className={`text-xs px-3 py-2 rounded border ${
                  saveMsg.type === 'ok'
                    ? 'text-[#27ae60] border-[#27ae60]/30 bg-[#27ae60]/5'
                    : 'text-[#e74c3c] border-[#e74c3c]/30 bg-[#e74c3c]/5'
                }`}>
                  {saveMsg.text}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pb-6">
                {!isReadOnly && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !editName.trim()}
                    className="text-xs px-4 py-2 bg-[#F5A623] text-[#0A0E17] font-bold rounded hover:bg-[#F5A623]/90 transition disabled:opacity-50"
                  >
                    {isSaving ? 'SAVING...' : isCreating ? 'CREATE' : 'SAVE'}
                  </button>
                )}
                {selected && (
                  <button
                    onClick={handleClone}
                    disabled={isSaving}
                    className="text-xs px-4 py-2 border border-[#F5A623]/40 text-[#F5A623] rounded hover:bg-[#F5A623]/10 transition disabled:opacity-50"
                  >
                    CLONE
                  </button>
                )}
                {selected && selected.is_system_template && (
                  <button
                    onClick={handleClone}
                    disabled={isSaving}
                    className="text-xs px-4 py-2 border border-[#A78BFA]/40 text-[#A78BFA] rounded hover:bg-[#A78BFA]/10 transition disabled:opacity-50"
                  >
                    CLONE TO EDIT
                  </button>
                )}
                {selected && !selected.is_system_template && (
                  <button
                    onClick={handleDelete}
                    disabled={isSaving}
                    className="text-xs px-4 py-2 border border-[#e74c3c]/40 text-[#e74c3c] rounded hover:bg-[#e74c3c]/10 transition disabled:opacity-50 ml-auto"
                  >
                    DELETE
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Gallery Modal */}
      {showTemplateGallery && (
        <TemplateGallery
          templates={SYSTEM_TEMPLATES}
          onClone={handleCloneTemplate}
          onClose={() => setShowTemplateGallery(false)}
        />
      )}
    </div>
  );
};

// ─── WEIGHTS TAB ─────────────────────────────────────────────────────────────

function WeightsTab({ weights, onChange, onNormalize, weightSum, isReadOnly }: {
  weights: Record<string, number>;
  onChange: (key: string, raw: number, invert: boolean) => void;
  onNormalize: () => void;
  weightSum: number;
  isReadOnly: boolean;
}) {
  const normalizedPct = (weightSum * 100).toFixed(0);
  const isNorm = Math.abs(weightSum - 1) < 0.05;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#7f8ea3]">SIGNAL WEIGHTS · Auto-normalizes to 100%</span>
        <span className={`text-[10px] ${isNorm ? 'text-[#27ae60]' : 'text-[#e74c3c]'}`}>
          SUM: {normalizedPct}%{isNorm ? ' ✓' : ''}
        </span>
      </div>
      <div className="space-y-3 bg-[#0d1424] rounded border border-[#1a2233] p-4">
        {SIGNALS.map(sig => {
          const raw = Math.abs(weights[sig.key] ?? 0);
          return (
            <div key={sig.key} className="flex items-center gap-3">
              <span className="text-[10px] text-[#7f8ea3] w-36 flex-shrink-0">
                {sig.label.toUpperCase()}
                {sig.invert && <span className="text-[#e74c3c] ml-1">(-)</span>}
              </span>
              <div className="flex-1 relative">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={Math.round(raw * 100)}
                  onChange={e => onChange(sig.key, parseInt(e.target.value) / 100, sig.invert)}
                  disabled={isReadOnly}
                  className="w-full h-1 rounded appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(to right, ${sig.invert ? '#e74c3c' : '#F5A623'} ${Math.min(100, raw * 250)}%, #1a2233 ${Math.min(100, raw * 250)}%)`,
                  }}
                />
              </div>
              <span className="text-[10px] text-[#c8cdd4] w-10 text-right flex-shrink-0">
                {sig.invert ? '-' : ''}{(raw * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
        {!isReadOnly && !isNorm && (
          <button
            onClick={onNormalize}
            className="text-[10px] text-[#F5A623] border border-[#F5A623]/30 px-3 py-1 rounded hover:bg-[#F5A623]/10 transition mt-2"
          >
            NORMALIZE TO 100%
          </button>
        )}
      </div>
      {/* Weight bar preview */}
      <div className="bg-[#0d1424] rounded border border-[#1a2233] p-3">
        <div className="text-[9px] text-[#4a5568] mb-2">WEIGHT DISTRIBUTION</div>
        <div className="flex h-5 rounded overflow-hidden gap-px">
          {SIGNALS.filter(s => !s.invert && (weights[s.key] ?? 0) > 0).map((sig, i) => {
            const colors = ['#F5A623','#00D26A','#00BCD4','#A78BFA','#FF8C42'];
            const posSum = SIGNALS.filter(s => !s.invert).reduce((a, s) => a + Math.abs(weights[s.key] ?? 0), 0) || 1;
            const pct = (Math.abs(weights[sig.key] ?? 0) / posSum) * 100;
            return (
              <div key={sig.key} style={{ width: `${pct}%`, background: colors[i % colors.length] }} className="relative group">
                <div className="absolute inset-0 flex items-center justify-center text-[7px] text-[#0A0E17] font-bold truncate px-0.5">
                  {pct > 8 ? `${pct.toFixed(0)}%` : ''}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {SIGNALS.filter(s => !s.invert).map((sig, i) => {
            const colors = ['#F5A623','#00D26A','#00BCD4','#A78BFA','#FF8C42'];
            return (
              <div key={sig.key} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: colors[i % colors.length] }} />
                <span className="text-[9px] text-[#7f8ea3]">{sig.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── GATES TAB ────────────────────────────────────────────────────────────────

function GatesTab({ gates, onChange, isReadOnly }: {
  gates: Gate[];
  onChange: (gates: Gate[]) => void;
  isReadOnly: boolean;
}) {
  const addGate = () => {
    onChange([...gates, { metric: '', operator: '>=', value: '', hard: true }]);
  };

  const removeGate = (i: number) => {
    onChange(gates.filter((_, idx) => idx !== i));
  };

  const updateGate = (i: number, patch: Partial<Gate>) => {
    onChange(gates.map((g, idx) => idx === i ? { ...g, ...patch } : g));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#7f8ea3]">PROPERTY GATE RULES</span>
        {!isReadOnly && (
          <button
            onClick={addGate}
            className="text-[10px] border border-[#27ae60]/40 text-[#27ae60] px-3 py-1 rounded hover:bg-[#27ae60]/10 transition"
          >
            + ADD GATE
          </button>
        )}
      </div>
      {gates.length === 0 ? (
        <div className="bg-[#0d1424] rounded border border-[#1a2233] p-6 text-center">
          <p className="text-[10px] text-[#4a5568]">No gates configured. All properties will pass.</p>
          {!isReadOnly && (
            <button onClick={addGate} className="mt-2 text-[10px] text-[#27ae60] hover:underline">+ Add first gate</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {gates.map((gate, i) => {
            const field = GATE_FIELDS.find(f => f.key === gate.metric);
            const ops = field?.type === 'enum' ? ENUM_OPERATORS : NUM_OPERATORS;
            return (
              <div key={i} className="bg-[#0d1424] rounded border border-[#1a2233] p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Hard/Soft toggle */}
                  <div className="flex rounded overflow-hidden border border-[#1e2a3d]">
                    <button
                      onClick={() => !isReadOnly && updateGate(i, { hard: true })}
                      disabled={isReadOnly}
                      className={`text-[9px] px-2 py-1 transition ${gate.hard ? 'bg-[#e74c3c] text-white' : 'text-[#7f8ea3] hover:bg-[#1a2233]'}`}
                    >
                      HARD
                    </button>
                    <button
                      onClick={() => !isReadOnly && updateGate(i, { hard: false })}
                      disabled={isReadOnly}
                      className={`text-[9px] px-2 py-1 transition ${!gate.hard ? 'bg-[#e67e22] text-white' : 'text-[#7f8ea3] hover:bg-[#1a2233]'}`}
                    >
                      SOFT
                    </button>
                  </div>
                  {/* Field selector */}
                  <select
                    value={gate.metric}
                    onChange={e => !isReadOnly && updateGate(i, { metric: e.target.value, operator: '>=', value: '' })}
                    disabled={isReadOnly}
                    className="bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1 text-xs text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Select field...</option>
                    {GATE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  {/* Operator */}
                  {gate.metric && (
                    <select
                      value={gate.operator ?? '>='}
                      onChange={e => !isReadOnly && updateGate(i, { operator: e.target.value })}
                      disabled={isReadOnly}
                      className="bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1 text-xs text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50"
                    >
                      {ops.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  )}
                  {/* Value */}
                  {gate.metric && field?.type === 'enum' ? (
                    <select
                      value={gate.value ?? ''}
                      onChange={e => !isReadOnly && updateGate(i, { value: e.target.value })}
                      disabled={isReadOnly}
                      className="bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1 text-xs text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Value...</option>
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : gate.metric ? (
                    <input
                      type={gate.operator === 'between' ? 'text' : 'number'}
                      value={gate.value ?? ''}
                      onChange={e => !isReadOnly && updateGate(i, { value: e.target.value })}
                      disabled={isReadOnly}
                      placeholder={gate.operator === 'between' ? 'min,max' : 'Value...'}
                      className="bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1 text-xs text-[#c8cdd4] w-24 focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50"
                    />
                  ) : null}
                  {!isReadOnly && (
                    <button onClick={() => removeGate(i)} className="ml-auto text-[10px] text-[#e74c3c] hover:bg-[#e74c3c]/10 px-2 py-1 rounded transition">
                      ✕
                    </button>
                  )}
                </div>
                {/* Soft gate penalty */}
                {!gate.hard && (
                  <div className="flex items-center gap-2 pl-2">
                    <span className="text-[9px] text-[#7f8ea3]">PENALTY:</span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={gate.penalty ?? 10}
                      onChange={e => !isReadOnly && updateGate(i, { penalty: parseInt(e.target.value) || 0 })}
                      disabled={isReadOnly}
                      className="bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-0.5 text-xs text-[#c8cdd4] w-16 focus:outline-none disabled:opacity-50"
                    />
                    <span className="text-[9px] text-[#4a5568]">score points deducted</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── FINANCIAL TAB ────────────────────────────────────────────────────────────

function FinancialTab({ values, onChange, isReadOnly }: {
  values: ReturnType<typeof defaultFinancial>;
  onChange: (v: ReturnType<typeof defaultFinancial>) => void;
  isReadOnly: boolean;
}) {
  const set = (key: string, val: number) => onChange({ ...values, [key]: val });
  const Row = ({ label, fieldKey, unit, min, max, step }: { label: string; fieldKey: string; unit: string; min?: number; max?: number; step?: number }) => (
    <div className="flex items-center justify-between py-2 border-b border-[#0d1424]">
      <span className="text-[10px] text-[#7f8ea3] flex-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min ?? 0}
          max={max ?? 100}
          step={step ?? 0.1}
          value={(values as any)[fieldKey]}
          onChange={e => !isReadOnly && set(fieldKey, parseFloat(e.target.value) || 0)}
          disabled={isReadOnly}
          className="bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1 text-xs text-[#c8cdd4] w-20 text-right focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50"
        />
        <span className="text-[9px] text-[#4a5568] w-8">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <span className="text-[10px] text-[#7f8ea3]">FINANCIAL CRITERIA — Minimum thresholds for deal qualification</span>
      <div className="bg-[#0d1424] rounded border border-[#1a2233] px-4 py-2">
        <Row label="Minimum IRR"              fieldKey="min_irr"               unit="%"    min={0} max={50} step={0.5} />
        <Row label="Minimum Cash-on-Cash"    fieldKey="min_coc"               unit="%"    min={0} max={30} step={0.5} />
        <Row label="Minimum Equity Multiple" fieldKey="min_equity_multiple"   unit="×"    min={1} max={5}  step={0.1} />
        <Row label="Maximum Payback Years"   fieldKey="max_payback_years"     unit="yrs"  min={1} max={20} step={1}   />
        <Row label="Minimum DSCR"            fieldKey="min_dscr"              unit="×"    min={1} max={3}  step={0.05} />
        <Row label="Maximum LTV"             fieldKey="max_ltv"               unit="%"    min={0} max={95} step={1}   />
        <Row label="Minimum Yield-on-Cost"   fieldKey="min_yield_on_cost"     unit="%"    min={0} max={20} step={0.1} />
      </div>
    </div>
  );
}

// ─── LOCATION TAB ────────────────────────────────────────────────────────────

function LocationTab({ values, onChange, isReadOnly }: {
  values: Record<string, { weight: number; radius_miles: number }>;
  onChange: (v: Record<string, { weight: number; radius_miles: number }>) => void;
  isReadOnly: boolean;
}) {
  const set = (key: string, field: 'weight' | 'radius_miles', val: number) => {
    onChange({ ...values, [key]: { ...values[key], [field]: val } });
  };

  return (
    <div className="space-y-3">
      <span className="text-[10px] text-[#7f8ea3]">LOCATION AMENITY WEIGHTS — Importance + proximity radius</span>
      <div className="bg-[#0d1424] rounded border border-[#1a2233] p-4 space-y-4">
        {AMENITY_WEIGHTS.map(a => {
          const v = values[a.key] ?? { weight: 0.5, radius_miles: 1.0 };
          const pct = v.weight * 100;
          return (
            <div key={a.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#c8cdd4]">{a.label.toUpperCase()}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-[#4a5568]">Radius:</span>
                    <input
                      type="number"
                      min={0.25}
                      max={10}
                      step={0.25}
                      value={v.radius_miles}
                      onChange={e => !isReadOnly && set(a.key, 'radius_miles', parseFloat(e.target.value) || 0.25)}
                      disabled={isReadOnly}
                      className="bg-[#0a0e17] border border-[#1a2233] rounded px-1.5 py-0.5 text-[10px] text-[#c8cdd4] w-14 focus:outline-none disabled:opacity-50"
                    />
                    <span className="text-[9px] text-[#4a5568]">mi</span>
                  </div>
                  <span className="text-[10px] text-[#F5A623] w-8 text-right">{pct.toFixed(0)}%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct}
                onChange={e => !isReadOnly && set(a.key, 'weight', parseInt(e.target.value) / 100)}
                disabled={isReadOnly}
                className="w-full h-1 rounded appearance-none cursor-pointer disabled:opacity-50"
                style={{ background: `linear-gradient(to right, #A78BFA ${pct}%, #1a2233 ${pct}%)` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── EXECUTION TAB ────────────────────────────────────────────────────────────

function ExecutionTab({ holdYears, exitStrategy, targetIrr, capitalRecycling, stabilizationMonths, onHoldYears, onExitStrategy, onTargetIrr, onCapitalRecycling, onStabilizationMonths, isReadOnly }: {
  holdYears: number;
  exitStrategy: string;
  targetIrr: number;
  capitalRecycling: boolean;
  stabilizationMonths: number;
  onHoldYears: (v: number) => void;
  onExitStrategy: (v: string) => void;
  onTargetIrr: (v: number) => void;
  onCapitalRecycling: (v: boolean) => void;
  onStabilizationMonths: (v: number) => void;
  isReadOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <span className="text-[10px] text-[#7f8ea3]">EXECUTION PROFILE</span>
      <div className="bg-[#0d1424] rounded border border-[#1a2233] p-4 space-y-4">
        {/* Hold period slider */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-[10px] text-[#7f8ea3]">HOLD PERIOD</label>
            <span className="text-[10px] text-[#F5A623]">{holdYears} years</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={holdYears}
            onChange={e => !isReadOnly && onHoldYears(parseInt(e.target.value))}
            disabled={isReadOnly}
            className="w-full h-1 rounded appearance-none cursor-pointer disabled:opacity-50"
            style={{ background: `linear-gradient(to right, #00BCD4 ${(holdYears / 20) * 100}%, #1a2233 ${(holdYears / 20) * 100}%)` }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-[#4a5568]">1yr</span>
            <span className="text-[9px] text-[#4a5568]">20yrs</span>
          </div>
        </div>

        {/* Exit strategy */}
        <div>
          <label className="text-[10px] text-[#7f8ea3] block mb-2">EXIT STRATEGY</label>
          <div className="flex flex-wrap gap-2">
            {EXIT_STRATEGIES.map(s => (
              <button
                key={s}
                onClick={() => !isReadOnly && onExitStrategy(s)}
                disabled={isReadOnly}
                className={`text-[10px] px-3 py-1 rounded border transition ${
                  exitStrategy === s
                    ? 'border-[#F5A623] text-[#F5A623] bg-[#F5A623]/10'
                    : 'border-[#1e2a3d] text-[#7f8ea3] hover:border-[#F5A623]/30'
                } disabled:opacity-50`}
              >
                {s.replace(/_/g, ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Target IRR */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-[#7f8ea3] block mb-1">TARGET IRR %</label>
            <input
              type="number"
              min={5}
              max={50}
              value={targetIrr}
              onChange={e => !isReadOnly && onTargetIrr(parseInt(e.target.value) || 10)}
              disabled={isReadOnly}
              className="w-full bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1.5 text-sm text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#7f8ea3] block mb-1">STABILIZATION (months)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={stabilizationMonths}
              onChange={e => !isReadOnly && onStabilizationMonths(parseInt(e.target.value) || 12)}
              disabled={isReadOnly}
              className="w-full bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1.5 text-sm text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Capital recycling toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#7f8ea3]">CAPITAL RECYCLING</div>
            <div className="text-[9px] text-[#4a5568]">Reinvest exit proceeds into next deal automatically</div>
          </div>
          <button
            onClick={() => !isReadOnly && onCapitalRecycling(!capitalRecycling)}
            disabled={isReadOnly}
            className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 ${
              capitalRecycling ? 'bg-[#27ae60]' : 'bg-[#1a2233]'
            }`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${capitalRecycling ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TEMPLATE GALLERY MODAL ───────────────────────────────────────────────────

function TemplateGallery({ templates, onClone, onClose }: {
  templates: typeof SYSTEM_TEMPLATES;
  onClone: (t: typeof SYSTEM_TEMPLATES[0]) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-8">
      <div className="bg-[#0d1424] border border-[#1a2233] rounded-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#1a2233] flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-[#F5A623]">STRATEGY TEMPLATE GALLERY</span>
            <span className="text-[10px] text-[#4a5568] ml-3">System templates · Read-only · Clone to customize</span>
          </div>
          <button onClick={onClose} className="text-[#7f8ea3] hover:text-[#c8cdd4] transition text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {templates.map(tpl => (
              <div key={tpl.name} className="bg-[#0A0E17] rounded border border-[#1e2a3d] p-4 flex flex-col gap-3 hover:border-[#F5A623]/30 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#c8cdd4]">{tpl.name}</div>
                    <div className="text-[10px] text-[#4a5568] mt-0.5">{tpl.description}</div>
                  </div>
                  <span className="text-[9px] text-[#7f8ea3] border border-[#1e2a3d] px-1 rounded flex-shrink-0 ml-2">SYS</span>
                </div>
                {/* Radar chart */}
                <div className="flex items-center gap-4">
                  <RadarChart weights={tpl.weights} />
                  <div className="flex-1 space-y-1">
                    {SIGNALS.filter(s => !s.invert).map(sig => (
                      <div key={sig.key} className="flex items-center gap-1">
                        <div className="flex-1 bg-[#1a2233] rounded-full h-1">
                          <div
                            className="h-1 rounded-full bg-[#F5A623]"
                            style={{ width: `${((tpl.weights as any)[sig.key] ?? 0) * 500}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-[#4a5568] w-8 text-right">
                          {(((tpl.weights as any)[sig.key] ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => onClone(tpl)}
                  className="text-[10px] w-full border border-[#A78BFA]/40 text-[#A78BFA] py-1.5 rounded hover:bg-[#A78BFA]/10 transition mt-auto"
                >
                  CLONE TO CUSTOMIZE
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default M08StrategyControlPanel;
