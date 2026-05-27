import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, Lock, AlertTriangle, TrendingUp } from 'lucide-react';
import { apiClient } from '../../../services/api.client';

const MONO = 'system-ui, sans-serif';
const BT = 10;

// ─── Types ──────────────────────────────────────────────────────────────────

interface RenovationData {
  totalUnits: number;
  yearRenovated: number | null;
  inPlaceRent: number | null;
  renovationUnits: number;
  currentTierId: string | null;
  availableTiers: {
    id: string;
    label: string;
    costRange: [number, number];
    premiumRange: [number, number];
    premiumCenter: number;
    absorptionUnitsMonth: number;
  }[];
  defaultTier: {
    id: string;
    label: string;
    costRange: [number, number];
    premiumRange: [number, number];
    premiumCenter: number;
  };
  overridePremium: number | null;
  premiumRamp: {
    year: number;
    premiumDecimal: number;
    premiumPct: number;
    premiumDeltaDollar: number | null;
    realizationPct: number;
  }[];
  capexItems: {
    id: string;
    category: string;
    description: string | null;
    vendor: string | null;
    budgeted: number;
    actual: number;
    remaining: number;
    startDate: string | null;
    completionDate: string | null;
    completionPct: number | null;
    status: string | null;
    source: string | null;
  }[];
  capexSummary: {
    totalBudgeted: number;
    totalActual: number;
    totalRemaining: number;
  };
  rehabCost: number | null;
  rehabCostPerUnit: number | null;
}

// ─── Premium ramp bar chart ─────────────────────────────────────────────

