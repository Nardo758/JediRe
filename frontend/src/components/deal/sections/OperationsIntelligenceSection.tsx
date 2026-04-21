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
import { apiClient } from '../../../services/api.client';
import { BT, MONO } from '../bloomberg-ui';

// ─── API response types (mirrors backend revenue-management.service.ts) ────────

interface VarianceItem {
  lineItem: string;
  category: string;
  projected: number;
  actual: number;
  varianceAmount: number;
  variancePct: number;
  varianceType: 'favorable' | 'unfavorable' | 'neutral';
  severity: 'minor' | 'moderate' | 'major';
  trend: 'improving' | 'stable' | 'worsening';
  consecutiveMonths: number;
  noiImpact: number;
}

interface DbVarianceRow {
  line_item: string;
  category: string;
  projected_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_pct: number;
  variance_type: 'favorable' | 'unfavorable' | 'neutral';
  severity: 'minor' | 'moderate' | 'major';
  trend: 'improving' | 'stable' | 'worsening';
  consecutive_months: number;
  noi_impact: number;
}

interface OperationsRecommendation {
  id: string;
  category: 'pricing' | 'occupancy' | 'expense' | 'renewal' | 'traffic' | 'collections' | 'other_income';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  estimated_monthly_impact: number;
  estimated_annual_impact: number;
  confidence: number;
  suggested_actions: { action: string; detail?: string }[] | null;
  status: string;
}

interface LeaseExpirationRow {
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

interface TrafficRow {
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
}

// ─── Sub-panel types ───────────────────────────────────────────────────────────

type SubPanel = 'variance' | 'recommendations' | 'leases' | 'traffic';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
};

const fmtPct = (v: number | null | undefined): string => {
  if (v == null) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
};

const severityColor = (s: 'minor' | 'moderate' | 'major'): string => {
  if (s === 'major') return BT.text.red;
  if (s === 'moderate') return BT.text.amber;
  return BT.text.green;
};

const priorityColor = (p: string): string => {
  if (p === 'critical' || p === 'high') return BT.text.red;
  if (p === 'medium') return BT.text.amber;
  return BT.text.muted;
};

const varianceColor = (type: string, amount: number): string => {
  if (type === 'favorable') return BT.text.green;
  if (type === 'unfavorable') return BT.text.red;
  return BT.text.muted;
};

