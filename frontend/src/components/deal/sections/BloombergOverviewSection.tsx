import React from 'react';
import { Deal } from '../../../types/deal';

interface BloombergOverviewSectionProps {
  deal: Deal;
  onTabChange?: (tab: string) => void;
  geographicContext?: Record<string, unknown>;
}

export const BloombergOverviewSection: React.FC<BloombergOverviewSectionProps> = ({
  deal,
}) => {
  return (
    <div style={{
      padding: 24,
      background: '#0F1319',
      color: '#E8ECF1',
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      fontSize: 12,
    }}>
      <div style={{ color: '#4A5568', fontSize: 9, letterSpacing: '0.12em', marginBottom: 8 }}>
        DEAL OVERVIEW
      </div>
      <div style={{ color: '#00BCD4', fontSize: 16, fontWeight: 700 }}>
        {deal?.name || deal?.address || 'Deal Overview'}
      </div>
    </div>
  );
};
