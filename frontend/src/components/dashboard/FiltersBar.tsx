import { useState } from 'react';
import { Filter, Target, Clock, Layers, Bookmark, ChevronDown } from 'lucide-react';
import { BT } from '@/components/deal/bloomberg-ui';

interface FiltersBarProps {
  onStrategyChange?: (strategy: string) => void;
  onScoreChange?: (minScore: number) => void;
  onTimelineChange?: (months: number) => void;
}

export default function FiltersBar({ onStrategyChange, onScoreChange, onTimelineChange }: FiltersBarProps) {
  const [strategy, setStrategy] = useState('All');
  const [minScore, setMinScore] = useState(70);
  const [timeline, setTimeline] = useState(6);
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);

  const strategies = ['All', 'Build-to-Sell', 'Flip', 'Rental', 'Airbnb'];

  const handleStrategySelect = (s: string) => {
    setStrategy(s);
    setShowStrategyDropdown(false);
    onStrategyChange?.(s);
  };

  return (
    <div className="px-6 py-3" style={{ background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}` }}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: BT.bg.panelAlt,
              color: BT.text.secondary,
              borderRadius: 0,
              fontFamily: BT.font.label,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = BT.bg.panelAlt)}
          >
            <Filter className="w-4 h-4" />
            <span>Strategy: {strategy}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {showStrategyDropdown && (
            <div
              className="absolute top-full left-0 mt-1 z-50 min-w-[160px]"
              style={{
                background: BT.bg.panel,
                border: `1px solid ${BT.border.medium}`,
                borderRadius: 0,
              }}
            >
              {strategies.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStrategySelect(s)}
                  className="w-full text-left px-4 py-2 text-sm"
                  style={{
                    background: s === strategy ? `${BT.text.cyan}11` : 'transparent',
                    color: s === strategy ? BT.text.cyan : BT.text.secondary,
                    fontFamily: BT.font.label,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = s === strategy ? `${BT.text.cyan}11` : 'transparent')}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ background: BT.bg.panelAlt, borderRadius: 0 }}
        >
          <Target className="w-4 h-4" style={{ color: BT.text.secondary }} />
          <span className="text-sm" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Score</span>
          <input
            id="filters-min-score"
            name="filtersMinScore"
            type="number"
            value={minScore}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setMinScore(val);
              onScoreChange?.(val);
            }}
            aria-label="Minimum opportunity score"
            className="w-12 text-sm font-medium border-none focus:outline-none text-center"
            style={{
              background: 'transparent',
              color: BT.text.primary,
              fontFamily: BT.font.mono,
            }}
            min={0}
            max={100}
          />
          <span className="text-sm" style={{ color: BT.text.muted }}>+</span>
        </div>

        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ background: BT.bg.panelAlt, borderRadius: 0 }}
        >
          <Clock className="w-4 h-4" style={{ color: BT.text.secondary }} />
          <span className="text-sm" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Timeline</span>
          <select
            id="filters-timeline"
            name="filtersTimeline"
            value={timeline}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setTimeline(val);
              onTimelineChange?.(val);
            }}
            aria-label="Timeline filter"
            className="text-sm font-medium border-none focus:outline-none"
            style={{
              background: 'transparent',
              color: BT.text.primary,
              fontFamily: BT.font.mono,
            }}
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>
        </div>

        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: BT.bg.panelAlt,
            color: BT.text.secondary,
            borderRadius: 0,
            fontFamily: BT.font.label,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = BT.bg.panelAlt)}
        >
          <Layers className="w-4 h-4" />
          <span>Modules</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: BT.bg.panelAlt,
            color: BT.text.secondary,
            borderRadius: 0,
            fontFamily: BT.font.label,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BT.bg.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = BT.bg.panelAlt)}
        >
          <Bookmark className="w-4 h-4" />
          <span>Saved Searches</span>
        </button>
      </div>
    </div>
  );
}
