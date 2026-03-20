import React, { useState, useEffect } from 'react';
import { T as BT, mono } from '../../../components/deal/bloomberg-tokens';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  uptime?: string;
}

export const SystemHealthSection: React.FC = () => {
  const [services] = useState<ServiceHealth[]>([
    { name: 'API Server', status: 'healthy', latency: 42, uptime: '99.9%' },
    { name: 'PostgreSQL', status: 'healthy', latency: 8, uptime: '100%' },
    { name: 'AI Services', status: 'healthy', latency: 340, uptime: '99.5%' },
    { name: 'Geocoding', status: 'healthy', latency: 180, uptime: '99.8%' },
    { name: 'Market Data Feed', status: 'healthy', latency: 95, uptime: '99.7%' },
  ]);

  const statusColor = (s: string) => {
    if (s === 'healthy') return BT.greenL;
    if (s === 'degraded') return BT.amber;
    return BT.redL;
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 20 }}>
        System Health Monitor
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'All Systems', value: 'Operational', color: BT.greenL },
          { label: 'Active Incidents', value: '0', color: BT.text.white },
          { label: 'Last Check', value: new Date().toLocaleTimeString(), color: BT.ts },
        ].map((m, i) => (
          <div key={i} style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, padding: '16px 20px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', ...mono, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.color, ...mono }}>{m.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 16px', background: BT.bgPanel, borderBottom: `1px solid ${BT.border}` }}>
          {['Service', 'Status', 'Latency', 'Uptime'].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', ...mono }}>{h}</div>
          ))}
        </div>
        {services.map((svc, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: i < services.length - 1 ? `1px solid ${BT.border}` : 'none', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: BT.text.white, ...mono }}>{svc.name}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: statusColor(svc.status), ...mono }}>
              ● {svc.status.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: BT.ts, ...mono }}>{svc.latency ? `${svc.latency}ms` : '—'}</div>
            <div style={{ fontSize: 11, color: BT.greenL, ...mono }}>{svc.uptime || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemHealthSection;
