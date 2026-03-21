import React, { useState, useEffect } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip as ReTooltip, BarChart, Bar, XAxis, Cell, ResponsiveContainer,
} from 'recharts';
import { T } from '../../styles/terminal-tokens';
import {
  useStrategyStore,
  Strategy,
  SignalWeights,
  PropertyGate,
  ExecutionProfile,
  FinancialCriteria,
  LocationWeights,
} from '../../stores/strategyStore';

// ─── TOKEN SHORTCUTS ──────────────────────────────────────────────────────────
const bg   = T.bg;
const text = T.text;
const bdr  = T.border;
const font = T.font;
const fz   = T.fontSize;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SIGNAL_KEYS: (keyof SignalWeights)[] = ['demand', 'supply', 'momentum', 'position', 'risk'];
const SIGNAL_COLORS: Record<keyof SignalWeights, string> = {
  demand: '#A78BFA', supply: '#00D26A', momentum: '#F5A623', position: '#00BCD4', risk: '#FF4757',
};

type FieldType = 'numeric' | 'enum' | 'boolean';

const PROPERTY_GATE_FIELDS: { value: string; label: string; type: FieldType }[] = [
  { value: 'product_type',       label: 'Product Type',         type: 'enum' },
  { value: 'unit_count',         label: 'Unit Count',           type: 'numeric' },
  { value: 'year_built',         label: 'Year Built',           type: 'numeric' },
  { value: 'zoning_utilization', label: 'Zoning Utilization %', type: 'numeric' },
  { value: 'str_regulations',    label: 'STR Regulations',      type: 'enum' },
  { value: 'acreage',            label: 'Acreage',              type: 'numeric' },
  { value: 'floors',             label: 'Floors',               type: 'numeric' },
  { value: 'market_rent',        label: 'Market Rent',          type: 'numeric' },
  { value: 'cap_rate',           label: 'Cap Rate',             type: 'numeric' },
];

const FIELD_TYPE_MAP: Record<string, FieldType> = Object.fromEntries(
  PROPERTY_GATE_FIELDS.map(f => [f.value, f.type])
);

const OPERATORS_FOR: Record<FieldType, { value: PropertyGate['operator']; label: string }[]> = {
  numeric: [
    { value: 'gte',     label: '≥' },
    { value: 'lte',     label: '≤' },
    { value: 'eq',      label: '=' },
    { value: 'between', label: 'between' },
  ],
  enum: [
    { value: 'in',      label: 'in' },
    { value: 'not_in',  label: 'not in' },
    { value: 'eq',      label: '=' },
  ],
  boolean: [
    { value: 'eq',      label: '=' },
  ],
};

const EXIT_TYPES: { value: ExecutionProfile['exit_type']; label: string }[] = [
  { value: 'sale',             label: 'Sale' },
  { value: 'refinance',        label: 'Refinance' },
  { value: '1031',             label: '1031 Exchange' },
  { value: 'hold_indefinitely',label: 'Hold Indefinitely' },
];

const LOCATION_AMENITY_KEYS: (keyof Omit<LocationWeights, 'radius_miles'>)[] = [
  'transit', 'schools', 'employment', 'retail', 'parks', 'healthcare', 'restaurants', 'entertainment',
];
const LOCATION_LABELS: Record<string, string> = {
  transit: 'Transit Access', schools: 'Schools', employment: 'Employment Centers',
  retail: 'Retail', parks: 'Parks & Recreation', healthcare: 'Healthcare',
  restaurants: 'Restaurants', entertainment: 'Entertainment',
};

const ICON_PRESETS = ['🏗️','🏢','🏘️','🏠','🏬','🏨','🏦','🔑','📊','💰','🎯','⚡','🌟','🔥','♻️'];

const DEFAULT_WEIGHTS: SignalWeights = { demand: 0.30, supply: 0.20, momentum: 0.20, position: 0.15, risk: 0.15 };
const DEFAULT_EXEC: ExecutionProfile  = { hold_period_min: 3, hold_period_max: 7, exit_type: 'sale', capital_recycling: false, stabilization_months: 12 };
const DEFAULT_LOCATION: LocationWeights = { transit: 0.5, schools: 0.5, employment: 0.5, retail: 0.5, parks: 0.5, healthcare: 0.5, restaurants: 0.5, entertainment: 0.5, radius_miles: 1.0 };
const DEFAULT_FINANCIAL: FinancialCriteria = { min_irr: 15, min_coc: 8, max_ltv: 75, min_dscr: 1.25 };

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function pct(v: number) { return `${Math.round(v * 100)}%`; }

/**
 * Adjust ONE slider to rawPct; redistribute the remaining budget among siblings.
 * The edited key's value is locked; siblings scale proportionally.
 */
function rebalanceWeights(old: SignalWeights, changedKey: keyof SignalWeights, rawPct: number): SignalWeights {
  const locked = Math.min(1, Math.max(0, rawPct / 100));
  const budget  = Math.max(0, 1.0 - locked);
  const siblings = SIGNAL_KEYS.filter(k => k !== changedKey);
  const sibSum   = siblings.reduce((a, k) => a + old[k], 0);

  const next: SignalWeights = { ...old, [changedKey]: locked };
  if (sibSum === 0) {
    const each = parseFloat((budget / siblings.length).toFixed(4));
    siblings.forEach(k => { next[k] = each; });
  } else {
    const factor = budget / sibSum;
    siblings.forEach(k => { next[k] = parseFloat((old[k] * factor).toFixed(4)); });
  }
  return next;
}

