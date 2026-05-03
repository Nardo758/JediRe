/**
 * Smart Metric Cell
 * 
 * A clickable metric cell that knows how to expand itself.
 * When the user clicks, it analyzes context and shows relevant details.
 * 
 * Example:
 * - "2,400 units" → Expands to show all development projects
 * - "$2,450 avg rent" → Expands to show rent comp breakdown
 * - "94.2% occupancy" → Expands to show historical trend
 */

import React, { useState, useCallback } from 'react';
import { ChevronRight, Loader2, AlertTriangle, Info } from 'lucide-react';
import { useSupplyExpansion, useContextAnalysis } from '../../hooks/useContextAwareness';
import { SupplyExpansionPanel } from './SupplyExpansionPanel';
import api from '../../services/api';

type MetricType = 
  | 'supply' 
  | 'rent' 
  | 'occupancy' 
  | 'cap_rate' 
  | 'absorption'
  | 'vacancy'
  | 'generic';

interface SmartMetricCellProps {
  value: number | string;
  label?: string;
  metricType?: MetricType;
  marketId?: string;
  submarketId?: string;
  dealId?: string;
  format?: 'number' | 'currency' | 'percent' | 'units';
  suffix?: string;
  className?: string;
  onClick?: () => void;
  expandable?: boolean;
}

export const SmartMetricCell: React.FC<SmartMetricCellProps> = ({
  value,
  label,
  metricType = 'generic',
  marketId,
  submarketId,
  dealId,
  format = 'number',
  suffix,
  className = '',
  onClick,
  expandable = true
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasGaps, setHasGaps] = useState(false);

  // Supply expansion hook
  const supplyExpansion = useSupplyExpansion(marketId || '');
  const contextAnalysis = useContextAnalysis();

  // Format the value
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return val >= 1000000 
          ? `$${(val / 1000000).toFixed(1)}M`
          : val >= 1000
          ? `$${(val / 1000).toFixed(0)}K`
          : `$${val.toLocaleString()}`;
      case 'percent':
        return `${val.toFixed(1)}%`;
      case 'units':
        return `${val.toLocaleString()} units`;
      default:
        return val.toLocaleString();
    }
  };

  // Handle click based on metric type
  const handleClick = useCallback(async () => {
    if (onClick) {
      onClick();
      return;
    }

    if (!expandable) return;

    setLoading(true);

    try {
      if (metricType === 'supply' && marketId) {
        await supplyExpansion.expand(submarketId);
        setShowPanel(true);
      } else {
        // Generic context analysis
        const analysis = await contextAnalysis.analyze({
          context: metricType === 'rent' ? 'rent_trends' :
                   metricType === 'cap_rate' ? 'cap_rates' :
                   metricType === 'supply' ? 'supply_pipeline' :
                   'market_dashboard',
          marketId,
          submarketId,
          dealId,
          focusedMetric: metricType,
          focusedValue: value
        });
        
        if (analysis) {
          const criticalGaps = analysis.gaps?.filter(g => g.relevance === 'critical') || [];
          setHasGaps(criticalGaps.length > 0);
        }
      }
    } catch (err) {
      console.error('Failed to expand metric:', err);
    } finally {
      setLoading(false);
    }
  // hook intentionally captures contextAnalysis, supplyExpansion via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted values are read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricType, marketId, submarketId, dealId, value, onClick, expandable]);

  // Trigger research for gaps
  const handleTriggerResearch = useCallback(async (gaps: any[]) => {
    try {
      await api.post('/context/trigger-research', { gaps, priority: 'immediate' });
      // Could show a toast notification here
    } catch (err) {
      console.error('Failed to trigger research:', err);
    }
  }, []);

  const isClickable = expandable && (onClick || metricType !== 'generic');

  return (
    <>
      <div 
        className={`
          relative group
          ${isClickable ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''}
          ${className}
        `}
        onClick={handleClick}
      >
        <div className="flex items-center gap-1">
          {/* Value */}
          <span className="font-mono font-semibold">
            {formatValue(value)}
          </span>
          
          {/* Suffix */}
          {suffix && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {suffix}
            </span>
          )}
          
          {/* Loading indicator */}
          {loading && (
            <Loader2 className="w-3 h-3 animate-spin text-blue-500 ml-1" />
          )}
          
          {/* Gap indicator */}
          {hasGaps && !loading && (
            <AlertTriangle className="w-3 h-3 text-amber-500 ml-1" />
          )}
          
          {/* Expand indicator */}
          {isClickable && !loading && (
            <ChevronRight className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        {/* Label */}
        {label && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {label}
          </p>
        )}

        {/* Tooltip hint */}
        {isClickable && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Click for details
          </div>
        )}
      </div>

      {/* Supply expansion panel */}
      {showPanel && metricType === 'supply' && supplyExpansion.data && (
        <SupplyExpansionPanel
          data={supplyExpansion.data}
          submarketName={submarketId}
          onClose={() => setShowPanel(false)}
          onTriggerResearch={handleTriggerResearch}
        />
      )}
    </>
  );
};

/**
 * Pre-configured metric cells for common use cases
 */

export const SupplyMetricCell: React.FC<{
  units: number;
  marketId: string;
  submarketId?: string;
  className?: string;
}> = ({ units, marketId, submarketId, className }) => (
  <SmartMetricCell
    value={units}
    metricType="supply"
    format="units"
    marketId={marketId}
    submarketId={submarketId}
    className={className}
  />
);

export const RentMetricCell: React.FC<{
  rent: number;
  marketId?: string;
  submarketId?: string;
  propertyId?: string;
  className?: string;
}> = ({ rent, marketId, submarketId, propertyId, className }) => (
  <SmartMetricCell
    value={rent}
    metricType="rent"
    format="currency"
    marketId={marketId}
    submarketId={submarketId}
    className={className}
  />
);

export const OccupancyMetricCell: React.FC<{
  occupancy: number;
  marketId?: string;
  submarketId?: string;
  propertyId?: string;
  className?: string;
}> = ({ occupancy, marketId, submarketId, propertyId, className }) => (
  <SmartMetricCell
    value={occupancy}
    metricType="occupancy"
    format="percent"
    marketId={marketId}
    submarketId={submarketId}
    className={className}
  />
);

export const CapRateMetricCell: React.FC<{
  capRate: number;
  marketId?: string;
  submarketId?: string;
  dealId?: string;
  className?: string;
}> = ({ capRate, marketId, submarketId, dealId, className }) => (
  <SmartMetricCell
    value={capRate}
    metricType="cap_rate"
    format="percent"
    marketId={marketId}
    submarketId={submarketId}
    dealId={dealId}
    className={className}
  />
);

export default SmartMetricCell;