// ─── Loading & error states ───────────────────────────────────────────────────

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
  const [rows, setRows] = useState<VarianceItem[]>([]);
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
      const mapped: VarianceItem[] = raw.map((r) => ({
        lineItem: r.line_item,
        category: r.category,
        projected: r.projected_amount,
        actual: r.actual_amount,
        varianceAmount: r.variance_amount,
        variancePct: r.variance_pct,
        varianceType: r.variance_type,
        severity: r.severity,
        trend: r.trend,
        consecutiveMonths: r.consecutive_months,
        noiImpact: r.noi_impact,
      }));
      const sorted = [...mapped].sort((a, b) => Math.abs(b.varianceAmount) - Math.abs(a.varianceAmount));
      setRows(sorted);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load variances';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const COL = { color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 };
  const CELL = { color: BT.text.primary, fontSize: 11, fontFamily: MONO };
  const ROW_BORDER = `1px solid ${BT.border.subtle}`;

  if (loading) return <LoadingRow />;
  if (error != null) return <ErrorRow message={error} onRetry={load} />;
  if (rows.length === 0) return (
    <EmptyState
      icon={<BarChart3 size={32} />}
      message="NO VARIANCE DATA"
      sub="Import actuals and projections to compute line-item variances"
    />
  );

  const totalNoiImpact = rows.reduce((sum, r) => sum + r.noiImpact, 0);

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 24, padding: '10px 16px', background: BT.bg.header, borderBottom: ROW_BORDER, marginBottom: 0 }}>
        <div>
          <div style={{ ...COL }}>TOTAL NOI IMPACT</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: totalNoiImpact >= 0 ? BT.text.green : BT.text.red }}>
            {fmt$(totalNoiImpact)}
          </div>
        </div>
        <div>
          <div style={{ ...COL }}>LINE ITEMS</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.primary }}>{rows.length}</div>
        </div>
        <div>
          <div style={{ ...COL }}>MAJOR VARIANCES</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.red }}>
            {rows.filter((r) => r.severity === 'major').length}
          </div>
        </div>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr 0.7fr', padding: '6px 16px', background: BT.bg.panelAlt, borderBottom: ROW_BORDER }}>
        {['LINE ITEM', 'PROJECTED', 'ACTUAL', 'VAR $', 'VAR %', 'NOI IMPACT', 'SEVERITY'].map((h) => (
          <div key={h} style={{ ...COL }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div>
        {rows.map((row, i) => (
          <div
            key={`${row.lineItem}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr 0.7fr',
              padding: '7px 16px',
              borderBottom: ROW_BORDER,
              background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
            }}
          >
            <div>
              <div style={{ ...CELL, fontWeight: 600 }}>{row.lineItem}</div>
              <div style={{ color: BT.text.muted, fontSize: 9, fontFamily: MONO, textTransform: 'uppercase' }}>{row.category}</div>
            </div>
            <div style={{ ...CELL }}>{fmt$(row.projected)}</div>
            <div style={{ ...CELL }}>{fmt$(row.actual)}</div>
            <div style={{ ...CELL, color: varianceColor(row.varianceType, row.varianceAmount) }}>
              {fmt$(row.varianceAmount)}
            </div>
            <div style={{ ...CELL, color: varianceColor(row.varianceType, row.varianceAmount) }}>
              {fmtPct(row.variancePct)}
            </div>
            <div style={{ ...CELL, color: row.noiImpact >= 0 ? BT.text.green : BT.text.red }}>
              {fmt$(row.noiImpact)}
            </div>
            <div>
              <span style={{
                fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.8,
                color: severityColor(row.severity),
                padding: '2px 5px',
                border: `1px solid ${severityColor(row.severity)}44`,
                textTransform: 'uppercase',
              }}>
                {row.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Recommendations panel ────────────────────────────────────────────────────

const RecommendationsPanel: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [recs, setRecs] = useState<OperationsRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; recommendations: OperationsRecommendation[] }>(
        `/api/v1/operations/${dealId}/recommendations?status=pending`
      );
      setRecs(res.data?.recommendations ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load recommendations';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id: string) => {
    setResolving((prev) => ({ ...prev, [id]: true }));
    try {
      await apiClient.patch(`/api/v1/operations/recommendations/${id}`, { status: 'resolved' });
      setRecs((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      console.error('[OperationsRecs] resolve failed:', e);
    } finally {
      setResolving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const CATEGORY_LABELS: Record<string, string> = {
    pricing: 'PRICING', occupancy: 'OCCUPANCY', expense: 'EXPENSE',
    renewal: 'RENEWAL', traffic: 'TRAFFIC', collections: 'COLLECTIONS', other_income: 'OTHER INCOME',
  };

  const ROW_BORDER = `1px solid ${BT.border.subtle}`;

  if (loading) return <LoadingRow />;
  if (error != null) return <ErrorRow message={error} onRetry={load} />;
  if (recs.length === 0) return (
    <EmptyState
      icon={<CheckCircle2 size={32} />}
      message="NO ACTIVE RECOMMENDATIONS"
      sub="Generate recommendations after importing actuals or use the generate endpoint"
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {recs.map((rec) => (
        <div
          key={rec.id}
          style={{
            background: BT.bg.panel,
            borderBottom: ROW_BORDER,
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              {/* Header row */}
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
                <span style={{
                  fontSize: 9, fontFamily: MONO, fontWeight: 600, letterSpacing: 0.5,
                  color: BT.text.cyan, border: `1px solid ${BT.text.cyan}33`, padding: '1px 6px',
                  textTransform: 'uppercase',
                }}>
                  {CATEGORY_LABELS[rec.category] ?? rec.category}
                </span>
                <span style={{ color: BT.text.muted, fontSize: 10, fontFamily: MONO }}>
                  {rec.confidence != null ? `${Math.round(rec.confidence * 100)}% CONFIDENCE` : ''}
                </span>
              </div>

              {/* Title */}
              <div style={{ color: BT.text.primary, fontSize: 12, fontWeight: 700, fontFamily: MONO, marginBottom: 4 }}>
                {rec.title}
              </div>

              {/* Description */}
              <div style={{ color: BT.text.secondary, fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
                {rec.description}
              </div>

              {/* Impact row */}
              <div style={{ display: 'flex', gap: 20 }}>
                {rec.estimated_monthly_impact != null && (
                  <div>
                    <div style={{ color: BT.text.muted, fontSize: 9, fontFamily: MONO, letterSpacing: 0.6 }}>MONTHLY IMPACT</div>
                    <div style={{ color: rec.estimated_monthly_impact >= 0 ? BT.text.green : BT.text.red, fontSize: 12, fontFamily: MONO, fontWeight: 700 }}>
                      {fmt$(rec.estimated_monthly_impact)}
                    </div>
                  </div>
                )}
                {rec.estimated_annual_impact != null && (
                  <div>
                    <div style={{ color: BT.text.muted, fontSize: 9, fontFamily: MONO, letterSpacing: 0.6 }}>ANNUAL IMPACT</div>
                    <div style={{ color: rec.estimated_annual_impact >= 0 ? BT.text.green : BT.text.red, fontSize: 12, fontFamily: MONO, fontWeight: 700 }}>
                      {fmt$(rec.estimated_annual_impact)}
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

            {/* Resolve button */}
            <button
              onClick={() => handleResolve(rec.id)}
              disabled={resolving[rec.id] === true}
              style={{
                background: 'transparent',
                border: `1px solid ${BT.text.green}55`,
                color: BT.text.green,
                fontSize: 10, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.8,
                padding: '4px 10px',
                cursor: resolving[rec.id] ? 'wait' : 'pointer',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: resolving[rec.id] ? 0.6 : 1,
              }}
            >
              {resolving[rec.id] === true
                ? <><Loader2 size={10} className="animate-spin" /> SENDING…</>
                : <><CheckCircle2 size={10} /> MARK RESOLVED</>
              }
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Lease Expirations panel ──────────────────────────────────────────────────

const LeaseExpirationsPanel: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [rows, setRows] = useState<LeaseExpirationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; expirations: LeaseExpirationRow[] }>(
        `/api/v1/operations/${dealId}/lease-expirations?months=12`
      );
      setRows(res.data?.expirations ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load lease expirations';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const ROW_BORDER = `1px solid ${BT.border.subtle}`;
  const COL = { color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 };
  const CELL = { color: BT.text.primary, fontSize: 11, fontFamily: MONO };

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
          <div style={{ ...COL }}>TOTAL UNITS AT RISK</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.amber }}>{totalUnits}</div>
        </div>
        <div>
          <div style={{ ...COL }}>RENT AT RISK (12 MO)</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.red }}>{fmt$(totalRentAtRisk)}</div>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 0.8fr 1fr 1fr 1fr 2fr', padding: '6px 16px', background: BT.bg.panelAlt, borderBottom: ROW_BORDER }}>
        {['MONTH', 'UNITS', '% OF TOTAL', 'RENT AT RISK', 'AVG CURR RENT', 'LOSS-TO-LEASE', 'RECOMMENDED ACTION'].map((h) => (
          <div key={h} style={{ ...COL }}>{h}</div>
        ))}
      </div>

      {/* Bar + data rows */}
      {rows.map((row, i) => {
        const barWidth = maxUnits > 0 ? (row.expiringUnits / maxUnits) * 100 : 0;
        const isHighRisk = row.expiringPct > 15;
        return (
          <div key={`${row.month}-${i}`} style={{ borderBottom: ROW_BORDER }}>
            {/* Bar visualization */}
            <div style={{ height: 3, background: BT.bg.panelAlt }}>
              <div style={{
                height: '100%',
                width: `${barWidth}%`,
                background: isHighRisk ? BT.text.red : row.expiringPct > 8 ? BT.text.amber : BT.text.green,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 0.8fr 0.8fr 1fr 1fr 1fr 2fr',
              padding: '7px 16px',
              background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
            }}>
              <div style={{ ...CELL, fontWeight: 600 }}>{row.month}</div>
              <div style={{ ...CELL, color: isHighRisk ? BT.text.red : BT.text.primary }}>
                {row.expiringUnits ?? '—'}
              </div>
              <div style={{ ...CELL, color: isHighRisk ? BT.text.red : BT.text.primary }}>
                {row.expiringPct != null ? `${row.expiringPct.toFixed(1)}%` : '—'}
              </div>
              <div style={{ ...CELL }}>{fmt$(row.rentAtRisk)}</div>
              <div style={{ ...CELL }}>{fmt$(row.avgCurrentRent)}</div>
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

// ─── Traffic panel ────────────────────────────────────────────────────────────

const TrafficPanel: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [rows, setRows] = useState<TrafficRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; traffic: TrafficRow[] | TrafficRow }>(
        `/api/v1/operations/${dealId}/traffic?months=12`
      );
      const raw = res.data?.traffic;
      const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      setRows(arr);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load traffic data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const ROW_BORDER = `1px solid ${BT.border.subtle}`;
  const COL = { color: BT.text.secondary, fontSize: 10, fontFamily: MONO, letterSpacing: 0.8 };
  const CELL = { color: BT.text.primary, fontSize: 11, fontFamily: MONO };

  if (loading) return <LoadingRow />;
  if (error != null) return <ErrorRow message={error} onRetry={load} />;
  if (rows.length === 0) return (
    <EmptyState
      icon={<Users size={32} />}
      message="NO TRAFFIC DATA"
      sub="Import traffic funnel data to see predicted vs. actual walk-in comparisons"
    />
  );

  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 1fr 0.8fr 0.8fr', padding: '6px 16px', background: BT.bg.panelAlt, borderBottom: ROW_BORDER }}>
        {['PERIOD', 'PROJ LEADS', 'ACT LEADS', 'LEAD VAR', 'PROJ MOVE-INS', 'ACT MOVE-INS', 'MOVE-IN VAR', 'CONV RATE'].map((h) => (
          <div key={h} style={{ ...COL }}>{h}</div>
        ))}
      </div>

      {rows.map((row, i) => {
        const leadVar = row.leadVariancePct ?? 0;
        const moveInVar = row.moveInVariancePct ?? 0;
        return (
          <div key={`${row.period}-${i}`}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 1fr 0.8fr 0.8fr',
              padding: '7px 16px',
              borderBottom: ROW_BORDER,
              background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
            }}>
              <div style={{ ...CELL, fontWeight: 600 }}>{row.period}</div>
              <div style={{ ...CELL }}>{row.projectedLeads ?? '—'}</div>
              <div style={{ ...CELL }}>{row.actualLeads ?? '—'}</div>
              <div style={{ ...CELL, color: leadVar >= 0 ? BT.text.green : BT.text.red }}>
                {row.leadVariancePct != null ? fmtPct(row.leadVariancePct) : '—'}
              </div>
              <div style={{ ...CELL }}>{row.projectedMoveIns ?? '—'}</div>
              <div style={{ ...CELL }}>{row.actualMoveIns ?? '—'}</div>
              <div style={{ ...CELL, color: moveInVar >= 0 ? BT.text.green : BT.text.red }}>
                {row.moveInVariancePct != null ? fmtPct(row.moveInVariancePct) : '—'}
              </div>
              <div style={{ ...CELL, color: (row.conversionRate ?? 0) >= (row.benchmarkConversion ?? 0) ? BT.text.green : BT.text.amber }}>
                {row.conversionRate != null ? `${(row.conversionRate * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            {/* Inline recommendations */}
            {Array.isArray(row.recommendations) && row.recommendations.length > 0 && (
              <div style={{ padding: '4px 16px 8px', background: BT.bg.panelAlt, borderBottom: ROW_BORDER }}>
                {row.recommendations.map((rec, ri) => (
                  <div key={ri} style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ChevronRight size={9} style={{ color: BT.text.cyan }} />
                    {rec}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const PANELS: { id: SubPanel; label: string; icon: React.ReactNode }[] = [
  { id: 'variance',        label: 'VARIANCE',        icon: <BarChart3 size={12} /> },
  { id: 'recommendations', label: 'RECOMMENDATIONS',  icon: <TrendingUp size={12} /> },
  { id: 'leases',          label: 'LEASE EXPIRATIONS', icon: <Clock size={12} /> },
  { id: 'traffic',         label: 'TRAFFIC FUNNEL',   icon: <Users size={12} /> },
];

export const OperationsIntelligenceSection: React.FC<OperationsIntelligenceSectionProps> = ({ dealId, deal }) => {
  const [activePanel, setActivePanel] = useState<SubPanel>('variance');

  const BORDER = `1px solid ${BT.border.subtle}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal, overflow: 'hidden' }}>

      {/* Module header */}
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
          {deal?.property_name as string || deal?.name as string || dealId}
        </span>
      </div>

      {/* Sub-panel tabs */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: BORDER,
        background: BT.bg.panelAlt,
        flexShrink: 0,
      }}>
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
