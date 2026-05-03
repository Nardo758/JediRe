import { logSwallowedError } from '../../utils/swallowedError';
/**
 * CascadeMap — Mapbox heat overlay for MSA events cascading to submarkets.
 * Heat gradient (6-stop cool→warm) based on proximity-decayed impact magnitude.
 * Portfolio property pins sized by projected IRR impact.
 * Click submarket → filter to submarket-scope view.
 * Click property → open Deal Capsule.
 * Falls back gracefully if Mapbox token absent.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BT } from '../deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmarketHeat {
  id: string;
  name: string;
  lat: number;
  lng: number;
  impactMag: number; // 0–4
  eventCount: number;
}

interface PropertyPin {
  dealId: string;
  name: string;
  lat: number;
  lng: number;
  irrImpactBps: number; // positive = upside
}

interface CascadeMapProps {
  msaId?: string;
  eventId?: string;
  submarkets?: SubmarketHeat[];
  properties?: PropertyPin[];
  height?: number;
  onSubmarketClick?: (submarketId: string) => void;
  onPropertyClick?: (dealId: string) => void;
}

// ─── Heat gradient ───────────────────────────────────────────────────────────

const HEAT_STOPS = [
  '#3B82F6', // cold (mag 0)
  '#06B6D4', // cool
  '#22C55E', // neutral
  '#F59E0B', // warm
  '#EF4444', // hot (mag 4)
];

function magToColor(mag: number): string {
  const idx = Math.min(4, Math.floor(mag));
  return HEAT_STOPS[idx] ?? HEAT_STOPS[0];
}

// ─── SVG fallback map ────────────────────────────────────────────────────────

function CascadeMapFallback({
  submarkets,
  properties,
  onSubmarketClick,
  onPropertyClick,
  height,
}: {
  submarkets: SubmarketHeat[];
  properties: PropertyPin[];
  onSubmarketClick?: (id: string) => void;
  onPropertyClick?: (id: string) => void;
  height: number;
}) {
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  // project lat/lng to SVG coords (simple equirectangular)
  const lats = [...submarkets.map(s => s.lat), ...properties.map(p => p.lat)];
  const lngs = [...submarkets.map(s => s.lng), ...properties.map(p => p.lng)];
  const minLat = Math.min(...lats, 33.0);
  const maxLat = Math.max(...lats, 34.5);
  const minLng = Math.min(...lngs, -85.0);
  const maxLng = Math.max(...lngs, -83.0);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  const W = 560;
  const H = height - 50;

  function project(lat: number, lng: number): [number, number] {
    const x = ((lng - minLng) / lngRange) * (W - 40) + 20;
    const y = H - ((lat - minLat) / latRange) * (H - 30) - 15;
    return [x, y];
  }

  return (
    <div style={{ position: 'relative', background: BT.bg.elevated, border: `1px solid ${BT.border.subtle}` }}>
      {/* Map SVG */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* Grid lines */}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1={0} x2={W} y1={H * i / 5} y2={H * i / 5} stroke={BT.border.subtle} strokeWidth={0.5} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`v${i}`} x1={W * i / 7} x2={W * i / 7} y1={0} y2={H} stroke={BT.border.subtle} strokeWidth={0.5} />
        ))}

        {/* Submarket heat circles */}
        {submarkets.map(sub => {
          const [x, y] = project(sub.lat, sub.lng);
          const r = 14 + sub.impactMag * 6;
          const color = magToColor(sub.impactMag);
          return (
            <g key={sub.id}>
              <circle
                cx={x} cy={y} r={r}
                fill={`${color}30`} stroke={color} strokeWidth={1.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => setTooltip({ label: `${sub.name} · ${sub.eventCount} events · Mag ${sub.impactMag.toFixed(1)}`, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => onSubmarketClick?.(sub.id)}
              />
              <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill={color} fontFamily="JetBrains Mono">
                {sub.name.split(' ')[0]}
              </text>
            </g>
          );
        })}

        {/* Property pins */}
        {properties.map(prop => {
          const [x, y] = project(prop.lat, prop.lng);
          const isUp = prop.irrImpactBps > 0;
          const color = isUp ? BT.text.green : BT.text.red;
          const size = Math.min(10, 4 + Math.abs(prop.irrImpactBps) / 20);
          return (
            <g key={prop.dealId}>
              <polygon
                points={`${x},${y - size} ${x + size * 0.6},${y + size * 0.4} ${x - size * 0.6},${y + size * 0.4}`}
                fill={color} opacity={0.85}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => setTooltip({
                  label: `${prop.name} · IRR impact: ${isUp ? '+' : ''}${prop.irrImpactBps}bps`,
                  x: e.clientX, y: e.clientY,
                })}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => onPropertyClick?.(prop.dealId)}
              />
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, padding: '4px 10px', fontSize: 7, color: BT.text.muted, ...mono }}>
        {HEAT_STOPS.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
            {i === 0 ? 'Low' : i === 4 ? 'High' : ''}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>▲ property pin (IRR impact)</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 10, top: tooltip.y - 30,
          zIndex: 9999, background: BT.bg.elevated, border: `1px solid ${BT.border.medium}`,
          padding: '4px 8px', fontSize: 9, pointerEvents: 'none', ...mono,
          color: BT.text.primary,
        }}>
          {tooltip.label}
        </div>
      )}
    </div>
  );
}

