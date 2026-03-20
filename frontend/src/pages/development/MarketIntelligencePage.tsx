import React from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';

export const MarketIntelligencePage: React.FC<any> = ({ dealId }) => (
  <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 20 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>Market Intelligence</div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
      Market intelligence data for {dealId || 'this deal'}.
    </div>
  </div>
);
export default MarketIntelligencePage;
