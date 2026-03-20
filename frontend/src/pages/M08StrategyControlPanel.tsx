/**
 * M08 Strategy Control Panel
 * Create, edit, clone, and delete M08 arbitrage strategies.
 * Signal weights + property/risk gates + execution profile editor.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';


interface Gate {
  metric: string;
  operator?: string;
  value?: any;
  threshold?: number;
  hard: boolean;
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
  };
  sort_order: number;
  version: number;
}

const SIGNALS = [
  { key: 'supply_pressure', label: 'Supply Pressure', invert: true },
  { key: 'demand_growth', label: 'Demand Growth', invert: false },
  { key: 'rent_momentum', label: 'Rent Momentum', invert: false },
  { key: 'job_growth', label: 'Job Growth', invert: false },
  { key: 'cap_rate_spread', label: 'Cap Rate Spread', invert: false },
  { key: 'irr_potential', label: 'IRR Potential', invert: false },
  { key: 'risk_score', label: 'Risk (penalty)', invert: true },
];

const EXIT_STRATEGIES = ['sale', 'hold', 'hold_or_sell', 'refi', 'refi_or_sell'];

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

function defaultWeights(): Record<string, number> {
  return { supply_pressure: 0.10, demand_growth: 0.20, rent_momentum: 0.20, job_growth: 0.15, cap_rate_spread: 0.15, irr_potential: 0.15, risk_score: -0.05 };
}

const StrategyCard: React.FC<{
  strategy: M08Strategy;
  isSelected: boolean;
  onClick: () => void;
}> = ({ strategy, isSelected, onClick }) => (
  <div
    onClick={onClick}
    className={`px-4 py-3 cursor-pointer border-l-2 transition-all ${
      isSelected
        ? 'border-[#F5A623] bg-[#F5A623]/5'
        : 'border-transparent hover:border-[#1e2a3d] hover:bg-[#0d1424]'
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      {strategy.is_system_template && (
        <span className="text-[9px] text-[#7f8ea3] border border-[#1e2a3d] px-1 rounded">SYS</span>
      )}
      <span className={`text-xs font-medium ${isSelected ? 'text-[#F5A623]' : 'text-[#c8cdd4]'}`}>
        {strategy.name}
      </span>
    </div>
    {strategy.description && (
      <p className="text-[10px] text-[#4a5568] line-clamp-1">{strategy.description}</p>
    )}
  </div>
);

const WeightSlider: React.FC<{
  label: string;
  value: number;
  onChange: (val: number) => void;
  disabled: boolean;
  invert?: boolean;
}> = ({ label, value, onChange, disabled, invert }) => {
  const displayVal = Math.abs(value);
  const pct = Math.min(100, displayVal * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-[#7f8ea3] w-32 flex-shrink-0">
        {label.toUpperCase()}
        {invert && <span className="text-[#e74c3c] ml-1">(-)</span>}
      </span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={Math.round(displayVal * 100)}
          onChange={(e) => {
            const raw = parseInt(e.target.value) / 100;
            onChange(invert ? -raw : raw);
          }}
          disabled={disabled}
          className="w-full h-1 bg-[#1a2233] rounded appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, ${invert ? '#e74c3c' : '#F5A623'} ${pct}%, #1a2233 ${pct}%)`,
          }}
        />
      </div>
      <span className={`text-[10px] text-[#c8cdd4] w-10 text-right flex-shrink-0`}>
        {invert ? '-' : ''}{(displayVal * 100).toFixed(0)}%
      </span>
    </div>
  );
};

export const M08StrategyControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<M08Strategy[]>([]);
  const [selected, setSelected] = useState<M08Strategy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editWeights, setEditWeights] = useState<Record<string, number>>(defaultWeights());
  const [editHoldYears, setEditHoldYears] = useState(5);
  const [editExitStrategy, setEditExitStrategy] = useState('hold');
  const [editTargetIrr, setEditTargetIrr] = useState(15);

  const fetchStrategies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/v1/strategies');
      if (res.data?.success) {
        setStrategies(res.data.strategies || []);
      }
    } catch { }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchStrategies(); }, [fetchStrategies]);

  const populateEditor = useCallback((strategy: M08Strategy) => {
    setSelected(strategy);
    setEditName(strategy.name);
    setEditDesc(strategy.description || '');
    const weights = { ...defaultWeights(), ...strategy.signal_weights };
    setEditWeights(weights);
    setEditHoldYears(strategy.execution_profile?.hold_period_years ?? 5);
    setEditExitStrategy(strategy.execution_profile?.exit_strategy ?? 'hold');
    setEditTargetIrr(Math.round((strategy.execution_profile?.target_irr ?? 0.15) * 100));
  }, []);

  const handleNew = () => {
    setIsCreating(true);
    setSelected(null);
    setEditName('');
    setEditDesc('');
    setEditWeights(defaultWeights());
    setEditHoldYears(5);
    setEditExitStrategy('hold');
    setEditTargetIrr(15);
    setSaveMsg(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const normalized = normalizeWeights(editWeights);
      const payload = {
        name: editName.trim(),
        description: editDesc.trim() || null,
        signal_weights: normalized,
        execution_profile: {
          hold_period_years: editHoldYears,
          exit_strategy: editExitStrategy,
          target_irr: editTargetIrr / 100,
        },
      };

      if (isCreating) {
        const res = await apiClient.post('/api/v1/strategies', payload);
        if (res.data?.success) {
          setIsCreating(false);
          await fetchStrategies();
          populateEditor(res.data.strategy);
          setSaveMsg({ type: 'ok', text: 'Strategy created' });
        }
      } else if (selected && !selected.is_system_template) {
        const res = await apiClient.put(`/api/v1/strategies/${selected.id}`, payload);
        if (res.data?.success) {
          await fetchStrategies();
          populateEditor(res.data.strategy);
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
        populateEditor(res.data.strategy);
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

  const weightSum = Object.entries(editWeights)
    .filter(([, v]) => v > 0)
    .reduce((a, [, v]) => a + v, 0);

  const isReadOnly = !isCreating && (selected?.is_system_template ?? true);

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#c8cdd4]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <div className="border-b border-[#1a2233] px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className={`text-[10px] text-[#7f8ea3] hover:text-[#F5A623] transition`}
        >
          ← BACK
        </button>
        <span className={`text-xs font-bold text-[#F5A623]`}>M08 STRATEGY CONTROL PANEL</span>
        <span className={`text-[10px] text-[#4a5568]`}>ARBITRAGE ENGINE</span>
        <div className="flex-1" />
        <button
          onClick={handleNew}
          className={`text-[10px] border border-[#F5A623]/40 text-[#F5A623] px-3 py-1 rounded hover:bg-[#F5A623]/10 transition`}
        >
          + NEW STRATEGY
        </button>
      </div>

      <div className="flex h-[calc(100vh-49px)]">
        {/* Left: Strategy List */}
        <div className="w-64 border-r border-[#1a2233] flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-[#1a2233]">
            <span className={`text-[10px] text-[#7f8ea3]`}>STRATEGIES ({strategies.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-4 h-4 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              strategies.map(s => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  isSelected={selected?.id === s.id && !isCreating}
                  onClick={() => { setIsCreating(false); populateEditor(s); setSaveMsg(null); }}
                />
              ))
            )}
            {isCreating && (
              <div className="px-4 py-3 border-l-2 border-[#27ae60] bg-[#27ae60]/5">
                <span className={`text-xs text-[#27ae60]`}>NEW STRATEGY *</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor */}
        <div className="flex-1 overflow-y-auto">
          {!selected && !isCreating ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className={`text-xs text-[#4a5568] mb-2`}>SELECT A STRATEGY OR CREATE NEW</p>
              <button
                onClick={handleNew}
                className={`text-[10px] border border-[#F5A623]/40 text-[#F5A623] px-4 py-2 rounded hover:bg-[#F5A623]/10 transition mt-2`}
              >
                + NEW STRATEGY
              </button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-8 py-6 space-y-6">
              {/* Meta */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {selected?.is_system_template && (
                    <span className={`text-[9px] bg-[#1a2233] text-[#7f8ea3] px-2 py-0.5 rounded border border-[#1e2a3d]`}>
                      SYSTEM TEMPLATE (READ-ONLY)
                    </span>
                  )}
                  {isCreating && (
                    <span className={`text-[9px] bg-[#27ae60]/10 text-[#27ae60] px-2 py-0.5 rounded border border-[#27ae60]/30`}>
                      NEW STRATEGY
                    </span>
                  )}
                  {selected && !selected.is_system_template && (
                    <span className={`text-[9px] text-[#7f8ea3]`}>v{selected.version}</span>
                  )}
                </div>
                <div>
                  <label className={`text-[10px] text-[#7f8ea3] block mb-1`}>NAME</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    disabled={isReadOnly}
                    className={`w-full bg-[#0d1424] border border-[#1a2233] rounded px-3 py-2 text-sm text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50`}
                    placeholder="Strategy name..."
                  />
                </div>
                <div>
                  <label className={`text-[10px] text-[#7f8ea3] block mb-1`}>DESCRIPTION</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    disabled={isReadOnly}
                    rows={2}
                    className={`w-full bg-[#0d1424] border border-[#1a2233] rounded px-3 py-2 text-xs text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50 resize-none`}
                    placeholder="Brief description..."
                  />
                </div>
              </div>

              {/* Signal Weights */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] text-[#7f8ea3]`}>SIGNAL WEIGHTS</span>
                  <span className={`text-[10px] ${Math.abs(weightSum - 1) < 0.05 ? 'text-[#27ae60]' : 'text-[#e74c3c]'}`}>
                    SUM: {(weightSum * 100).toFixed(0)}%
                    {Math.abs(weightSum - 1) < 0.05 ? ' ✓' : ' (must be 100%)'}
                  </span>
                </div>
                <div className="space-y-3 bg-[#0d1424] rounded border border-[#1a2233] p-4">
                  {SIGNALS.map(sig => (
                    <WeightSlider
                      key={sig.key}
                      label={sig.label}
                      value={editWeights[sig.key] ?? 0}
                      onChange={val => setEditWeights(prev => ({ ...prev, [sig.key]: val }))}
                      disabled={isReadOnly}
                      invert={sig.invert}
                    />
                  ))}
                  {!isReadOnly && (
                    <button
                      onClick={() => setEditWeights(normalizeWeights(editWeights))}
                      className={`text-[10px] text-[#F5A623] border border-[#F5A623]/30 px-3 py-1 rounded hover:bg-[#F5A623]/10 transition mt-2`}
                    >
                      NORMALIZE TO 100%
                    </button>
                  )}
                </div>
              </div>

              {/* Execution Profile */}
              <div>
                <span className={`text-[10px] text-[#7f8ea3] block mb-3`}>EXECUTION PROFILE</span>
                <div className="grid grid-cols-3 gap-4 bg-[#0d1424] rounded border border-[#1a2233] p-4">
                  <div>
                    <label className={`text-[10px] text-[#7f8ea3] block mb-1`}>HOLD YEARS</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={editHoldYears}
                      onChange={e => setEditHoldYears(parseInt(e.target.value) || 1)}
                      disabled={isReadOnly}
                      className={`w-full bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1.5 text-sm text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] text-[#7f8ea3] block mb-1`}>EXIT STRATEGY</label>
                    <select
                      value={editExitStrategy}
                      onChange={e => setEditExitStrategy(e.target.value)}
                      disabled={isReadOnly}
                      className={`w-full bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1.5 text-xs text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50`}
                    >
                      {EXIT_STRATEGIES.map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`text-[10px] text-[#7f8ea3] block mb-1`}>TARGET IRR %</label>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={editTargetIrr}
                      onChange={e => setEditTargetIrr(parseInt(e.target.value) || 10)}
                      disabled={isReadOnly}
                      className={`w-full bg-[#0a0e17] border border-[#1a2233] rounded px-2 py-1.5 text-sm text-[#c8cdd4] focus:border-[#F5A623]/50 focus:outline-none disabled:opacity-50`}
                    />
                  </div>
                </div>
              </div>

              {/* Gates (read-only display) */}
              {selected && (selected.property_gates?.length > 0 || selected.risk_gates?.length > 0) && (
                <div>
                  <span className={`text-[10px] text-[#7f8ea3] block mb-3`}>GATES</span>
                  <div className="bg-[#0d1424] rounded border border-[#1a2233] p-4 space-y-2">
                    {[...( selected.property_gates || []), ...(selected.risk_gates || [])].map((gate, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span
                          className={`text-[9px] px-1 rounded border ${gate.hard ? 'text-[#e74c3c] border-[#e74c3c]/30' : 'text-[#e67e22] border-[#e67e22]/30'}`}
                        >
                          {gate.hard ? 'HARD' : 'SOFT'}
                        </span>
                        <span className={`text-[10px] text-[#c8cdd4]`}>{gate.metric}</span>
                        {gate.operator && (
                          <span className={`text-[10px] text-[#7f8ea3]`}>{gate.operator} {JSON.stringify(gate.value)}</span>
                        )}
                        {gate.threshold !== undefined && (
                          <span className={`text-[10px] text-[#7f8ea3]`}>&ge; {gate.threshold}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save msg */}
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
                    className={`text-xs px-4 py-2 bg-[#F5A623] text-[#0A0E17] font-bold rounded hover:bg-[#F5A623]/90 transition disabled:opacity-50`}
                  >
                    {isSaving ? 'SAVING...' : isCreating ? 'CREATE' : 'SAVE'}
                  </button>
                )}
                {selected && (
                  <button
                    onClick={handleClone}
                    disabled={isSaving}
                    className={`text-xs px-4 py-2 border border-[#F5A623]/40 text-[#F5A623] rounded hover:bg-[#F5A623]/10 transition disabled:opacity-50`}
                  >
                    CLONE
                  </button>
                )}
                {selected && !selected.is_system_template && (
                  <button
                    onClick={handleDelete}
                    disabled={isSaving}
                    className={`text-xs px-4 py-2 border border-[#e74c3c]/40 text-[#e74c3c] rounded hover:bg-[#e74c3c]/10 transition disabled:opacity-50 ml-auto`}
                  >
                    DELETE
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default M08StrategyControlPanel;
