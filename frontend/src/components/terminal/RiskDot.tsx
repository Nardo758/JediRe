import React from 'react';
import { T } from '../../styles/terminal-tokens';

interface RiskDotProps {
  severity: 'LOW' | 'MED' | 'HIGH';
  label?: string;
}

const COLOR_MAP = {
  LOW:  T.text.green,
  MED:  T.text.orange,
  HIGH: T.text.red,
};

export const RiskDot: React.FC<RiskDotProps> = ({ severity, label }) => {
  const color = COLOR_MAP[severity] ?? T.text.muted;
  const isHigh = severity === 'HIGH';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: isHigh ? 'riskPulse 1.4s ease-in-out infinite' : undefined,
        boxShadow: isHigh ? `0 0 6px ${color}88` : undefined,
      }} />
      <style>{`@keyframes riskPulse{0%,100%{opacity:1;box-shadow:0 0 4px ${T.text.red}44}50%{opacity:0.7;box-shadow:0 0 10px ${T.text.red}88}}`}</style>
      <span style={{ fontSize: '9px', fontFamily: T.font.mono, color, fontWeight: 700, letterSpacing: 0.5 }}>
        {label ?? severity}
      </span>
    </span>
  );
};