function mkGate(): PropertyGate {
  return { id: crypto.randomUUID(), field: 'unit_count', operator: 'gte', value: '', hard: true, penalty: 0 };
}

// ─── SHARED STYLED PRIMITIVES ─────────────────────────────────────────────────
const panelSx: React.CSSProperties = {
  background: bg.panel, border: `1px solid ${bdr.subtle}`, borderRadius: 6,
};
const inputSx: React.CSSProperties = {
  background: bg.input, border: `1px solid ${bdr.subtle}`, color: text.primary,
  fontFamily: font.mono, fontSize: fz.base, borderRadius: 4, padding: '6px 10px',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};
const btnSx = (variant: 'primary' | 'ghost' | 'danger' | 'amber'): React.CSSProperties => ({
  fontFamily: font.mono, fontSize: fz.base, fontWeight: 600, letterSpacing: '0.05em',
  borderRadius: 4, padding: '7px 14px', cursor: 'pointer', transition: 'background 0.15s',
  background: variant === 'primary' ? text.purple : variant === 'amber' ? text.amber : variant === 'danger' ? text.red : 'transparent',
  color: variant === 'ghost' ? text.secondary : '#fff',
  border: variant === 'ghost' ? `1px solid ${bdr.subtle}` : 'none',
} as React.CSSProperties);
const labelSx: React.CSSProperties = {
  fontFamily: font.mono, fontSize: fz.sm, color: text.secondary,
  letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4,
};

// ─── SIGNAL WEIGHT SLIDERS ────────────────────────────────────────────────────
/** Hard-normalize all weights so they sum exactly to 1.0 */
function finalizeWeights(w: SignalWeights): SignalWeights {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total === 0) return { ...DEFAULT_WEIGHTS };
  const normalized = { ...w } as SignalWeights;
  let acc = 0;
  const keys = SIGNAL_KEYS.slice(0, -1);
  keys.forEach(k => {
    normalized[k] = parseFloat((w[k] / total).toFixed(4));
    acc += normalized[k];
  });
  normalized.risk = parseFloat((1.0 - acc).toFixed(4));
  return normalized;
}

function SignalWeightSliders({ weights, onChange }: { weights: SignalWeights; onChange: (w: SignalWeights) => void }) {
  const chartData = SIGNAL_KEYS.map(k => ({ key: k, val: Math.round(weights[k] * 100) }));
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const sumOk = Math.abs(sum - 1.0) < 0.02;

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        {SIGNAL_KEYS.map(k => (
          <div key={k} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ ...labelSx, textTransform: 'capitalize', marginBottom: 0 }}>{k}</span>
              <span style={{ fontFamily: font.mono, fontSize: fz.base, color: SIGNAL_COLORS[k], fontWeight: 700 }}>
                {pct(weights[k])}
              </span>
            </div>
            <input
              type="range" min={0} max={100} step={1}
              value={Math.round(weights[k] * 100)}
              onChange={e => onChange(rebalanceWeights(weights, k, Number(e.target.value)))}
              onMouseUp={() => onChange(finalizeWeights(weights))}
              onTouchEnd={() => onChange(finalizeWeights(weights))}
              style={{ width: '100%', accentColor: SIGNAL_COLORS[k] }}
            />
          </div>
        ))}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
          padding: '6px 10px', borderRadius: 4,
          background: sumOk ? '#00D26A18' : '#FF475718',
          border: `1px solid ${sumOk ? '#00D26A40' : '#FF475740'}`,
        }}>
          <span style={{ fontFamily: font.mono, fontSize: fz.sm, color: sumOk ? text.green : text.red }}>
            {sumOk ? '✓ WEIGHTS SUM TO 100%' : `⚠ SUM = ${Math.round(sum * 100)}%`}
          </span>
          <button style={{ ...btnSx('ghost'), fontSize: fz.xs, padding: '2px 8px', marginLeft: 'auto' }}
            onClick={() => onChange({ ...DEFAULT_WEIGHTS })}>RESET</button>
        </div>
      </div>

      <div style={{ width: 200 }}>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis dataKey="key" tick={{ fill: text.secondary, fontSize: 9 }} axisLine={false} tickLine={false} />
            <Bar dataKey="val" radius={[3, 3, 0, 0]}>
              {chartData.map(d => <Cell key={d.key} fill={SIGNAL_COLORS[d.key as keyof SignalWeights]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ textAlign: 'center', fontFamily: font.mono, fontSize: fz.xs, color: text.muted }}>
          WEIGHT DISTRIBUTION
        </div>
      </div>
    </div>
  );
}

