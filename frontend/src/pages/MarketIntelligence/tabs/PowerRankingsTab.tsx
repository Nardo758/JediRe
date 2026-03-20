import React from 'react';
import { T as BT, mono, BMiniBar } from '../../../components/deal/bloomberg-tokens';

interface PowerRankingsTabProps {
  [key: string]: any;
}

const PowerRankingsTab: React.FC<PowerRankingsTabProps> = () => {
  const markets = [
    { name: 'Downtown Core', score: 88, demand: 92, supply: 78, momentum: 85 },
    { name: 'Midtown', score: 82, demand: 85, supply: 80, momentum: 79 },
    { name: 'Suburban East', score: 74, demand: 70, supply: 85, momentum: 68 },
    { name: 'Suburban West', score: 71, demand: 68, supply: 78, momentum: 70 },
    { name: 'Urban Fringe', score: 65, demand: 60, supply: 72, momentum: 62 },
  ];

  return (
    <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>
        Market Power Rankings
      </div>
      <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          padding: '8px 16px',
          background: BT.bgPanel,
          borderBottom: `1px solid ${BT.border}`,
        }}>
          {['Market', 'Score', 'Demand', 'Supply', 'Momentum'].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', ...mono }}>{h}</div>
          ))}
        </div>
        {markets.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              padding: '12px 16px',
              borderBottom: i < markets.length - 1 ? `1px solid ${BT.border}` : 'none',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: BT.text.white, ...mono }}>{m.name}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: BT.cyanL, ...mono }}>{m.score}</div>
              <BMiniBar value={m.score} color={BT.cyanL} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: BT.greenL, ...mono }}>{m.demand}</div>
              <BMiniBar value={m.demand} color={BT.greenL} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: BT.amber, ...mono }}>{m.supply}</div>
              <BMiniBar value={m.supply} color={BT.amber} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: BT.violL, ...mono }}>{m.momentum}</div>
              <BMiniBar value={m.momentum} color={BT.violL} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PowerRankingsTab;
