import React from 'react';
import { T as BT, mono } from '../bloomberg-tokens';

interface CustomScreenTabProps {
  [key: string]: any;
}

const CustomScreenTab: React.FC<CustomScreenTabProps> = () => (
  <div style={{ padding: 20 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: BT.violL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>
      Custom Screen
    </div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
      Configure your custom screen layout and metrics.
    </div>
  </div>
);

export default CustomScreenTab;
