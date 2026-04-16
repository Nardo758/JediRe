import React from 'react';

export const WatchlistPage: React.FC = () => {
  return (
    <div style={{
      padding: 32,
      background: '#0F1319',
      color: '#E8ECF1',
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      minHeight: '100vh',
    }}>
      <div style={{ fontSize: 9, color: '#4A5568', letterSpacing: '0.12em', marginBottom: 12 }}>
        MARKET INTELLIGENCE
      </div>
      <div style={{ fontSize: 18, color: '#00BCD4', fontWeight: 700, marginBottom: 8 }}>
        Watchlist
      </div>
      <div style={{ fontSize: 11, color: '#8B95A5' }}>
        Track markets and submarkets of interest.
      </div>
    </div>
  );
};

export default WatchlistPage;
