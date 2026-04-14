import React from 'react';

const COLORS = {
  bgDeep: '#0B0E1A',
  bgPanel: '#131929',
  border: '#1E2538',
  textPrimary: '#E2E8F0',
  textSecondary: '#A0ABBE',
  textMuted: '#6B7A8D',
  gray: '#6B7A8D', // MSA
  cyan: '#0891B2', // Submarket
  amber: '#D97706', // Property
  futureBg: 'rgba(255, 255, 255, 0.02)'
};

interface EventTick {
  id: string;
  month: number; // -24 to +12
  magnitude: 'small' | 'medium' | 'large' | 'transformative';
  scope: 'MSA' | 'Submarket' | 'Property';
  title?: string;
  isHovered?: boolean;
}

const events: EventTick[] = [
  { id: '1', month: -22, magnitude: 'small', scope: 'Property' },
  { id: '2', month: -20, magnitude: 'medium', scope: 'Submarket' },
  { id: '3', month: -18, magnitude: 'large', scope: 'MSA' },
  { id: '4', month: -17, magnitude: 'small', scope: 'Property' },
  { id: '5', month: -16, magnitude: 'medium', scope: 'Submarket' },
  { id: '6', month: -15, magnitude: 'transformative', scope: 'MSA' },
  { id: '7', month: -14, magnitude: 'medium', scope: 'Property' },
  { id: '8', month: -14.5, magnitude: 'large', scope: 'Submarket' },
  { id: '9', month: -10, magnitude: 'small', scope: 'MSA' },
  { id: '10', month: -8, magnitude: 'transformative', scope: 'MSA', title: 'Amazon HQ2 Tampa', isHovered: true },
  { id: '11', month: -5, magnitude: 'medium', scope: 'Submarket' },
  { id: '12', month: -3, magnitude: 'large', scope: 'Property' },
  { id: '13', month: -1, magnitude: 'small', scope: 'Submarket' },
  { id: '14', month: 2, magnitude: 'medium', scope: 'Property' },
  { id: '15', month: 6, magnitude: 'large', scope: 'MSA' },
  { id: '16', month: 9, magnitude: 'small', scope: 'Submarket' },
];

const getMagnitudeHeight = (mag: string) => {
  switch(mag) {
    case 'small': return 20;
    case 'medium': return 40;
    case 'large': return 60;
    case 'transformative': return 80;
    default: return 20;
  }
};

const getScopeColor = (scope: string) => {
  switch(scope) {
    case 'MSA': return COLORS.gray;
    case 'Submarket': return COLORS.cyan;
    case 'Property': return COLORS.amber;
    default: return COLORS.gray;
  }
};

