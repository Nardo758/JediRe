/**
 * PropertyCardPage - Comprehensive property profile page
 * 
 * Shows detailed property information with:
 * - Property details and photos
 * - Performance history charts
 * - Top 5 comps with map
 * - Sale and tax history
 */

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PropertyCard } from '../components/terminal/PropertyCard';
import { BT } from '../components/terminal/theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════

interface PropertyRecord {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  submarket: string;
  msa: string;
  class: 'A' | 'B' | 'C';
  units: number;
  yearBuilt: number;
  yearRenovated?: number;
  sqft?: number;
  stories?: number;
  avgRent: number;
  rentChange: number;
  occupancy: number;
  occupancyChange: number;
  capRate: number;
  noi?: number;
  owner: string;
  ownerType?: string;
  management?: string;
  jediScore: number;
  photos?: { url: string; label?: string }[];
  comps?: {
    id: string;
    name: string;
    address: string;
    distance: number;
    units: number;
    yearBuilt: number;
    avgRent: number;
    occupancy: number;
    class: 'A' | 'B' | 'C';
  }[];
  saleHistory?: {
    date: string;
    price: number;
    pricePerUnit: number;
    buyer: string;
    seller: string;
    capRate?: number;
  }[];
  taxHistory?: {
    year: number;
    assessedValue: number;
    taxableValue: number;
    taxAmount: number;
    changePercent?: number;
  }[];
}

