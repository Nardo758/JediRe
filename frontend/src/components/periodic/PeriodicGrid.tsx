import React, { useMemo, useState } from 'react';
import { usePeriodicData } from '../../hooks/usePeriodicData';
import { useCustomMetrics } from '../../hooks/useCustomMetrics';
import type { CustomMetricsData, CustomMetricDefinition } from '../../hooks/useCustomMetrics';
import { BT } from '../deal/bloomberg-ui';
import {
  FIELD_LABELS,
  fmtPeriodicValue,
  fmtCustomMetricValue,
  ZONE_COLORS,
  ZONE_BG_COLORS,
} from './fieldLabels';
import type {
  PeriodicGridPreset,
  PeriodicPeriod,
} from './PeriodicGrid.types';
import { MONITORING_FIELDS } from './PeriodicGrid.types';

// ─────────────────────────────────────────────────────────────────────────────
// Field roll-up helpers
// ─────────────────────────────────────────────────────────────────────────────

// Fields whose year-level value is an average (not a sum) of monthly values.
const AVG_SYSTEM_FIELDS = new Set([
  'vacancy_pct', 'loss_to_lease_pct', 'concessions_pct', 'bad_debt_pct',
  'non_revenue_units_pct', 'management_fee_pct', 'noi_per_unit',
  'other_income_per_unit', 'rent_growth',
]);

