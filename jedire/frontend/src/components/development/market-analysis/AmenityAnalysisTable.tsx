import React, { useState, useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, Minus, DollarSign, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import type { Amenity } from '@/types/development';

interface AmenityAnalysisTableProps {
  amenities: Amenity[];
  selectedAmenities: string[];
  onToggleAmenity: (amenityId: string) => void;
}

type SortField = 'name' | 'premium' | 'roi' | 'penetration';
type SortDirection = 'asc' | 'desc';

export const AmenityAnalysisTable: React.FC<AmenityAnalysisTableProps> = ({
  amenities,
  selectedAmenities,
  onToggleAmenity,
}) => {
  const [sortField, setSortField] = useState<SortField>('roi');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAmenities = useMemo(() => {
    return [...amenities].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'premium':
          aValue = a.monthlyPremium;
          bValue = b.monthlyPremium;
          break;
        case 'roi':
          aValue = a.roi;
          bValue = b.roi;
          break;
        case 'penetration':
          aValue = a.marketPenetration;
          bValue = b.marketPenetration;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [amenities, sortField, sortDirection]);

  const getTrendIcon = (trend: 'up' | 'stable' | 'down') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryColor = (category: Amenity['category']) => {
    const colors: Record<Amenity['category'], string> = {
      fitness: 'bg-green-100 text-green-700',
      work: 'bg-blue-100 text-blue-700',
      pet: 'bg-purple-100 text-purple-700',
      parking: 'bg-gray-100 text-gray-700',
      entertainment: 'bg-pink-100 text-pink-700',
      service: 'bg-yellow-100 text-yellow-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const SortableHeader: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown className="w-3 h-3 text-gray-400" />
        {sortField === field && (
          <span className="text-blue-500">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Amenity Premium Analysis
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              ROI-ranked amenities based on market rent premiums
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-600">
              {selectedAmenities.length} selected
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-12"></th>
              <SortableHeader field="name" label="Amenity" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Category
              </th>
              <SortableHeader field="premium" label="Rent Premium" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Adoption
              </th>
              <SortableHeader field="roi" label="ROI" />
              <SortableHeader field="penetration" label="Market %" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Trend
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedAmenities.map((amenity) => {
              const isSelected = selectedAmenities.includes(amenity.id);
              
              return (
                <tr
                  key={amenity.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleAmenity(amenity.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {amenity.name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {amenity.sqftRequired.toLocaleString()} SF required
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(amenity.category)}`}>
                      {amenity.category}
                    </span>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">
                      +${amenity.monthlyPremium}/mo
                    </div>
                    <div className="text-xs text-gray-500">
                      per unit
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[60px]">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${amenity.adoptionRate * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {(amenity.adoptionRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className={`text-sm font-bold ${
                      amenity.roi >= 3 ? 'text-green-600' :
                      amenity.roi >= 2 ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      {amenity.roi.toFixed(1)}x
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {(amenity.marketPenetration * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      of comps
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    {getTrendIcon(amenity.trending)}
                  </td>
                  
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => onToggleAmenity(amenity.id)}
                      className="whitespace-nowrap"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {isSelected ? 'Added' : 'Add'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            <span className="font-semibold">
              {selectedAmenities.length} amenities selected
            </span>
            {' '}• Est. total premium: 
            <span className="font-bold text-green-600 ml-1">
              +${amenities
                .filter(a => selectedAmenities.includes(a.id))
                .reduce((sum, a) => sum + a.monthlyPremium, 0)
                .toFixed(0)}
              /mo per unit
            </span>
          </div>
          
          <div className="text-xs text-gray-500">
            💡 Top ROI amenities highlighted in green
          </div>
        </div>
      </div>
    </div>
  );
};
