import React from 'react';

const Page: React.FC = () => (
  <div style={{ padding: 32, background: '#0F1319', color: '#E8ECF1', fontFamily: "'JetBrains Mono',monospace", minHeight: '100vh' }}>
    <div style={{ fontSize: 9, color: '#4A5568', letterSpacing: '0.12em', marginBottom: 12 }}>INTELLIGENCE</div>
    <div style={{ fontSize: 18, color: '#00BCD4', fontWeight: 700, marginBottom: 8 }}>Competition Analysis</div>
    <div style={{ fontSize: 11, color: '#8B95A5' }}>Development competition analysis.</div>
  </div>
);

export default Page;
export { Page };
