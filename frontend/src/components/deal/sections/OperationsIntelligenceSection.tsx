/**
 * OperationsIntelligenceSection — M20 Operations Intelligence
 *
 * 4 sub-panels: Variance | Recommendations | Lease Expirations | Traffic
 * All data is live from /api/v1/operations/:dealId/* — no mock data.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, ChevronRight,
  Clock, Loader2, TrendingUp, Users,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { apiClient } from '../../../services/api.client';
import { BT, MONO } from '../bloomberg-ui';

// ─── DB row types (column names exactly as returned by Postgres) ──────────────

interface DbVarianceRow {
  line_item: string;
  category: string;
  projected_value: string | number;
  actual_value: string | number;
  variance_amount: string | number;
  variance_pct: string | number;
  variance_type: 'favorable' | 'unfavorable' | 'neutral';
  severity: 'minor' | 'moderate' | 'major';
  noi_impact: string | number;
}

interface DbRecommendation {
  id: string;
  category: 'pricing' | 'occupancy' | 'expense' | 'renewal' | 'traffic' | 'collections' | 'other_income';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  estimated_monthly_impact: string | number | null;
  estimated_annual_impact: string | number | null;
  confidence_pct: string | number | null;
  suggested_actions: { action: string; detail?: string }[] | null;
  status: string;
}

interface DbLeaseRow {
  month: string;
  expiringUnits: number;
  expiringPct: number;
  rentAtRisk: number;
  avgCurrentRent: number;
  avgMarketRent: number;
  lossToLeasePct: number;
  recommendedAction: string;
  recommendedIncreasePct: number;
}

interface DbTrafficRow {
  period: string;
  projectedLeads: number;
  actualLeads: number;
  leadVariancePct: number;
  projectedMoveIns: number;
  actualMoveIns: number;
  moveInVariancePct: number;
  conversionRate: number;
  benchmarkConversion: number;
  recommendations: string[];
}

// ─── Section props ─────────────────────────────────────────────────────────────

interface OperationsIntelligenceSectionProps {
  dealId: string;
  deal?: Record<string, unknown>;
  initialPanel?: SubPanel;
  compact?: boolean;
}

type SubPanel = 'variance' | 'recommendations' | 'leases' | 'traffic';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const n = (v: string | number | null | undefined): number => Number(v ?? 0);

const fmt$ = (v: string | number | null | undefined): string => {
  const num = n(v);
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
};

const fmtPct = (v: string | number | null | undefined): string => {
  if (v == null) return '—';
  const num = n(v);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
};

const severityColor = (s: string): string => {
  if (s === 'major') return BT.text.red;
  if (s === 'moderate') return BT.text.amber;
  return BT.text.green;
};

const priorityColor = (p: string): string => {
  if (p === 'critical' || p === 'high') return BT.text.red;
  if (p === 'medium') return BT.text.amber;
  return BT.text.muted;
};

const varColor = (type: string): string => {
  if (type === 'favorable') return BT.text.green;
  if (type === 'unfavorable') return BT.text.red;
  return BT.text.muted;
};

// ─── Loading / error / empty shared components ────────────────────────────────

const LoadingRow: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
    <Loader2 size={16} style={{ color: BT.text.cyan }} className="animate-spin" />
    <span style={{ color: BT.text.secondary, fontSize: 12, fontFamily: MONO }}>LOADING…</span>
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; message: string; sub?: string }> = ({ icon, message, sub }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
    <div style={{ color: BT.text.muted }}>{icon}</div>
    <span style={{ color: BT.text.secondary, fontSize: 12, fontFamily: MONO }}>{message}</span>
    {sub != null && <span style={{ color: BT.text.muted, fontSize: 11 }}>{sub}</span>}
  </div>
);

const ErrorRow: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 12 }}>
    <AlertTriangle size={14} style={{ color: BT.text.red }} />
    <span style={{ color: BT.text.red, fontSize: 12, fontFamily: MONO }}>{message}</span>
    <button
      onClick={onRetry}
      style={{ background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, fontSize: 11, fontFamily: MONO, padding: '2px 8px', cursor: 'pointer' }}
    >
      RETRY
    </button>
  </div>
);

// ─── Variance panel ───────────────────────────────────────────────────────────

const VariancePanel: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [rows, setRows] = useState<DbVarianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; variances: DbVarianceRow[] }>(
        `/api/v1/operations/${dealId}/variances`
      );
      const raw = res.data?.variances ?? [];
      const sorted = [...raw].sort((a, b) => Math.abs(n(b.noi_impact)) - Math.abs(n(a.noi_impact)));
      setRows(sorted);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load variances');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const ROW_BORDER = `1px solid ${BT.border.subtle}`;
  const COL: React.CSSProperties = { color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 };
  const CELL: React.CSSProperties = { color: BT.text.primary, fontSize: 11, fontFamily: MONO };

  if (loading) return <LoadingRow />;
  if (error != null) return <ErrorRow message={error} onRetry={load} />;
  if (rows.length === 0) return (
    <EmptyState
      icon={<BarChart3 size={32} />}
      message="NO VARIANCE DATA"
      sub="Import actuals and projections to compute line-item variances"
    />
  );

  const totalNoi = rows.reduce((sum, r) => sum + n(r.noi_impact), 0);

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 24, padding: '10px 16px', background: BT.bg.header, borderBottom: ROW_BORDER }}>
        <div>
          <div style={COL}>TOTAL NOI IMPACT</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: totalNoi >= 0 ? BT.text.green : BT.text.red }}>
            {fmt$(totalNoi)}
          </div>
        </div>
        <div>
          <div style={COL}>LINE ITEMS</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.primary }}>{rows.length}</div>
        </div>
        <div>
          <div style={COL}>MAJOR VARIANCES</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.red }}>
            {rows.filter((r) => r.severity === 'major').length}
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 0.7fr', padding: '6px 16px', background: BT.bg.panelAlt, borderBottom: ROW_BORDER }}>
        {['LINE ITEM', 'PROJECTED', 'ACTUAL', 'VAR $', 'VAR %', 'NOI IMPACT', 'SEV'].map((h) => (
          <div key={h} style={COL}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={`${row.line_item}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 0.7fr',
            padding: '7px 16px',
            borderBottom: ROW_BORDER,
            background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
          }}
        >
          <div>
            <div style={{ ...CELL, fontWeight: 600 }}>{row.line_item.replace(/_/g, ' ').toUpperCase()}</div>
            <div style={{ color: BT.text.muted, fontSize: 9, fontFamily: MONO, textTransform: 'uppercase' }}>{row.category}</div>
          </div>
          <div style={CELL}>{fmt$(row.projected_value)}</div>
          <div style={CELL}>{fmt$(row.actual_value)}</div>
          <div style={{ ...CELL, color: varColor(row.variance_type) }}>{fmt$(row.variance_amount)}</div>
          <div style={{ ...CELL, color: varColor(row.variance_type) }}>{fmtPct(row.variance_pct)}</div>
          <div style={{ ...CELL, color: n(row.noi_impact) >= 0 ? BT.text.green : BT.text.red }}>{fmt$(row.noi_impact)}</div>
          <div>
            <span style={{
              fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.6,
              color: severityColor(row.severity),
              padding: '1px 4px',
              border: `1px solid ${severityColor(row.severity)}44`,
              textTransform: 'uppercase',
            }}>
              {row.severity}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Recommendations panel ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  pricing: 'PRICING', occupancy: 'OCCUPANCY', expense: 'EXPENSE',
  renewal: 'RENEWAL', traffic: 'TRAFFIC', collections: 'COLLECTIONS', other_income: 'OTHER INCOME',
};

const CATEGORY_ORDER = ['pricing', 'occupancy', 'renewal', 'expense', 'traffic', 'collections', 'other_income'];

const RecommendationsPanel: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [recs, setRecs] = useState<DbRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; recommendations: DbRecommendation[] }>(
        `/api/v1/operations/${dealId}/recommendations?status=pending`
      );
      setRecs(res.data?.recommendations ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleSendToFeed = async (rec: DbRecommendation) => {
    setSending((prev) => ({ ...prev, [rec.id]: true }));
    try {
      await apiClient.patch(`/api/v1/operations/recommendations/${rec.id}`, {
        status: 'implemented',
        implementation_notes: 'Sent to feed from Operations Intelligence UI',
      });
      await apiClient.post(`/api/v1/operations/${dealId}/feed-learning`, {});
      setRecs((prev) => prev.filter((r) => r.id !== rec.id));
    } catch (e: unknown) {
      console.error('[OperationsRecs] send to feed failed:', e);
    } finally {
      setSending((prev) => ({ ...prev, [rec.id]: false }));
    }
  };

  const ROW_BORDER = `1px solid ${BT.border.subtle}`;

  if (loading) return <LoadingRow />;
  if (error != null) return <ErrorRow message={error} onRetry={load} />;
  if (recs.length === 0) return (
    <EmptyState
      icon={<CheckCircle2 size={32} />}
      message="NO ACTIVE RECOMMENDATIONS"
      sub="Generate recommendations after importing actuals via the generate endpoint"
    />
  );

  // Group by category
  const byCategory: Record<string, DbRecommendation[]> = {};
  for (const rec of recs) {
    const cat = rec.category ?? 'other_income';
    if (byCategory[cat] == null) byCategory[cat] = [];
    byCategory[cat].push(rec);
  }

  const orderedCategories = CATEGORY_ORDER.filter((c) => byCategory[c] != null);

  return (
    <div>
      {orderedCategories.map((cat) => (
        <div key={cat}>
          {/* Category header */}
          <div style={{
            padding: '6px 16px',
            background: BT.bg.header,
            borderBottom: ROW_BORDER,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: BT.text.cyan, fontSize: 10, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.8 }}>
              {CATEGORY_LABELS[cat] ?? cat.toUpperCase()}
            </span>
            <span style={{ color: BT.text.muted, fontSize: 10, fontFamily: MONO }}>
              ({byCategory[cat].length})
            </span>
          </div>

          {/* Cards in this category */}
          {byCategory[cat].map((rec) => {
            const confidencePct = n(rec.confidence_pct);
            const monthlyImpact = rec.estimated_monthly_impact != null ? n(rec.estimated_monthly_impact) : null;
            const annualImpact = rec.estimated_annual_impact != null ? n(rec.estimated_annual_impact) : null;
            const isSending = sending[rec.id] === true;

            return (
              <div
                key={rec.id}
                style={{ padding: '12px 16px', borderBottom: ROW_BORDER, background: BT.bg.panel }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    {/* Priority + confidence */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.8,
                        color: priorityColor(rec.priority),
                        border: `1px solid ${priorityColor(rec.priority)}44`,
                        padding: '1px 6px',
                        textTransform: 'uppercase',
                      }}>
                        {rec.priority}
                      </span>
                      {confidencePct > 0 && (
                        <span style={{ color: BT.text.muted, fontSize: 10, fontFamily: MONO }}>
                          {confidencePct.toFixed(0)}% CONFIDENCE
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div style={{ color: BT.text.primary, fontSize: 12, fontWeight: 700, fontFamily: MONO, marginBottom: 4 }}>
                      {rec.title}
                    </div>

                    {/* Description */}
                    <div style={{ color: BT.text.secondary, fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
                      {rec.description}
                    </div>

                    {/* Impact */}
                    <div style={{ display: 'flex', gap: 20 }}>
                      {monthlyImpact != null && (
                        <div>
                          <div style={{ color: BT.text.muted, fontSize: 9, fontFamily: MONO, letterSpacing: 0.6 }}>MO IMPACT</div>
                          <div style={{ color: monthlyImpact >= 0 ? BT.text.green : BT.text.red, fontSize: 12, fontFamily: MONO, fontWeight: 700 }}>
                            {fmt$(monthlyImpact)}
                          </div>
                        </div>
                      )}
                      {annualImpact != null && (
                        <div>
                          <div style={{ color: BT.text.muted, fontSize: 9, fontFamily: MONO, letterSpacing: 0.6 }}>ANN IMPACT</div>
                          <div style={{ color: annualImpact >= 0 ? BT.text.green : BT.text.red, fontSize: 12, fontFamily: MONO, fontWeight: 700 }}>
                            {fmt$(annualImpact)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Suggested actions */}
                    {Array.isArray(rec.suggested_actions) && rec.suggested_actions.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {rec.suggested_actions.map((sa, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 10, fontFamily: MONO, color: BT.text.secondary,
                              border: `1px solid ${BT.border.medium}`, padding: '2px 8px',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <ChevronRight size={10} />
                            {sa.action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Send to feed button */}
                  <button
                    onClick={() => handleSendToFeed(rec)}
                    disabled={isSending}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${BT.text.cyan}55`,
                      color: BT.text.cyan,
                      fontSize: 10, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.8,
                      padding: '4px 10px',
                      cursor: isSending ? 'wait' : 'pointer',
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 4,
                      opacity: isSending ? 0.6 : 1,
                    }}
                  >
                    {isSending
                      ? <><Loader2 size={10} className="animate-spin" /> SENDING…</>
                      : <>SEND TO FEED</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ─── Lease Expirations panel ──────────────────────────────────────────────────

const LeaseExpirationsPanel: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [rows, setRows] = useState<DbLeaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; expirations: DbLeaseRow[] }>(
        `/api/v1/operations/${dealId}/lease-expirations?months=12`
      );
      setRows(res.data?.expirations ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load lease expirations');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const ROW_BORDER = `1px solid ${BT.border.subtle}`;
  const COL: React.CSSProperties = { color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 };
  const CELL: React.CSSProperties = { color: BT.text.primary, fontSize: 11, fontFamily: MONO };

  if (loading) return <LoadingRow />;
  if (error != null) return <ErrorRow message={error} onRetry={load} />;
  if (rows.length === 0) return (
    <EmptyState
      icon={<Clock size={32} />}
      message="NO LEASE EXPIRATION DATA"
      sub="Import a rent roll snapshot to enable lease expiration tracking"
    />
  );

  const totalRentAtRisk = rows.reduce((sum, r) => sum + (r.rentAtRisk ?? 0), 0);
  const totalUnits = rows.reduce((sum, r) => sum + (r.expiringUnits ?? 0), 0);
  const maxUnits = Math.max(...rows.map((r) => r.expiringUnits ?? 0), 1);

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 24, padding: '10px 16px', background: BT.bg.header, borderBottom: ROW_BORDER }}>
        <div>
          <div style={COL}>TOTAL UNITS EXPIRING (12 MO)</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.amber }}>{totalUnits}</div>
        </div>
        <div>
          <div style={COL}>RENT AT RISK</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.red }}>{fmt$(totalRentAtRisk)}</div>
        </div>
      </div>

      {/* Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 0.8fr 1fr 1fr 1fr 2fr', padding: '6px 16px', background: BT.bg.panelAlt, borderBottom: ROW_BORDER }}>
        {['MONTH', 'UNITS', '% TOTAL', 'RENT AT RISK', 'AVG CURR RENT', 'LOSS-TO-LEASE', 'RECOMMENDED ACTION'].map((h) => (
          <div key={h} style={COL}>{h}</div>
        ))}
      </div>

      {rows.map((row, i) => {
        const barWidth = maxUnits > 0 ? (row.expiringUnits / maxUnits) * 100 : 0;
        const isHighRisk = (row.expiringPct ?? 0) > 15;
        const barColor = isHighRisk ? BT.text.red : (row.expiringPct ?? 0) > 8 ? BT.text.amber : BT.text.green;
        return (
          <div key={`${row.month}-${i}`} style={{ borderBottom: ROW_BORDER }}>
            <div style={{ height: 3, background: BT.bg.panelAlt }}>
              <div style={{ height: '100%', width: `${barWidth}%`, background: barColor, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 0.8fr 0.8fr 1fr 1fr 1fr 2fr',
              padding: '7px 16px',
              background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
            }}>
              <div style={{ ...CELL, fontWeight: 600 }}>{row.month}</div>
              <div style={{ ...CELL, color: isHighRisk ? BT.text.red : BT.text.primary }}>{row.expiringUnits ?? '—'}</div>
              <div style={{ ...CELL, color: isHighRisk ? BT.text.red : BT.text.primary }}>
                {row.expiringPct != null ? `${row.expiringPct.toFixed(1)}%` : '—'}
              </div>
              <div style={CELL}>{fmt$(row.rentAtRisk)}</div>
              <div style={CELL}>{fmt$(row.avgCurrentRent)}</div>
              <div style={{ ...CELL, color: (row.lossToLeasePct ?? 0) > 5 ? BT.text.red : BT.text.amber }}>
                {row.lossToLeasePct != null ? `${row.lossToLeasePct.toFixed(1)}%` : '—'}
              </div>
              <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO, paddingRight: 8 }}>
                {row.recommendedAction ?? '—'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Traffic panel (line chart) ───────────────────────────────────────────────

const CHART_COLORS = {
  projectedLeads: BT.text.cyan,
  actualLeads: BT.text.amber,
  projectedMoveIns: BT.text.purple,
  actualMoveIns: BT.text.green,
};

const TrafficPanel: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [rows, setRows] = useState<DbTrafficRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; traffic: DbTrafficRow | DbTrafficRow[] }>(
        `/api/v1/operations/${dealId}/traffic?months=12`
      );
      const raw = res.data?.traffic;
      setRows(Array.isArray(raw) ? raw : raw != null ? [raw] : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load traffic data');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const ROW_BORDER = `1px solid ${BT.border.subtle}`;

  if (loading) return <LoadingRow />;
  if (error != null) return <ErrorRow message={error} onRetry={load} />;
  if (rows.length === 0) return (
    <EmptyState
      icon={<Users size={32} />}
      message="NO TRAFFIC DATA"
      sub="Import traffic funnel data to see predicted vs. actual walk-in comparisons"
    />
  );

  // Summary stats
  const totalProjLeads = rows.reduce((s, r) => s + (r.projectedLeads ?? 0), 0);
  const totalActLeads = rows.reduce((s, r) => s + (r.actualLeads ?? 0), 0);
  const totalProjMoveIns = rows.reduce((s, r) => s + (r.projectedMoveIns ?? 0), 0);
  const totalActMoveIns = rows.reduce((s, r) => s + (r.actualMoveIns ?? 0), 0);
  const leadDelta = totalProjLeads > 0 ? ((totalActLeads - totalProjLeads) / totalProjLeads) * 100 : 0;
  const moveInDelta = totalProjMoveIns > 0 ? ((totalActMoveIns - totalProjMoveIns) / totalProjMoveIns) * 100 : 0;

  // Chart data
  const chartData = rows.map((r) => ({
    period: r.period,
    'Proj Leads': r.projectedLeads ?? 0,
    'Act Leads': r.actualLeads ?? 0,
    'Proj Move-Ins': r.projectedMoveIns ?? 0,
    'Act Move-Ins': r.actualMoveIns ?? 0,
  }));

  const tooltipStyle: React.CSSProperties = {
    background: BT.bg.panelAlt,
    border: `1px solid ${BT.border.medium}`,
    fontFamily: MONO,
    fontSize: 11,
    color: BT.text.primary,
  };

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 32, padding: '10px 16px', background: BT.bg.header, borderBottom: ROW_BORDER }}>
        <div>
          <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 }}>TOTAL LEADS (PROJ)</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.cyan }}>{totalProjLeads.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 }}>TOTAL LEADS (ACT)</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.amber }}>{totalActLeads.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 }}>LEAD VARIANCE</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: leadDelta >= 0 ? BT.text.green : BT.text.red }}>
            {fmtPct(leadDelta)}
          </div>
        </div>
        <div>
          <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 }}>MOVE-IN VARIANCE</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: moveInDelta >= 0 ? BT.text.green : BT.text.red }}>
            {fmtPct(moveInDelta)}
          </div>
        </div>
      </div>

      {/* Leads chart */}
      <div style={{ padding: '16px', borderBottom: ROW_BORDER }}>
        <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8, marginBottom: 8 }}>
          PREDICTED VS ACTUAL LEADS/WEEK — TRAILING 12 MONTHS
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid stroke={BT.border.subtle} strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fill: BT.text.muted, fontSize: 10, fontFamily: MONO }} tickLine={false} axisLine={{ stroke: BT.border.subtle }} />
            <YAxis tick={{ fill: BT.text.muted, fontSize: 10, fontFamily: MONO }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: BT.text.secondary }} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: MONO, color: BT.text.secondary }} />
            <Line type="monotone" dataKey="Proj Leads" stroke={CHART_COLORS.projectedLeads} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="Act Leads" stroke={CHART_COLORS.actualLeads} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.actualLeads }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Move-ins chart */}
      <div style={{ padding: '16px', borderBottom: ROW_BORDER }}>
        <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8, marginBottom: 8 }}>
          PREDICTED VS ACTUAL MOVE-INS — TRAILING 12 MONTHS
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid stroke={BT.border.subtle} strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fill: BT.text.muted, fontSize: 10, fontFamily: MONO }} tickLine={false} axisLine={{ stroke: BT.border.subtle }} />
            <YAxis tick={{ fill: BT.text.muted, fontSize: 10, fontFamily: MONO }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: BT.text.secondary }} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: MONO, color: BT.text.secondary }} />
            <Line type="monotone" dataKey="Proj Move-Ins" stroke={CHART_COLORS.projectedMoveIns} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="Act Move-Ins" stroke={CHART_COLORS.actualMoveIns} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.actualMoveIns }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Conversion rate & recommendations rows */}
      {rows.some((r) => Array.isArray(r.recommendations) && r.recommendations.length > 0) && (
        <div style={{ padding: '12px 16px', borderBottom: ROW_BORDER }}>
          <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8, marginBottom: 8 }}>
            AI OBSERVATIONS
          </div>
          {rows.flatMap((r) => r.recommendations ?? []).slice(0, 6).map((obs, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
              <ChevronRight size={10} style={{ color: BT.text.cyan, flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO }}>{obs}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Sub-panel tab definitions ────────────────────────────────────────────────

const PANELS: { id: SubPanel; label: string; icon: React.ReactNode }[] = [
  { id: 'variance',        label: 'VARIANCE',          icon: <BarChart3 size={12} /> },
  { id: 'recommendations', label: 'RECOMMENDATIONS',    icon: <TrendingUp size={12} /> },
  { id: 'leases',          label: 'LEASE EXPIRATIONS',  icon: <Clock size={12} /> },
  { id: 'traffic',         label: 'TRAFFIC FUNNEL',     icon: <Users size={12} /> },
];

// ─── Main component ───────────────────────────────────────────────────────────

export const OperationsIntelligenceSection: React.FC<OperationsIntelligenceSectionProps> = ({ dealId, deal, initialPanel, compact }) => {
  const [activePanel, setActivePanel] = useState<SubPanel>(initialPanel ?? 'variance');

  const BORDER = `1px solid ${BT.border.subtle}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal, overflow: 'hidden' }}>

      {/* Module header — hidden in compact mode */}
      {!compact && (
        <div style={{
          padding: '8px 16px',
          background: BT.bg.header,
          borderBottom: BORDER,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} style={{ color: BT.text.cyan }} />
            <span style={{ color: BT.text.primary, fontSize: 11, fontFamily: MONO, fontWeight: 700, letterSpacing: 1 }}>
              M20 · OPERATIONS INTELLIGENCE
            </span>
            <span style={{ color: BT.text.muted, fontSize: 9, fontFamily: MONO }}>
              VARIANCE · AI RECS · LEASE EXPIRATIONS · TRAFFIC
            </span>
          </div>
          <span style={{ color: BT.text.muted, fontSize: 9, fontFamily: MONO }}>
            {(deal?.property_name as string) ?? (deal?.name as string) ?? dealId}
          </span>
        </div>
      )}

      {/* Sub-panel tabs — hidden in compact mode (parent controls active panel) */}
      {!compact && (
        <div style={{ display: 'flex', gap: 0, borderBottom: BORDER, background: BT.bg.panelAlt, flexShrink: 0 }}>
          {PANELS.map((p) => {
            const isActive = activePanel === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePanel(p.id)}
                style={{
                  background: isActive ? BT.bg.active : 'transparent',
                  border: 'none',
                  borderRight: BORDER,
                  borderBottom: isActive ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
                  color: isActive ? BT.text.cyan : BT.text.muted,
                  fontSize: 10, fontFamily: MONO, fontWeight: isActive ? 700 : 400,
                  letterSpacing: 0.8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {p.icon}
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activePanel === 'variance'        && <VariancePanel dealId={dealId} />}
        {activePanel === 'recommendations' && <RecommendationsPanel dealId={dealId} />}
        {activePanel === 'leases'          && <LeaseExpirationsPanel dealId={dealId} />}
        {activePanel === 'traffic'         && <TrafficPanel dealId={dealId} />}
      </div>

    </div>
  );
};

export default OperationsIntelligenceSection;
