import React from 'react';
import { T as BT, mono } from '../../components/deal/bloomberg-tokens';

export const M28WidgetsDemo: React.FC = () => (
  <div style={{ background: BT.bg.terminal, minHeight: '100%', padding: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: BT.violL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>M28 Widgets Demo</div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
      Market cycle intelligence widget demonstrations.
    </div>
  </div>
);

export default M28WidgetsDemo;
