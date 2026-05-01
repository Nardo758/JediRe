/**
 * PlausibilityPanel — detailed breakdown of the plausibility score
 *
 * Shows:
 * - Overall d-value and band
 * - Per-variable contribution (z-score, contribution %)
 * - Warnings (heroic assumptions, regime mismatch, double-up)
 * - Bundle assessment
 *
 * Displayed as an overlay/dropdown below the PlausibilityBadge.
 *
 * Phase B (M36-B) — Plausibility UI
 */

import React from 'react';
import type { PlausibilityResult } from '../../api/sigmaApi';
import { bandColor } from '../../api/sigmaApi';

interface PlausibilityPanelProps {
  result: PlausibilityResult;
  onClose: () => void;
}

// Variable display names
const VARIABLE_LABELS: Record<string, string> = {
  rent_growth: 'Rent Growth',
  vacancy_rate: 'Vacancy Rate',
  exit_cap_rate: 'Exit Cap Rate',
  expense_growth: 'Expense Growth',
  entry_cap_rate: 'Entry Cap Rate',
  debt_rate: 'Debt Rate',
  ltv: 'LTV',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f87171',
  warning: '#facc15',
  info: '#60a5fa',
};

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtZ(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}σ`;
}

/** Row for a single-variable contribution breakdown */
function VariableRow({
  varId,
  data,
}: {
  varId: string;
  data: PlausibilityResult['perVariable'][string];
}) {
  const label = VARIABLE_LABELS[varId] ?? varId.replace(/_/g, ' ');

  return (
    <tr>
      <td style={colStyles.label}>
        {label}
        {data.macroAnchored && <span style={macroBadge}>μ</span>}
      </td>
      <td style={colStyles.pct}>{fmtPct(data.value)}</td>
      <td style={colStyles.z}>{fmtZ(data.zScore)}</td>
      <td style={colStyles.contrib}>
        <div style={barOuter}>
          <div
            style={{
              ...barInner,
              width: `${Math.min(Math.abs(data.contributionPct), 100)}%`,
              background: data.contributionPct > 50 ? '#f87171' : '#60a5fa',
            }}
          />
        </div>
        <span style={{ fontSize: 10, marginLeft: 4, color: '#aaa' }}>
          {data.contributionPct.toFixed(0)}%
        </span>
      </td>
    </tr>
  );
}

/** Single warning row */
function WarningRow({ w }: { w: PlausibilityResult['warnings'][number] }) {
  return (
    <div style={{ ...warnRow, borderLeft: `3px solid ${SEVERITY_COLORS[w.severity] ?? '#888'}` }}>
      <div style={warnHeader}>
        <span style={{ fontWeight: 600, fontSize: 11, color: SEVERITY_COLORS[w.severity] }}>
          {w.severity.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color: '#888' }}>
          {w.type.replace(/_/g, ' ')}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#ccc', marginTop: 2 }}>
        {w.message}
      </div>
    </div>
  );
}

export default function PlausibilityPanel({ result, onClose }: PlausibilityPanelProps) {
  const { mahalanobisD, band, perVariable, warnings, regime, bundleAssessment } = result;
  const colors = bandColor(band);

  const variableEntries = Object.entries(perVariable).sort(
    (a, b) => Math.abs(b[1].contributionPct) - Math.abs(a[1].contributionPct),
  );
  const criticalWarnings = warnings.filter(w => w.severity === 'critical');
  const infoWarnings = warnings.filter(w => w.severity !== 'critical');

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#eee' }}>
                Plausibility Score
              </h4>
              <span
                style={{
                  ...bandChip,
                  background: colors.bg,
                  color: colors.text,
                  borderColor: colors.border,
                }}
              >
                {band}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              Mahalanobis d = {mahalanobisD.toFixed(2)} | Regime: {regime}
            </div>
          </div>
          <button style={closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Critical warnings banner */}
        {criticalWarnings.length > 0 && (
          <div style={criticalBanner}>
            {criticalWarnings.map((w, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>
                ⚠ {w.message}
              </div>
            ))}
          </div>
        )}

        {/* Per-variable breakdown */}
        {variableEntries.length > 0 && (
          <div>
            <h5 style={sectionTitle}>Variable Contributions</h5>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Variable</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>z-Score</th>
                  <th style={thStyle}>Contrib</th>
                </tr>
              </thead>
              <tbody>
                {variableEntries.map(([varId, data]) => (
                  <VariableRow key={varId} varId={varId} data={data} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bundle assessment */}
        {bundleAssessment && (
          <div>
            <h5 style={sectionTitle}>Bundle Assessment</h5>
            <div style={bundleRow}>
              <span style={{ color: '#aaa', fontSize: 11 }}>
                Double-up: <strong style={{ color: '#eee' }}>{bundleAssessment.doubleUp.severity}</strong>
              </span>
              <span style={{ color: '#aaa', fontSize: 11, marginLeft: 16 }}>
                IRR Variance: <strong style={{ color: '#eee' }}>{bundleAssessment.irrVariance.toFixed(3)}</strong>
              </span>
            </div>
            {bundleAssessment.doubleUp.explanation && (
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                {bundleAssessment.doubleUp.explanation}
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {infoWarnings.length > 0 && (
          <div>
            <h5 style={sectionTitle}>
              Warnings ({warnings.length})
            </h5>
            {infoWarnings.map((w, i) => (
              <WarningRow key={i} w={w} />
            ))}
          </div>
        )}

        {/* No warnings */}
        {warnings.length === 0 && (
          <div style={{ fontSize: 11, color: '#4ade80', marginTop: 8 }}>
            ✓ No warnings. Assumptions are consistent with historical patterns.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  padding: '60px 24px 24px',
};

const panelStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: 8,
  padding: 16,
  maxWidth: 520,
  width: '100%',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid #333',
};

const closeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#888',
  fontSize: 22,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};

const bandChip: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  border: '1px solid',
};

const criticalBanner: React.CSSProperties = {
  background: '#3a0a0a',
  border: '1px solid #7f1d1d',
  borderRadius: 4,
  padding: '8px 12px',
  marginBottom: 12,
  color: '#f87171',
  fontSize: 12,
};

const sectionTitle: React.CSSProperties = {
  margin: '12px 0 6px',
  fontSize: 12,
  fontWeight: 600,
  color: '#bbb',
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 6px',
  color: '#666',
  fontWeight: 500,
  borderBottom: '1px solid #333',
  fontSize: 10,
  textTransform: 'uppercase',
};

const colStyles: Record<string, React.CSSProperties> = {
  label: { padding: '3px 6px', color: '#ddd' },
  pct: { padding: '3px 6px', color: '#ccc', fontVariantNumeric: 'tabular-nums' },
  z: { padding: '3px 6px', color: '#aaa', fontVariantNumeric: 'tabular-nums', fontSize: 10 },
  contrib: { padding: '3px 6px', display: 'flex', alignItems: 'center' },
};

const barOuter: React.CSSProperties = {
  width: 60,
  height: 4,
  background: '#333',
  borderRadius: 2,
  overflow: 'hidden',
};

const barInner: React.CSSProperties = {
  height: '100%',
  borderRadius: 2,
  transition: 'width 0.2s',
};

const macroBadge: React.CSSProperties = {
  display: 'inline-block',
  background: '#334',
  color: '#60a5fa',
  fontSize: 9,
  padding: '0 4px',
  borderRadius: 3,
  marginLeft: 4,
  fontWeight: 700,
};

const bundleRow: React.CSSProperties = {
  background: '#1e1e36',
  borderRadius: 4,
  padding: '6px 10px',
  marginTop: 4,
};

const warnRow: React.CSSProperties = {
  background: '#1e1e36',
  borderRadius: 4,
  padding: '6px 10px',
  marginTop: 4,
};
