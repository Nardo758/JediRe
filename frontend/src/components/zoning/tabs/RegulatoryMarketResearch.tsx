import React from 'react';
import { T as BT } from '../../deal/bloomberg-tokens';

interface RegulatoryMarketResearchProps {
  dealId?: string;
  [key: string]: any;
}

const RegulatoryMarketResearch: React.FC<RegulatoryMarketResearchProps> = ({ dealId }) => (
  <div style={{ padding: 20, background: BT.bg.terminal }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: BT.amber, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 12 }}>
      Regulatory Market Research
    </div>
    <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: 20, color: BT.td, fontSize: 11, fontFamily: 'monospace' }}>
      Regulatory and entitlement research data loading…
    </div>
  </div>
);

export default RegulatoryMarketResearch;
