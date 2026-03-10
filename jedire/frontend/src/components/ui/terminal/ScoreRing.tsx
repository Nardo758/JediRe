import React from 'react';
import { TerminalTheme as T } from './theme';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({ 
  score, 
  size = 72, 
  strokeWidth = 5,
  label = "JEDI"
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  // Color based on score
  const color = score >= 80 
    ? T.text.green 
    : score >= 65 
    ? T.text.amber 
    : score >= 50 
    ? T.text.orange 
    : T.text.red;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Background circle */}
        <circle 
          cx={size/2} 
          cy={size/2} 
          r={radius} 
          fill="none" 
          stroke={`${color}15`} 
          strokeWidth={strokeWidth} 
        />
        {/* Progress circle */}
        <circle 
          cx={size/2} 
          cy={size/2} 
          r={radius} 
          fill="none" 
          stroke={color} 
          strokeWidth={strokeWidth}
          strokeDasharray={circumference} 
          strokeDashoffset={offset} 
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} 
        />
      </svg>
      <div style={{ 
        position: "absolute", 
        inset: 0, 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center" 
      }}>
        <span style={{ 
          fontSize: size * 0.25, 
          fontFamily: T.font.mono, 
          fontWeight: 800, 
          color, 
          lineHeight: 1 
        }}>
          {score}
        </span>
        {label && (
          <span style={{ 
            fontSize: size * 0.083, 
            fontFamily: T.font.mono, 
            color: T.text.muted, 
            letterSpacing: "0.1em",
            marginTop: 2,
          }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
};
