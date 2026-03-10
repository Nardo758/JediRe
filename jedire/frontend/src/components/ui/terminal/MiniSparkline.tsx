import React from 'react';
import { TerminalTheme as T } from './theme';

interface MiniSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({ 
  data, 
  color = T.text.green, 
  width = 60, 
  height = 16 
}) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline 
        points={points} 
        fill="none" 
        stroke={color} 
        strokeWidth={1.2}
        style={{ transition: "stroke 0.3s ease" }}
      />
    </svg>
  );
};
