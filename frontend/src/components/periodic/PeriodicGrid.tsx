import React, { useMemo, useState } from 'react';
import { usePeriodicData } from '../../hooks/usePeriodicData';
import { BT } from '../deal/bloomberg-ui';
import {
  FIELD_LABELS,
  fmtPeriodicValue,
  ZONE_COLORS,
  ZONE_BG_COLORS,
} from './fieldLabels';
import type {
  PeriodicGridPreset,
  PeriodicPeriod,
} from './PeriodicGrid.types';
import { MONITORING_FIELDS } from './PeriodicGrid.types';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PeriodicGridProps {
  dealId: string;
  preset: PeriodicGridPreset;
  /** Override which fields to render. Defaults to preset-appropriate set. */
  fields?: string[];
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone Badge
// ─────────────────────────────────────────────────────────────────────────────

const ZoneBadge: React.FC<{ zone: string }> = ({ zone }) => {
  const color = ZONE_COLORS[zone] ?? ZONE_COLORS.projection;
  return (
    <span
      style={{
        fontSize: BT.fontSize.xs,
        fontFamily: BT.font.mono,
        color,
        backgroundColor: ZONE_BG_COLORS[zone] ?? ZONE_BG_COLORS.projection,
        padding: '1px 4px',
        borderRadius: '2px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'inline-block',
      }}
    >
      {zone}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Month Header (sticky, compact)
// ─────────────────────────────────────────────────────────────────────────────

const MonthHeader: React.FC<{ month: string; zone: string }> = ({ month, zone }) => {
  const color = ZONE_COLORS[zone] ?? ZONE_COLORS.projection;
  return (
    <th
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        backgroundColor: BT.bg.header,
        color: BT.text.secondary,
        fontSize: BT.fontSize.xs,
        fontFamily: BT.font.mono,
        fontWeight: 500,
        padding: '4px 6px',
        textAlign: 'right',
        borderBottom: `1px solid ${BT.border.medium}`,
        borderLeft: `1px solid ${BT.border.subtle}`,
        whiteSpace: 'nowrap',
        minWidth: '60px',
      }}
    >
      <span style={{ color }}>{month.slice(2, 7)}</span> {/* YYYY-MM → YY-MM */}
    </th>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cell
// ─────────────────────────────────────────────────────────────────────────────

const Cell: React.FC<{ value: number | null; zone: string; fieldName: string }> = ({
  value,
  zone,
  fieldName,
}) => {
  const display = fmtPeriodicValue(value, fieldName);
  const isNull = value == null || !Number.isFinite(value);
  const bg = ZONE_BG_COLORS[zone] ?? ZONE_BG_COLORS.projection;

  return (
    <td
      style={{
        backgroundColor: bg,
        color: isNull ? BT.text.muted : BT.text.primary,
        fontSize: BT.fontSize.xs,
        fontFamily: BT.font.mono,
        textAlign: 'right',
        padding: '3px 6px',
        borderLeft: `1px solid ${BT.border.subtle}`,
        whiteSpace: 'nowrap',
      }}
      title={`${zone}${isNull ? '' : `: ${value}`}`}
    >
      {display}
    </td>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Full Preset — Scrolling table of all periods × all fields
// ─────────────────────────────────────────────────────────────────────────────

const FullPreset: React.FC<{
  fields: Record<string, PeriodicPeriod[]>;
  fieldNames: string[];
}> = ({ fields, fieldNames }) => {
  // All months from the first field (all fields have same months)
  const months = useMemo(() => {
    const firstField = Object.values(fields)[0];
    return firstField?.map(p => p.month) ?? [];
  }, [fields]);

  return (
    <div
      style={{
        overflow: 'auto',
        maxHeight: '60vh',
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: '2px',
      }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 3,
                backgroundColor: BT.bg.header,
                color: BT.text.secondary,
                fontSize: BT.fontSize.xs,
                fontFamily: BT.font.mono,
                fontWeight: 600,
                padding: '4px 8px',
                textAlign: 'left',
                borderBottom: `1px solid ${BT.border.medium}`,
                borderRight: `1px solid ${BT.border.medium}`,
                minWidth: '140px',
              }}
            >
              Field
            </th>
            {months.map((month, i) => {
              const firstField = Object.values(fields)[0];
              const zone = firstField?.[i]?.zone ?? 'projection';
              return <MonthHeader key={month} month={month} zone={zone} />;
            })}
          </tr>
        </thead>
        <tbody>
          {fieldNames.map(fieldName => {
            const series = fields[fieldName] ?? [];
            return (
              <tr key={fieldName}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    backgroundColor: BT.bg.panel,
                    color: BT.text.secondary,
                    fontSize: BT.fontSize.xs,
                    fontFamily: BT.font.label,
                    fontWeight: 500,
                    padding: '3px 8px',
                    textAlign: 'left',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    borderRight: `1px solid ${BT.border.medium}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {FIELD_LABELS[fieldName] ?? fieldName}
                </td>
                {months.map((month, i) => {
                  const period = series[i];
                  return (
                    <Cell
                      key={month}
                      value={period?.resolved ?? null}
                      zone={period?.zone ?? 'projection'}
                      fieldName={fieldName}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Monitoring Preset — Actual + Gap only, key metrics
// ─────────────────────────────────────────────────────────────────────────────

const MonitoringPreset: React.FC<{
  fields: Record<string, PeriodicPeriod[]>;
  fieldNames: string[];
}> = ({ fields, fieldNames }) => {
  // Filter to actual + gap periods only
  const months = useMemo(() => {
    const firstField = Object.values(fields)[0];
    if (!firstField) return [];
    return firstField
      .filter(p => p.zone === 'actual' || p.zone === 'gap')
      .map(p => p.month);
  }, [fields]);

  return (
    <div
      style={{
        overflow: 'auto',
        maxHeight: '50vh',
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: '2px',
      }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 3,
                backgroundColor: BT.bg.header,
                color: BT.text.secondary,
                fontSize: BT.fontSize.xs,
                fontFamily: BT.font.mono,
                fontWeight: 600,
                padding: '4px 8px',
                textAlign: 'left',
                borderBottom: `1px solid ${BT.border.medium}`,
                borderRight: `1px solid ${BT.border.medium}`,
                minWidth: '140px',
              }}
            >
              Metric
            </th>
            {months.map(month => (
              <th
                key={month}
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  backgroundColor: BT.bg.header,
                  color: BT.text.secondary,
                  fontSize: BT.fontSize.xs,
                  fontFamily: BT.font.mono,
                  fontWeight: 500,
                  padding: '4px 6px',
                  textAlign: 'right',
                  borderBottom: `1px solid ${BT.border.medium}`,
                  borderLeft: `1px solid ${BT.border.subtle}`,
                  whiteSpace: 'nowrap',
                  minWidth: '60px',
                }}
              >
                {month.slice(2, 7)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fieldNames.map(fieldName => {
            const series = fields[fieldName] ?? [];
            const filtered = series.filter(p => p.zone === 'actual' || p.zone === 'gap');
            return (
              <tr key={fieldName}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    backgroundColor: BT.bg.panel,
                    color: BT.text.secondary,
                    fontSize: BT.fontSize.xs,
                    fontFamily: BT.font.label,
                    fontWeight: 500,
                    padding: '3px 8px',
                    textAlign: 'left',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    borderRight: `1px solid ${BT.border.medium}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {FIELD_LABELS[fieldName] ?? fieldName}
                </td>
                {filtered.map((period, i) => (
                  <Cell
                    key={period.month}
                    value={period.resolved}
                    zone={period.zone}
                    fieldName={fieldName}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Overview Preset — Card layout: latest actual / gap / projection summary
// ─────────────────────────────────────────────────────────────────────────────

const OverviewPreset: React.FC<{
  fields: Record<string, PeriodicPeriod[]>;
  fieldNames: string[];
  boundary: { actuals_through_month: string | null };
}> = ({ fields, fieldNames, boundary }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '8px',
      }}
    >
      {fieldNames.map(fieldName => {
        const series = fields[fieldName] ?? [];
        const latestActual = [...series].reverse().find(p => p.zone === 'actual' && p.resolved != null);
        const latestGap = [...series].reverse().find(p => p.zone === 'gap' && p.resolved != null);
        const firstProjection = series.find(p => p.zone === 'projection' && p.resolved != null);

        return (
          <div
            key={fieldName}
            style={{
              backgroundColor: BT.bg.panelAlt,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: '2px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div
              style={{
                fontSize: BT.fontSize.xs,
                fontFamily: BT.font.label,
                color: BT.text.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {FIELD_LABELS[fieldName] ?? fieldName}
            </div>
            <div
              style={{
                fontSize: BT.fontSize.lg,
                fontFamily: BT.font.mono,
                color: BT.text.primary,
                fontWeight: 600,
              }}
            >
              {fmtPeriodicValue(latestActual?.resolved ?? latestGap?.resolved ?? firstProjection?.resolved ?? null, fieldName)}
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {latestActual && (
                <span style={{ fontSize: BT.fontSize.xs, fontFamily: BT.font.mono, color: ZONE_COLORS.actual }}>
                  A {latestActual.month.slice(2, 7)}
                </span>
              )}
              {latestGap && (
                <span style={{ fontSize: BT.fontSize.xs, fontFamily: BT.font.mono, color: ZONE_COLORS.gap }}>
                  G {latestGap.month.slice(2, 7)}
                </span>
              )}
              {firstProjection && (
                <span style={{ fontSize: BT.fontSize.xs, fontFamily: BT.font.mono, color: ZONE_COLORS.projection }}>
                  P {firstProjection.month.slice(2, 7)}
                </span>
              )}
            </div>
            {boundary.actuals_through_month && (
              <div
                style={{
                  fontSize: BT.fontSize.xs,
                  fontFamily: BT.font.mono,
                  color: BT.text.muted,
                  marginTop: '2px',
                }}
              >
                thru {boundary.actuals_through_month}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const PeriodicGrid: React.FC<PeriodicGridProps> = ({
  dealId,
  preset,
  fields: fieldsOverride,
  className,
}) => {
  const { data, loading, error } = usePeriodicData({ dealId });

  const fieldNames = useMemo(() => {
    if (fieldsOverride) return fieldsOverride;
    if (!data) return [];

    const all = Object.keys(data.fields);
    if (preset === 'monitoring' || preset === 'overview') {
      const monitoringSet = new Set(MONITORING_FIELDS as readonly string[]);
      return all.filter(f => monitoringSet.has(f));
    }
    return all;
  }, [data, fieldsOverride, preset]);

  if (loading) {
    return (
      <div
        className={className}
        style={{
          padding: '16px',
          color: BT.text.muted,
          fontSize: BT.fontSize.md,
          fontFamily: BT.font.mono,
          textAlign: 'center',
        }}
      >
        Loading periodic data…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={className}
        style={{
          padding: '16px',
          color: BT.text.red,
          fontSize: BT.fontSize.md,
          fontFamily: BT.font.mono,
        }}
      >
        {error}
      </div>
    );
  }

  if (!data || !Object.keys(data.fields).length) {
    return (
      <div
        className={className}
        style={{
          padding: '16px',
          color: BT.text.muted,
          fontSize: BT.fontSize.md,
          fontFamily: BT.font.mono,
          textAlign: 'center',
        }}
      >
        No periodic data available for this deal.
      </div>
    );
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Boundary header */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: BT.fontSize.xs, fontFamily: BT.font.mono, color: BT.text.muted }}>
          Boundary:
        </span>
        {data.boundary.actuals_through_month && (
          <span style={{ fontSize: BT.fontSize.xs, fontFamily: BT.font.mono, color: ZONE_COLORS.actual }}>
            Actuals thru {data.boundary.actuals_through_month}
          </span>
        )}
        {data.boundary.gap_start_month && data.boundary.gap_end_month && (
          <span style={{ fontSize: BT.fontSize.xs, fontFamily: BT.font.mono, color: ZONE_COLORS.gap }}>
            Gap {data.boundary.gap_start_month} → {data.boundary.gap_end_month}
          </span>
        )}
        {data.boundary.first_projection_month && (
          <span style={{ fontSize: BT.fontSize.xs, fontFamily: BT.font.mono, color: ZONE_COLORS.projection }}>
            Projection from {data.boundary.first_projection_month}
          </span>
        )}
      </div>

      {preset === 'full' && <FullPreset fields={data.fields} fieldNames={fieldNames} />}
      {preset === 'monitoring' && <MonitoringPreset fields={data.fields} fieldNames={fieldNames} />}
      {preset === 'overview' && (
        <OverviewPreset fields={data.fields} fieldNames={fieldNames} boundary={data.boundary} />
      )}
    </div>
  );
};

export default PeriodicGrid;
