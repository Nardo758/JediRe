import React, { useState, useEffect } from 'react';
import { BT, Bd } from '../bloomberg-ui';
import { apiClient } from '@/services/api.client';
import { MONO } from './strategy-v2.utils';

interface CompSet {
  id: string;
  comp_count: number;
  median_price_per_unit: number;
  avg_price_per_unit: number;
  min_price_per_unit: number;
  max_price_per_unit: number;
  median_implied_cap_rate: number | null;
  avg_implied_cap_rate: number | null;
  comps: CompTransaction[];
}

interface CompTransaction {
  id: string;
  recording_date: string;
  property_address: string;
  units: number;
  year_built: number;
  derived_sale_price: number;
  price_per_unit: number;
  implied_cap_rate: number | null;
  grantee_name: string;
  buyer_type: string;
  distance_miles: number;
}

function fmtPpu(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  } catch {
    return d;
  }
}

const COL_WIDTHS = '1fr 36px 60px 56px 40px 32px';

export function StrategyCompsPanel({ dealId }: { dealId: string }) {
  const [compSet, setCompSet] = useState<CompSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    apiClient.get(`/api/v1/deals/${dealId}/comps`)
      .then((res: any) => {
        const body = res.data as { success?: boolean; data?: CompSet };
        if (body?.success && body.data) setCompSet(body.data);
        else setCompSet(null);
      })
      .catch((err: any) => {
        if (err?.response?.status === 404) {
          setCompSet(null);
        } else {
          setError(err?.response?.data?.error || err?.message || 'Failed to load comps');
        }
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  const handleGenerate = () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    apiClient.post(`/api/v1/deals/${dealId}/comps/generate`, {
      radius_miles: 3.0,
      date_range_months: 24,
      min_units: 50,
      max_units: 500,
      exclude_distress: true,
      arms_length_only: true,
    })
      .then((res: any) => {
        const body = res.data as { success?: boolean; data?: CompSet };
        if (body?.success && body.data) setCompSet(body.data);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.error || err?.message || 'Failed to generate comps');
      })
      .finally(() => setGenerating(false));
  };

  const handleViewInM27 = () => {
    window.dispatchEvent(new CustomEvent('deal-tab-change', { detail: 'comps' }));
  };

  const METRICS = compSet ? [
    { label: 'MEDIAN $/UNIT',  value: fmtPpu(compSet.median_price_per_unit), color: BT.text.green },
    { label: 'MEDIAN CAP RATE', value: compSet.median_implied_cap_rate != null ? `${(compSet.median_implied_cap_rate * 100).toFixed(2)}%` : '—', color: BT.text.cyan },
    { label: 'COMP COUNT',     value: String(compSet.comp_count), color: BT.text.amber },
    { label: 'PRICE RANGE',    value: `${fmtPpu(compSet.min_price_per_unit)} – ${fmtPpu(compSet.max_price_per_unit)}`, color: BT.text.secondary },
  ] : [];

  return (
    <div style={{ marginBottom: 1, borderTop: `2px solid ${BT.text.green}`, background: BT.bg.panel }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 12px',
          borderBottom: `1px solid ${BT.border.subtle}`,
          cursor: 'pointer',
          background: BT.bg.header,
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green, letterSpacing: 0.5 }}>
            COMP INTELLIGENCE
          </span>
          {compSet && !loading && (
            <Bd c={BT.text.green}>{compSet.comp_count} COMPS · 3mi · 24mo</Bd>
          )}
          {!compSet && !loading && !error && (
            <Bd c={BT.text.muted}>NO COMP SET</Bd>
          )}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>
          {collapsed ? '▶ SHOW' : '▼ HIDE'}
        </span>
      </div>

      {!collapsed && (
        <div>
          {loading && (
            <div style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
              Loading comp data…
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 9, color: BT.text.red }}>
              ERROR — {error}
            </div>
          )}

          {!loading && !error && !compSet && (
            <div style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
              flexWrap: 'wrap' as const,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                No comp set — generate to ground price ceiling in real transactions.
              </span>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  color: BT.text.green,
                  background: `${BT.text.green}18`,
                  border: `1px solid ${BT.text.green}44`,
                  padding: '4px 14px',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap' as const,
                  opacity: generating ? 0.6 : 1,
                  letterSpacing: 0.3,
                }}
              >
                {generating ? 'GENERATING…' : '⊕ GENERATE COMPS'}
              </button>
            </div>
          )}

          {!loading && !error && compSet && (
            <div style={{ padding: '8px 12px' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1, background: BT.border.subtle, marginBottom: 6,
              }}>
                {METRICS.map(m => (
                  <div key={m.label} style={{ background: BT.bg.panel, padding: '5px 8px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>{m.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: m.color, marginTop: 1 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {compSet.comps && compSet.comps.length > 0 && (
                <div style={{ maxHeight: 160, overflowY: 'auto', border: `1px solid ${BT.border.subtle}` }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: COL_WIDTHS,
                    gap: 4, padding: '3px 6px',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    background: BT.bg.header,
                    position: 'sticky' as const, top: 0,
                  }}>
                    {['ADDRESS', 'UNITS', '$/UNIT', 'CAP', 'DATE', 'MI'].map(h => (
                      <span key={h} style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>{h}</span>
                    ))}
                  </div>
                  {compSet.comps.slice(0, 8).map((c, idx) => (
                    <div key={c.id ?? idx} style={{
                      display: 'grid', gridTemplateColumns: COL_WIDTHS,
                      gap: 4, padding: '3px 6px',
                      background: idx % 2 === 0 ? 'transparent' : `${BT.border.subtle}50`,
                      alignItems: 'center',
                      borderBottom: `1px solid ${BT.border.subtle}40`,
                    }}>
                      <span
                        style={{ fontFamily: MONO, fontSize: 7, color: BT.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}
                        title={c.property_address}
                      >
                        {c.property_address}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.secondary, textAlign: 'right' as const }}>{c.units}</span>
                      <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: BT.text.green, textAlign: 'right' as const }}>{fmtPpu(c.price_per_unit)}</span>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.cyan, textAlign: 'right' as const }}>
                        {c.implied_cap_rate != null ? `${(c.implied_cap_rate * 100).toFixed(2)}%` : '—'}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, textAlign: 'right' as const }}>{fmtDate(c.recording_date)}</span>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, textAlign: 'right' as const }}>{c.distance_miles.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              {compSet.comps.length > 8 && (
                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, padding: '3px 2px' }}>
                  +{compSet.comps.length - 8} additional comps not shown
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 6, paddingTop: 4, borderTop: `1px solid ${BT.border.subtle}`,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                  3mi radius · 24mo window · arms-length only
                </span>
                <button
                  onClick={handleViewInM27}
                  style={{
                    fontFamily: MONO, fontSize: 8, color: BT.text.cyan,
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', padding: 0, letterSpacing: 0.3,
                  }}
                >
                  VIEW ALL IN M27 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
