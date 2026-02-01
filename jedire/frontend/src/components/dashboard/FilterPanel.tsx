import { useState } from 'react';
import { useAppStore } from '@/store';
import { MapFilter } from '@/types';

export default function FilterPanel() {
  const { filters, setFilters } = useAppStore();
  const [localFilters, setLocalFilters] = useState<MapFilter>(filters);

  const handleApply = () => {
    setFilters(localFilters);
  };

  const handleReset = () => {
    setLocalFilters({});
    setFilters({});
  };

  return (
    <div className="p-4 space-y-4">
      {/* Opportunity Score Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Opportunity Score
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="0"
            max="100"
            placeholder="Min"
            value={localFilters.minScore || ''}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, minScore: Number(e.target.value) })
            }
            className="input text-sm py-1.5"
          />
          <span className="text-gray-500">to</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="Max"
            value={localFilters.maxScore || ''}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, maxScore: Number(e.target.value) })
            }
            className="input text-sm py-1.5"
          />
        </div>
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Price Range
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            value={localFilters.minPrice || ''}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, minPrice: Number(e.target.value) })
            }
            className="input text-sm py-1.5"
          />
          <span className="text-gray-500">to</span>
          <input
            type="number"
            placeholder="Max"
            value={localFilters.maxPrice || ''}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, maxPrice: Number(e.target.value) })
            }
            className="input text-sm py-1.5"
          />
        </div>
      </div>

      {/* Municipalities */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cities
        </label>
        <div className="space-y-2">
          {['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale'].map((city) => (
            <label key={city} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={localFilters.municipalities?.includes(city) || false}
                onChange={(e) => {
                  const current = localFilters.municipalities || [];
                  setLocalFilters({
                    ...localFilters,
                    municipalities: e.target.checked
                      ? [...current, city]
                      : current.filter((m) => m !== city),
                  });
                }}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <span>{city}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button onClick={handleApply} className="btn btn-primary flex-1">
          Apply
        </button>
        <button onClick={handleReset} className="btn btn-secondary flex-1">
          Reset
        </button>
      </div>
    </div>
  );
}
