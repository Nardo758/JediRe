import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/api.client';
import { getTierColor, formatMetricValue } from '../map-surface/FlagPin';

interface GeoProperty {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  jediScore: number;
  ownershipStatus: 'portfolio' | 'pipeline' | string;
  pipelineStage: string | null;
  yearBuilt: number | null;
  metrics: {
    occupancyRate: number | null;
    avgEffectiveRent: number | null;
    concessions: number | null;
    vacancyLoss: number | null;
    noi: number | null;
    rentGrowth: number | null;
  };
}

const METRIC_OPTIONS = [
  { value: 'jediScore', label: 'JEDI Score' },
  { value: 'occupancyRate', label: 'Occupancy' },
  { value: 'rentGrowth', label: 'Rent Growth' },
  { value: 'concessions', label: 'Concessions' },
  { value: 'vacancyLoss', label: 'Vacancy Loss' },
  { value: 'noi', label: 'NOI' },
];

interface WarMapPipelineSidebarProps {
  theme: any;
  onDealClick: (dealId: string) => void;
  selectedDealId?: string | null;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * WAR MAP PIPELINE SIDEBAR — Pipeline deal cards with metrics
 * ═══════════════════════════════════════════════════════════════════
 *
 * Displays pipeline deals in the War Map sidebar with selectable
 * performance metrics.  Each card shows the active metric tier color,
 * deal name, stage, and key stats.  Clicking a card navigates to
 * the deal detail page.
 */
export const WarMapPipelineSidebar: React.FC<WarMapPipelineSidebarProps> = ({
  theme: T,
  onDealClick,
  selectedDealId,
}) => {
  const [deals, setDeals] = useState<GeoProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayMetric, setDisplayMetric] = useState('jediScore');

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/api/v1/properties/geo')
      .then((res) => {
        const list = res.data?.properties || [];
        const pipeline = list.filter(
          (p: GeoProperty) => p.ownershipStatus === 'pipeline'
        );
        setDeals(pipeline);
      })
      .catch((err) => {
        console.error('[WarMapPipelineSidebar] fetch failed:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const resolveValue = (d: GeoProperty, key: string): number | null => {
    if (key === 'jediScore') return d.jediScore ?? null;
    return d.metrics[key as keyof GeoProperty['metrics']] ?? null;
  };

  return (
    <div style={{ borderBottom: `1px solid ${T.border.medium}` }}>
      {/* Header + Metric selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: T.bg.panelAlt,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: T.text.cyan,
            letterSpacing: 0.5,
          }}
        >
          PIPELINE ({deals.length})
        </span>
        <select
          value={displayMetric}
          onChange={(e) => setDisplayMetric(e.target.value)}
          style={{
            fontSize: 9,
            fontFamily: T.font.mono,
            background: T.bg.input,
            color: T.text.primary,
            border: `1px solid ${T.border.subtle}`,
            padding: '2px 4px',
            outline: 'none',
          }}
        >
          {METRIC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Deal list */}
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {loading && (
          <div
            style={{
              padding: 12,
              textAlign: 'center',
              fontSize: 10,
              color: T.text.muted,
              fontFamily: T.font.mono,
            }}
          >
            Loading…
          </div>
        )}

        {!loading && deals.length === 0 && (
          <div
            style={{
              padding: 12,
              textAlign: 'center',
              fontSize: 10,
              color: T.text.muted,
              fontFamily: T.font.mono,
            }}
          >
            No pipeline deals with geo data
          </div>
        )}

        {deals.map((d) => {
          const val = resolveValue(d, displayMetric);
          const color = getTierColor(displayMetric, val);
          const displayVal = formatMetricValue(displayMetric, val);
          const isSelected = selectedDealId === d.id;

          return (
            <div
              key={d.id}
              onClick={() => onDealClick(d.id)}
              style={{
                padding: '6px 8px',
                borderBottom: `1px solid ${T.border.subtle}`,
                background: isSelected ? T.bg.active : T.bg.panel,
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = T.bg.hover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = isSelected
                  ? T.bg.active
                  : T.bg.panel)
              }
            >
              {/* Top row: name + metric badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.text.primary,
                    fontFamily: T.font.mono,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={d.name}
                >
                  {d.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color,
                    fontFamily: T.font.mono,
                    marginLeft: 6,
                    flexShrink: 0,
                  }}
                >
                  {displayVal}
                </span>
              </div>

              {/* Bottom row: stage + address */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: T.text.muted,
                    fontFamily: T.font.mono,
                  }}
                >
                  {d.pipelineStage || 'LEAD'}
                  {d.yearBuilt ? ` · Built ${d.yearBuilt}` : ''}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: T.text.secondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 120,
                  }}
                  title={d.address}
                >
                  {d.address}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
