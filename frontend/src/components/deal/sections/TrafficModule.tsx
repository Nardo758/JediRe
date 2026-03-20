import React from 'react';
export const TrafficModule: React.FC<any> = () => (
  <div style={{ background: '#050810', minHeight: '100%', padding: 20 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#c77dff', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 12 }}>Traffic Intelligence</div>
    <div style={{ background: '#0d1326', border: '1px solid #1e2a45', borderRadius: 4, padding: 20, color: '#4a5568', fontSize: 12, fontFamily: 'monospace' }}>Loading…</div>
  </div>
);
export default TrafficModule;
