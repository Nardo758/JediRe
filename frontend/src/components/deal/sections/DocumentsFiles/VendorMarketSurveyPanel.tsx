/**
 * VendorMarketSurveyPanel
 *
 * Surfaces vendor-uploaded market survey data from `historical_observations`
 * (vendor_source IS NOT NULL) scoped to the current deal. Reads from:
 *   GET /api/v1/historical-observations/deals/:dealId/vendor-surveys
 *
 * Shows rent / vacancy / effective-rent time-series grouped by vendor with a
 * vendor_source badge on every row. Multiple vendors are shown in separate
 * sections rather than silently merged.
 *
 * Graceful fallback: renders an empty state with upload prompt when no vendor
 * rows exist.
 *
 * License posture: rows with any posture are shown here (internal deal-scoped
 * endpoint, authenticated). The backend already filters non-deal rows.
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../../services/api.client';
import { BT } from '../../bloomberg-ui';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VendorSurveyRow {
  id: string;
  observation_date: string;
  geography_level: string;
  submarket_avg_asking_rent: number | null;
  submarket_avg_effective_rent: number | null;
  submarket_vacancy_rate: number | null;
  submarket_under_construction: number | null;
  vendor_source: string;
  vendor_license_posture: string;
  vendor_data_as_of: string | null;
  market_survey_source: string | null;
  market_survey_snapshot: Record<string, unknown> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VENDOR_DISPLAY: Record<string, { label: string; color: string }> = {
  yardi_matrix: { label: 'Yardi Matrix', color: '#f59e0b' },
  costar:       { label: 'CoStar',       color: '#3b82f6' },
};

function vendorLabel(source: string): string {
  return VENDOR_DISPLAY[source]?.label ?? source;
}

function vendorColor(source: string): string {
  return VENDOR_DISPLAY[source]?.color ?? '#6b7280';
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function fmtRent(v: number | null): string {
  if (v == null) return '—';
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${Number(v).toFixed(1)}%`;
}

// ── Mini sparkline ────────────────────────────────────────────────────────────

function Sparkline({ rows, field }: { rows: VendorSurveyRow[]; field: 'submarket_avg_asking_rent' | 'submarket_vacancy_rate' }) {
  const values = rows.map(r => Number(r[field] ?? 0)).filter(v => v > 0);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80;
  const H = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={field === 'submarket_avg_asking_rent' ? BT.text.green : BT.text.amber}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── VendorSurveyTable (per vendor) ────────────────────────────────────────────

function VendorSurveyTable({ source, rows }: { source: string; rows: VendorSurveyRow[] }) {
  const sorted = [...rows].sort((a, b) =>
    new Date(b.observation_date).getTime() - new Date(a.observation_date).getTime()
  );
  const posture = rows[0]?.vendor_license_posture ?? '';
  const postureColor = posture === 'platform_only' ? BT.text.amber
    : posture === 'restricted' ? BT.text.red
    : BT.text.muted;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Vendor header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px',
        background: vendorColor(source) + '15',
        borderLeft: `3px solid ${vendorColor(source)}`,
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: vendorColor(source), fontFamily: BT.font.mono }}>
          {vendorLabel(source).toUpperCase()}
        </span>
        <span style={{
          fontSize: 7, padding: '1px 5px',
          background: postureColor + '22', color: postureColor,
          fontFamily: BT.font.mono,
        }}>
          {posture === 'platform_only' ? 'PLATFORM ONLY' : posture.toUpperCase()}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 7, color: BT.text.muted, fontFamily: BT.font.mono }}>
          {rows.length} period{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Sparklines */}
      <div style={{ display: 'flex', gap: 16, padding: '4px 8px', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: BT.font.mono, marginBottom: 2 }}>ASK RENT</div>
          <Sparkline rows={sorted} field="submarket_avg_asking_rent" />
        </div>
        <div>
          <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: BT.font.mono, marginBottom: 2 }}>VACANCY</div>
          <Sparkline rows={sorted} field="submarket_vacancy_rate" />
        </div>
      </div>

      {/* Data table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8, fontFamily: BT.font.mono }}>
          <thead>
            <tr style={{ background: BT.bg.panelAlt }}>
              {['PERIOD', 'SUBMARKET', 'ASK RENT', 'EFF RENT', 'VACANCY', 'AS OF'].map(h => (
                <th key={h} style={{
                  padding: '3px 6px', textAlign: 'left',
                  color: BT.text.muted, fontWeight: 600,
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const snap = row.market_survey_snapshot;
              const submarket = snap?.submarket as string ?? '—';
              return (
                <tr key={row.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '3px 6px', color: BT.text.primary, whiteSpace: 'nowrap' }}>
                    {fmtDate(row.observation_date)}
                  </td>
                  <td style={{ padding: '3px 6px', color: BT.text.secondary, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {submarket}
                  </td>
                  <td style={{ padding: '3px 6px', color: BT.text.green }}>
                    {fmtRent(row.submarket_avg_asking_rent)}
                  </td>
                  <td style={{ padding: '3px 6px', color: BT.text.primary }}>
                    {fmtRent(row.submarket_avg_effective_rent)}
                  </td>
                  <td style={{ padding: '3px 6px', color: row.submarket_vacancy_rate != null && row.submarket_vacancy_rate > 8 ? BT.text.amber : BT.text.primary }}>
                    {fmtPct(row.submarket_vacancy_rate)}
                  </td>
                  <td style={{ padding: '3px 6px', color: BT.text.muted }}>
                    {fmtDate(row.vendor_data_as_of)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── VendorMarketSurveyPanel ───────────────────────────────────────────────────

export function VendorMarketSurveyPanel({ dealId }: { dealId: string }) {
  const [rows, setRows] = useState<VendorSurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    apiClient.get(`/api/v1/historical-observations/deals/${dealId}/vendor-surveys`)
      .then(r => setRows(r.data?.rows ?? []))
      .catch(e => setError(e?.response?.data?.error ?? 'Failed to load survey data'))
      .finally(() => setLoading(false));
  }, [dealId]);

  // Group rows by vendor_source
  const byVendor = rows.reduce<Record<string, VendorSurveyRow[]>>((acc, row) => {
    (acc[row.vendor_source] ??= []).push(row);
    return acc;
  }, {});

  const vendors = Object.keys(byVendor);

  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.subtle}`,
      padding: 12,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 9, fontWeight: 700, color: BT.text.muted,
        fontFamily: BT.font.mono, letterSpacing: 0.5,
      }}>
        <span>VENDOR MARKET SURVEYS</span>
        {vendors.length > 0 && (
          <span style={{ fontSize: 7, color: BT.text.cyan, fontFamily: BT.font.mono }}>
            {vendors.map(v => vendorLabel(v)).join(' · ')}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono }}>
          loading…
        </div>
      )}

      {!loading && error && (
        <div style={{ fontSize: 8, color: BT.text.red, fontFamily: BT.font.mono }}>
          ✗ {error}
        </div>
      )}

      {!loading && !error && vendors.length === 0 && (
        <div style={{
          padding: '12px 10px',
          background: BT.bg.panelAlt,
          border: `1px dashed ${BT.border.subtle}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: BT.font.mono, marginBottom: 4 }}>
            No vendor survey data yet
          </div>
          <div style={{ fontSize: 7, color: BT.text.muted + 'bb', fontFamily: BT.font.mono }}>
            Upload a Yardi Matrix Rent Survey or CoStar Submarket export above to populate this view
          </div>
        </div>
      )}

      {!loading && !error && vendors.map(source => (
        <VendorSurveyTable key={source} source={source} rows={byVendor[source]} />
      ))}
    </div>
  );
}
