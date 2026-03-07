/**
 * MiniCycleRing - Small 4-phase ring showing cycle position
 * Usage: <MiniCycleRing marketId="tampa-msa" size={60} />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { CycleSnapshot, CyclePhase } from '../../../types/m28.types';

interface MiniCycleRingProps {
  marketId: string;
  size?: number;
  showLabel?: boolean;
}

const phaseAngles: Record<CyclePhase, { start: number; end: number }> = {
  recession: { start: 135, end: 225 },    // Bottom-left quadrant
  recovery: { start: 225, end: 315 },     // Bottom-right quadrant
  expansion: { start: 315, end: 45 },     // Top-right quadrant
  hypersupply: { start: 45, end: 135 },   // Top-left quadrant
};

const phaseColors: Record<CyclePhase, string> = {
  recession: '#EF4444',    // red
  recovery: '#F59E0B',     // amber
  expansion: '#10B981',    // green
  hypersupply: '#F97316',  // orange
};

export const MiniCycleRing: React.FC<MiniCycleRingProps> = ({
  marketId,
  size = 80,
  showLabel = false,
}) => {
  const [snapshot, setSnapshot] = useState<CycleSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCyclePhase = async () => {
      try {
        const data = await m28Client.getCyclePhase(marketId);
        setSnapshot(data);
      } catch (err) {
        console.error('Error fetching cycle phase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCyclePhase();
  }, [marketId]);

  if (loading || !snapshot) {
    return (
      <div 
        style={{ width: size, height: size }}
        className="rounded-full bg-gray-200 animate-pulse"
      />
    );
  }

  const phase = snapshot.lag_phase;
  const position = snapshot.lag_position; // 0-1 within phase
  const angles = phaseAngles[phase];
  
  // Calculate precise angle within phase
  const phaseSpan = angles.end - angles.start;
  const adjustedSpan = phaseSpan < 0 ? phaseSpan + 360 : phaseSpan;
  const currentAngle = (angles.start + (position * adjustedSpan)) % 360;

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) - 5;
  
  // Calculate indicator dot position
  const angleRad = (currentAngle * Math.PI) / 180;
  const dotX = centerX + radius * Math.cos(angleRad);
  const dotY = centerY + radius * Math.sin(angleRad);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="8"
        />

        {/* Phase segments */}
        {Object.entries(phaseAngles).map(([phaseName, angles]) => {
          const start = (angles.start * Math.PI) / 180;
          const end = (angles.end * Math.PI) / 180;
          const span = angles.end - angles.start;
          const adjustedSpan = span < 0 ? span + 360 : span;
          
          const largeArcFlag = adjustedSpan > 180 ? 1 : 0;
          
          const startX = centerX + radius * Math.cos(start);
          const startY = centerY + radius * Math.sin(start);
          const endX = centerX + radius * Math.cos(end);
          const endY = centerY + radius * Math.sin(end);

          const pathData = `
            M ${startX} ${startY}
            A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}
          `;

          const isActive = phaseName === phase;

          return (
            <path
              key={phaseName}
              d={pathData}
              fill="none"
              stroke={phaseColors[phaseName as CyclePhase]}
              strokeWidth="8"
              opacity={isActive ? 1 : 0.3}
            />
          );
        })}

        {/* Current position indicator */}
        <circle
          cx={dotX}
          cy={dotY}
          r={6}
          fill={phaseColors[phase]}
          stroke="white"
          strokeWidth="2"
        />
      </svg>

      {showLabel && (
        <span className="text-xs font-medium text-gray-600 capitalize">
          {phase}
        </span>
      )}
    </div>
  );
};
