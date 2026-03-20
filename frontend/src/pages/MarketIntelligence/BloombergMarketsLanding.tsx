import React from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';
import { useNavigate } from 'react-router-dom';

const BloombergMarketsLanding: React.FC = () => {
  const navigate = useNavigate();

  const panels = [
    { title: 'Market Overview', sub: 'Demand · Rent · Supply', path: '/markets/overview', accent: BT.cyanL },
    { title: 'My Markets', sub: 'Watchlist · Alerts', path: '/markets/my-markets', accent: BT.greenL },
    { title: 'Compare Markets', sub: 'Side-by-side Analysis', path: '/markets/compare', accent: BT.amber },
    { title: 'Power Rankings', sub: 'Top Markets by Score', path: '/markets/rankings', accent: BT.violL },
    { title: 'Future Supply', sub: 'Pipeline · Deliveries', path: '/markets/supply', accent: BT.orangeL },
    { title: 'Active Owners', sub: 'Buyer Activity', path: '/markets/owners', accent: BT.blueL },
  ];

  return (
    <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 8 }}>
        Bloomberg Market Intelligence
      </div>
      <div style={{ fontSize: 13, color: BT.ts, marginBottom: 28, ...mono }}>
        Real-time market data, rankings, and intelligence across all submarkets
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {panels.map((p, i) => (
          <button
            key={i}
            onClick={() => navigate(p.path)}
            style={{
              background: BT.bgCard,
              border: `1px solid ${BT.border}`,
              borderLeft: `3px solid ${p.accent}`,
              borderRadius: 4,
              padding: '20px 16px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = BT.bgPanel; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = BT.bgCard; }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: p.accent, letterSpacing: 1, textTransform: 'uppercase', ...mono, marginBottom: 4 }}>
              {p.title}
            </div>
            <div style={{ fontSize: 11, color: BT.td, ...mono }}>{p.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BloombergMarketsLanding;
