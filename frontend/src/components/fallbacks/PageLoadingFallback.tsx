import React from 'react';

export const PageLoadingFallback: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0E17',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '2px solid #1E2538',
          borderTopColor: '#00BCD4',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span style={{ color: '#4A5568', fontSize: 11, letterSpacing: '0.12em' }}>
        LOADING
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default PageLoadingFallback;