// ─── PROPERTY GATE BUILDER ────────────────────────────────────────────────────
function PropertyGateBuilder({ gates, onChange, title }: { gates: PropertyGate[]; onChange: (g: PropertyGate[]) => void; title: string }) {
  function updateGate(id: string, patch: Partial<PropertyGate>) {
    onChange(gates.map(g => {
      if (g.id !== id) return g;
      const updated = { ...g, ...patch };
      // When field changes, reset operator to first valid one for new type
      if ('field' in patch && patch.field !== g.field) {
        const ft = FIELD_TYPE_MAP[updated.field] ?? 'numeric';
        updated.operator = OPERATORS_FOR[ft][0].value;
        updated.value = '';
      }
      return updated;
    }));
  }
  function removeGate(id: string) { onChange(gates.filter(g => g.id !== id)); }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: font.mono, fontSize: fz.base, color: text.primary, fontWeight: 600 }}>{title}</span>
        <button style={btnSx('ghost')} onClick={() => onChange([...gates, mkGate()])}>+ ADD GATE</button>
      </div>
      {gates.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: text.muted, fontFamily: font.mono, fontSize: fz.base }}>
          No gates configured — all properties will pass
        </div>
      )}
      {gates.map(gate => {
        const ft = FIELD_TYPE_MAP[gate.field] ?? 'numeric';
        const ops = OPERATORS_FOR[ft];
        return (
          <div key={gate.id} style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr auto auto auto',
            gap: 8, marginBottom: 8, padding: '10px',
            borderRadius: 4, background: bg.panelAlt, border: `1px solid ${bdr.subtle}`,
            alignItems: 'center',
          }}>
            <select value={gate.field} onChange={e => updateGate(gate.id, { field: e.target.value })} style={inputSx}>
              {PROPERTY_GATE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            <select
              value={gate.operator}
              onChange={e => updateGate(gate.id, { operator: e.target.value as PropertyGate['operator'] })}
              style={{ ...inputSx, width: 90 }}
            >
              {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <input
              style={inputSx}
              placeholder={gate.operator === 'between' ? 'min,max' : ft === 'enum' ? 'val1, val2...' : 'value'}
              value={String(gate.value)}
              onChange={e => updateGate(gate.id, { value: e.target.value })}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: font.mono, fontSize: fz.xs, color: text.muted }}>HARD</span>
              <input type="checkbox" checked={gate.hard}
                onChange={e => updateGate(gate.id, { hard: e.target.checked })}
                style={{ accentColor: text.red, width: 14, height: 14 }} />
            </div>

            {!gate.hard && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min={0} max={50} step={1} value={gate.penalty ?? 0}
                  onChange={e => updateGate(gate.id, { penalty: Number(e.target.value) })}
                  style={{ ...inputSx, width: 58 }} placeholder="pen" />
                <span style={{ fontFamily: font.mono, fontSize: fz.xs, color: text.amber }}>pts</span>
              </div>
            )}

            <button style={{ ...btnSx('danger'), padding: '5px 10px', fontSize: fz.xs }}
              onClick={() => removeGate(gate.id)}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── LOCATION WEIGHTS ─────────────────────────────────────────────────────────
function LocationWeightsTab({ weights, onChange }: { weights: LocationWeights; onChange: (w: LocationWeights) => void }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelSx}>SEARCH RADIUS</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min={0.25} max={5} step={0.25} value={weights.radius_miles}
            onChange={e => onChange({ ...weights, radius_miles: Number(e.target.value) })}
            style={{ flex: 1, accentColor: text.cyan }} />
          <span style={{ fontFamily: font.mono, fontSize: fz.base, color: text.cyan, minWidth: 50 }}>
            {weights.radius_miles} mi
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {LOCATION_AMENITY_KEYS.map(k => (
          <div key={k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ ...labelSx, marginBottom: 0 }}>{LOCATION_LABELS[k]}</label>
              <span style={{ fontFamily: font.mono, fontSize: fz.base, color: text.amber }}>{Math.round(weights[k] * 10)}/10</span>
            </div>
            <input type="range" min={0} max={1} step={0.1} value={weights[k]}
              onChange={e => onChange({ ...weights, [k]: Number(e.target.value) })}
              style={{ width: '100%', accentColor: text.amber }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FINANCIAL CRITERIA ───────────────────────────────────────────────────────
function FinancialCriteriaTab({ criteria, onChange }: { criteria: FinancialCriteria; onChange: (c: FinancialCriteria) => void }) {
  const fields: { key: keyof FinancialCriteria; label: string; unit: string; min: number; max: number; step: number }[] = [
    { key: 'min_irr',            label: 'Min IRR',             unit: '%',  min: 0,  max: 50, step: 0.5 },
    { key: 'min_coc',            label: 'Min CoC Return',      unit: '%',  min: 0,  max: 30, step: 0.5 },
    { key: 'min_equity_multiple',label: 'Min Equity Multiple', unit: 'x',  min: 1,  max: 10, step: 0.1 },
    { key: 'max_payback_years',  label: 'Max Payback Years',   unit: 'yr', min: 1,  max: 20, step: 1 },
    { key: 'min_dscr',           label: 'Min DSCR',            unit: 'x',  min: 1,  max: 3,  step: 0.05 },
    { key: 'max_ltv',            label: 'Max LTV',             unit: '%',  min: 50, max: 95, step: 1 },
    { key: 'min_yoc',            label: 'Min Yield on Cost',   unit: '%',  min: 0,  max: 20, step: 0.25 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {fields.map(f => (
        <div key={f.key}>
          <label style={labelSx}>{f.label}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min={f.min} max={f.max} step={f.step} value={criteria[f.key] ?? ''}
              onChange={e => onChange({ ...criteria, [f.key]: e.target.value ? Number(e.target.value) : undefined })}
              style={{ ...inputSx, flex: 1 }} placeholder="—" />
            <span style={{ fontFamily: font.mono, fontSize: fz.base, color: text.muted, minWidth: 20 }}>{f.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── EXECUTION PROFILE ────────────────────────────────────────────────────────
function ExecutionProfileTab({ profile, onChange }: { profile: ExecutionProfile; onChange: (p: ExecutionProfile) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={labelSx}>HOLD PERIOD (YEARS)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: font.mono, fontSize: fz.sm, color: text.muted, minWidth: 28 }}>MIN</span>
          <input type="range" min={1} max={20} step={1} value={profile.hold_period_min}
            onChange={e => onChange({ ...profile, hold_period_min: Number(e.target.value) })}
            style={{ flex: 1, accentColor: text.purple }} />
          <span style={{ fontFamily: font.mono, fontSize: fz.base, color: text.purple, minWidth: 30 }}>{profile.hold_period_min}yr</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <span style={{ fontFamily: font.mono, fontSize: fz.sm, color: text.muted, minWidth: 28 }}>MAX</span>
          <input type="range" min={1} max={30} step={1} value={profile.hold_period_max}
            onChange={e => onChange({ ...profile, hold_period_max: Number(e.target.value) })}
            style={{ flex: 1, accentColor: text.purple }} />
          <span style={{ fontFamily: font.mono, fontSize: fz.base, color: text.purple, minWidth: 30 }}>{profile.hold_period_max}yr</span>
        </div>
      </div>
      <div>
        <label style={labelSx}>EXIT TYPE</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EXIT_TYPES.map(et => (
            <button key={et.value} onClick={() => onChange({ ...profile, exit_type: et.value })}
              style={{ ...btnSx(profile.exit_type === et.value ? 'primary' : 'ghost'), fontSize: fz.sm }}>
              {et.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelSx}>STABILIZATION PERIOD</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min={0} max={36} step={1} value={profile.stabilization_months}
            onChange={e => onChange({ ...profile, stabilization_months: Number(e.target.value) })}
            style={{ flex: 1, accentColor: text.green }} />
          <span style={{ fontFamily: font.mono, fontSize: fz.base, color: text.green, minWidth: 60 }}>
            {profile.stabilization_months} mo
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input type="checkbox" id="cap_recycle" checked={profile.capital_recycling}
          onChange={e => onChange({ ...profile, capital_recycling: e.target.checked })}
          style={{ accentColor: text.amber, width: 16, height: 16 }} />
        <label htmlFor="cap_recycle" style={{ ...labelSx, marginBottom: 0, cursor: 'pointer' }}>
          CAPITAL RECYCLING ENABLED
        </label>
        <span style={{ fontFamily: font.mono, fontSize: fz.xs, color: text.muted }}>
          (reinvest proceeds on exit)
        </span>
      </div>
    </div>
  );
}

// ─── EDITOR STATE & MODAL ─────────────────────────────────────────────────────
type EditorTab = 'weights' | 'gates' | 'location' | 'financial' | 'execution';

interface EditorState {
  name: string;
  description: string;
  icon: string;
  color: string;
  is_active: boolean;
  signal_weights: SignalWeights;
  property_gates: PropertyGate[];
  risk_gates: PropertyGate[];
  financial_criteria: FinancialCriteria;
  location_weights: LocationWeights;
  execution_profile: ExecutionProfile;
}

function buildInitialEditor(strategy?: Strategy | null): EditorState {
  return {
    name:               strategy?.name ?? '',
    description:        strategy?.description ?? '',
    icon:               strategy?.icon ?? '🏗️',
    color:              strategy?.color ?? '#A78BFA',
    is_active:          strategy?.is_active ?? true,
    signal_weights:     strategy?.signal_weights ?? { ...DEFAULT_WEIGHTS },
    property_gates:     strategy?.property_gates ?? [],
    risk_gates:         strategy?.risk_gates ?? [],
    financial_criteria: strategy?.financial_criteria ?? { ...DEFAULT_FINANCIAL },
    location_weights:   strategy?.location_weights ?? { ...DEFAULT_LOCATION },
    execution_profile:  strategy?.execution_profile ?? { ...DEFAULT_EXEC },
  };
}

function StrategyEditorModal({
  strategy, isNew, onClose, onSave,
}: {
  strategy?: Strategy | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (state: EditorState) => Promise<void>;
}) {
  const [tab, setTab] = useState<EditorTab>('weights');
  const [editor, setEditor] = useState<EditorState>(() => buildInitialEditor(strategy));
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const TABS: { key: EditorTab; label: string }[] = [
    { key: 'weights',   label: 'SIGNAL WEIGHTS' },
    { key: 'gates',     label: 'PROPERTY GATES' },
    { key: 'location',  label: 'LOCATION' },
    { key: 'financial', label: 'FINANCIAL' },
    { key: 'execution', label: 'EXECUTION' },
  ];

  async function handleSave() {
    setSaving(true);
    try { await onSave(editor); } finally { setSaving(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        ...panelSx, width: 780, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        border: `1px solid ${bdr.medium}`,
        boxShadow: '0 28px 80px rgba(0,0,0,0.85)',
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${bdr.subtle}`,
          background: bg.header, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: font.mono, fontSize: fz.xs, color: text.muted, letterSpacing: '0.1em' }}>M08 STRATEGY BUILDER</div>
            <div style={{ fontFamily: font.display, fontSize: fz.xl, color: text.primary, fontWeight: 700, marginTop: 2 }}>
              {isNew ? 'NEW STRATEGY' : editor.name || 'EDIT STRATEGY'}
            </div>
          </div>
          <button style={{ ...btnSx('ghost'), padding: '5px 12px' }} onClick={onClose}>✕ CLOSE</button>
        </div>

        {/* META */}
        <div style={{
          padding: '14px 20px', borderBottom: `1px solid ${bdr.subtle}`,
          display: 'flex', gap: 12, alignItems: 'flex-end',
        }}>
          {/* ICON */}
          <div style={{ position: 'relative' }}>
            <label style={labelSx}>ICON</label>
            <button
              onClick={() => setShowIconPicker(s => !s)}
              style={{
                background: bg.input, border: `1px solid ${bdr.subtle}`,
                borderRadius: 4, padding: '6px 10px', cursor: 'pointer',
                fontSize: 20, minWidth: 48,
              }}
            >
              {editor.icon}
            </button>
            {showIconPicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: bg.panel, border: `1px solid ${bdr.medium}`,
                borderRadius: 6, padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6, width: 200,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {ICON_PRESETS.map(ic => (
                  <button key={ic} onClick={() => { setEditor(s => ({ ...s, icon: ic })); setShowIconPicker(false); }}
                    style={{
                      background: editor.icon === ic ? '#A78BFA30' : 'transparent',
                      border: editor.icon === ic ? `1px solid ${text.purple}` : `1px solid transparent`,
                      borderRadius: 4, padding: '4px 6px', cursor: 'pointer', fontSize: 18,
                    }}>
                    {ic}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* COLOR */}
          <div>
            <label style={labelSx}>COLOR</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color" value={editor.color}
                onChange={e => setEditor(s => ({ ...s, color: e.target.value }))}
                style={{
                  width: 40, height: 36, border: `1px solid ${bdr.subtle}`,
                  borderRadius: 4, background: 'none', cursor: 'pointer', padding: 2,
                }}
              />
              <input
                value={editor.color}
                onChange={e => setEditor(s => ({ ...s, color: e.target.value }))}
                style={{ ...inputSx, width: 90, fontFamily: font.mono }}
                placeholder="#A78BFA"
              />
            </div>
          </div>

          {/* NAME */}
          <div style={{ flex: 2 }}>
            <label style={labelSx}>STRATEGY NAME</label>
            <input style={inputSx} value={editor.name}
              onChange={e => setEditor(s => ({ ...s, name: e.target.value }))}
              placeholder="e.g. Value-Add Multifamily" />
          </div>

          {/* DESCRIPTION */}
          <div style={{ flex: 3 }}>
            <label style={labelSx}>DESCRIPTION</label>
            <input style={inputSx} value={editor.description}
              onChange={e => setEditor(s => ({ ...s, description: e.target.value }))}
              placeholder="Brief description" />
          </div>

          {/* ACTIVE */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <label style={labelSx}>ACTIVE</label>
            <button
              onClick={() => setEditor(s => ({ ...s, is_active: !s.is_active }))}
              style={{
                background: editor.is_active ? '#00D26A20' : bg.input,
                border: `1px solid ${editor.is_active ? '#00D26A60' : bdr.subtle}`,
                borderRadius: 4, padding: '6px 14px', cursor: 'pointer',
                fontFamily: font.mono, fontSize: fz.sm,
                color: editor.is_active ? text.green : text.muted,
                fontWeight: 700,
              }}
            >
              {editor.is_active ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* TAB BAR */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${bdr.subtle}`, background: bg.topBar }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              fontFamily: font.mono, fontSize: fz.xs, fontWeight: 700,
              letterSpacing: '0.08em', padding: '10px 16px',
              border: 'none', cursor: 'pointer',
              background: tab === t.key ? bg.panel : 'transparent',
              color: tab === t.key ? text.purple : text.muted,
              borderBottom: tab === t.key ? `2px solid ${text.purple}` : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {tab === 'weights' && (
            <SignalWeightSliders weights={editor.signal_weights}
              onChange={w => setEditor(s => ({ ...s, signal_weights: w }))} />
          )}
          {tab === 'gates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <PropertyGateBuilder title="PROPERTY GATES" gates={editor.property_gates}
                onChange={g => setEditor(s => ({ ...s, property_gates: g }))} />
              <div style={{ borderTop: `1px solid ${bdr.subtle}`, paddingTop: 20 }}>
                <PropertyGateBuilder title="RISK GATES" gates={editor.risk_gates}
                  onChange={g => setEditor(s => ({ ...s, risk_gates: g }))} />
              </div>
            </div>
          )}
          {tab === 'location' && (
            <LocationWeightsTab weights={editor.location_weights}
              onChange={w => setEditor(s => ({ ...s, location_weights: w }))} />
          )}
          {tab === 'financial' && (
            <FinancialCriteriaTab criteria={editor.financial_criteria}
              onChange={c => setEditor(s => ({ ...s, financial_criteria: c }))} />
          )}
          {tab === 'execution' && (
            <ExecutionProfileTab profile={editor.execution_profile}
              onChange={p => setEditor(s => ({ ...s, execution_profile: p }))} />
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '14px 20px', borderTop: `1px solid ${bdr.subtle}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10, background: bg.topBar,
        }}>
          <button style={btnSx('ghost')} onClick={onClose}>CANCEL</button>
          <button
            style={{ ...btnSx('primary'), opacity: (saving || !editor.name.trim()) ? 0.5 : 1 }}
            onClick={handleSave} disabled={saving || !editor.name.trim()}
          >
            {saving ? 'SAVING...' : isNew ? 'CREATE STRATEGY' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TEMPLATE RADAR CHART ─────────────────────────────────────────────────────
function TemplateRadarChart({ weights }: { weights: SignalWeights }) {
  const data = SIGNAL_KEYS.map(k => ({
    subject: k.charAt(0).toUpperCase() + k.slice(1),
    value: Math.round(weights[k] * 100),
  }));
  return (
    <ResponsiveContainer width="100%" height={140}>
      <RadarChart cx="50%" cy="50%" outerRadius={50} data={data}>
        <PolarGrid stroke={bdr.subtle} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: text.muted, fontSize: 8, fontFamily: font.mono }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="weights" dataKey="value" stroke={text.purple} fill={text.purple} fillOpacity={0.25} />
        <ReTooltip
          contentStyle={{ background: bg.panel, border: `1px solid ${bdr.subtle}`, fontFamily: font.mono, fontSize: 10 }}
          labelStyle={{ color: text.primary }} itemStyle={{ color: text.purple }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── STRATEGY CARD ────────────────────────────────────────────────────────────
function StrategyCard({
  strategy, onEdit, onDelete, onClone, onToggleActive,
}: {
  strategy: Strategy;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
  onToggleActive: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const weights  = strategy.signal_weights ?? DEFAULT_WEIGHTS;
  const gateCount = (strategy.property_gates?.length ?? 0) + (strategy.risk_gates?.length ?? 0);
  const topKey   = SIGNAL_KEYS.reduce((a, b) => weights[a] >= weights[b] ? a : b);
  const color    = strategy.color || '#A78BFA';
  const icon     = strategy.icon  || '🏗️';

  return (
    <div
      onClick={() => { if (!strategy.is_system_template) onEdit(); }}
      style={{
        ...panelSx,
        border: `1px solid ${hovered ? bdr.medium : bdr.subtle}`,
        cursor: strategy.is_system_template ? 'default' : 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? `0 4px 20px rgba(167,139,250,0.12)` : 'none',
        display: 'flex', flexDirection: 'column',
        opacity: strategy.is_active ? 1 : 0.6,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* HEADER */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${bdr.subtle}`,
        background: bg.header, display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        {/* Color swatch + icon */}
        <div style={{
          width: 38, height: 38, borderRadius: 8, flexShrink: 0,
          background: `${color}22`, border: `1px solid ${color}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.mono, fontSize: fz.base, color: text.primary, fontWeight: 700 }}>
            {strategy.name}
          </div>
          {strategy.description && (
            <div style={{ fontFamily: font.mono, fontSize: fz.sm, color: text.secondary, marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {strategy.description}
            </div>
          )}
        </div>

        {/* Color dot */}
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />

        {strategy.is_system_template && (
          <span style={{
            background: '#A78BFA20', border: `1px solid ${text.purple}50`,
            color: text.purple, fontFamily: font.mono, fontSize: fz.xs,
            padding: '2px 6px', borderRadius: 3, flexShrink: 0,
          }}>SYSTEM</span>
        )}
      </div>

      {/* WEIGHT MINI-BARS */}
      <div style={{ padding: '10px 14px' }}>
        {SIGNAL_KEYS.map(k => (
          <div key={k} style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontFamily: font.mono, fontSize: fz.xs, color: text.muted, textTransform: 'capitalize' }}>{k}</span>
              <span style={{ fontFamily: font.mono, fontSize: fz.xs, color: SIGNAL_COLORS[k] }}>{pct(weights[k])}</span>
            </div>
            <div style={{ height: 3, background: bdr.subtle, borderRadius: 2 }}>
              <div style={{
                height: '100%', borderRadius: 2, background: SIGNAL_COLORS[k],
                width: `${Math.round(weights[k] * 100)}%`, transition: 'width 0.3s',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* BADGES */}
      <div style={{ padding: '0 14px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          background: `${color}18`, border: `1px solid ${color}40`,
          color: color, fontFamily: font.mono, fontSize: fz.xs, padding: '2px 7px', borderRadius: 3,
        }}>TOP: {topKey.toUpperCase()}</span>
        {gateCount > 0 && (
          <span style={{
            background: '#00BCD418', border: `1px solid #00BCD440`,
            color: text.cyan, fontFamily: font.mono, fontSize: fz.xs, padding: '2px 7px', borderRadius: 3,
          }}>{gateCount} {gateCount === 1 ? 'GATE' : 'GATES'}</span>
        )}
        {strategy.execution_profile?.exit_type && (
          <span style={{
            background: '#00D26A18', border: `1px solid #00D26A40`,
            color: text.green, fontFamily: font.mono, fontSize: fz.xs, padding: '2px 7px', borderRadius: 3,
          }}>{strategy.execution_profile.exit_type.replace('_', ' ').toUpperCase()}</span>
        )}
      </div>

      {/* ACTIONS */}
      <div style={{
        padding: '10px 14px', borderTop: `1px solid ${bdr.subtle}`,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        {/* Active toggle */}
        {!strategy.is_system_template && (
          <button
            onClick={e => { e.stopPropagation(); onToggleActive(); }}
            style={{
              background: strategy.is_active ? '#00D26A20' : bg.input,
              border: `1px solid ${strategy.is_active ? '#00D26A60' : bdr.subtle}`,
              borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
              fontFamily: font.mono, fontSize: fz.xs,
              color: strategy.is_active ? text.green : text.muted,
              fontWeight: 700,
            }}
          >
            {strategy.is_active ? 'ACTIVE' : 'OFF'}
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {strategy.is_system_template ? (
            <button
              style={{ ...btnSx('amber'), fontSize: fz.xs, padding: '4px 10px' }}
              onClick={e => { e.stopPropagation(); onClone(); }}>
              CLONE TO EDIT
            </button>
          ) : (
            <>
              <button style={{ ...btnSx('ghost'), fontSize: fz.xs, padding: '4px 10px' }}
                onClick={e => { e.stopPropagation(); onClone(); }}>CLONE</button>
              <button style={{ ...btnSx('danger'), fontSize: fz.xs, padding: '4px 10px' }}
                onClick={e => { e.stopPropagation(); onDelete(); }}>DELETE</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TEMPLATE GALLERY ─────────────────────────────────────────────────────────
function TemplateGallery({ templates, onClone, onClose }: {
  templates: Strategy[];
  onClone: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', paddingTop: 60, paddingBottom: 60,
    }}>
      <div style={{
        ...panelSx, width: '100%', maxWidth: 1100,
        border: `1px solid ${bdr.medium}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        margin: '0 24px',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${bdr.subtle}`,
          background: bg.header, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: font.mono, fontSize: fz.xs, color: text.muted, letterSpacing: '0.1em' }}>M08 STRATEGY BUILDER</div>
            <div style={{ fontFamily: font.display, fontSize: fz.xl, color: text.primary, fontWeight: 700, marginTop: 2 }}>
              SYSTEM TEMPLATES
            </div>
            <div style={{ fontFamily: font.mono, fontSize: fz.sm, color: text.secondary, marginTop: 2 }}>
              Read-only — clone to create an editable copy
            </div>
          </div>
          <button style={{ ...btnSx('ghost'), padding: '5px 12px' }} onClick={onClose}>✕ CLOSE</button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {templates.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: text.muted, fontFamily: font.mono, fontSize: fz.base, gridColumn: '1/-1' }}>
              No system templates available.
            </div>
          )}
          {templates.map(t => (
            <div key={t.id} style={{ ...panelSx, border: `1px solid ${text.purple}30`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${bdr.subtle}`, background: bg.header }}>
                <div style={{ fontFamily: font.mono, fontSize: fz.base, color: text.primary, fontWeight: 700 }}>
                  {t.icon || '🏗️'} {t.name}
                </div>
                {t.description && (
                  <div style={{ fontFamily: font.mono, fontSize: fz.sm, color: text.secondary, marginTop: 3 }}>
                    {t.description}
                  </div>
                )}
              </div>
              <TemplateRadarChart weights={t.signal_weights ?? DEFAULT_WEIGHTS} />
              <div style={{ padding: '8px 14px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SIGNAL_KEYS.map(k => (
                  <span key={k} style={{ fontFamily: font.mono, fontSize: fz.xs, color: SIGNAL_COLORS[k] }}>
                    {k.slice(0, 3).toUpperCase()}: {pct((t.signal_weights ?? DEFAULT_WEIGHTS)[k])}
                  </span>
                ))}
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'flex-end' }}>
                <button style={{ ...btnSx('amber'), fontSize: fz.xs, padding: '5px 12px' }} onClick={() => onClone(t.id)}>
                  CLONE TO EDIT
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export function M08StrategyBuilderPage() {
  const {
    strategies, systemTemplates, loading, error,
    fetchStrategies, fetchSystemTemplates, createStrategy, updateStrategy,
    deleteStrategy, cloneStrategy, toggleActive,
  } = useStrategyStore();

  const [editorOpen, setEditorOpen]           = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [cloneModalOpen, setCloneModalOpen]   = useState(false);
  const [cloneSourceId, setCloneSourceId]     = useState<string | null>(null);
  const [cloneName, setCloneName]             = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch]                   = useState('');
  const [showTemplates, setShowTemplates]     = useState(false);

  function openTemplates() {
    fetchSystemTemplates();
    setShowTemplates(true);
  }

  useEffect(() => {
    fetchStrategies();
    fetchSystemTemplates();
  }, [fetchStrategies, fetchSystemTemplates]);

  const filtered = strategies.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  function openNew()           { setEditingStrategy(null); setEditorOpen(true); }
  function openEdit(s: Strategy) { setEditingStrategy(s);  setEditorOpen(true); }

  function openClone(id: string) {
    const src = [...strategies, ...systemTemplates].find(s => s.id === id);
    setCloneSourceId(id);
    setCloneName(src ? `${src.name} (Copy)` : '');
    setCloneModalOpen(true);
  }

  async function handleSave(state: EditorState) {
    const payload = {
      name: state.name, description: state.description,
      icon: state.icon, color: state.color, is_active: state.is_active,
      signal_weights: state.signal_weights,
      property_gates: state.property_gates, risk_gates: state.risk_gates,
      financial_criteria: state.financial_criteria,
      location_weights: state.location_weights,
      execution_profile: state.execution_profile,
    };
    if (editingStrategy) { await updateStrategy(editingStrategy.id, payload); }
    else                 { await createStrategy(payload); }
    setEditorOpen(false);
  }

  async function handleDelete(id: string) {
    await deleteStrategy(id);
    setConfirmDeleteId(null);
  }

  async function handleCloneConfirm() {
    if (!cloneSourceId || !cloneName.trim()) return;
    await cloneStrategy(cloneSourceId, cloneName.trim());
    setCloneModalOpen(false);
    setCloneSourceId(null);
    setCloneName('');
  }

  return (
    <div style={{ background: bg.terminal, minHeight: '100vh', color: text.primary }}>
      {/* TOP BAR */}
      <div style={{
        background: bg.topBar, borderBottom: `1px solid ${bdr.subtle}`,
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 56,
      }}>
        <div style={{ fontFamily: font.mono, fontSize: fz.xs, color: text.muted, letterSpacing: '0.1em' }}>SETTINGS</div>
        <div style={{ color: bdr.medium, fontSize: 14 }}>›</div>
        <div style={{ fontFamily: font.display, fontSize: fz.xl, color: text.primary, fontWeight: 700 }}>
          M08 STRATEGY BUILDER
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: font.mono, fontSize: fz.xs, color: text.muted }}>
            {strategies.length} CUSTOM · {systemTemplates.length} SYSTEM
          </span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: 1280, margin: '0 auto' }}>
        {/* CONTROL BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <input style={{ ...inputSx, maxWidth: 280 }} placeholder="Search strategies..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button style={btnSx('ghost')} onClick={fetchStrategies}>↺ REFRESH</button>
            <button style={btnSx('ghost')} onClick={openTemplates}>
              BROWSE TEMPLATES
            </button>
            <button style={btnSx('primary')} onClick={openNew}>+ NEW STRATEGY</button>
          </div>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 4, marginBottom: 20,
            background: '#FF475718', border: `1px solid #FF475740`,
            fontFamily: font.mono, fontSize: fz.base, color: text.red,
          }}>{error}</div>
        )}

        {/* LOADING */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                ...panelSx, height: 260,
                background: `linear-gradient(90deg, ${bg.panel} 25%, ${bg.panelAlt} 50%, ${bg.panel} 75%)`,
                backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
              }} />
            ))}
          </div>
        )}

        {/* CUSTOM STRATEGIES */}
        {!loading && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${bdr.subtle}` }}>
              <span style={{ fontFamily: font.mono, fontSize: fz.base, color: text.primary, fontWeight: 700 }}>
                CUSTOM STRATEGIES
              </span>
              <span style={{
                background: '#A78BFA20', color: text.purple,
                fontFamily: font.mono, fontSize: fz.xs, padding: '2px 8px', borderRadius: 10,
              }}>{filtered.length}</span>
            </div>

            {filtered.length === 0 ? (
              <div style={{
                ...panelSx, padding: '48px', textAlign: 'center',
                color: text.muted, fontFamily: font.mono, fontSize: fz.base,
              }}>
                {search
                  ? 'No strategies match your search.'
                  : 'No strategies configured — create your first strategy or browse system templates above.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {filtered.map(s => (
                  <StrategyCard
                    key={s.id} strategy={s}
                    onEdit={() => openEdit(s)}
                    onDelete={() => setConfirmDeleteId(s.id)}
                    onClone={() => openClone(s.id)}
                    onToggleActive={() => toggleActive(s.id, !s.is_active)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* EDITOR MODAL */}
      {editorOpen && (
        <StrategyEditorModal
          strategy={editingStrategy} isNew={!editingStrategy}
          onClose={() => setEditorOpen(false)} onSave={handleSave}
        />
      )}

      {/* TEMPLATE GALLERY MODAL */}
      {showTemplates && (
        <TemplateGallery
          templates={systemTemplates}
          onClone={id => { setShowTemplates(false); openClone(id); }}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* CLONE MODAL */}
      {cloneModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ ...panelSx, width: 420, padding: 24, border: `1px solid ${bdr.medium}` }}>
            <div style={{ fontFamily: font.display, fontSize: fz.xl, color: text.primary, fontWeight: 700, marginBottom: 16 }}>
              CLONE STRATEGY
            </div>
            <label style={labelSx}>NEW STRATEGY NAME</label>
            <input style={{ ...inputSx, marginBottom: 20 }} value={cloneName}
              onChange={e => setCloneName(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSx('ghost')} onClick={() => setCloneModalOpen(false)}>CANCEL</button>
              <button style={{ ...btnSx('amber'), opacity: cloneName.trim() ? 1 : 0.5 }}
                onClick={handleCloneConfirm} disabled={!cloneName.trim()}>CLONE</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDeleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ ...panelSx, width: 380, padding: 24, border: `1px solid ${bdr.medium}` }}>
            <div style={{ fontFamily: font.display, fontSize: fz.xl, color: text.red, fontWeight: 700, marginBottom: 10 }}>
              DELETE STRATEGY
            </div>
            <div style={{ fontFamily: font.mono, fontSize: fz.base, color: text.secondary, marginBottom: 20 }}>
              This action cannot be undone. The strategy will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSx('ghost')} onClick={() => setConfirmDeleteId(null)}>CANCEL</button>
              <button style={btnSx('danger')} onClick={() => handleDelete(confirmDeleteId)}>DELETE</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}

export default M08StrategyBuilderPage;
