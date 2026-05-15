/**
 * StabilizedPotentialView — M09 Pro Forma 4-Column Layout
 *
 * Renders the Stabilized Potential view per M09_PROFORMA_SPEC.md:
 *   LINE ITEM | CURRENT (T12) | PRO FORMA (Y_S) | Δ | DRIVER
 *
 * Updated for Session 9.2: surfaces stabilization calendar month,
 * binding constraints, and engine mode from the StabillizedYearResolver.
 *
 * @version 2.0.0 (Session 9.2)
 * @date 2026-05-15
 */

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api.client';
import type { LayeredValueSource } from '../../types/proforma.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelType = 'acquisition_value_add' | 'acquisition_stabilized' | 'development' | 'redevelopment';
type AlertLevel = 'green' | 'amber' | 'red';

interface BindingConstraint {
  type: string;
  description: string;
  severity: string;
}

interface BridgeDecomposition {
  market: number;
  platform: number;
  operator: number;
  capex: number;
  capacity?: number;
}

interface StabilizedLineItem {
  key: string;
  label: string;
  current: number | null;
  proForma: number;
  delta: number;
  driver: string;
  bridge: BridgeDecomposition;
  dominantSource: LayeredValueSource | null;
  alertLevel: AlertLevel;
  isSubtotal: boolean;
}

