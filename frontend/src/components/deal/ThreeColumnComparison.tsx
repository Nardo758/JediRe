import React from 'react';
import { TrendingUp, TrendingDown, Minus, Edit2 } from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';

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
        <div className="flex items-center gap-1" style={{ color: BT.text.muted, fontSize: BT.fontSize.base, fontFamily: BT.font.mono }}>
          <Minus className="w-3 h-3" />
          <span>Match</span>
        </div>
      );
    }

    const isPositive = delta > 0;

    return (
      <div className="flex items-center gap-1" style={{ fontSize: BT.fontSize.base, fontFamily: BT.font.mono, color: isPositive ? BT.text.amber : BT.text.green }}>
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
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div className="grid grid-cols-4" style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
        <div className="p-4" style={{ fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base }}>Metric</div>
        <div className="p-4 text-center">
          <div style={{ fontWeight: 600, color: BT.text.cyan, fontFamily: BT.font.mono, fontSize: BT.fontSize.base }}>Broker Claims</div>
          <div style={{ fontSize: BT.fontSize.xs, color: BT.text.cyan, fontFamily: BT.font.label, opacity: 0.7 }}>Layer 1: Deal Data</div>
        </div>
        <div className="p-4 text-center">
          <div style={{ fontWeight: 600, color: BT.text.purple, fontFamily: BT.font.mono, fontSize: BT.fontSize.base }}>Market Reality</div>
          <div style={{ fontSize: BT.fontSize.xs, color: BT.text.purple, fontFamily: BT.font.label, opacity: 0.7 }}>Layer 2: Platform Intel</div>
        </div>
        <div className="p-4 text-center">
          <div style={{ fontWeight: 600, color: BT.text.green, fontFamily: BT.font.mono, fontSize: BT.fontSize.base }}>Your Model</div>
          <div style={{ fontSize: BT.fontSize.xs, color: BT.text.green, fontFamily: BT.font.label, opacity: 0.7 }}>Layer 3: Your Assumptions</div>
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => (
        <div
          key={idx}
          className="grid grid-cols-4"
          style={{
            borderBottom: `1px solid ${BT.border.subtle}`,
            background: idx % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt)}
        >
          {/* Label */}
          <div className="p-4" style={{ fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base }}>
            {row.label}
          </div>

          {/* Broker Claims (Cyan - Original) */}
          <div className="p-4 text-center" style={{ background: `${BT.text.cyan}06` }}>
            <div style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.cyan, fontFamily: BT.font.mono }}>
              {formatValue(row.broker, row.format)}
            </div>
            <div style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, fontFamily: BT.font.label, marginTop: 4 }}>Original claim</div>
          </div>

          {/* Market Reality (Purple - Comparison) */}
          <div className="p-4 text-center" style={{ background: `${BT.text.purple}06` }}>
            <div style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.purple, fontFamily: BT.font.mono }}>
              {formatValue(row.market, row.format)}
            </div>
            <div style={{ marginTop: 4 }}>
              {getDeltaDisplay(row.broker, row.market)}
            </div>
          </div>

          {/* Your Model (Green - User's Choice) */}
          <div className="p-4 text-center" style={{ background: `${BT.text.green}06` }}>
            {row.editable && onUserEdit ? (
              <button
                onClick={() => onUserEdit(row.label, row.user || row.broker)}
                className="group flex items-center justify-center gap-2 w-full"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.green, fontFamily: BT.font.mono }}>
                  {row.user ? formatValue(row.user, row.format) : formatValue(row.broker, row.format)}
                </div>
                <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: BT.text.green }} />
              </button>
            ) : (
              <div style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.green, fontFamily: BT.font.mono }}>
                {row.user ? formatValue(row.user, row.format) : formatValue(row.broker, row.format)}
              </div>
            )}
            <div style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, fontFamily: BT.font.label, marginTop: 4 }}>
              {row.user ? 'Your adjustment' : 'Using broker'}
            </div>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="p-4" style={{ background: BT.bg.header, fontSize: BT.fontSize.xs, color: BT.text.muted, fontFamily: BT.font.label }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 12, background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}33`, borderRadius: 0 }}></div>
            <span>Original deal data (preserved)</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 12, background: `${BT.text.purple}18`, border: `1px solid ${BT.text.purple}33`, borderRadius: 0 }}></div>
            <span>Market comparison (reference only)</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 12, background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}33`, borderRadius: 0 }}></div>
            <span>Your final assumptions (used in pro forma)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeColumnComparison;