function systemYearValue(
  months: string[],
  series: PeriodicPeriod[],
  fieldName: string,
): number | null {
  const monthSet = new Set(months);
  const vals = series
    .filter(p => monthSet.has(p.month) && p.resolved != null)
    .map(p => p.resolved as number);
  if (vals.length === 0) return null;
  if (AVG_SYSTEM_FIELDS.has(fieldName)) {
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return vals.reduce((a, b) => a + b, 0);
}

function yearZone(months: string[], series: PeriodicPeriod[]): string {
  const monthSet = new Set(months);
  const periods = series.filter(p => monthSet.has(p.month));
  if (periods.length === 0) return 'projection';
  const actual = periods.filter(p => p.zone === 'actual').length;
  const proj = periods.filter(p => p.zone === 'projection').length;
  if (actual === periods.length) return 'actual';
  if (proj === periods.length) return 'projection';
  if (actual === 0 && proj === 0) return 'gap';
  return 'mixed';
}

// ─────────────────────────────────────────────────────────────────────────────
// Year group helpers
// ─────────────────────────────────────────────────────────────────────────────

interface YearGroup {
  year: string;
  months: string[];
}

function buildYearGroups(allMonths: string[]): YearGroup[] {
  const map: Record<string, string[]> = {};
  for (const m of allMonths) {
    const y = m.slice(0, 4);
    if (!map[y]) map[y] = [];
    map[y].push(m);
  }
  return Object.keys(map).sort().map(y => ({ year: y, months: map[y] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PeriodicGridProps {
  dealId: string;
  preset: PeriodicGridPreset;
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
// Month Header
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
      <span style={{ color }}>{month.slice(2, 7)}</span>
    </th>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cell
// ─────────────────────────────────────────────────────────────────────────────

const Cell: React.FC<{
  value: number | null;
  zone: string;
  display: string;
}> = ({ value, zone, display }) => {
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
// Year Header Cell (clickable, with expand/collapse toggle)
// ─────────────────────────────────────────────────────────────────────────────

const YearHeaderCell: React.FC<{
  year: string;
  zone: string;
  expanded: boolean;
  onToggle: () => void;
}> = ({ year, zone, expanded, onToggle }) => {
  const color = ZONE_COLORS[zone] ?? ZONE_COLORS.projection;
  return (
    <th
      onClick={onToggle}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        backgroundColor: BT.bg.header,
        color: BT.text.secondary,
        fontSize: BT.fontSize.xs,
        fontFamily: BT.font.mono,
        fontWeight: 600,
        padding: '4px 8px',
        textAlign: 'center',
        borderBottom: `1px solid ${BT.border.medium}`,
        borderLeft: `2px solid ${BT.border.medium}`,
        whiteSpace: 'nowrap',
        minWidth: expanded ? undefined : '72px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span style={{ color }}>{year}</span>
      <span style={{ marginLeft: '4px', fontSize: '8px', opacity: 0.7 }}>
        {expanded ? '▼' : '▶'}
      </span>
    </th>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Full Preset — Year-grouped columns (expand/collapse) + all fields
// ─────────────────────────────────────────────────────────────────────────────

const FullPreset: React.FC<{
  fields: Record<string, PeriodicPeriod[]>;
  fieldNames: string[];
  customMetrics: CustomMetricsData | null;
}> = ({ fields, fieldNames, customMetrics }) => {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());

  const allMonths = useMemo(() => {
    const first = Object.values(fields)[0];
    return first?.map(p => p.month) ?? [];
  }, [fields]);

  const yearGroups = useMemo(() => buildYearGroups(allMonths), [allMonths]);

  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const customDefs: CustomMetricDefinition[] = customMetrics?.metrics ?? [];
  const hasCustom = customDefs.length > 0;

  // Determine the dominant zone per year for the first field (header color)
  const firstFieldSeries = Object.values(fields)[0] ?? [];

  const labelCellStyle: React.CSSProperties = {
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
  };

  const customLabelCellStyle: React.CSSProperties = {
    ...labelCellStyle,
    color: BT.text.primary,
    backgroundColor: '#1A1F2B',
  };

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
            {/* Sticky label column */}
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

            {/* Year + month columns */}
            {yearGroups.map(yg => {
              const expanded = expandedYears.has(yg.year);
              const zone = yearZone(yg.months, firstFieldSeries);
              if (expanded) {
                return yg.months.map((month, mi) => {
                  const monthZone = firstFieldSeries.find(p => p.month === month)?.zone ?? 'projection';
                  return mi === 0 ? (
                    <React.Fragment key={`${yg.year}-${month}`}>
                      <YearHeaderCell
                        year={yg.year}
                        zone={zone}
                        expanded={true}
                        onToggle={() => toggleYear(yg.year)}
                      />
                      <MonthHeader month={month} zone={monthZone} />
                    </React.Fragment>
                  ) : (
                    <MonthHeader key={month} month={month} zone={monthZone} />
                  );
                });
              }
              return (
                <YearHeaderCell
                  key={yg.year}
                  year={yg.year}
                  zone={zone}
                  expanded={false}
                  onToggle={() => toggleYear(yg.year)}
                />
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* System field rows */}
          {fieldNames.map(fieldName => {
            const series = fields[fieldName] ?? [];
            return (
              <tr key={fieldName}>
                <td style={labelCellStyle}>{FIELD_LABELS[fieldName] ?? fieldName}</td>
                {yearGroups.map(yg => {
                  const expanded = expandedYears.has(yg.year);
                  const yearVal = systemYearValue(yg.months, series, fieldName);
                  const yearZn = yearZone(yg.months, series);
                  if (expanded) {
                    return yg.months.map((month, mi) => {
                      const period = series.find(p => p.month === month);
                      const display = fmtPeriodicValue(period?.resolved ?? null, fieldName);
                      const cell = (
                        <Cell
                          key={month}
                          value={period?.resolved ?? null}
                          zone={period?.zone ?? 'projection'}
                          display={display}
                        />
                      );
                      if (mi === 0) {
                        return (
                          <React.Fragment key={`${yg.year}-yr-${month}`}>
                            <Cell
                              value={yearVal}
                              zone={yearZn}
                              display={fmtPeriodicValue(yearVal, fieldName)}
                            />
                            {cell}
                          </React.Fragment>
                        );
                      }
                      return cell;
                    });
                  }
                  return (
                    <Cell
                      key={yg.year}
                      value={yearVal}
                      zone={yearZn}
                      display={fmtPeriodicValue(yearVal, fieldName)}
                    />
                  );
                })}
              </tr>
            );
          })}

          {/* Custom metric rows */}
          {hasCustom && (
            <tr>
              <td
                colSpan={999}
                style={{
                  ...labelCellStyle,
                  backgroundColor: '#111418',
                  color: BT.text.muted,
                  fontSize: '10px',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  position: 'static',
                }}
              >
                ◆ Custom Metrics
              </td>
            </tr>
          )}
          {customDefs.map(def => {
            const monthly = customMetrics?.series[def.metric_key];
            const annual = customMetrics?.annualSeries[def.metric_key] ?? [];
            return (
              <tr key={def.metric_key}>
                <td style={customLabelCellStyle}>
                  <span style={{ color: '#A78BFA', marginRight: '4px' }}>◆</span>
                  {def.name}
                </td>
                {yearGroups.map(yg => {
                  const expanded = expandedYears.has(yg.year);
                  const annualPoint = annual.find(a => a.year === yg.year);
                  const yearVal = annualPoint?.value ?? null;
                  const yearZn = annualPoint?.zone ?? 'gap';
                  const yearDisplay = fmtCustomMetricValue(yearVal, def.format);

                  if (expanded) {
                    return yg.months.map((month, mi) => {
                      const period = monthly?.periods.find(p => p.month === month);
                      const display = fmtCustomMetricValue(period?.resolved ?? null, def.format);
                      const cell = (
                        <Cell
                          key={month}
                          value={period?.resolved ?? null}
                          zone={period?.zone ?? 'projection'}
                          display={display}
                        />
                      );
                      if (mi === 0) {
                        return (
                          <React.Fragment key={`${yg.year}-cm-${month}`}>
                            <Cell value={yearVal} zone={yearZn} display={yearDisplay} />
                            {cell}
                          </React.Fragment>
                        );
                      }
                      return cell;
                    });
                  }
                  return (
                    <Cell
                      key={yg.year}
                      value={yearVal}
                      zone={yearZn}
                      display={yearDisplay}
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
// Monitoring Preset — Actual + Gap months only, key metrics + custom metrics
// ─────────────────────────────────────────────────────────────────────────────

const MonitoringPreset: React.FC<{
  fields: Record<string, PeriodicPeriod[]>;
  fieldNames: string[];
  customMetrics: CustomMetricsData | null;
}> = ({ fields, fieldNames, customMetrics }) => {
  const months = useMemo(() => {
    const first = Object.values(fields)[0];
    if (!first) return [];
    return first.filter(p => p.zone === 'actual' || p.zone === 'gap').map(p => p.month);
  }, [fields]);

  const customDefs: CustomMetricDefinition[] = customMetrics?.metrics ?? [];
  const hasCustom = customDefs.length > 0;

  const labelCellStyle: React.CSSProperties = {
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
  };

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
          {/* System field rows */}
          {fieldNames.map(fieldName => {
            const series = fields[fieldName] ?? [];
            const filtered = series.filter(p => p.zone === 'actual' || p.zone === 'gap');
            return (
              <tr key={fieldName}>
                <td style={labelCellStyle}>{FIELD_LABELS[fieldName] ?? fieldName}</td>
                {filtered.map(period => (
                  <Cell
                    key={period.month}
                    value={period.resolved}
                    zone={period.zone}
                    display={fmtPeriodicValue(period.resolved, fieldName)}
                  />
                ))}
              </tr>
            );
          })}

          {/* Custom metric rows */}
          {hasCustom && (
            <tr>
              <td
                colSpan={999}
                style={{
                  ...labelCellStyle,
                  backgroundColor: '#111418',
                  color: BT.text.muted,
                  fontSize: '10px',
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  position: 'static',
                }}
              >
                ◆ Custom Metrics
              </td>
            </tr>
          )}
          {customDefs.map(def => {
            const monthly = customMetrics?.series[def.metric_key];
            const filtered = (monthly?.periods ?? []).filter(
              p => p.zone === 'actual' || p.zone === 'gap',
            );
            return (
              <tr key={def.metric_key}>
                <td style={{ ...labelCellStyle, color: BT.text.primary, backgroundColor: '#1A1F2B' }}>
                  <span style={{ color: '#A78BFA', marginRight: '4px' }}>◆</span>
                  {def.name}
                </td>
                {filtered.map(period => (
                  <Cell
                    key={period.month}
                    value={period.resolved}
                    zone={period.zone}
                    display={fmtCustomMetricValue(period.resolved, def.format)}
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
// Overview Preset — Card layout (unchanged, no custom metric rows needed)
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
  const { data: customData } = useCustomMetrics(dealId);

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
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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

      {preset === 'full' && (
        <FullPreset
          fields={data.fields}
          fieldNames={fieldNames}
          customMetrics={customData}
        />
      )}
      {preset === 'monitoring' && (
        <MonitoringPreset
          fields={data.fields}
          fieldNames={fieldNames}
          customMetrics={customData}
        />
      )}
      {preset === 'overview' && (
        <OverviewPreset
          fields={data.fields}
          fieldNames={fieldNames}
          boundary={data.boundary}
        />
      )}
    </div>
  );
};

export default PeriodicGrid;
