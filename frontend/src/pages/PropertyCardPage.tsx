import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BloombergPropertyCard } from '../components/terminal/BloombergPropertyCard';
import { BT } from '../components/terminal/theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface PropertyRecord {
  id: string;
  name: string;
  submarket: string;
  msa: string;
  address: string;
  class: 'A' | 'B' | 'C';
  units: number;
  yearBuilt: number;
  avgRent: number;
  rentChange: number;
  rentChangePercent: number;
  occupancy: number;
  occupancyChange: number;
  capRate: number;
  owner: string;
  concessions?: number;
  noi?: number;
  revenue?: number;
  expenses?: number;
  debtService?: number;
  absorption?: number;
  jedi: number;
  sellerMotivation: number;
  sparkline: number[];
  images?: { url: string; caption?: string }[];
  comps?: {
    rank: number;
    name: string;
    units: number;
    avgRent: number;
    rentChange1D: number;
    rentChange1M: number;
    rentGrowthYoY: number;
    occupancy: number;
    capRate: number;
  }[];
}

const STANDALONE_PROPERTIES: PropertyRecord[] = [
  {
    id: 'pines-at-midtown',
    name: 'Pines at Midtown',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    address: '1240 Peachtree St NE, Atlanta, GA 30309',
    class: 'B',
    units: 180,
    yearBuilt: 1992,
    avgRent: 1480,
    rentChange: 220,
    rentChangePercent: 14.8,
    occupancy: 94.2,
    occupancyChange: 1.2,
    capRate: 5.8,
    owner: 'Greystone Capital',
    concessions: 180,
    noi: 2160,
    revenue: 3196,
    expenses: 1036,
    absorption: 12,
    jedi: 92,
    sellerMotivation: 78,
    sparkline: [1280, 1310, 1340, 1360, 1380, 1400, 1420, 1440, 1455, 1465, 1475, 1480],
    images: [
      { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400', caption: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', caption: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400', caption: 'Amenities' },
    ],
    comps: [
      { rank: 1, name: 'Pines at Midtown', units: 180, avgRent: 1480, rentChange1D: 0.12, rentChange1M: 1.8, rentGrowthYoY: 4.2, occupancy: 94.2, capRate: 5.8 },
      { rank: 2, name: 'Peachtree Walk', units: 310, avgRent: 1920, rentChange1D: 0.08, rentChange1M: 1.2, rentGrowthYoY: 3.8, occupancy: 93.6, capRate: 5.2 },
      { rank: 3, name: 'The Vue at Midtown', units: 196, avgRent: 2420, rentChange1D: 0.15, rentChange1M: 2.1, rentGrowthYoY: 5.1, occupancy: 93.2, capRate: 4.8 },
    ],
  },
  {
    id: 'summit-ridge',
    name: 'Summit Ridge',
    submarket: 'Decatur',
    msa: 'Atlanta, GA',
    address: '450 Clairemont Ave, Decatur, GA 30030',
    class: 'B',
    units: 200,
    yearBuilt: 1987,
    avgRent: 1280,
    rentChange: 170,
    rentChangePercent: 11.7,
    occupancy: 95.8,
    occupancyChange: 0.8,
    capRate: 6.2,
    owner: 'Cortland Partners',
    concessions: 120,
    noi: 1840,
    revenue: 3072,
    expenses: 1232,
    absorption: 15,
    jedi: 89,
    sellerMotivation: 62,
    sparkline: [1100, 1120, 1140, 1160, 1180, 1200, 1220, 1240, 1250, 1260, 1270, 1280],
    images: [
      { url: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400', caption: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400', caption: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400', caption: 'Pool' },
    ],
    comps: [
      { rank: 1, name: 'Summit Ridge', units: 200, avgRent: 1280, rentChange1D: 0.10, rentChange1M: 1.5, rentGrowthYoY: 4.2, occupancy: 95.8, capRate: 6.2 },
      { rank: 2, name: 'Decatur Crossing', units: 165, avgRent: 1340, rentChange1D: -0.05, rentChange1M: 0.8, rentGrowthYoY: 3.1, occupancy: 94.6, capRate: 5.8 },
      { rank: 3, name: 'Emory Gardens', units: 220, avgRent: 1420, rentChange1D: 0.20, rentChange1M: 2.0, rentGrowthYoY: 4.8, occupancy: 93.4, capRate: 5.5 },
    ],
  },
  {
    id: 'alexan-buckhead',
    name: 'Alexan Buckhead',
    submarket: 'Buckhead',
    msa: 'Atlanta, GA',
    address: '3300 Peachtree Rd NE, Atlanta, GA 30326',
    class: 'A',
    units: 420,
    yearBuilt: 2019,
    avgRent: 2680,
    rentChange: 70,
    rentChangePercent: 2.5,
    occupancy: 92.1,
    occupancyChange: -0.3,
    capRate: 4.6,
    owner: 'Trammell Crow',
    concessions: 250,
    noi: 8400,
    revenue: 13510,
    expenses: 5110,
    absorption: 8,
    jedi: 83,
    sellerMotivation: 45,
    sparkline: [2500, 2520, 2540, 2560, 2580, 2600, 2620, 2640, 2650, 2660, 2670, 2680],
    images: [
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400', caption: 'Tower' },
      { url: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=400', caption: 'Lobby' },
      { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400', caption: 'Rooftop' },
    ],
    comps: [
      { rank: 1, name: 'Alexan Buckhead', units: 420, avgRent: 2680, rentChange1D: 0.05, rentChange1M: 0.8, rentGrowthYoY: 2.5, occupancy: 92.1, capRate: 4.6 },
      { rank: 2, name: 'Hanover Buckhead', units: 370, avgRent: 2280, rentChange1D: 0.30, rentChange1M: 1.8, rentGrowthYoY: 4.8, occupancy: 94.2, capRate: 5.2 },
      { rank: 3, name: 'The Darcy', units: 265, avgRent: 2380, rentChange1D: 0.80, rentChange1M: 2.5, rentGrowthYoY: 6.1, occupancy: 92.8, capRate: 4.6 },
    ],
  },
  {
    id: 'the-metropolitan',
    name: 'The Metropolitan',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    address: '999 Peachtree St NE, Atlanta, GA 30309',
    class: 'A',
    units: 412,
    yearBuilt: 2019,
    avgRent: 2450,
    rentChange: 85,
    rentChangePercent: 3.6,
    occupancy: 96.2,
    occupancyChange: 1.4,
    capRate: 4.6,
    owner: 'Greystar',
    concessions: 200,
    noi: 7600,
    revenue: 12118,
    expenses: 4518,
    absorption: 18,
    jedi: 94,
    sellerMotivation: 32,
    sparkline: [2200, 2240, 2280, 2310, 2340, 2360, 2380, 2400, 2420, 2430, 2440, 2450],
    images: [
      { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400', caption: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', caption: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400', caption: 'Amenities' },
    ],
    comps: [
      { rank: 1, name: 'The Metropolitan', units: 412, avgRent: 2450, rentChange1D: 0.15, rentChange1M: 2.1, rentGrowthYoY: 3.6, occupancy: 96.2, capRate: 4.6 },
      { rank: 2, name: 'Peachtree Walk', units: 310, avgRent: 1920, rentChange1D: 0.08, rentChange1M: 1.2, rentGrowthYoY: 3.8, occupancy: 93.6, capRate: 5.2 },
      { rank: 3, name: 'Alexan Midtown', units: 290, avgRent: 1950, rentChange1D: -0.20, rentChange1M: 1.5, rentGrowthYoY: 3.9, occupancy: 95.0, capRate: 5.5 },
    ],
  },
  {
    id: 'cascade-heights',
    name: 'Cascade Heights',
    submarket: 'Cascade',
    msa: 'Atlanta, GA',
    address: '2400 Cascade Rd, Atlanta, GA 30311',
    class: 'C',
    units: 144,
    yearBuilt: 1995,
    avgRent: 1050,
    rentChange: 230,
    rentChangePercent: 21.9,
    occupancy: 97.2,
    occupancyChange: 2.1,
    capRate: 7.2,
    owner: 'Peachtree Residential',
    concessions: 50,
    noi: 1080,
    revenue: 1814,
    expenses: 734,
    absorption: 10,
    jedi: 76,
    sellerMotivation: 72,
    sparkline: [880, 900, 920, 940, 960, 975, 990, 1005, 1020, 1030, 1040, 1050],
    images: [
      { url: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400', caption: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400', caption: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400', caption: 'Courtyard' },
    ],
    comps: [
      { rank: 1, name: 'Cascade Heights', units: 144, avgRent: 1050, rentChange1D: 0.22, rentChange1M: 2.8, rentGrowthYoY: 5.6, occupancy: 97.2, capRate: 7.2 },
      { rank: 2, name: 'Greenbriar Village', units: 120, avgRent: 980, rentChange1D: 0.10, rentChange1M: 1.4, rentGrowthYoY: 3.8, occupancy: 96.0, capRate: 7.8 },
      { rank: 3, name: 'Cascade Pines', units: 96, avgRent: 1120, rentChange1D: -0.08, rentChange1M: 0.6, rentGrowthYoY: 2.9, occupancy: 95.4, capRate: 6.8 },
    ],
  },
  {
    id: 'the-vue-at-midtown',
    name: 'The Vue at Midtown',
    submarket: 'Midtown',
    msa: 'Atlanta, GA',
    address: '750 Piedmont Ave NE, Atlanta, GA 30308',
    class: 'A',
    units: 196,
    yearBuilt: 2018,
    avgRent: 2420,
    rentChange: 120,
    rentChangePercent: 5.2,
    occupancy: 93.2,
    occupancyChange: 0.6,
    capRate: 4.8,
    owner: 'Hines',
    concessions: 220,
    noi: 3560,
    revenue: 5694,
    expenses: 2134,
    absorption: 14,
    jedi: 94,
    sellerMotivation: 38,
    sparkline: [2180, 2210, 2240, 2270, 2300, 2320, 2340, 2360, 2380, 2395, 2410, 2420],
    images: [
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400', caption: 'Tower' },
      { url: 'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=400', caption: 'Lobby' },
      { url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400', caption: 'Amenities' },
    ],
    comps: [
      { rank: 1, name: 'The Vue at Midtown', units: 196, avgRent: 2420, rentChange1D: 0.15, rentChange1M: 2.1, rentGrowthYoY: 5.2, occupancy: 93.2, capRate: 4.8 },
      { rank: 2, name: 'Pines at Midtown', units: 180, avgRent: 1480, rentChange1D: 0.12, rentChange1M: 1.8, rentGrowthYoY: 4.2, occupancy: 94.2, capRate: 5.8 },
      { rank: 3, name: 'Peachtree Walk', units: 310, avgRent: 1920, rentChange1D: 0.08, rentChange1M: 1.2, rentGrowthYoY: 3.8, occupancy: 93.6, capRate: 5.2 },
    ],
  },
  {
    id: 'buckhead-grand',
    name: 'Buckhead Grand',
    submarket: 'Buckhead',
    msa: 'Atlanta, GA',
    address: '3338 Peachtree Rd NE, Atlanta, GA 30326',
    class: 'A',
    units: 320,
    yearBuilt: 2020,
    avgRent: 2580,
    rentChange: 90,
    rentChangePercent: 3.6,
    occupancy: 94.6,
    occupancyChange: 1.0,
    capRate: 4.5,
    owner: 'JMB Realty',
    concessions: 190,
    noi: 6200,
    revenue: 9907,
    expenses: 3707,
    absorption: 16,
    jedi: 91,
    sellerMotivation: 35,
    sparkline: [2380, 2400, 2420, 2440, 2460, 2480, 2500, 2520, 2540, 2555, 2570, 2580],
    images: [
      { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400', caption: 'Exterior' },
      { url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', caption: 'Interior' },
      { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400', caption: 'Rooftop' },
    ],
    comps: [
      { rank: 1, name: 'Buckhead Grand', units: 320, avgRent: 2580, rentChange1D: 0.10, rentChange1M: 1.4, rentGrowthYoY: 3.6, occupancy: 94.6, capRate: 4.5 },
      { rank: 2, name: 'Alexan Buckhead', units: 420, avgRent: 2680, rentChange1D: 0.05, rentChange1M: 0.8, rentGrowthYoY: 2.5, occupancy: 92.1, capRate: 4.6 },
      { rank: 3, name: 'Hanover Buckhead', units: 370, avgRent: 2280, rentChange1D: 0.30, rentChange1M: 1.8, rentGrowthYoY: 4.8, occupancy: 94.2, capRate: 5.2 },
    ],
  },
];

const PropertyCardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const property = useMemo(() => {
    if (!id) return STANDALONE_PROPERTIES[0];
    return STANDALONE_PROPERTIES.find(p => p.id === id) || STANDALONE_PROPERTIES[0];
  }, [id]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: BT.bg.terminal,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
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

        <div style={{ display: 'flex', gap: 6 }}>
          {STANDALONE_PROPERTIES.map(p => (
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

      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ width: '100%', flex: 1 }}>
          <BloombergPropertyCard
            property={{
              id: property.id,
              name: property.name,
              address: property.address,
              class: property.class,
              avgRent: property.avgRent,
              rentChange: property.rentChange,
              rentChangePercent: property.rentChangePercent,
              units: property.units,
              yearBuilt: property.yearBuilt,
              occupancy: property.occupancy,
              occupancyChange: property.occupancyChange,
              capRate: property.capRate,
              owner: property.owner,
              images: property.images,
              concessions: property.concessions,
              noi: property.noi,
              revenue: property.revenue,
              expenses: property.expenses,
              debtService: property.debtService,
              absorption: property.absorption,
            }}
            sparklineData={property.sparkline}
            showComps={true}
            comps={property.comps}
            strategyScore={{
              score: property.jedi,
              strategy: 'value-add',
              arbitrageFlag: property.sellerMotivation >= 70,
            }}
            onClick={() => navigate(`/properties/${property.id}`)}
          />
        </div>
      </div>

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
          JEDIRE PROPERTY CARD v1.0
        </span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.muted }}>
          {STANDALONE_PROPERTIES.length} properties indexed · {property.submarket} submarket
        </span>
        <span style={{ ...mono, fontSize: 9, color: BT.text.green }}>
          JEDI {property.jedi}/100
        </span>
      </div>
    </div>
  );
};

export default PropertyCardPage;
