/**
 * SupplyCell - Smart supply metric cell for F4 Markets
 * 
 * Wraps SmartMetricCell with F4-specific styling.
 * Click to expand full supply pipeline details.
 */

import React from 'react';
import { SmartMetricCell } from '../../intelligence/SmartMetricCell';

interface SupplyCellProps {
  value: string;       // "15.8%"
  valueNum: number;    // 15.8
  marketId: string;    // "atlanta-ga"
  submarketId?: string;
  showExpand?: boolean;
}

// Threshold colors (lower pipeline % is better)
const getColor = (val: number): string => {
  if (val <= 8) return '#10B981';  // Green - low supply
  if (val <= 14) return '#F59E0B'; // Amber - moderate
  return '#EF4444';                 // Red - high supply
};

export const SupplyCell: React.FC<SupplyCellProps> = ({ 
  value, 
  valueNum, 
  marketId,
  submarketId,
  showExpand = true
}) => {
  const color = getColor(valueNum);
  
  return (
    <div style={{ position: 'relative' }}>
      <SmartMetricCell
        value={valueNum}
        metricType="supply"
        format="percent"
        marketId={marketId}
        submarketId={submarketId}
        expandable={showExpand}
        className=""
      />
      {/* Subtle color indicator */}
      <div 
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 2,
          height: 12,
          backgroundColor: color,
          borderRadius: 1,
          opacity: 0.7,
        }}
      />
    </div>
  );
};

export default SupplyCell;
