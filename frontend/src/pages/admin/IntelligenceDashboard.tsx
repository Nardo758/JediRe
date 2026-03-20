import React from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';

export const IntelligenceDashboard: React.FC = () => (
  <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>Intelligence Dashboard</div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
      System intelligence monitoring and configuration.
    </div>
  </div>
);
export default IntelligenceDashboard;
