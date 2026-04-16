import React from 'react';

const COLORS = {
  bgDeep: '#0B0E1A',
  bgPanel: '#131929',
  border: '#1E2538',
  textPrimary: '#E2E8F0',
  textSecondary: '#A0ABBE',
  textMuted: '#6B7A8D',
  cyan: '#0891B2',
  amber: '#D97706',
  green: '#10B981',
  red: '#EF4444',
};

type Status = 'AHEAD' | 'ON PACE' | 'BEHIND';

interface MetricData {
  id: string;
  title: string;
  currentValue: string;
  status: Status;
  // Simplified path data for SVG
  forecastPath: string;
  actualPath: string;
  conePath: string;
  trend: 'up' | 'down' | 'neutral';
}

const metrics: MetricData[] = [
  {
    id: '1',
    title: 'Rent Growth (YoY)',
    currentValue: '+4.2%',
    status: 'AHEAD',
    forecastPath: 'M0,40 Q25,40 50,30 T100,20 T150,15',
    actualPath: 'M0,40 Q25,38 50,25 T75,10 T80,5', // Ends at T+0 (x=80)
    conePath: 'M50,30 L100,10 L150,5 L150,25 L100,30 Z',
    trend: 'up'
  },
  {
    id: '2',
    title: 'Absorption Rate',
    currentValue: '12.5%',
    status: 'AHEAD',
    forecastPath: 'M0,35 Q30,35 60,30 T150,20',
    actualPath: 'M0,35 Q40,30 80,10',
    conePath: 'M60,30 L150,10 L150,30 Z',
    trend: 'up'
  },
  {
    id: '3',
    title: 'Search Momentum',
    currentValue: '154 idx',
    status: 'ON PACE',
    forecastPath: 'M0,45 L150,45',
    actualPath: 'M0,45 L70,45 L75,10 L80,25',
    conePath: 'M70,45 L150,15 L150,45 Z',
    trend: 'up'
  },
  {
    id: '4',
    title: 'Cap Rate',
    currentValue: '4.85%',
    status: 'AHEAD', // Lower is better
    forecastPath: 'M0,10 Q50,15 100,20 T150,25',
    actualPath: 'M0,10 Q40,15 80,35',
    conePath: 'M50,15 L150,15 L150,35 Z',
    trend: 'down'
  },
  {
    id: '5',
    title: 'Permit Velocity',
    currentValue: '210/mo',
    status: 'ON PACE',
    forecastPath: 'M0,40 Q50,40 100,30 T150,25',
    actualPath: 'M0,40 Q40,35 80,20',
    conePath: 'M100,30 L150,15 L150,35 Z',
    trend: 'up'
  },
  {
    id: '6',
    title: 'AADT / Traffic',
    currentValue: '45,200',
    status: 'BEHIND',
    forecastPath: 'M0,35 Q50,30 100,20 T150,10',
    actualPath: 'M0,35 Q40,35 80,25',
    conePath: 'M100,20 L150,0 L150,20 Z',
    trend: 'neutral'
  }
];

const StatusBadge = ({ status }: { status: Status }) => {
  let bg = '';
  let text = '';
  switch (status) {
    case 'AHEAD':
      bg = 'rgba(16, 185, 129, 0.15)';
      text = COLORS.green;
      break;
    case 'ON PACE':
      bg = 'rgba(8, 145, 178, 0.15)';
      text = COLORS.cyan;
      break;
    case 'BEHIND':
      bg = 'rgba(239, 68, 68, 0.15)';
      text = COLORS.red;
      break;
  }

  return (
    <div style={{
      backgroundColor: bg,
      color: text,
      fontSize: '9px',
      padding: '2px 6px',
      borderRadius: '4px',
      fontWeight: 600,
      letterSpacing: '0.05em'
    }}>
      {status}
    </div>
  );
};

const MiniChart = ({ metric }: { metric: MetricData }) => {
  return (
    <div style={{
      backgroundColor: COLORS.bgDeep,
      border: `1px solid ${COLORS.border}`,
      borderRadius: '4px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'flex-col',
      position: 'relative'
    }} className="flex flex-col h-full justify-between">
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1">
          <span style={{ color: COLORS.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {metric.title}
          </span>
          <StatusBadge status={metric.status} />
        </div>
        <span style={{ color: COLORS.textPrimary, fontFamily: 'monospace', fontSize: '16px', fontWeight: 700 }}>
          {metric.currentValue}
        </span>
      </div>

      <div style={{ height: '60px', position: 'relative', width: '100%' }}>
        <svg width="100%" height="100%" viewBox="0 0 150 50" preserveAspectRatio="none">
          {/* Shaded cone */}
          <path d={metric.conePath} fill="rgba(8, 145, 178, 0.05)" />
          
          {/* Forecast line (dotted) */}
          <path d={metric.forecastPath} fill="none" stroke={COLORS.textMuted} strokeWidth="1.5" strokeDasharray="3,3" />
          
          {/* Actual line (solid) */}
          <path d={metric.actualPath} fill="none" stroke={COLORS.textPrimary} strokeWidth="2" />
          
          {/* Event Marker at T+0 (x=80) */}
          <line x1="80" y1="0" x2="80" y2="50" stroke={COLORS.cyan} strokeWidth="1" strokeDasharray="2,2" opacity="0.7" />
          
          {/* Base Grid Line */}
          <line x1="0" y1="48" x2="150" y2="48" stroke={COLORS.border} strokeWidth="1" />
        </svg>

        {/* X-Axis Labels */}
        <div className="absolute bottom-[-16px] w-full flex justify-between px-1" style={{ fontSize: '9px', color: COLORS.textMuted, fontFamily: 'monospace' }}>
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>T+0</span>
          <span style={{ position: 'absolute', right: '0' }}>T+12</span>
        </div>
      </div>
    </div>
  );
};

export const MultiMetricPanel = () => {
  return (
    <div style={{
      backgroundColor: COLORS.bgPanel,
      padding: '20px',
      borderRadius: '8px',
      fontFamily: 'Inter, sans-serif',
      color: COLORS.textPrimary,
      width: '100%',
      maxWidth: '900px'
    }}>
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 border-b pb-4" style={{ borderColor: COLORS.border }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.cyan }}></div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0, letterSpacing: '0.02em' }}>
          Amazon HQ2 — Tampa MSA <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>| MSA Scope | T+8 months</span>
        </h2>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px'
      }}>
        {metrics.map(m => (
          <MiniChart key={m.id} metric={m} />
        ))}
      </div>

    </div>
  );
};

export default MultiMetricPanel;
