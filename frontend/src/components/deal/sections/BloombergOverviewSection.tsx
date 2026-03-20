import React from 'react';

interface BloombergOverviewSectionProps {
  deal: any;
  onTabChange?: (tab: string) => void;
  geographicContext?: Record<string, unknown>;
}

export const BloombergOverviewSection: React.FC<BloombergOverviewSectionProps> = ({ deal, onTabChange, geographicContext }) => {
  if (!deal) {
    return (
      <div style={{ padding: 24, color: '#4a5568', fontFamily: 'monospace', fontSize: 12 }}>
        Loading deal…
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* The actual OverviewSection content is rendered by OverviewSection.tsx via DealDetailPage */}
    </div>
  );
};

export default BloombergOverviewSection;
