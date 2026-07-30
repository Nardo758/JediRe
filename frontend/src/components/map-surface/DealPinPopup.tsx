import React from 'react';
import { Popup } from 'react-map-gl';
import type { GeoProperty } from './DealPinLayer';
import { formatMetricValue, getTierColor } from './FlagPin';

interface DealPinPopupProps {
  property: GeoProperty;
  onClose: () => void;
  highlightMetric: string;
}

const METRIC_DEFS = [
  { key: 'jediScore', label: 'JEDI Score' },
  { key: 'occupancyRate', label: 'Occupancy' },
  { key: 'avgEffectiveRent', label: 'Avg Rent' },
  { key: 'rentGrowth', label: 'Rent Growth' },
  { key: 'concessions', label: 'Concessions' },
  { key: 'vacancyLoss', label: 'Vacancy Loss' },
  { key: 'noi', label: 'NOI' },
];

/**
 * ═══════════════════════════════════════════════════════════════════
 * DEAL PIN POPUP — Expandable metrics modal anchored to map pin
 * ═══════════════════════════════════════════════════════════════════
 *
 * Renders inside a react-map-gl Popup.  Shows a full metrics grid
 * with the currently-selected display metric highlighted.  Includes
 * an "Open Deal →" CTA that routes to the deal detail page.
 */
export const DealPinPopup: React.FC<DealPinPopupProps> = ({
  property,
  onClose,
  highlightMetric,
}) => {
  const getValue = (key: string): number | null => {
    if (key === 'jediScore') return property.jediScore ?? null;
    return property.metrics[key as keyof GeoProperty['metrics']] ?? null;
  };

  return (
    <Popup
      longitude={property.lng}
      latitude={property.lat}
      anchor="top"
      onClose={onClose}
      closeButton={true}
      closeOnClick={false}
      offset={[0, -8]}
      maxWidth="320px"
    >
      <div style={{ minWidth: 260, padding: 2 }}>
        {/* Header */}
        <div style={{ marginBottom: 10 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#111827',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {property.name}
          </h3>
          <p
            style={{
              fontSize: 11,
              color: '#6b7280',
              margin: '4px 0 0 0',
            }}
          >
            {property.address}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                backgroundColor:
                  property.ownershipStatus === 'portfolio'
                    ? '#dbeafe'
                    : property.ownershipStatus === 'pipeline'
                    ? '#fef3c7'
                    : '#f3f4f6',
                color:
                  property.ownershipStatus === 'portfolio'
                    ? '#1d4ed8'
                    : property.ownershipStatus === 'pipeline'
                    ? '#b45309'
                    : '#4b5563',
              }}
            >
              {property.ownershipStatus}
            </span>
            {property.yearBuilt && (
              <span style={{ fontSize: 10, color: '#9ca3af' }}>
                Built {property.yearBuilt}
              </span>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            marginBottom: 10,
          }}
        >
          {METRIC_DEFS.map((m) => {
            const val = getValue(m.key);
            const isHighlighted = m.key === highlightMetric;
            const color = getTierColor(m.key, val);

            return (
              <div
                key={m.key}
                style={{
                  borderRadius: 6,
                  padding: '6px 8px',
                  backgroundColor: isHighlighted ? `${color}12` : '#f9fafb',
                  border: isHighlighted ? `1.5px solid ${color}` : '1.5px solid transparent',
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    margin: '0 0 2px 0',
                  }}
                >
                  {m.label}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color,
                    margin: 0,
                  }}
                >
                  {formatMetricValue(m.key, val)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Pipeline stage */}
        {property.pipelineStage && (
          <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
            Pipeline:{' '}
            <span style={{ fontWeight: 600, color: '#374151' }}>
              {property.pipelineStage}
            </span>
          </p>
        )}

        {/* CTA */}
        <a
          href={`/deals/${property.id}`}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            padding: '8px 0',
            backgroundColor: '#2563eb',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            textDecoration: 'none',
            transition: 'background-color 150ms',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget.style.backgroundColor = '#1d4ed8'))
          }
          onMouseLeave={(e) =>
            ((e.currentTarget.style.backgroundColor = '#2563eb'))
          }
        >
          Open Deal →
        </a>
      </div>
    </Popup>
  );
};
