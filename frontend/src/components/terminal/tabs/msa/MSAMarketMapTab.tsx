/**
 * MSAMarketMapTab — Combined Rankings + Properties view
 * Map-based layout: Mapbox dark map | filter bar top | properties side panel right
 * Click a property card or map pin → onSelectProperty()
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { BT, terminalStyles, fmt } from '../../theme';
import { scoreColor } from '../../signalGroups';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

interface MSAMarketMapTabProps {
  msaId: string;
  msa: any;
  onSelectProperty?: (propertyId: string, propertyName?: string) => void;
}

interface MarketProperty {
  id: string;
  name: string;
  address: string;
  submarket: string;
  units: number;
  yearBuilt: number;
  class: string;
  owner: string;
  rank: number;
  movement: number;
  pcsScore: number;
  rent: string;
  occ: string;
  jedi: number;
  holdPeriod: string;
  sellerMotivation: number;
  lossToLeasePct: string;
  pricePerUnit: string;
  lat: number;
  lng: number;
}

const MARKET_PROPERTIES: MarketProperty[] = [
  {
    id: '10', name: 'The Vue at Midtown', address: '715 Peachtree St', submarket: 'Midtown',
    units: 196, yearBuilt: 2018, class: 'A', owner: 'Hines',
    rank: 1, movement: 2, pcsScore: 94,
    rent: '$2,420', occ: '93.2%', jedi: 94, holdPeriod: '4.0yr',
    sellerMotivation: 28, lossToLeasePct: '2.5%', pricePerUnit: '$300K',
    lat: 33.7879, lng: -84.3838,
  },
  {
    id: '3', name: 'Alexan Buckhead', address: '3300 Peachtree Rd NE', submarket: 'Buckhead',
    units: 420, yearBuilt: 2019, class: 'A', owner: 'Trammell Crow',
    rank: 2, movement: 0, pcsScore: 91,
    rent: '$2,680', occ: '92.1%', jedi: 83, holdPeriod: '5.1yr',
    sellerMotivation: 45, lossToLeasePct: '2.5%', pricePerUnit: '$250K',
    lat: 33.8395, lng: -84.3850,
  },
  {
    id: '1', name: 'Pines at Midtown', address: '1240 Peachtree St NE', submarket: 'Midtown',
    units: 180, yearBuilt: 1992, class: 'B', owner: 'Greystone Capital',
    rank: 3, movement: 3, pcsScore: 88,
    rent: '$1,480', occ: '94.2%', jedi: 92, holdPeriod: '6.9yr',
    sellerMotivation: 78, lossToLeasePct: '14.8%', pricePerUnit: '$158K',
    lat: 33.7846, lng: -84.3792,
  },
  {
    id: '4', name: 'Brookhaven Terrace', address: '1850 Dresden Dr', submarket: 'Brookhaven',
    units: 240, yearBuilt: 1998, class: 'B+', owner: 'Bridge Investment',
    rank: 4, movement: -1, pcsScore: 86,
    rent: '$1,680', occ: '93.4%', jedi: 86, holdPeriod: '6.5yr',
    sellerMotivation: 58, lossToLeasePct: '8.3%', pricePerUnit: '$160K',
    lat: 33.8719, lng: -84.3355,
  },
  {
    id: '7', name: 'Peachtree Walk', address: '1010 Peachtree St', submarket: 'Midtown',
    units: 310, yearBuilt: 2015, class: 'B+', owner: 'Cortland Partners',
    rank: 5, movement: 1, pcsScore: 85,
    rent: '$1,920', occ: '93.6%', jedi: 85, holdPeriod: '5.4yr',
    sellerMotivation: 48, lossToLeasePct: '6.8%', pricePerUnit: '$190K',
    lat: 33.7818, lng: -84.3810,
  },
  {
    id: '2', name: 'Summit Ridge', address: '450 Clairemont Ave', submarket: 'Decatur',
    units: 200, yearBuilt: 1987, class: 'B-', owner: 'Cortland Partners',
    rank: 6, movement: 4, pcsScore: 83,
    rent: '$1,280', occ: '95.8%', jedi: 89, holdPeriod: '5.7yr',
    sellerMotivation: 62, lossToLeasePct: '11.7%', pricePerUnit: '$110K',
    lat: 33.7739, lng: -84.2977,
  },
  {
    id: '5', name: 'Sandy Springs Crossing', address: '6200 Roswell Rd', submarket: 'Sandy Springs',
    units: 312, yearBuilt: 2001, class: 'B+', owner: 'Starwood Capital',
    rank: 7, movement: -2, pcsScore: 81,
    rent: '$1,720', occ: '94.8%', jedi: 81, holdPeriod: '7.2yr',
    sellerMotivation: 52, lossToLeasePct: '7.6%', pricePerUnit: '$167K',
    lat: 33.9305, lng: -84.3710,
  },
  {
    id: '6', name: 'East Atlanta Gardens', address: '1420 Flat Shoals Ave', submarket: 'East Atlanta',
    units: 128, yearBuilt: 1988, class: 'B-', owner: 'Local GP',
    rank: 8, movement: 5, pcsScore: 79,
    rent: '$1,180', occ: '96.1%', jedi: 79, holdPeriod: '8.9yr',
    sellerMotivation: 84, lossToLeasePct: '20.3%', pricePerUnit: '$100K',
    lat: 33.7332, lng: -84.3450,
  },
  {
    id: '8', name: 'Cascade Heights', address: '2400 Cascade Rd', submarket: 'Cascade',
    units: 144, yearBuilt: 1995, class: 'C+', owner: 'Peachtree Residential',
    rank: 9, movement: 0, pcsScore: 76,
    rent: '$1,050', occ: '97.2%', jedi: 76, holdPeriod: '7.6yr',
    sellerMotivation: 72, lossToLeasePct: '21.9%', pricePerUnit: '$80K',
    lat: 33.7120, lng: -84.4467,
  },
  {
    id: '9', name: 'Westside Lofts', address: '890 Marietta St', submarket: 'Westside',
    units: 96, yearBuilt: 2008, class: 'B', owner: 'Local Syndicator',
    rank: 10, movement: -3, pcsScore: 74,
    rent: '$1,580', occ: '91.8%', jedi: 74, holdPeriod: '6.2yr',
    sellerMotivation: 65, lossToLeasePct: '6.3%', pricePerUnit: '$150K',
    lat: 33.7620, lng: -84.4150,
  },
];

const CLASS_OPTIONS = ['All', 'A', 'B+', 'B', 'B-', 'C+', 'C'];
const VINTAGE_OPTIONS = ['All', '2020s', '2010s', '2000s', '1990s', '1980s', 'Pre-1980'];
const SIZE_OPTIONS = ['All', '< 150', '150-250', '250-350', '350+'];
const SORT_OPTIONS = [
  { key: 'rank', label: 'Rank' },
  { key: 'pcsScore', label: 'PCS' },
  { key: 'jedi', label: 'JEDI' },
  { key: 'sellerMotivation', label: 'Motivation' },
];

function getVintage(year: number): string {
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  return 'Pre-1980';
}

function matchesSize(units: number, filter: string): boolean {
  if (filter === 'All') return true;
  if (filter === '< 150') return units < 150;
  if (filter === '150-250') return units >= 150 && units <= 250;
  if (filter === '250-350') return units > 250 && units <= 350;
  if (filter === '350+') return units > 350;
  return true;
}

function pinColor(pcs: number): string {
  if (pcs >= 90) return BT.text.green;
  if (pcs >= 80) return BT.text.cyan;
  if (pcs >= 70) return BT.text.amber;
  return BT.accent.red;
}

function motivationLabel(score: number): string {
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MED';
  return 'LOW';
}

function motivationColor(score: number): string {
  if (score >= 75) return BT.accent.red;
  if (score >= 50) return BT.text.amber;
  return BT.text.green;
}

export const MSAMarketMapTab: React.FC<MSAMarketMapTabProps> = ({ msaId, msa, onSelectProperty }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'market_dashboard', marketId: msaId }
  );

  const msaName = msa?.name || msaId || 'Atlanta';

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [vintageFilter, setVintageFilter] = useState('All');
  const [sizeFilter, setSizeFilter] = useState('All');
  const [sortKey, setSortKey] = useState('rank');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [viewState, setViewState] = useState({
    longitude: -84.388,
    latitude: 33.749,
    zoom: 10.5,
  });

  const filtered = useMemo(() => {
    const result = MARKET_PROPERTIES.filter(p => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !p.submarket.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (classFilter !== 'All' && p.class !== classFilter) return false;
      if (vintageFilter !== 'All' && getVintage(p.yearBuilt) !== vintageFilter) return false;
      if (!matchesSize(p.units, sizeFilter)) return false;
      return true;
    });
    result.sort((a, b) => {
      if (sortKey === 'rank') return a.rank - b.rank;
      return (b as any)[sortKey] - (a as any)[sortKey];
    });
    return result;
  }, [searchQuery, classFilter, vintageFilter, sizeFilter, sortKey]);

  const handleSelectProperty = useCallback((p: MarketProperty) => {
    onSelectProperty?.(p.id, p.name);
  }, [onSelectProperty]);

  const scrollCardIntoView = (id: string) => {
    const el = panelRef.current?.querySelector(`[data-prop-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const filteredIds = useMemo(() => new Set(filtered.map(p => p.id)), [filtered]);

  const FilterBtn: React.FC<{ options: string[]; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
    <div style={{ display: 'flex', gap: 3 }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '3px 9px',
            background: value === opt ? BT.accent.blue : 'rgba(26,31,46,0.85)',
            color: value === opt ? '#fff' : BT.text.secondary,
            border: `1px solid ${value === opt ? BT.accent.blue : BT.border.medium}`,
            borderRadius: 2,
            fontSize: 10,
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'background 0.12s',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ── Filter Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        padding: '8px 14px',
        background: 'rgba(10,14,23,0.96)',
        borderBottom: `1px solid ${BT.border.medium}`,
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>SEARCH</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Property or submarket..."
            style={{
              background: 'rgba(26,31,46,0.9)',
              border: `1px solid ${BT.border.medium}`,
              borderRadius: 2,
              color: BT.text.primary,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              padding: '3px 8px',
              width: 160,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ width: 1, height: 20, background: BT.border.medium }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>CLASS</span>
          <FilterBtn options={CLASS_OPTIONS} value={classFilter} onChange={setClassFilter} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>VINTAGE</span>
          <FilterBtn options={VINTAGE_OPTIONS} value={vintageFilter} onChange={setVintageFilter} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>SIZE</span>
          <FilterBtn options={SIZE_OPTIONS} value={sizeFilter} onChange={setSizeFilter} />
        </div>

        <div style={{ width: 1, height: 20, background: BT.border.medium }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>SORT</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                style={{
                  padding: '3px 9px',
                  background: sortKey === opt.key ? '#1E3A5F' : 'rgba(26,31,46,0.85)',
                  color: sortKey === opt.key ? BT.text.cyan : BT.text.secondary,
                  border: `1px solid ${sortKey === opt.key ? BT.text.cyan : BT.border.medium}`,
                  borderRadius: 2,
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: 'background 0.12s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 10, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
          {filtered.length} PROPERTIES · {msaName.toUpperCase()}
        </div>
      </div>

      {/* ── Map + Side Panel ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* MAP */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {MAPBOX_TOKEN ? (
            <Map
              {...viewState}
              onMove={evt => setViewState(evt.viewState)}
              mapStyle={MAP_STYLE}
              mapboxAccessToken={MAPBOX_TOKEN}
              style={{ width: '100%', height: '100%' }}
            >
              <NavigationControl position="bottom-right" />

              {MARKET_PROPERTIES.map(p => {
                const isFiltered = filteredIds.has(p.id);
                const isHovered = hoveredId === p.id;
                const color = pinColor(p.pcsScore);
                const size = isHovered ? 38 : 28;
                return (
                  <Marker
                    key={p.id}
                    longitude={p.lng}
                    latitude={p.lat}
                    anchor="bottom"
                    onClick={() => handleSelectProperty(p)}
                  >
                    <div
                      onMouseEnter={() => { setHoveredId(p.id); scrollCardIntoView(p.id); }}
                      onMouseLeave={() => setHoveredId(null)}
                      title={p.name}
                      style={{
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        background: isFiltered ? color : BT.bg.elevated,
                        border: `2px solid ${isHovered ? '#fff' : isFiltered ? color : BT.border.medium}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: isHovered ? `0 0 16px ${color}88` : `0 2px 6px rgba(0,0,0,0.6)`,
                        opacity: isFiltered ? 1 : 0.35,
                        zIndex: isHovered ? 10 : 1,
                      }}
                    >
                      <span style={{
                        fontSize: isHovered ? 11 : 9,
                        fontWeight: 700,
                        color: isFiltered ? '#fff' : BT.text.muted,
                        fontFamily: "'JetBrains Mono', monospace",
                        lineHeight: 1,
                      }}>
                        {p.rank}
                      </span>
                    </div>
                    {isHovered && (
                      <div style={{
                        position: 'absolute',
                        bottom: 44,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(10,14,23,0.97)',
                        border: `1px solid ${color}`,
                        borderRadius: 4,
                        padding: '6px 10px',
                        minWidth: 180,
                        pointerEvents: 'none',
                        zIndex: 20,
                        boxShadow: `0 4px 16px rgba(0,0,0,0.7)`,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 10, color: BT.text.secondary, fontFamily: "'JetBrains Mono', monospace" }}>
                          {p.submarket} · Class {p.class} · {p.units}u
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                          <span style={{ fontSize: 10, color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>PCS {p.pcsScore}</span>
                          <span style={{ fontSize: 10, color: BT.text.amber, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>JEDI {p.jedi}</span>
                          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>{p.rent}</span>
                        </div>
                      </div>
                    )}
                  </Marker>
                );
              })}
            </Map>
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #0A0E17 0%, #0F1319 40%, #0D111A 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{
                fontSize: 11,
                color: BT.text.muted,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.1em',
              }}>
                MAP UNAVAILABLE
              </div>
              <div style={{ fontSize: 10, color: BT.text.dim, fontFamily: "'JetBrains Mono', monospace" }}>
                Configure VITE_MAPBOX_TOKEN to enable map view
              </div>
            </div>
          )}

          {/* Map Legend */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(10,14,23,0.92)',
            border: `1px solid ${BT.border.medium}`,
            borderRadius: 4,
            padding: '8px 12px',
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6, letterSpacing: '0.08em' }}>
              PCS SCORE
            </div>
            {[
              { label: '90–100', color: BT.text.green },
              { label: '80–89', color: BT.text.cyan },
              { label: '70–79', color: BT.text.amber },
              { label: '&lt;70', color: BT.accent.red },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: "'JetBrains Mono', monospace" }}
                  dangerouslySetInnerHTML={{ __html: item.label }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── SIDE PANEL ── */}
        <div
          ref={panelRef}
          style={{
            width: 380,
            flexShrink: 0,
            background: 'rgba(10,14,23,0.97)',
            borderLeft: `1px solid ${BT.border.medium}`,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Panel Header */}
          <div style={{
            padding: '10px 14px',
            borderBottom: `1px solid ${BT.border.medium}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.secondary, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>
              PROPERTIES
            </span>
            <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
              {filtered.length} shown
            </span>
          </div>

          {/* Column labels */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 44px 44px 44px',
            gap: 0,
            padding: '5px 12px',
            borderBottom: `1px solid ${BT.border.subtle}`,
            flexShrink: 0,
          }}>
            {['#', 'PROPERTY', 'PCS', 'JEDI', 'OCC'].map(h => (
              <span key={h} style={{ fontSize: 9, color: BT.text.dim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Property Cards */}
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: BT.text.muted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              No properties match filters
            </div>
          ) : (
            filtered.map(p => {
              const isHovered = hoveredId === p.id;
              const pcsClr = pinColor(p.pcsScore);
              const jediColors = scoreColor(p.jedi);

              return (
                <div
                  key={p.id}
                  data-prop-id={p.id}
                  onClick={() => handleSelectProperty(p)}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    background: isHovered ? BT.bg.active : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    borderLeft: isHovered ? `3px solid ${pcsClr}` : '3px solid transparent',
                  }}
                >
                  {/* Row 1: rank + name + scores */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr 44px 44px 44px',
                    alignItems: 'center',
                    gap: 0,
                    marginBottom: 5,
                  }}>
                    {/* Rank badge */}
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: p.rank <= 3 ? BT.accent.blue : BT.bg.elevated,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: p.rank <= 3 ? '#fff' : BT.text.secondary, fontFamily: "'JetBrains Mono', monospace" }}>
                        {p.rank}
                      </span>
                    </div>

                    {/* Name + submarket */}
                    <div style={{ minWidth: 0, paddingRight: 8 }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: BT.text.primary,
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                          {p.submarket}
                        </span>
                        <span style={{
                          fontSize: 9,
                          padding: '1px 4px',
                          background: BT.bg.elevated,
                          color: BT.text.secondary,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600,
                        }}>
                          {p.class}
                        </span>
                        <span style={{ fontSize: 9, color: BT.text.dim, fontFamily: "'JetBrains Mono', monospace" }}>
                          {p.yearBuilt}
                        </span>
                      </div>
                    </div>

                    {/* PCS */}
                    <span style={{ fontSize: 12, fontWeight: 700, color: pcsClr, fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' }}>
                      {p.pcsScore}
                    </span>

                    {/* JEDI */}
                    <span style={{ fontSize: 12, fontWeight: 700, color: jediColors.btText, fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' }}>
                      {p.jedi}
                    </span>

                    {/* Occ */}
                    <span style={{ fontSize: 10, color: BT.text.secondary, fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' }}>
                      {p.occ}
                    </span>
                  </div>

                  {/* Row 2: detail tags */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 28 }}>
                    <span style={{ fontSize: 10, color: BT.text.secondary, fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.rent}
                    </span>
                    <span style={{ fontSize: 9, color: BT.text.dim }}>·</span>
                    <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.units}u
                    </span>
                    <span style={{ fontSize: 9, color: BT.text.dim }}>·</span>
                    <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                      Hold {p.holdPeriod}
                    </span>
                    <span style={{ fontSize: 9, color: BT.text.dim }}>·</span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: motivationColor(p.sellerMotivation),
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {motivationLabel(p.sellerMotivation)} MOTIV
                    </span>

                    {/* Rank movement */}
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                      color: p.movement > 0 ? BT.text.green : p.movement < 0 ? BT.accent.red : BT.text.dim }}>
                      {p.movement > 0 ? `▲${p.movement}` : p.movement < 0 ? `▼${Math.abs(p.movement)}` : '—'}
                    </span>
                  </div>

                  {/* Navigation hint on hover */}
                  {isHovered && (
                    <div style={{
                      marginTop: 6,
                      paddingLeft: 28,
                      fontSize: 9,
                      color: BT.accent.blue,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: '0.06em',
                    }}>
                      CLICK TO OPEN PROPERTY CARD →
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MSAMarketMapTab;
