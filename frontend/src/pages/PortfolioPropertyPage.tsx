import React from 'react';
import { T as BT, mono } from '../components/deal/bloomberg-tokens';

const PortfolioPropertyPage: React.FC = () => (
  <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>Portfolio Property</div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
      Property-level portfolio analytics and performance tracking.
    </div>
  </div>
);

export default PortfolioPropertyPage;
