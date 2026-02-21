import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Download, TrendingUp, TrendingDown } from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface PropertyDetail {
  address: string;
  units: number;
  yearBought: number;
  price: number;
}

interface OwnerData {
  id: string;
  name: string;
  properties: number;
  totalUnits: number;
  avgHoldPeriod: number;
  motivationScore: number;
  signal: 'BUY' | 'WATCH' | 'HOLD';
  propertyDetails: PropertyDetail[];
}

interface OwnerPortfolioViewProps {
  marketId: string;
  owners?: OwnerData[];
  onOwnerClick?: (ownerId: string) => void;
}

type SortKey = keyof Omit<OwnerData, 'id' | 'propertyDetails'>;
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Mock Data
// ============================================================================

const mockOwners: OwnerData[] = [
  {
    id: 'owner-1',
    name: 'Greystone Capital Partners LLC',
    properties: 4,
    totalUnits: 850,
    avgHoldPeriod: 6.2,
    motivationScore: 72,
    signal: 'WATCH',
    propertyDetails: [
      { address: '100 Summit Ridge Dr', units: 200, yearBought: 2019, price: 28500000 },
      { address: '245 Peachtree Center Ave', units: 180, yearBought: 2018, price: 24200000 },
      { address: '3350 Riverwood Pkwy', units: 250, yearBought: 2020, price: 35000000 },
      { address: '1055 Piedmont Ave NE', units: 220, yearBought: 2017, price: 31500000 },
    ]
  },
  {
    id: 'owner-2',
    name: 'Legacy Properties Group',
    properties: 3,
    totalUnits: 620,
    avgHoldPeriod: 8.5,
    motivationScore: 45,
    signal: 'HOLD',
    propertyDetails: [
      { address: '2479 Peachtree Rd NE', units: 280, yearBought: 2015, price: 38500000 },
      { address: '788 West Marietta St', units: 180, yearBought: 2016, price: 22000000 },
      { address: '1280 West Peachtree St', units: 160, yearBought: 2017, price: 19500000 },
    ]
  },
  {
    id: 'owner-3',
    name: 'Sentinel Real Estate Corporation',
    properties: 5,
    totalUnits: 1150,
    avgHoldPeriod: 4.8,
    motivationScore: 85,
    signal: 'BUY',
    propertyDetails: [
      { address: '400 Central Park Place', units: 300, yearBought: 2020, price: 42000000 },
      { address: '3101 Howell Mill Rd NW', units: 220, yearBought: 2021, price: 28500000 },
      { address: '2285 Peachtree Rd NE', units: 190, yearBought: 2019, price: 25000000 },
      { address: '1016 Piedmont Ave NE', units: 240, yearBought: 2020, price: 33500000 },
      { address: '1735 North Brown Ave', units: 200, yearBought: 2022, price: 26000000 },
    ]
  },
  {
    id: 'owner-4',
    name: 'Midtown Equity Partners',
    properties: 2,
    totalUnits: 380,
    avgHoldPeriod: 3.2,
    motivationScore: 68,
    signal: 'WATCH',
    propertyDetails: [
      { address: '860 Peachtree St NE', units: 200, yearBought: 2021, price: 29000000 },
      { address: '1745 Peachtree St NE', units: 180, yearBought: 2022, price: 24500000 },
    ]
  },
  {
    id: 'owner-5',
    name: 'Cornerstone Residential Holdings',
    properties: 6,
    totalUnits: 940,
    avgHoldPeriod: 7.1,
    motivationScore: 52,
    signal: 'WATCH',
    propertyDetails: [
      { address: '2255 Cumberland Pkwy SE', units: 165, yearBought: 2017, price: 21500000 },
      { address: '1375 Peachtree St NE', units: 145, yearBought: 2016, price: 18000000 },
      { address: '3630 Peachtree Rd NE', units: 190, yearBought: 2018, price: 23500000 },
      { address: '1100 Spring St NW', units: 140, yearBought: 2019, price: 17500000 },
      { address: '2277 Peachtree Rd NE', units: 150, yearBought: 2015, price: 19000000 },
      { address: '1850 Cotillion Dr', units: 150, yearBought: 2020, price: 18500000 },
    ]
  },
  {
    id: 'owner-6',
    name: 'Horizon Investment Trust',
    properties: 3,
    totalUnits: 510,
    avgHoldPeriod: 5.5,
    motivationScore: 78,
    signal: 'BUY',
    propertyDetails: [
      { address: '1075 Peachtree Walk NE', units: 180, yearBought: 2019, price: 24000000 },
      { address: '1250 West Peachtree St NW', units: 170, yearBought: 2020, price: 21500000 },
      { address: '3334 Peachtree Rd NE', units: 160, yearBought: 2018, price: 20000000 },
    ]
  },
  {
    id: 'owner-7',
    name: 'Atlantic Realty Advisors',
    properties: 2,
    totalUnits: 320,
    avgHoldPeriod: 9.3,
    motivationScore: 38,
    signal: 'HOLD',
    propertyDetails: [
      { address: '2479 Piedmont Rd NE', units: 180, yearBought: 2014, price: 22000000 },
      { address: '1545 Peachtree St NE', units: 140, yearBought: 2015, price: 16500000 },
    ]
  },
  {
    id: 'owner-8',
    name: 'Parkside Development LLC',
    properties: 4,
    totalUnits: 720,
    avgHoldPeriod: 6.8,
    motivationScore: 61,
    signal: 'WATCH',
    propertyDetails: [
      { address: '3300 Windy Ridge Pkwy SE', units: 210, yearBought: 2018, price: 27500000 },
      { address: '1221 Avenue of the Americas', units: 180, yearBought: 2017, price: 23000000 },
      { address: '2001 Clearview Ave SE', units: 165, yearBought: 2019, price: 20500000 },
      { address: '1050 Crown Pointe Pkwy', units: 165, yearBought: 2016, price: 21000000 },
    ]
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

const getSignalColor = (signal: string): string => {
  switch (signal) {
    case 'BUY':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'WATCH':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'HOLD':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getMotivationScoreColor = (score: number): string => {
  if (score >= 70) return 'text-red-600 font-semibold';
  if (score >= 50) return 'text-yellow-600 font-medium';
  return 'text-gray-600';
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

// ============================================================================
// Main Component
// ============================================================================

const OwnerPortfolioView: React.FC<OwnerPortfolioViewProps> = ({
  marketId,
  owners = mockOwners,
  onOwnerClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('motivationScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());

  // Filter and sort owners
  const filteredAndSortedOwners = useMemo(() => {
    let filtered = owners.filter((owner) =>
      owner.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return filtered;
  }, [owners, searchTerm, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const toggleExpand = (ownerId: string) => {
    const newExpanded = new Set(expandedOwners);
    if (newExpanded.has(ownerId)) {
      newExpanded.delete(ownerId);
    } else {
      newExpanded.add(ownerId);
    }
    setExpandedOwners(newExpanded);
  };

  const handleOwnerClick = (ownerId: string) => {
    toggleExpand(ownerId);
    if (onOwnerClick) {
      onOwnerClick(ownerId);
    }
  };

  const handleExport = () => {
    // Placeholder for export functionality
    console.log('Export functionality to be implemented');
    alert('Export feature coming soon!');
  };

  const SortIcon: React.FC<{ columnKey: SortKey }> = ({ columnKey }) => {
    if (sortKey !== columnKey) return null;
    return sortDirection === 'asc' ? (
      <TrendingUp className="w-4 h-4 inline ml-1" />
    ) : (
      <TrendingDown className="w-4 h-4 inline ml-1" />
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Owner Portfolio Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">
            Market: {marketId} • {filteredAndSortedOwners.length} owners
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search owners..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  {/* Expand column */}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Owner Name <SortIcon columnKey="name" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('properties')}
                >
                  Properties <SortIcon columnKey="properties" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalUnits')}
                >
                  Total Units <SortIcon columnKey="totalUnits" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('avgHoldPeriod')}
                >
                  Avg Hold Period <SortIcon columnKey="avgHoldPeriod" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('motivationScore')}
                >
                  Motivation Score <SortIcon columnKey="motivationScore" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('signal')}
                >
                  Signal <SortIcon columnKey="signal" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedOwners.map((owner) => (
                <React.Fragment key={owner.id}>
                  {/* Main Row */}
                  <tr
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleOwnerClick(owner.id)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {expandedOwners.has(owner.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{owner.name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{owner.properties}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatNumber(owner.totalUnits)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{owner.avgHoldPeriod} years</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`text-sm ${getMotivationScoreColor(owner.motivationScore)}`}>
                        {owner.motivationScore}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getSignalColor(
                          owner.signal
                        )}`}
                      >
                        {owner.signal}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Property Details */}
                  {expandedOwners.has(owner.id) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Property Holdings
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-white">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Address
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Units
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Year Acquired
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Purchase Price
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Hold Period
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-100">
                                {owner.propertyDetails.map((property, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {property.address}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {formatNumber(property.units)}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {property.yearBought}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {formatCurrency(property.price)}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {new Date().getFullYear() - property.yearBought} years
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
          </table>
        </div>

        {/* Empty State */}
        {filteredAndSortedOwners.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No owners found matching your search.</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Owners</div>
          <div className="text-2xl font-bold text-gray-900">{filteredAndSortedOwners.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Properties</div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredAndSortedOwners.reduce((sum, owner) => sum + owner.properties, 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Units</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(filteredAndSortedOwners.reduce((sum, owner) => sum + owner.totalUnits, 0))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Avg Motivation Score</div>
          <div className={`text-2xl font-bold ${getMotivationScoreColor(
            filteredAndSortedOwners.length > 0
              ? Math.round(filteredAndSortedOwners.reduce((sum, owner) => sum + owner.motivationScore, 0) / filteredAndSortedOwners.length)
              : 0
          )}`}>
            {filteredAndSortedOwners.length > 0
              ? Math.round(filteredAndSortedOwners.reduce((sum, owner) => sum + owner.motivationScore, 0) / filteredAndSortedOwners.length)
              : 0}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerPortfolioView;
