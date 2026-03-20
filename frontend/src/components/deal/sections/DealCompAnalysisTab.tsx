import React from 'react';
import { T as BT, mono } from '../bloomberg-tokens';

interface DealCompAnalysisTabProps {
  dealId?: string;
  [key: string]: any;
}

const DealCompAnalysisTab: React.FC<DealCompAnalysisTabProps> = ({ dealId }) => (
  <div style={{ padding: 20 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: BT.amber, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 16 }}>
      Competitive Analysis
    </div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 24, color: BT.td, fontSize: 12, ...mono }}>
      Comp analysis data loading…
    </div>
  </div>
);

export default DealCompAnalysisTab;
