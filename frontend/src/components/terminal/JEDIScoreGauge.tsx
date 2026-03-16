import React from 'react';
import { T } from '../../styles/terminal-tokens';
import { Spark } from './Spark';

interface JEDIScoreGaugeProps {
  score: number;
  delta?: string;
  history?: number[];
  size?: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return T.text.green;
  if (score >= 65) return T.text.amber;
  return T.text.red;
}

export const JEDIScoreGauge: React.FC<JEDIScoreGaugeProps> = ({ score, delta, history, size = 100 }) => {
  const color = scoreColor(score);
  const r = (size / 2) - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDash = (score / 100) * circumference;
  const deltaColor = delta?.startsWith('+') ? T.text.green : delta?.startsWith('-') ? T.text.red : T.text.secondary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border.medium} strokeWidth={6} />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
            strokeDashoffset={circumference / 4}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <span style={{ fontSize: T.fontSize.hero, fontWeight: 800, color, fontFamily: T.font.mono, lineHeight: 1 }}>
            {score}
          </span>
          {delta && (
            <span style={{ fontSize: T.fontSize.xs, color: deltaColor, fontFamily: T.font.mono, fontWeight: 600 }}>
              {delta}
            </span>
          )}
        </div>
      </div>
      {history && <Spark data={history} color={color} w={size * 0.8} h={14} />}
    </div>
  );
};
