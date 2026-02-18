import React from 'react';
import { TrendingUp, TrendingDown, Minus, Edit2 } from 'lucide-react';

interface ComparisonRow {
  label: string;
  broker: string | number;
  market: string | number;
  user?: string | number;
  format?: 'currency' | 'percent' | 'number' | 'text';
  editable?: boolean;
}

interface ThreeColumnComparisonProps {
  rows: ComparisonRow[];
  onUserEdit?: (label: string, value: string | number) => void;
}

export const ThreeColumnComparison: React.FC<ThreeColumnComparisonProps> = ({ 
  rows, 
  onUserEdit 
}) => {
  
  const formatValue = (value: string | number, format?: string) => {
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'percent':
        return `${value}%`;
      case 'number':
        return value.toLocaleString();
      default:
        return value;
    }
  };

  const calculateDelta = (broker: number, market: number) => {
    const delta = ((broker - market) / market) * 100;
    return delta;
  };

  const getDeltaDisplay = (broker: string | number, market: string | number) => {
    if (typeof broker !== 'number' || typeof market !== 'number') return null;
    
    const delta = calculateDelta(broker, market);
    
    if (Math.abs(delta) < 0.1) {
      return (
        <div className="flex items-center gap-1 text-gray-500 text-sm">
          <Minus className="w-3 h-3" />
          <span>Match</span>
        </div>
      );
    }
    
    const isPositive = delta > 0;
    
    return (
      <div className={`flex items-center gap-1 text-sm ${
        isPositive ? 'text-yellow-600' : 'text-green-600'
      }`}>
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        <span>{isPositive ? '+' : ''}{delta.toFixed(1)}%</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200">
        <div className="p-4 font-semibold text-gray-900">Metric</div>
        <div className="p-4 text-center">
          <div className="font-semibold text-blue-900">Broker Claims</div>
          <div className="text-xs text-blue-600">Layer 1: Deal Data</div>
        </div>
        <div className="p-4 text-center">
          <div className="font-semibold text-purple-900">Market Reality</div>
          <div className="text-xs text-purple-600">Layer 2: Platform Intel</div>
        </div>
        <div className="p-4 text-center">
          <div className="font-semibold text-green-900">Your Model</div>
          <div className="text-xs text-green-600">Layer 3: Your Assumptions</div>
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => (
        <div 
          key={idx} 
          className={`grid grid-cols-4 border-b border-gray-100 hover:bg-gray-50 ${
            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
          }`}
        >
          {/* Label */}
          <div className="p-4 font-medium text-gray-700">
            {row.label}
          </div>

          {/* Broker Claims (Blue - Original) */}
          <div className="p-4 text-center bg-blue-50/30">
            <div className="text-lg font-semibold text-blue-900">
              {formatValue(row.broker, row.format)}
            </div>
            <div className="text-xs text-blue-600 mt-1">Original claim</div>
          </div>

          {/* Market Reality (Purple - Comparison) */}
          <div className="p-4 text-center bg-purple-50/30">
            <div className="text-lg font-semibold text-purple-900">
              {formatValue(row.market, row.format)}
            </div>
            <div className="mt-1">
              {getDeltaDisplay(row.broker, row.market)}
            </div>
          </div>

          {/* Your Model (Green - User's Choice) */}
          <div className="p-4 text-center bg-green-50/30">
            {row.editable && onUserEdit ? (
              <button 
                onClick={() => onUserEdit(row.label, row.user || row.broker)}
                className="group flex items-center justify-center gap-2 w-full"
              >
                <div className="text-lg font-semibold text-green-900">
                  {row.user ? formatValue(row.user, row.format) : formatValue(row.broker, row.format)}
                </div>
                <Edit2 className="w-4 h-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ) : (
              <div className="text-lg font-semibold text-green-900">
                {row.user ? formatValue(row.user, row.format) : formatValue(row.broker, row.format)}
              </div>
            )}
            <div className="text-xs text-green-600 mt-1">
              {row.user ? 'Your adjustment' : 'Using broker'}
            </div>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="bg-gray-50 p-4 text-xs text-gray-600">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span>Original deal data (preserved)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
            <span>Market comparison (reference only)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span>Your final assumptions (used in pro forma)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeColumnComparison;
