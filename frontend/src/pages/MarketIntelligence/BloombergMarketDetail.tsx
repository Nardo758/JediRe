import React from 'react';

interface BloombergMarketDetailProps {
  marketId?: string;
  msaCode?: string;
}

const BloombergMarketDetail: React.FC<BloombergMarketDetailProps> = ({ marketId, msaCode }) => {
  return (
    <div style={{
      padding: 32,
      background: '#0F1319',
      color: '#E8ECF1',
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      minHeight: '400px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontSize: 11, color: '#4A5568', letterSpacing: '0.1em' }}>MARKET DETAIL</div>
      <div style={{ fontSize: 14, color: '#00BCD4' }}>{msaCode || marketId || 'No market selected'}</div>
    </div>
  );
};

export default BloombergMarketDetail;