function PremiumRampChart({ ramp }: { ramp: RenovationData['premiumRamp'] }) {
  if (!ramp?.length) return null;
  const maxPremium = Math.max(...ramp.map(r => r.premiumPct));

  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60, padding: '4px 0' }}>
      {ramp.map(r => {
        const pct = r.premiumPct;
        const barHeight = maxPremium > 0 ? (pct / maxPremium) * 50 : 0;
        const isFading = r.year >= 3;
        return (
          <div key={r.year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div
              title={`Year ${r.year}: ${pct}% rent premium${r.premiumDeltaDollar != null ? ` ($${r.premiumDeltaDollar}/unit)` : ''}${isFading ? '\nPremium fading' : ''}`}
              style={{
                width: 22,
                height: Math.max(barHeight, 4),
                background: isFading
                  ? `linear-gradient(to top, #f59e0b40, #f59e0b${Math.round(r.realizationPct * 100).toString(16).padStart(2, '0')})`
                  : '#10b981',
                borderRadius: '3px 3px 0 0',
                opacity: isFading ? 0.5 + (r.realizationPct * 0.5) : 1,
                transition: 'height 0.3s',
              }}
            />
            <span style={{ fontSize: 7, color: '#64748b' }}>{pct}%</span>
            <span style={{ fontSize: 7, color: '#475569' }}>Y{r.year}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────

interface RenovationAssumptionsProps {
  dealId: string;
  dealType: string;
  collapsed: boolean;
  onToggle: () => void;
}

export function RenovationAssumptionsSection({
  dealId,
  dealType,
  collapsed,
  onToggle,
}: RenovationAssumptionsProps) {
  const [data, setData] = useState<RenovationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tierSaved, setTierSaved] = useState(false);

  const isRedevelopment = dealType === 'redevelopment';
  const isValueAdd = dealType === 'value_add';

  // Fetch renovation data
  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    apiClient.get(`/api/v1/deals/${dealId}/renovation`)
      .then(res => {
        const d = res.data?.data;
        if (d) {
          setData(d);
          setSelectedTier(d.currentTierId || d.defaultTier?.id || 'moderate');
        }
      })
      .catch(err => {
        console.warn('Renovation data not available:', err.message);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  // Set premium tier
  const handleTierChange = useCallback(async (tierId: string) => {
    setSelectedTier(tierId);
    setSaving(true);
    setTierSaved(false);
    try {
      const res = await apiClient.post(`/api/v1/deals/${dealId}/renovation/premium`, { tierId });
      if (res.data?.data?.premiumRamp) {
        setData(prev => prev ? {
          ...prev,
          currentTierId: tierId,
          premiumRamp: res.data.data.premiumRamp,
        } : prev);
      }
      setTierSaved(true);
      setTimeout(() => setTierSaved(false), 2000);
    } catch (err: any) {
      console.warn('Failed to set tier:', err.message);
    }
    setSaving(false);
  }, [dealId]);

  // Format $/unit
  const fmt$ = (n: number | null | undefined) => {
    if (n == null) return '—';
    return '$' + n.toLocaleString();
  };

  const fmtPct = (n: number | null | undefined, dec = 0) => {
    if (n == null) return '—';
    return (n * 100).toFixed(dec) + '%';
  };

  if (loading) {
    return (
      <tr><td colSpan={12} style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 10 }}>
        Loading renovation data…
      </td></tr>
    );
  }

  if (error || !data) {
    return null; // Hide section if data unavailable
  }

  const tierInfo = data.availableTiers.find(t => t.id === selectedTier) || data.defaultTier;
  const isCollapsed = collapsed;

  return (
    <React.Fragment>
      {/* Section header */}
      <tr
        style={{ background: '#181818', borderTop: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e', height: 22, cursor: 'pointer' }}
        onClick={onToggle}
      >
        <td colSpan={12} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 'bold', color: '#e2e8f0', background: '#181818', position: 'sticky', left: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isCollapsed
              ? <ChevronRight className="w-3 h-3 text-slate-500" />
              : <ChevronDown className="w-3 h-3 text-slate-500" />
            }
            <span className="text-[11px] font-bold">🏗️ {isRedevelopment ? 'REDEVELOPMENT' : isValueAdd ? 'VALUE-ADD RENOVATION' : 'DEVELOPMENT COST STRUCTURE'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 8, color: '#64748b' }}>
              {tierInfo?.label ?? ''}{(isRedevelopment || isValueAdd) ? ` — ${tierInfo ? fmtPct(data.premiumRamp?.[0]?.premiumDecimal) : ''} premium` : ''}
            </span>
          </span>
        </td>
      </tr>

      {!isCollapsed && (
        <>
          {/* ── Redevelopment / Value-add: Premium tier picker + ramp ── */}
          {(isRedevelopment || isValueAdd) && (
            <tr style={{ borderBottom: '1px solid #1e1e1e1a' }}>
              <td colSpan={12} style={{ padding: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>

                  {/* Row 1: Tier picker + details */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {/* Tier selector */}
                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>RENOVATION SCOPE</div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {data.availableTiers.map(tier => (
                          <button
                            key={tier.id}
                            onClick={() => handleTierChange(tier.id)}
                            disabled={saving}
                            style={{
                              padding: '6px 12px',
                              fontSize: 10,
                              fontFamily: 'system-ui, sans-serif',
                              fontWeight: selectedTier === tier.id ? 700 : 400,
                              background: selectedTier === tier.id ? '#1d4ed8' : '#1e293b',
                              color: selectedTier === tier.id ? '#fff' : '#94a3b8',
                              border: selectedTier === tier.id ? '1px solid #3b82f6' : '1px solid #334155',
                              borderRadius: 6,
                              cursor: 'pointer',
                              opacity: saving ? 0.5 : 1,
                              transition: 'all 0.15s',
                            }}
                          >
                            {tier.label}
                          </button>
                        ))}
                      </div>
                      {tierSaved && (
                        <div style={{ fontSize: 9, color: '#10b981', marginTop: 4 }}>
                          ✓ Tier saved — premium curve recalculated
                        </div>
                      )}
                    </div>

                    {/* Tier details */}
                    {tierInfo && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: '4px 16px', fontSize: 9, color: '#94a3b8' }}>
                        <span>Cost/unit:</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                          {fmt$(tierInfo.costRange[0])} – {fmt$(tierInfo.costRange[1])}
                        </span>
                        <span>Premium target:</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                          {fmtPct(tierInfo.premiumRange[0])} – {fmtPct(tierInfo.premiumRange[1])}
                        </span>
                        <span>Absorption:</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                          {tierInfo.absorptionUnitsMonth} units/month
                        </span>
                        <span>Units renovated:</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                          {data.renovationUnits.toLocaleString()} of {data.totalUnits.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Premium ramp chart */}
                  {data.premiumRamp?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>PREMIUM RAMP + FADE</div>
                      <PremiumRampChart ramp={data.premiumRamp} />
                      <div style={{ display: 'flex', gap: 16, fontSize: 8, color: '#64748b', marginTop: 4 }}>
                        {data.premiumRamp.map(r => {
                          const isFading = r.year >= 3;
                          return (
                            <span key={r.year} style={{ color: isFading ? '#f59e0b' : '#10b981' }}>
                              Y{r.year}: {r.premiumPct}% lift{r.premiumDeltaDollar != null ? ` ($${r.premiumDeltaDollar}/mo)` : ''}
                              {isFading ? '↘' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Row 3: Key metrics */}
                  <div style={{ display: 'flex', gap: 24, fontSize: 9, color: '#94a3b8' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>In-Place Rent: </span>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {data.inPlaceRent != null ? fmt$(data.inPlaceRent) : '—'}/mo
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Total Rehab Budget: </span>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {data.rehabCost != null ? '$' + (data.rehabCost / 1000000).toFixed(1) + 'M' : '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Rehab/Unit: </span>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {data.rehabCostPerUnit != null ? fmt$(data.rehabCostPerUnit) : '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Year Renovated: </span>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {data.yearRenovated || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Capex items table */}
                  {data.capexItems?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4, marginTop: 8 }}>
                        CAPEX LINE ITEMS — from deal_capex_items
                      </div>
                      <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#64748b', borderBottom: '1px solid #1e1e1e' }}>
                            <th style={{ padding: '2px 8px', textAlign: 'left' }}>Category</th>
                            <th style={{ padding: '2px 8px', textAlign: 'left' }}>Description</th>
                            <th style={{ padding: '2px 8px', textAlign: 'left' }}>Vendor</th>
                            <th style={{ padding: '2px 8px', textAlign: 'right' }}>Budgeted</th>
                            <th style={{ padding: '2px 8px', textAlign: 'right' }}>Actual</th>
                            <th style={{ padding: '2px 8px', textAlign: 'right' }}>Remaining</th>
                            <th style={{ padding: '2px 8px', textAlign: 'center' }}>% Done</th>
                            <th style={{ padding: '2px 8px', textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.capexItems.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #1e1e1e1a' }}>
                              <td style={{ padding: '2px 8px', color: '#94a3b8' }}>
                                {item.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </td>
                              <td style={{ padding: '2px 8px', color: '#e2e8f0' }}>
                                {item.description || '—'}
                              </td>
                              <td style={{ padding: '2px 8px', color: '#94a3b8' }}>
                                {item.vendor || '—'}
                              </td>
                              <td style={{ padding: '2px 8px', textAlign: 'right', color: '#e2e8f0' }}>
                                {fmt$(item.budgeted)}
                              </td>
                              <td style={{ padding: '2px 8px', textAlign: 'right', color: '#10b981' }}>
                                {item.actual > 0 ? fmt$(item.actual) : '—'}
                              </td>
                              <td style={{ padding: '2px 8px', textAlign: 'right', color: item.remaining > 0 ? '#f59e0b' : '#64748b' }}>
                                {item.remaining > 0 ? fmt$(item.remaining) : '—'}
                              </td>
                              <td style={{ padding: '2px 8px', textAlign: 'center', color: '#94a3b8' }}>
                                {item.completionPct != null ? item.completionPct + '%' : '—'}
                              </td>
                              <td style={{ padding: '2px 8px', textAlign: 'center' }}>
                                <span style={{
                                  color: item.status === 'completed' ? '#10b981'
                                    : item.status === 'in_progress' ? '#3b82f6'
                                    : item.status === 'planned' ? '#f59e0b' : '#64748b',
                                }}>
                                  {item.status ? item.status.replace(/_/g, ' ') : '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {/* Summary row */}
                          <tr style={{ borderTop: '2px solid #1e1e1e', fontWeight: 'bold' }}>
                            <td colSpan={3} style={{ padding: '4px 8px', color: '#94a3b8', fontSize: 9 }}>
                              Total
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0' }}>
                              {fmt$(data.capexSummary.totalBudgeted)}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', color: '#10b981' }}>
                              {data.capexSummary.totalActual > 0 ? fmt$(data.capexSummary.totalActual) : '—'}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b' }}>
                              {data.capexSummary.totalRemaining > 0 ? fmt$(data.capexSummary.totalRemaining) : '—'}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* No capex items */}
                  {(!data.capexItems || data.capexItems.length === 0) && (
                    <div style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>
                      No capex line items set. Navigate to Sources & Uses to add renovation capex items.
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )}

          {/* ── Development: Hard/Soft/Contingency cost structure ── */}
          {!isRedevelopment && !isValueAdd && (
            <tr style={{ borderBottom: '1px solid #1e1e1e1a' }}>
              <td colSpan={12} style={{ padding: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>
                    Development cost structure — populate via the proforma or enter directly in the Sources & Uses tab.
                    The TDC stack (Hard Cost + Soft Cost + Contingency + Developer Fee + Land) determines the
                    development yield.
                  </div>

                  {/* Placeholder for TDC columns from deal_assumptions */}
                  <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid #1e1e1e' }}>
                        <th style={{ padding: '2px 8px', textAlign: 'left' }}>Cost Category</th>
                        <th style={{ padding: '2px 8px', textAlign: 'right' }}>Total ($)</th>
                        <th style={{ padding: '2px 8px', textAlign: 'right' }}>$/SF</th>
                        <th style={{ padding: '2px 8px', textAlign: 'right' }}>$/Unit</th>
                        <th style={{ padding: '2px 8px', textAlign: 'center' }}>% of TDC</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #1e1e1e1a' }}>
                        <td style={{ padding: '2px 8px', color: '#94a3b8' }}>Land</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'center', color: '#64748b' }}>—</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #1e1e1e1a' }}>
                        <td style={{ padding: '2px 8px', color: '#94a3b8' }}>Hard Cost</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'center', color: '#64748b' }}>—</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #1e1e1e1a' }}>
                        <td style={{ padding: '2px 8px', color: '#94a3b8' }}>Soft Cost (25% default)</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'center', color: '#64748b' }}>—</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #1e1e1e1a' }}>
                        <td style={{ padding: '2px 8px', color: '#94a3b8' }}>Contingency (5% default)</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'right', color: '#64748b' }}>—</td>
                        <td style={{ padding: '2px 8px', textAlign: 'center', color: '#64748b' }}>—</td>
                      </tr>
                      <tr style={{ borderTop: '2px solid #1e1e1e' }}>
                        <td style={{ padding: '4px 8px', color: '#94a3b8', fontWeight: 'bold' }}>Total TDC</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0' }}>—</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0' }}>—</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0' }}>—</td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', color: '#e2e8f0' }}>100%</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ fontSize: 8, color: '#64748b', fontStyle: 'italic' }}>
                    TDC values populate from the deal financial model when built. Enter hard/soft/contingency in the
                    proforma to see live calculations here.
                  </div>
                </div>
              </td>
            </tr>
          )}
        </>
      )}
    </React.Fragment>
  );
}