export const EventDensityStrip = () => {
  const minMonth = -24;
  const maxMonth = 12;
  const totalMonths = maxMonth - minMonth;

  const getLeftPercentage = (month: number) => {
    return ((month - minMonth) / totalMonths) * 100;
  };

  const todayPercentage = getLeftPercentage(0);

  return (
    <div style={{
      backgroundColor: COLORS.bgPanel,
      padding: '24px',
      borderRadius: '8px',
      fontFamily: 'Inter, sans-serif',
      color: COLORS.textPrimary,
      width: '100%',
      maxWidth: '1000px',
      border: `1px solid ${COLORS.border}`
    }}>
      
      {/* Title Row */}
      <div className="flex justify-between items-end mb-6">
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, letterSpacing: '0.02em', color: COLORS.textPrimary }}>
          Events affecting Tampa — Westshore Submarket
        </h3>
        <span style={{ fontSize: '12px', color: COLORS.textSecondary }}>
          24mo history + 12mo forward
        </span>
      </div>

      {/* Main Strip Container */}
      <div style={{ position: 'relative', height: '120px', width: '100%', backgroundColor: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderRadius: '4px', overflow: 'hidden' }}>
        
        {/* Shaded future region */}
        <div style={{
          position: 'absolute',
          left: `${todayPercentage}%`,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: COLORS.futureBg,
          borderLeft: `1px dashed ${COLORS.textMuted}`
        }} />

        {/* Baseline */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '20px',
          height: '1px',
          backgroundColor: COLORS.border
        }} />

        {/* Ticks */}
        {events.map(event => {
          const height = getMagnitudeHeight(event.magnitude);
          const color = getScopeColor(event.scope);
          const left = getLeftPercentage(event.month);
          
          return (
            <div key={event.id} style={{ position: 'absolute', left: `${left}%`, bottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              
              {/* Tooltip Simulation */}
              {event.isHovered && (
                <div style={{
                  position: 'absolute',
                  bottom: `${height + 10}px`,
                  backgroundColor: COLORS.bgPanel,
                  border: `1px solid ${COLORS.border}`,
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  color: COLORS.textPrimary,
                  transform: 'translateX(-50%)'
                }}>
                  📣 {event.title} | {event.scope} | {event.magnitude.charAt(0).toUpperCase() + event.magnitude.slice(1)} | T{event.month}mo
                  <div style={{
                    position: 'absolute',
                    bottom: '-5px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: `5px solid ${COLORS.border}`
                  }}/>
                </div>
              )}

              {/* Tick Mark */}
              <div style={{
                width: '3px',
                height: `${height}px`,
                backgroundColor: color,
                borderRadius: '2px 2px 0 0',
                opacity: event.isHovered ? 1 : 0.8,
                boxShadow: event.isHovered ? `0 0 8px ${color}` : 'none'
              }} />
            </div>
          );
        })}

        {/* X-axis labels */}
        <div style={{ position: 'absolute', bottom: '2px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 8px', fontSize: '10px', color: COLORS.textMuted, fontFamily: 'monospace' }}>
          <span style={{ position: 'absolute', left: `${getLeftPercentage(-24)}%`, transform: 'translateX(0)' }}>T-24mo</span>
          <span style={{ position: 'absolute', left: `${getLeftPercentage(-18)}%`, transform: 'translateX(-50%)' }}>T-18mo</span>
          <span style={{ position: 'absolute', left: `${getLeftPercentage(-12)}%`, transform: 'translateX(-50%)' }}>T-12mo</span>
          <span style={{ position: 'absolute', left: `${getLeftPercentage(-6)}%`, transform: 'translateX(-50%)' }}>T-6mo</span>
          <span style={{ position: 'absolute', left: `${todayPercentage}%`, transform: 'translateX(-50%)', color: COLORS.textPrimary }}>Today</span>
          <span style={{ position: 'absolute', left: `${getLeftPercentage(6)}%`, transform: 'translateX(-50%)' }}>T+6mo</span>
          <span style={{ position: 'absolute', right: '4px' }}>T+12mo</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-6 items-center justify-center" style={{ fontSize: '11px', color: COLORS.textSecondary }}>
        <div className="flex gap-4">
          <div className="flex items-center gap-1"><div style={{ width: '8px', height: '8px', backgroundColor: COLORS.gray, borderRadius: '2px' }}></div> MSA</div>
          <div className="flex items-center gap-1"><div style={{ width: '8px', height: '8px', backgroundColor: COLORS.cyan, borderRadius: '2px' }}></div> Submarket</div>
          <div className="flex items-center gap-1"><div style={{ width: '8px', height: '8px', backgroundColor: COLORS.amber, borderRadius: '2px' }}></div> Property</div>
        </div>
        
        <div style={{ width: '1px', height: '12px', backgroundColor: COLORS.border }}></div>
        
        <div className="flex gap-4 items-end">
          <div className="flex items-end gap-1"><div style={{ width: '3px', height: '8px', backgroundColor: COLORS.textMuted }}></div> Small</div>
          <div className="flex items-end gap-1"><div style={{ width: '3px', height: '12px', backgroundColor: COLORS.textMuted }}></div> Medium</div>
          <div className="flex items-end gap-1"><div style={{ width: '3px', height: '16px', backgroundColor: COLORS.textMuted }}></div> Large</div>
          <div className="flex items-end gap-1"><div style={{ width: '3px', height: '20px', backgroundColor: COLORS.textMuted }}></div> Transformative</div>
        </div>
      </div>

    </div>
  );
};

export default EventDensityStrip;