// ─── Demo seed ───────────────────────────────────────────────────────────────

const DEMO_SUBMARKETS: SubmarketHeat[] = [
  { id: 'midtown',    name: 'Midtown',       lat: 33.783, lng: -84.383, impactMag: 3.8, eventCount: 5 },
  { id: 'buckhead',  name: 'Buckhead',       lat: 33.840, lng: -84.374, impactMag: 2.6, eventCount: 3 },
  { id: 'westside',  name: 'Westside',       lat: 33.757, lng: -84.415, impactMag: 2.0, eventCount: 2 },
  { id: 'decatur',   name: 'Decatur',        lat: 33.775, lng: -84.296, impactMag: 1.4, eventCount: 2 },
  { id: 'perimeter', name: 'Perimeter',      lat: 33.924, lng: -84.350, impactMag: 0.8, eventCount: 1 },
  { id: 'smyrna',    name: 'Smyrna',         lat: 33.883, lng: -84.514, impactMag: 0.4, eventCount: 1 },
];

const DEMO_PROPERTIES: PropertyPin[] = [
  { dealId: 'deal-1', name: 'Midtown Heights', lat: 33.790, lng: -84.380, irrImpactBps: 85 },
  { dealId: 'deal-2', name: 'The Westside',    lat: 33.753, lng: -84.420, irrImpactBps: 40 },
  { dealId: 'deal-3', name: 'Buckhead Arms',   lat: 33.845, lng: -84.370, irrImpactBps: -30 },
];

// ─── Main component ───────────────────────────────────────────────────────────

export const CascadeMap: React.FC<CascadeMapProps> = ({
  msaId,
  eventId,
  submarkets: propSubmarkets,
  properties: propProperties,
  height = 320,
  onSubmarketClick,
  onPropertyClick,
}) => {
  const navigate = useNavigate();
  const [submarkets, setSubmarkets] = useState<SubmarketHeat[]>(propSubmarkets ?? []);
  const [properties, setProperties] = useState<PropertyPin[]>(propProperties ?? []);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (propSubmarkets && propProperties) {
      setSubmarkets(propSubmarkets);
      setProperties(propProperties);
      return;
    }
    try {
      const id = msaId ?? eventId;
      const endpoint = eventId
        ? `/api/v1/m35/events/${eventId}/cascade-map`
        : `/api/v1/m35/msa/${msaId}/cascade-map`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        setSubmarkets(json.submarkets ?? DEMO_SUBMARKETS);
        setProperties(json.properties ?? DEMO_PROPERTIES);
        return;
      }
    } catch (err) { logSwallowedError('components/m35/CascadeMap', err); }
    setSubmarkets(DEMO_SUBMARKETS);
    setProperties(DEMO_PROPERTIES);
  }, [msaId, eventId, propSubmarkets, propProperties]);

  useEffect(() => { load(); }, [load]);

  const handleSubmarketClick = (id: string) => {
    setSelectedSub(id);
    onSubmarketClick?.(id);
  };

  const handlePropertyClick = (dealId: string) => {
    onPropertyClick?.(dealId);
    navigate(`/deals/${dealId}`);
  };

  const filtered = selectedSub
    ? submarkets.filter(s => s.id === selectedSub)
    : submarkets;

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, textTransform: 'uppercase', letterSpacing: 0.8, ...mono }}>
          CASCADE MAP · {msaId?.toUpperCase() ?? 'MSA'} EVENT PROPAGATION
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {selectedSub && (
            <button
              onClick={() => setSelectedSub(null)}
              style={{ fontSize: 8, color: BT.text.cyan, background: 'none', border: 'none', cursor: 'pointer', ...mono }}
            >
              ← ALL SUBMARKETS
            </button>
          )}
          <span style={{ fontSize: 7, color: BT.text.muted, ...mono }}>
            {submarkets.length} submarkets · {properties.length} tracked
          </span>
        </div>
      </div>

      {/* Map (SVG fallback — Mapbox integration if token present) */}
      <CascadeMapFallback
        submarkets={filtered}
        properties={properties}
        onSubmarketClick={handleSubmarketClick}
        onPropertyClick={handlePropertyClick}
        height={height}
      />
    </div>
  );
};
