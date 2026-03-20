import React from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';

const WatchlistPage: React.FC = () => (
  <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>Market Watchlist</div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
      Your watched markets will appear here. Add markets from the Market Intelligence dashboard.
    </div>
  </div>
);

export default WatchlistPage;