const PROPERTIES: Record<string, PropertyRecord> = {
  'the-vue-at-midtown': {
    id: 'the-vue-at-midtown',
    name: 'The Vue at Midtown',
    address: '750 Piedmont Ave NE',
    city: 'Atlanta',
    state: 'GA',
    zip: '30308',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    class: 'A',
    units: 196,
    yearBuilt: 2018,
    stories: 24,
    sqft: 245000,
    avgRent: 2420,
    rentChange: 120,
    occupancy: 93.2,
    occupancyChange: 0.6,
    capRate: 4.8,
    noi: 4200000,
    owner: 'Hines',
    ownerType: 'Institutional',
    management: 'Greystar',
    jediScore: 94,
    photos: [
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400', label: 'Tower' },
      { url: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=400', label: 'Lobby' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400', label: 'Amenities' },
    ],
    comps: [
      { id: 'pines-at-midtown', name: 'Pines at Midtown', address: '1240 Peachtree St NE', distance: 0.3, units: 180, yearBuilt: 1992, avgRent: 1480, occupancy: 94.2, class: 'B' },
      { id: 'peachtree-walk', name: 'Peachtree Walk', address: '1355 Peachtree St NE', distance: 0.5, units: 310, yearBuilt: 2008, avgRent: 1920, occupancy: 93.6, class: 'A' },
      { id: 'the-metropolitan', name: 'The Metropolitan', address: '999 Peachtree St NE', distance: 0.7, units: 412, yearBuilt: 2019, avgRent: 2450, occupancy: 96.2, class: 'A' },
      { id: 'camden-midtown', name: 'Camden Midtown', address: '1055 Piedmont Ave NE', distance: 0.4, units: 305, yearBuilt: 2015, avgRent: 2120, occupancy: 94.6, class: 'A' },
      { id: 'skyhouse-midtown', name: 'SkyHouse Midtown', address: '1085 Juniper St NE', distance: 0.6, units: 320, yearBuilt: 2014, avgRent: 2050, occupancy: 94.8, class: 'A' },
    ],
    saleHistory: [
      { date: '2021-06-15', price: 68500000, pricePerUnit: 349490, buyer: 'Hines', seller: 'Trammell Crow', capRate: 4.2 },
      { date: '2018-03-01', price: 52000000, pricePerUnit: 265306, buyer: 'Trammell Crow', seller: 'Developer', capRate: 4.5 },
    ],
    taxHistory: [
      { year: 2025, assessedValue: 72000000, taxableValue: 72000000, taxAmount: 1584000, changePercent: 8.2 },
      { year: 2024, assessedValue: 66540000, taxableValue: 66540000, taxAmount: 1463880, changePercent: 5.1 },
      { year: 2023, assessedValue: 63300000, taxableValue: 63300000, taxAmount: 1392600 },
    ],
  },
  'pines-at-midtown': {
    id: 'pines-at-midtown',
    name: 'Pines at Midtown',
    address: '1240 Peachtree St NE',
    city: 'Atlanta',
    state: 'GA',
    zip: '30309',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    class: 'B',
    units: 180,
    yearBuilt: 1992,
    yearRenovated: 2018,
    stories: 4,
    sqft: 162000,
    avgRent: 1480,
    rentChange: 220,
    occupancy: 94.2,
    occupancyChange: 1.2,
    capRate: 5.8,
    noi: 2160000,
    owner: 'Greystone Capital',
    ownerType: 'Private Equity',
    jediScore: 92,
    photos: [
      { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400', label: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', label: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400', label: 'Amenities' },
    ],
    comps: [
      { id: 'the-vue-at-midtown', name: 'The Vue at Midtown', address: '750 Piedmont Ave NE', distance: 0.3, units: 196, yearBuilt: 2018, avgRent: 2420, occupancy: 93.2, class: 'A' },
      { id: 'peachtree-walk', name: 'Peachtree Walk', address: '1355 Peachtree St NE', distance: 0.4, units: 310, yearBuilt: 2008, avgRent: 1920, occupancy: 93.6, class: 'A' },
      { id: 'camden-midtown', name: 'Camden Midtown', address: '1055 Piedmont Ave NE', distance: 0.5, units: 305, yearBuilt: 2015, avgRent: 2120, occupancy: 94.6, class: 'A' },
      { id: 'the-metropolitan', name: 'The Metropolitan', address: '999 Peachtree St NE', distance: 0.8, units: 412, yearBuilt: 2019, avgRent: 2450, occupancy: 96.2, class: 'A' },
      { id: 'midtown-terrace', name: 'Midtown Terrace', address: '1280 Spring St NW', distance: 0.6, units: 180, yearBuilt: 1998, avgRent: 1420, occupancy: 88.4, class: 'C' },
    ],
    saleHistory: [
      { date: '2019-08-20', price: 28800000, pricePerUnit: 160000, buyer: 'Greystone Capital', seller: 'AvalonBay', capRate: 5.5 },
      { date: '2014-03-15', price: 21600000, pricePerUnit: 120000, buyer: 'AvalonBay', seller: 'Local LLC', capRate: 6.2 },
    ],
    taxHistory: [
      { year: 2025, assessedValue: 31200000, taxableValue: 31200000, taxAmount: 686400, changePercent: 12.5 },
      { year: 2024, assessedValue: 27733000, taxableValue: 27733000, taxAmount: 610126, changePercent: 6.8 },
      { year: 2023, assessedValue: 25970000, taxableValue: 25970000, taxAmount: 571340 },
    ],
  },
  'the-metropolitan': {
    id: 'the-metropolitan',
    name: 'The Metropolitan',
    address: '999 Peachtree St NE',
    city: 'Atlanta',
    state: 'GA',
    zip: '30309',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    class: 'A',
    units: 412,
    yearBuilt: 2019,
    stories: 32,
    sqft: 485000,
    avgRent: 2450,
    rentChange: 85,
    occupancy: 96.2,
    occupancyChange: 1.4,
    capRate: 4.6,
    noi: 7600000,
    owner: 'Greystar',
    ownerType: 'Institutional',
    management: 'Greystar',
    jediScore: 94,
    photos: [
      { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400', label: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', label: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400', label: 'Amenities' },
    ],
    comps: [
      { id: 'the-vue-at-midtown', name: 'The Vue at Midtown', address: '750 Piedmont Ave NE', distance: 0.7, units: 196, yearBuilt: 2018, avgRent: 2420, occupancy: 93.2, class: 'A' },
      { id: 'peachtree-walk', name: 'Peachtree Walk', address: '1355 Peachtree St NE', distance: 0.3, units: 310, yearBuilt: 2008, avgRent: 1920, occupancy: 93.6, class: 'A' },
      { id: 'pines-at-midtown', name: 'Pines at Midtown', address: '1240 Peachtree St NE', distance: 0.8, units: 180, yearBuilt: 1992, avgRent: 1480, occupancy: 94.2, class: 'B' },
      { id: 'camden-midtown', name: 'Camden Midtown', address: '1055 Piedmont Ave NE', distance: 0.5, units: 305, yearBuilt: 2015, avgRent: 2120, occupancy: 94.6, class: 'A' },
      { id: 'skyhouse-midtown', name: 'SkyHouse Midtown', address: '1085 Juniper St NE', distance: 0.4, units: 320, yearBuilt: 2014, avgRent: 2050, occupancy: 94.8, class: 'A' },
    ],
    saleHistory: [
      { date: '2022-11-10', price: 142000000, pricePerUnit: 344660, buyer: 'Greystar', seller: 'Hines', capRate: 4.3 },
    ],
    taxHistory: [
      { year: 2025, assessedValue: 148500000, taxableValue: 148500000, taxAmount: 3267000, changePercent: 6.2 },
      { year: 2024, assessedValue: 139830000, taxableValue: 139830000, taxAmount: 3076260, changePercent: 8.5 },
      { year: 2023, assessedValue: 128850000, taxableValue: 128850000, taxAmount: 2834700 },
    ],
  },
  'cascade-heights': {
    id: 'cascade-heights',
    name: 'Cascade Heights',
    address: '2400 Cascade Rd',
    city: 'Atlanta',
    state: 'GA',
    zip: '30311',
    submarket: 'Cascade',
    msa: 'Atlanta, GA',
    class: 'C',
    units: 144,
    yearBuilt: 1995,
    stories: 3,
    sqft: 115200,
    avgRent: 1050,
    rentChange: 230,
    occupancy: 97.2,
    occupancyChange: 2.1,
    capRate: 7.2,
    noi: 1080000,
    owner: 'Peachtree Residential',
    ownerType: 'Local Operator',
    jediScore: 76,
    photos: [
      { url: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400', label: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400', label: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400', label: 'Courtyard' },
    ],
    comps: [
      { id: 'greenbriar-village', name: 'Greenbriar Village', address: '2800 Greenbriar Pkwy', distance: 0.8, units: 120, yearBuilt: 1988, avgRent: 980, occupancy: 96.0, class: 'C' },
      { id: 'cascade-pines', name: 'Cascade Pines', address: '2600 Cascade Rd', distance: 0.4, units: 96, yearBuilt: 2002, avgRent: 1120, occupancy: 95.4, class: 'B' },
      { id: 'cascade-place', name: 'Cascade Place', address: '2550 Cascade Rd', distance: 0.5, units: 108, yearBuilt: 1992, avgRent: 1010, occupancy: 94.8, class: 'C' },
      { id: 'southwest-crossing', name: 'Southwest Crossing', address: '3200 Campbellton Rd', distance: 1.2, units: 200, yearBuilt: 1998, avgRent: 1080, occupancy: 93.2, class: 'C' },
      { id: 'cascade-summit', name: 'Cascade Summit', address: '2700 Cascade Rd', distance: 0.6, units: 156, yearBuilt: 2005, avgRent: 1180, occupancy: 95.8, class: 'B' },
    ],
    saleHistory: [
      { date: '2020-02-28', price: 12960000, pricePerUnit: 90000, buyer: 'Peachtree Residential', seller: 'Private Owner', capRate: 6.8 },
      { date: '2012-06-15', price: 8640000, pricePerUnit: 60000, buyer: 'Private Owner', seller: 'Bank (REO)', capRate: 8.5 },
    ],
    taxHistory: [
      { year: 2025, assessedValue: 15120000, taxableValue: 15120000, taxAmount: 332640, changePercent: 18.5 },
      { year: 2024, assessedValue: 12757000, taxableValue: 12757000, taxAmount: 280654, changePercent: 10.2 },
      { year: 2023, assessedValue: 11577000, taxableValue: 11577000, taxAmount: 254694 },
    ],
  },
};

// Default property for fallback
const DEFAULT_PROPERTY = PROPERTIES['the-vue-at-midtown'];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const PropertyCardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const property = useMemo(() => {
    if (!id) return DEFAULT_PROPERTY;
    return PROPERTIES[id] || DEFAULT_PROPERTY;
  }, [id]);

  const handleCompClick = (compId: string) => {
    navigate(`/property-card/${compId}`);
  };

  const handleCreateDeal = () => {
    navigate('/deals/create', {
      state: {
        sourcePropertyId: property.id,
        propertyName: property.name,
        address: `${property.address}, ${property.city}, ${property.state} ${property.zip}`,
        units: property.units,
      }
    });
  };

  const handleTrack = () => {
    // TODO: Add to watchlist
    console.log('Track property:', property.id);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: BT.bg.terminal,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.medium}`,
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            ...mono,
            fontSize: 10,
            fontWeight: 700,
            background: 'transparent',
            color: BT.text.cyan,
            border: `1px solid ${BT.text.cyan}44`,
            padding: '4px 12px',
            cursor: 'pointer',
            letterSpacing: 0.5,
          }}
        >
          ← BACK
        </button>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>PROPERTY CARD</span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>›</span>
        <span style={{ ...mono, fontSize: 10, color: BT.text.amber, fontWeight: 700 }}>
          {property.msa.toUpperCase()}
        </span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>›</span>
        <span style={{ ...mono, fontSize: 10, color: BT.text.cyan, fontWeight: 600 }}>
          {property.submarket.toUpperCase()}
        </span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>›</span>
        <span style={{ ...mono, fontSize: 11, color: BT.text.primary, fontWeight: 700 }}>
          {property.name.toUpperCase()}
        </span>

        <div style={{ flex: 1 }} />

        {/* Property Switcher */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.values(PROPERTIES).slice(0, 4).map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/property-card/${p.id}`)}
              style={{
                ...mono,
                fontSize: 9,
                fontWeight: p.id === property.id ? 700 : 400,
                background: p.id === property.id ? `${BT.text.amber}22` : 'transparent',
                color: p.id === property.id ? BT.text.amber : BT.text.muted,
                border: p.id === property.id ? `1px solid ${BT.text.amber}44` : `1px solid ${BT.border.subtle}`,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              {p.name.split(' ').map(w => w[0]).join('')}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9,
          color: BT.text.green,
          ...mono,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: BT.text.green,
            display: 'inline-block',
          }} />
          LIVE
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 16,
      }}>
        <PropertyCard
          property={{
            id: property.id,
            name: property.name,
            address: property.address,
            city: property.city,
            state: property.state,
            zip: property.zip,
            class: property.class,
            units: property.units,
            yearBuilt: property.yearBuilt,
            yearRenovated: property.yearRenovated,
            sqft: property.sqft,
            stories: property.stories,
            owner: property.owner,
            ownerType: property.ownerType,
            management: property.management,
            avgRent: property.avgRent,
            rentChange: property.rentChange,
            occupancy: property.occupancy,
            occupancyChange: property.occupancyChange,
            capRate: property.capRate,
            noi: property.noi,
            jediScore: property.jediScore,
            photos: property.photos,
          }}
          comps={property.comps}
          saleHistory={property.saleHistory}
          taxHistory={property.taxHistory}
          onCompClick={handleCompClick}
          onCreateDeal={handleCreateDeal}
          onTrack={handleTrack}
        />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        background: BT.bg.header,
        borderTop: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>
          JEDIRE PROPERTY CARD v2.0
        </span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>
          {Object.keys(PROPERTIES).length} properties indexed · {property.submarket} submarket
        </span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.green }}>
          JEDI {property.jediScore}/100
        </span>
      </div>
    </div>
  );
};

export default PropertyCardPage;
