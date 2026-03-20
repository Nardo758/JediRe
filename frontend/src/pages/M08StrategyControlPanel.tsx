import React from 'react';
import { T as BT, mono } from '../components/deal/bloomberg-tokens';

const M08StrategyControlPanel: React.FC = () => (
  <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: BT.amber, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>M08 · Strategy Control Panel</div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
      Configure strategy parameters and scoring models.
    </div>
  </div>
);

export default M08StrategyControlPanel;
