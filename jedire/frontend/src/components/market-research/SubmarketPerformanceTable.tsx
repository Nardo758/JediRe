/**
 * Submarket Performance Table - Comprehensive view with expandable property grids
 * Inspired by Colliers market reports
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Building2, MapPin } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  units: number;
  yearBuilt: number;
  avgRent: number;
  occupancy: number;
  owner: string;
  distance: number;
  propertyClass: 'A' | 'B' | 'C' | 'D';
}

interface SubmarketData {
  id: string;
  name: string;
  rank: number;
  totalUnits: number;
  rents: {
    all: number;
    y2020plus: number;
    y2010s: number;
    y2000s: number;
    pre2000: number;
  };
  occupancy: {
    all: number;
    y2020plus: number;
    y2010s: number;
    y2000s: number;
    pre2000: number;
  };
  demand: number; // Net absorption
  underConstruction: number;
  compositeScore: number;
  properties: Property[];
}

interface SubmarketPerformanceTableProps {
  submarkets: SubmarketData[];
}

export function SubmarketPerformanceTable({ submarkets }: SubmarketPerformanceTableProps) {
  const [expandedSubmarkets, setExpandedSubmarkets] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<keyof Property>('units');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const toggleSubmarket = (submarketId: string) => {
    const newExpanded = new Set(expandedSubmarkets);
    if (newExpanded.has(submarketId)) {
      newExpanded.delete(submarketId);
    } else {
      newExpanded.add(submarketId);
    }
    setExpandedSubmarkets(newExpanded);
  };

  const sortProperties = (properties: Property[]) => {
    return [...properties].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * direction;
      }
      return ((aVal as number) - (bVal as number)) * direction;
    });
  };

  const handleSort = (column: keyof Property) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const getRankBadge = (rank: number) => {
    const badges = {
      1: '🥇',
      2: '🥈',
      3: '🥉',
    };
    return badges[rank as 1 | 2 | 3] || `${rank}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getChangeColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getOccupancyColor = (occ: number) => {
    if (occ >= 95) return 'text-green-600 bg-green-50';
    if (occ >= 90) return 'text-blue-600 bg-blue-50';
    if (occ >= 85) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <h3 className="font-semibold text-gray-900">Submarket Performance by Year Built</h3>
        <p className="text-sm text-gray-600 mt-1">
          Click any submarket to view property-level details
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                Submarket
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                Existing<br/>Units
              </th>
              <th colSpan={5} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-l border-gray-300">
                Average Rents (by Year Built)
              </th>
              <th colSpan={5} className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase border-l border-gray-300">
                Occupancy % (by Year Built)
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase border-l border-gray-300">
                Demand
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                UC
              </th>
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2"></th>
              <th className="px-3 py-2"></th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">All</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">2020+</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">2010s</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">2000s</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">&lt;2000</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">All</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">2020+</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">2010s</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">2000s</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-600">&lt;2000</th>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {submarkets.map((submarket) => (
              <React.Fragment key={submarket.id}>
                {/* Main Row */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSubmarket(submarket.id)}
                      className="flex items-center gap-2 text-left w-full group"
                    >
                      <span className="text-lg">{getRankBadge(submarket.rank)}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-blue-600">
                          {submarket.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {expandedSubmarkets.has(submarket.id) ? (
                            <span className="flex items-center gap-1">
                              <ChevronUp className="w-3 h-3" />
                              Hide {submarket.properties.length} properties
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <ChevronDown className="w-3 h-3" />
                              View {submarket.properties.length} properties
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                    {formatNumber(submarket.totalUnits)}
                  </td>
                  
                  {/* Rents */}
                  <td className="px-2 py-3 text-center font-semibold text-gray-900 border-l border-gray-200">
                    ${submarket.rents.all.toLocaleString()}
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">
                    ${submarket.rents.y2020plus.toLocaleString()}
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">
                    ${submarket.rents.y2010s.toLocaleString()}
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">
                    ${submarket.rents.y2000s.toLocaleString()}
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">
                    ${submarket.rents.pre2000.toLocaleString()}
                  </td>

                  {/* Occupancy */}
                  <td className="px-2 py-3 text-center border-l border-gray-200">
                    <span className={`inline-block px-2 py-1 rounded font-semibold ${getOccupancyColor(submarket.occupancy.all)}`}>
                      {submarket.occupancy.all.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">
                    {submarket.occupancy.y2020plus.toFixed(1)}%
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">
                    {submarket.occupancy.y2010s.toFixed(1)}%
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">
                    {submarket.occupancy.y2000s.toFixed(1)}%
                  </td>
                  <td className="px-2 py-3 text-center text-gray-700">
                    {submarket.occupancy.pre2000.toFixed(1)}%
                  </td>

                  {/* Demand & UC */}
                  <td className={`px-3 py-3 text-right font-semibold border-l border-gray-200 ${getChangeColor(submarket.demand)}`}>
                    {submarket.demand > 0 ? '+' : ''}{submarket.demand}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                    {submarket.underConstruction}
                  </td>
                </tr>

                {/* Expanded Property Grid */}
                {expandedSubmarkets.has(submarket.id) && (
                  <tr>
                    <td colSpan={14} className="bg-gray-50 p-4">
                      <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-600" />
                            <h4 className="font-semibold text-gray-900">
                              {submarket.name} Properties ({submarket.properties.length})
                            </h4>
                          </div>
                          <span className="text-xs text-gray-600">
                            Click column headers to sort
                          </span>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-200">
                              <tr>
                                <th 
                                  onClick={() => handleSort('name')}
                                  className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-200"
                                >
                                  Property Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                  onClick={() => handleSort('units')}
                                  className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-200"
                                >
                                  Units {sortBy === 'units' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                  onClick={() => handleSort('yearBuilt')}
                                  className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-200"
                                >
                                  Year {sortBy === 'yearBuilt' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                  onClick={() => handleSort('avgRent')}
                                  className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-200"
                                >
                                  Avg Rent {sortBy === 'avgRent' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                  onClick={() => handleSort('occupancy')}
                                  className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-200"
                                >
                                  Occ % {sortBy === 'occupancy' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">
                                  Class
                                </th>
                                <th 
                                  onClick={() => handleSort('owner')}
                                  className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-200"
                                >
                                  Owner {sortBy === 'owner' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                  onClick={() => handleSort('distance')}
                                  className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-200"
                                >
                                  Distance {sortBy === 'distance' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {sortProperties(submarket.properties).map((property) => (
                                <tr key={property.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                    {property.name}
                                  </td>
                                  <td className="px-3 py-3 text-right text-gray-700">
                                    {property.units}
                                  </td>
                                  <td className="px-3 py-3 text-center text-gray-700">
                                    {property.yearBuilt}
                                  </td>
                                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                                    ${property.avgRent.toLocaleString()}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getOccupancyColor(property.occupancy)}`}>
                                      {property.occupancy.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                      property.propertyClass === 'A' ? 'bg-green-100 text-green-800' :
                                      property.propertyClass === 'B' ? 'bg-blue-100 text-blue-800' :
                                      property.propertyClass === 'C' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {property.propertyClass}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-gray-700">
                                    {property.owner}
                                  </td>
                                  <td className="px-3 py-3 text-right text-gray-600">
                                    {property.distance.toFixed(1)} mi
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>

          {/* Total Row */}
          <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
            <tr>
              <td className="px-4 py-3 text-gray-900">Total / Weighted Avg</td>
              <td className="px-3 py-3 text-right text-gray-900">
                {formatNumber(submarkets.reduce((sum, s) => sum + s.totalUnits, 0))}
              </td>
              <td className="px-2 py-3 text-center text-gray-900 border-l border-gray-300">
                ${Math.round(submarkets.reduce((sum, s) => sum + s.rents.all, 0) / submarkets.length).toLocaleString()}
              </td>
              <td className="px-2 py-3 text-center text-gray-700">—</td>
              <td className="px-2 py-3 text-center text-gray-700">—</td>
              <td className="px-2 py-3 text-center text-gray-700">—</td>
              <td className="px-2 py-3 text-center text-gray-700">—</td>
              <td className="px-2 py-3 text-center text-gray-900 border-l border-gray-300">
                {(submarkets.reduce((sum, s) => sum + s.occupancy.all, 0) / submarkets.length).toFixed(1)}%
              </td>
              <td className="px-2 py-3 text-center text-gray-700">—</td>
              <td className="px-2 py-3 text-center text-gray-700">—</td>
              <td className="px-2 py-3 text-center text-gray-700">—</td>
              <td className="px-2 py-3 text-center text-gray-700">—</td>
              <td className={`px-3 py-3 text-right border-l border-gray-300 ${getChangeColor(submarkets.reduce((sum, s) => sum + s.demand, 0))}`}>
                {submarkets.reduce((sum, s) => sum + s.demand, 0) > 0 ? '+' : ''}
                {submarkets.reduce((sum, s) => sum + s.demand, 0)}
              </td>
              <td className="px-3 py-3 text-right text-gray-900">
                {submarkets.reduce((sum, s) => sum + s.underConstruction, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer Note */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <strong>Note:</strong> Rents and occupancy segmented by property age. 
        Property Class auto-assigned: A (2015+), B (2000-2014), C (1985-1999), D (&lt;1985).
        Demand = Net Absorption (12-month). UC = Under Construction units.
      </div>
    </div>
  );
}