interface StabilizedPotentialResponse {
  dealId: string;
  modelType: ModelType;
  stabilizedYear: number;
  stabilizationCalendarMonth: string;
  monthsToStabilization: number;
  bindingConstraint: string | null;
  bindingConstraintSeverity: string | null;
  constraints: BindingConstraint[];
  engineMode: string;
  layout: StabilizedLineItem[];
  summary: {
    currentNoi: number;
    proFormaNoi: number;
    noiGrowth: number;
    stabilizedValue: number;
    valueCreation: number;
    goingInCapRate: number;
    exitCapRate: number;
    yieldOnCost: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(val: number | null): string {
  if (val === null || val === undefined) return '—';
  const sign = val >= 0 ? '' : '';
  return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return `${(val * 100).toFixed(2)}%`;
}

function fmtDelta(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDeltaPct(val: number, base: number): string {
  if (base === 0) return '';
  const pct = (val / base) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function getModelTypeLabel(mt: ModelType): string {
  switch (mt) {
    case 'acquisition_value_add': return 'Acquisition (Value-Add)';
    case 'acquisition_stabilized': return 'Acquisition (Stabilized / Core)';
    case 'development': return 'Ground-Up Development';
    case 'redevelopment': return 'Redevelopment';
  }
}

function getEngineModeLabel(mode: string): string {
  switch (mode) {
    case 'LEASE_UP_NEW_CONSTRUCTION': return 'Lease-Up (New Construction)';
    case 'STABILIZED_MAINTENANCE': return 'Stabilized Maintenance';
    case 'OCCUPANCY_RECOVERY': return 'Occupancy Recovery';
    case 'V2_PENDING_VALUE_ADD': return 'V2 Pending Value-Add';
    default: return mode;
  }
}

function getAlertColor(al: AlertLevel): string {
  switch (al) {
    case 'green': return '#22c55e';
    case 'amber': return '#f59e0b';
    case 'red': return '#ef4444';
  }
}

function getAlertLabel(al: AlertLevel): string {
  switch (al) {
    case 'green': return 'High confidence — layers consistent';
    case 'amber': return 'One layer disagrees materially';
    case 'red': return 'Override conflicts with platform signal';
  }
}

function getSourceBadge(source: LayeredValueSource | null): string {
  if (!source) return '';
  return source;
}

function getConstraintColor(severity: string): string {
  switch (severity) {
    case 'binding': return '#f59e0b';
    case 'secondary': return '#818cf8';
    case 'informational': return '#888';
    default: return '#888';
  }
}

const COMPONENT_ORDER = ['gpr', 'vacancy', 'concessions', 'bad_debt', 'other_income', 'egr', 'opex', 'noi', 'cap_rate', 'stabilized_value'];

// ─── Bridge Popover ───────────────────────────────────────────────────────────

interface BridgePopoverProps {
  item: StabilizedLineItem;
  onClose: () => void;
}

const BridgePopover: React.FC<BridgePopoverProps> = ({ item, onClose }) => {
  const totalBridge = item.bridge.market + item.bridge.platform + item.bridge.operator + item.bridge.capex + (item.bridge.capacity ?? 0);

  const components: { label: string; value: number; pct: number }[] = [
    { label: 'Δ_market', value: item.bridge.market, pct: totalBridge > 0 ? item.bridge.market / totalBridge : 0 },
    { label: 'Δ_platform', value: item.bridge.platform, pct: totalBridge > 0 ? item.bridge.platform / totalBridge : 0 },
    { label: 'Δ_operator', value: item.bridge.operator, pct: totalBridge > 0 ? item.bridge.operator / totalBridge : 0 },
    { label: 'Δ_capex', value: item.bridge.capex, pct: totalBridge > 0 ? item.bridge.capex / totalBridge : 0 },
  ];

  if (item.bridge.capacity !== undefined) {
    components.push({ label: 'Δ_capacity', value: item.bridge.capacity, pct: totalBridge > 0 ? item.bridge.capacity / totalBridge : 0 });
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e1e2e',
          border: '1px solid #383850',
          borderRadius: 12,
          padding: 24,
          minWidth: 420,
          maxWidth: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>{item.label} — Δ Breakdown</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 12, color: '#aaa', fontSize: 13 }}>
          Total Δ: <strong style={{ color: item.delta >= 0 ? '#22c55e' : '#ef4444' }}>{fmtDelta(item.delta)}</strong>
          &nbsp;| Sum of components: <strong>{fmt$(totalBridge)}</strong>
        </div>

        {components.map((c) => (
          <div
            key={c.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #2a2a3e',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#e0e0e0', fontWeight: 500 }}>{c.label}</span>
              <div
                style={{
                  width: 120,
                  height: 6,
                  background: '#2a2a3e',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(c.pct * 100)}%`,
                    height: '100%',
                    background: '#6366f1',
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: c.value >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {fmt$(c.value)}
              </div>
              <div style={{ color: '#888', fontSize: 11 }}>{(c.pct * 100).toFixed(0)}%</div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 12, color: '#888', fontSize: 12, fontStyle: 'italic' }}>
          {item.driver}
        </div>
      </div>
    </div>
  );
};

// ─── Constraints Panel ────────────────────────────────────────────────────────

interface ConstraintsPanelProps {
  constraints: BindingConstraint[];
  bindingConstraint: string | null;
}

const ConstraintsPanel: React.FC<ConstraintsPanelProps> = ({ constraints, bindingConstraint }) => {
  if (constraints.length === 0) return null;

  return (
    <div
      style={{
        background: '#1e1e2e',
        border: '1px solid #383850',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ color: '#888', fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Binding Constraints
      </div>
      {constraints.map((c, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 0',
            fontSize: 13,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: getConstraintColor(c.severity),
              flexShrink: 0,
            }}
          />
          <span style={{ color: c.description === bindingConstraint ? '#f59e0b' : '#aaa', fontWeight: c.description === bindingConstraint ? 600 : 400 }}>
            {c.description}
            {c.description === bindingConstraint && (
              <span style={{ color: '#f59e0b', marginLeft: 6, fontSize: 11, border: '1px solid #f59e0b33', borderRadius: 4, padding: '0 6px' }}>
                BINDING
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface StabilizedPotentialViewProps {
  dealId: string;
  showMultiStrategy?: boolean;
}

const StabilizedPotentialView: React.FC<StabilizedPotentialViewProps> = ({ dealId, showMultiStrategy }) => {
  const [data, setData] = useState<StabilizedPotentialResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBridge, setExpandedBridge] = useState<string | null>(null);
  const [showPhased, setShowPhased] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient(`/api/v1/proforma/${dealId}/stabilized-potential`);
      setData(resp as StabilizedPotentialResponse);
    } catch (err: any) {
      setError(err?.message || 'Failed to load stabilized potential');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <div style={{ marginBottom: 12 }}>Loading stabilized potential...</div>
        <div style={{ width: 200, height: 4, background: '#2a2a3e', borderRadius: 2, margin: '0 auto', overflow: 'hidden' }}>
          <div style={{ width: '30%', height: '100%', background: '#6366f1', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: '#ef4444', background: '#2a1a1a', borderRadius: 8, border: '1px solid #3a2020' }}>
        <strong>Error loading stabilized potential:</strong> {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, color: '#888' }}>
        No data available for this deal.
      </div>
    );
  }

  const sortedLayout = [...data.layout].sort(
    (a, b) => COMPONENT_ORDER.indexOf(a.key) - COMPONENT_ORDER.indexOf(b.key)
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Deal info banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#252540',
          borderRadius: 8,
          marginBottom: 8,
          border: '1px solid #383850',
        }}
      >
        <div>
          <span style={{ color: '#aaa', fontSize: 13 }}>Model Type</span>
          <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>{getModelTypeLabel(data.modelType)}</div>
          <div style={{ color: '#818cf8', fontSize: 11, marginTop: 2 }}>{getEngineModeLabel(data.engineMode)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#aaa', fontSize: 13 }}>Stabilized Year</span>
          <div style={{ color: '#818cf8', fontWeight: 700, fontSize: 20 }}>Y{data.stabilizedYear}</div>
          <div style={{ color: '#888', fontSize: 11 }}>{data.stabilizationCalendarMonth} ({data.monthsToStabilization}mo)</div>
        </div>
        <div style={{ textAlign: 'right', maxWidth: 280 }}>
          <span style={{ color: '#aaa', fontSize: 13 }}>Engine</span>
          <div style={{ color: '#6366f1', fontSize: 12, marginTop: 2 }}>M07 Leass Velocity Engine</div>
        </div>
        {showMultiStrategy && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#818cf8', fontSize: 12 }}>Multi-strategy (M08) — upcoming</span>
          </div>
        )}
      </div>

      {/* Constraints panel */}
      <ConstraintsPanel
        constraints={data.constraints}
        bindingConstraint={data.bindingConstraint}
      />

      {/* Phasing toggle */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <button
          onClick={() => setShowPhased(false)}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid #383850',
            background: showPhased ? '#2a2a3e' : '#6366f1',
            color: showPhased ? '#888' : '#fff',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Fully Stabilized
        </button>
        <button
          onClick={() => setShowPhased(true)}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid #383850',
            background: showPhased ? '#6366f1' : '#2a2a3e',
            color: showPhased ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Phased Pro Forma (mock)
        </button>
      </div>

      {/* Main table */}
      <div
        style={{
          borderRadius: 8,
          border: '1px solid #383850',
          overflow: 'hidden',
          background: '#1a1a2e',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '4px 1fr 160px 160px 160px 1.5fr',
            background: '#252540',
            borderBottom: '1px solid #383850',
            fontSize: 13,
            fontWeight: 600,
            color: '#888',
          }}
        >
          <div />
          <div style={{ padding: '10px 12px' }}>LINE ITEM</div>
          <div style={{ padding: '10px 12px', textAlign: 'right' }}>CURRENT (T12)</div>
          <div style={{ padding: '10px 12px', textAlign: 'right' }}>PRO FORMA (Y{data.stabilizedYear})</div>
          <div style={{ padding: '10px 12px', textAlign: 'right' }}>Δ</div>
          <div style={{ padding: '10px 12px' }}>DRIVER</div>
        </div>

        {/* Table rows */}
        {sortedLayout.map((item) => {
          const isValuation = item.key === 'cap_rate' || item.key === 'stabilized_value';
          const isNoi = item.key === 'noi';

          return (
            <React.Fragment key={item.key}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '4px 1fr 160px 160px 160px 1.5fr',
                  borderBottom: item.isSubtotal ? '1px solid #383850' : '1px solid #2a2a3e',
                  fontSize: item.isSubtotal ? 14 : 13,
                  fontWeight: item.isSubtotal ? 700 : 400,
                  color: isNoi ? '#60a5fa' : (isValuation ? '#a78bfa' : '#e0e0e0'),
                  background: item.isSubtotal ? '#1e1e32' : 'transparent',
                }}
              >
                {/* Alert color rail */}
                <div
                  style={{
                    background: getAlertColor(item.alertLevel),
                    width: 4,
                    height: '100%',
                    minHeight: 36,
                    cursor: 'help',
                  }}
                  title={getAlertLabel(item.alertLevel)}
                />

                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.label}
                  {item.dominantSource && (
                    <span
                      style={{
                        fontSize: 10,
                        background: '#2a2a40',
                        color: '#818cf8',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      {getSourceBadge(item.dominantSource)}
                    </span>
                  )}
                </div>

                <div style={{ padding: '8px 12px', textAlign: 'right', color: item.current === null ? '#555' : undefined }}>
                  {fmt$(item.current)}
                </div>

                <div style={{ padding: '8px 12px', textAlign: 'right' }}>
                  {fmt$(item.proForma)}
                </div>

                {/* Δ column — clickable to expand bridge */}
                <div
                  style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    color: item.delta >= 0 ? '#22c55e' : '#ef4444',
                    cursor: !item.isSubtotal && item.key !== 'cap_rate' && item.key !== 'stabilized_value' ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (item.isSubtotal || item.key === 'cap_rate' || item.key === 'stabilized_value') return;
                    setExpandedBridge(expandedBridge === item.key ? null : item.key);
                  }}
                  title={item.isSubtotal ? '' : 'Click to expand bridge breakdown'}
                >
                  {item.key === 'cap_rate'
                    ? `${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(1)}bps`
                    : fmtDelta(item.delta)
                  }
                  {!item.isSubtotal && item.key !== 'cap_rate' && item.key !== 'stabilized_value' && item.current !== null && (
                    <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>
                      {fmtDeltaPct(item.delta, item.current!)}
                    </div>
                  )}
                </div>

                <div style={{ padding: '8px 12px', fontSize: 12, color: '#888' }}>
                  {item.driver}
                </div>
              </div>

              {/* Expanded bridge decomposition */}
              {expandedBridge === item.key && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '4px 1fr 160px 160px 160px 1.5fr',
                    background: '#1a1a2e',
                    borderBottom: '1px solid #2a2a3e',
                  }}
                >
                  <div style={{ background: '#6366f1', width: 4 }} />
                  <div style={{ padding: '12px 12px' }}>
                    <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Bridge Decomposition</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { label: 'Δ_market', value: item.bridge.market },
                        { label: 'Δ_platform', value: item.bridge.platform },
                        { label: 'Δ_operator', value: item.bridge.operator },
                        { label: 'Δ_capex', value: item.bridge.capex },
                        ...(item.bridge.capacity !== undefined ? [{ label: 'Δ_capacity', value: item.bridge.capacity }] : []),
                      ].map((c) => (
                        <div key={c.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ color: '#aaa', fontSize: 12, width: 90 }}>{c.label}</span>
                          <div
                            style={{
                              width: 100,
                              height: 4,
                              background: '#2a2a3e',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Math.abs(c.value) / Math.abs(item.delta) * 100)}%`,
                                height: 4,
                                background: c.value >= 0 ? '#22c55e' : '#ef4444',
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <span style={{ color: c.value >= 0 ? '#22c55e' : '#ef4444', fontSize: 12, fontWeight: 500 }}>
                            {fmt$(c.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div />
                  <div />
                  <div />
                  <div style={{ padding: '12px 12px', fontSize: 11, color: '#666', fontStyle: 'italic' }}>
                    Components must sum to Δ. Hover each component for source detail.
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Summary block */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginTop: 20,
        }}
      >
        <SummaryCard label="NOI Growth" value={fmt$(data.summary.noiGrowth)} />
        <SummaryCard label="Stabilized Value" value={fmt$(data.summary.stabilizedValue)} />
        <SummaryCard
          label="Value Creation"
          value={fmt$(data.summary.valueCreation)}
          valueColor={data.summary.valueCreation >= 0 ? '#22c55e' : '#ef4444'}
        />
        <SummaryCard label="Yield-on-Cost" value={fmtPct(data.summary.yieldOnCost)} />
        <SummaryCard label="Going-In Cap Rate" value={fmtPct(data.summary.goingInCapRate)} />
        <SummaryCard label="Exit Cap Rate" value={fmtPct(data.summary.exitCapRate)} />
        <SummaryCard label="Pro Forma NOI" value={fmt$(data.summary.proFormaNoi)} />
        <SummaryCard label="Current NOI" value={fmt$(data.summary.currentNoi)} />
      </div>

      {/* Bridge popover */}
      {expandedBridge && (
        <BridgePopover
          item={sortedLayout.find((l) => l.key === expandedBridge)!}
          onClose={() => setExpandedBridge(null)}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Summary Card Sub-Component ───────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  valueColor?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, valueColor }) => (
  <div
    style={{
      padding: '12px 16px',
      background: '#1e1e2e',
      border: '1px solid #383850',
      borderRadius: 8,
    }}
  >
    <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>{label}</div>
    <div style={{ color: valueColor ?? '#e0e0e0', fontSize: 18, fontWeight: 700 }}>
      {value}
    </div>
  </div>
);

export { StabilizedPotentialView };
