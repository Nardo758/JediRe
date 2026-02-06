import { useState } from 'react';
import { Filter, Target, Clock, Layers, Bookmark, ChevronDown } from 'lucide-react';

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
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Strategy: {strategy}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {showStrategyDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px]">
              {strategies.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStrategySelect(s)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                    s === strategy ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
          <Target className="w-4 h-4 text-gray-600" />
          <span className="text-sm text-gray-600">Score</span>
          <input
            type="number"
            value={minScore}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setMinScore(val);
              onScoreChange?.(val);
            }}
            className="w-12 text-sm font-medium text-gray-800 bg-transparent border-none focus:outline-none text-center"
            min={0}
            max={100}
          />
          <span className="text-sm text-gray-500">+</span>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
          <Clock className="w-4 h-4 text-gray-600" />
          <span className="text-sm text-gray-600">Timeline</span>
          <select
            value={timeline}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setTimeline(val);
              onTimelineChange?.(val);
            }}
            className="text-sm font-medium text-gray-800 bg-transparent border-none focus:outline-none"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
          <Layers className="w-4 h-4" />
          <span>Modules</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
          <Bookmark className="w-4 h-4" />
          <span>Saved Searches</span>
        </button>
      </div>
    </div>
  );
}
