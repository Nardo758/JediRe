import React from 'react';
import { Calendar } from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

export type DateRangeOption = 
  | '24h'
  | '7d'
  | '30d'
  | '90d'
  | '6m'
  | '1y'
  | '2y'
  | 'all'
  | 'custom';

interface DateRangeFilterProps {
  selectedRange: DateRangeOption;
  onRangeChange: (range: DateRangeOption) => void;
  showCustom?: boolean;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDatesChange?: (start: string, end: string) => void;
  className?: string;
}

const rangeOptions: { value: DateRangeOption; label: string }[] = [
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last week' },
  { value: '30d', label: 'Last month' },
  { value: '90d', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
  { value: '2y', label: 'Last 2 years' },
  { value: 'all', label: 'All time' },
];

export function DateRangeFilter({
  selectedRange,
  onRangeChange,
  showCustom = false,
  customStartDate,
  customEndDate,
  onCustomDatesChange,
}: DateRangeFilterProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {rangeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onRangeChange(option.value)}
            style={{
              padding: '4px 12px',
              fontSize: 10,
              fontWeight: 600,
              background: selectedRange === option.value ? BT.text.cyan : BT.bg.panel,
              color: selectedRange === option.value ? BT.bg.terminal : BT.text.secondary,
              border: selectedRange === option.value ? 'none' : `1px solid ${BT.border.subtle}`,
              cursor: 'pointer',
              ...mono,
            }}
          >
            {option.label}
          </button>
        ))}

        {showCustom && (
          <button
            onClick={() => onRangeChange('custom')}
            style={{
              padding: '4px 12px',
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: selectedRange === 'custom' ? BT.text.cyan : BT.bg.panel,
              color: selectedRange === 'custom' ? BT.bg.terminal : BT.text.secondary,
              border: selectedRange === 'custom' ? 'none' : `1px solid ${BT.border.subtle}`,
              cursor: 'pointer',
              ...mono,
            }}
          >
            <Calendar style={{ width: 12, height: 12 }} />
            Custom
          </button>
        )}
      </div>

      {showCustom && selectedRange === 'custom' && onCustomDatesChange && (
        <div style={{ display: 'flex', gap: 12, padding: 12, background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}` }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>START DATE</label>
            <input
              type="date"
              value={customStartDate || ''}
              onChange={(e) => onCustomDatesChange(e.target.value, customEndDate || '')}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 11,
                background: BT.bg.input,
                color: BT.text.primary,
                border: `1px solid ${BT.border.medium}`,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: BT.text.muted, marginBottom: 4, ...mono }}>END DATE</label>
            <input
              type="date"
              value={customEndDate || ''}
              onChange={(e) => onCustomDatesChange(customStartDate || '', e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 11,
                background: BT.bg.input,
                color: BT.text.primary,
                border: `1px solid ${BT.border.medium}`,
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function getDateRangeFromOption(option: DateRangeOption, customStart?: string, customEnd?: string): { start: Date | null; end: Date } {
  const now = new Date();
  const end = new Date();

  if (option === 'custom') {
    return {
      start: customStart ? new Date(customStart) : null,
      end: customEnd ? new Date(customEnd) : now,
    };
  }

  if (option === 'all') {
    return { start: null, end };
  }

  const start = new Date();

  switch (option) {
    case '24h': start.setHours(start.getHours() - 24); break;
    case '7d': start.setDate(start.getDate() - 7); break;
    case '30d': start.setDate(start.getDate() - 30); break;
    case '90d': start.setDate(start.getDate() - 90); break;
    case '6m': start.setMonth(start.getMonth() - 6); break;
    case '1y': start.setFullYear(start.getFullYear() - 1); break;
    case '2y': start.setFullYear(start.getFullYear() - 2); break;
  }

  return { start, end };
}
