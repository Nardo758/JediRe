import React from 'react';

export const PageLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#050810',
    flexDirection: 'column',
    gap: 16,
  }}>
    <div style={{
      width: 40,
      height: 40,
      border: '3px solid #1e2a45',
      borderTop: '3px solid #00b4d8',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{ color: '#4a5568', fontSize: 11, letterSpacing: 2, fontFamily: 'monospace', textTransform: 'uppercase' }}>
      Loading…
    </div>
  </div>
);

export default PageLoadingFallback;
