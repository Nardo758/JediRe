import { useState, useMemo } from 'react';
import { Search, Filter, ChevronUp, ChevronDown, ChevronsUpDown, Building2, MapPin } from 'lucide-react';
import { generateMockPropertyData, PropertyIntelligenceRecord } from '@/mock/mockPropertyIntelligence';

interface MarketDataTableProps {
  marketId: string;
  onPropertyClick: (propertyId: string) => void;
}

type SortField = 'address' | 'units' | 'year_built' | 'vintage_class' | 'owner_name' | 'sqft_per_unit' | 'hold_period_years';
type SortDirection = 'asc' | 'desc' | null;
type VintageClass = 'Pre-1980' | '1980-1999' | '2000-2009' | '2010+';

interface Filters {
  searchQuery: string;
  vintageClass: VintageClass[];
  ownerType: string[];
  unitsMin: number | null;
  unitsMax: number | null;
}

export default function MarketDataTable({ marketId, onPropertyClick }: MarketDataTableProps) {
  // Generate full dataset (1,028 properties)
  const allProperties = useMemo(() => generateMockPropertyData(1028), []);
  
  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    searchQuery: '',
    vintageClass: [],
    ownerType: [],
    unitsMin: null,
    unitsMax: null
  });
  
  const itemsPerPage = 50;
  
  // Filter logic
  const filteredProperties = useMemo(() => {
    return allProperties.filter(property => {
      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesSearch = 
          property.address.toLowerCase().includes(query) ||
          property.owner_name.toLowerCase().includes(query) ||
          property.parcel_id.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Vintage class filter
      if (filters.vintageClass.length > 0) {
        if (!filters.vintageClass.includes(property.vintage_class)) return false;
      }
      
      // Owner type filter (LLC, Inc, etc.)
      if (filters.ownerType.length > 0) {
        const hasMatch = filters.ownerType.some(type => 
          property.owner_name.toUpperCase().includes(type.toUpperCase())
        );
        if (!hasMatch) return false;
      }
      
      // Units range filter
      if (filters.unitsMin !== null && property.units < filters.unitsMin) return false;
      if (filters.unitsMax !== null && property.units > filters.unitsMax) return false;
      
      return true;
    });
  }, [allProperties, filters]);
  
  // Sort logic
  const sortedProperties = useMemo(() => {
    if (!sortField || !sortDirection) return filteredProperties;
    
    return [...filteredProperties].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      // Handle null values
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      
      // Convert year_built to number
      if (sortField === 'year_built') {
        aValue = parseInt(aValue);
        bValue = parseInt(bValue);
      }
      
      // Compare
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProperties, sortField, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(sortedProperties.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProperties = sortedProperties.slice(startIndex, endIndex);
  
  // Sort handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page on sort
  };
  
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="w-4 h-4 text-blue-600" />;
    }
    return <ChevronDown className="w-4 h-4 text-blue-600" />;
  };
  
  // Filter handlers
  const handleVintageToggle = (vintage: VintageClass) => {
    setFilters(prev => ({
      ...prev,
      vintageClass: prev.vintageClass.includes(vintage)
        ? prev.vintageClass.filter(v => v !== vintage)
        : [...prev.vintageClass, vintage]
    }));
    setCurrentPage(1);
  };
  
  const handleOwnerTypeToggle = (type: string) => {
    setFilters(prev => ({
      ...prev,
      ownerType: prev.ownerType.includes(type)
        ? prev.ownerType.filter(t => t !== type)
        : [...prev.ownerType, type]
    }));
    setCurrentPage(1);
  };
  
  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      vintageClass: [],
      ownerType: [],
      unitsMin: null,
      unitsMax: null
    });
    setCurrentPage(1);
  };
  
  const hasActiveFilters = 
    filters.searchQuery !== '' ||
    filters.vintageClass.length > 0 ||
    filters.ownerType.length > 0 ||
    filters.unitsMin !== null ||
    filters.unitsMax !== null;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Market Property Data</h2>
              <p className="text-sm text-gray-600">
                {sortedProperties.length.toLocaleString()} of {allProperties.length.toLocaleString()} properties
                {filters.searchQuery && ` matching "${filters.searchQuery}"`}
              </p>
            </div>
          </div>
          
          {/* Data Source Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              MOCK DATA
            </span>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                showFilters
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {filters.vintageClass.length + filters.ownerType.length + (filters.searchQuery ? 1 : 0) + (filters.unitsMin !== null ? 1 : 0) + (filters.unitsMax !== null ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by address, owner, or parcel ID..."
            value={filters.searchQuery}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, searchQuery: e.target.value }));
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      {/* Filters Panel */}
      {showFilters && (
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Vintage Class Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vintage Class
              </label>
              <div className="space-y-2">
                {(['Pre-1980', '1980-1999', '2000-2009', '2010+'] as VintageClass[]).map(vintage => (
                  <button
                    key={vintage}
                    onClick={() => handleVintageToggle(vintage)}
                    className={`w-full px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                      filters.vintageClass.includes(vintage)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {vintage}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Owner Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Type
              </label>
              <div className="space-y-2">
                {['LLC', 'Inc', 'LP', 'Corp', 'Partners'].map(type => (
                  <button
                    key={type}
                    onClick={() => handleOwnerTypeToggle(type)}
                    className={`w-full px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                      filters.ownerType.includes(type)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Units Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Units Range
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Min Units</label>
                  <input
                    type="number"
                    placeholder="e.g., 50"
                    value={filters.unitsMin ?? ''}
                    onChange={(e) => {
                      setFilters(prev => ({
                        ...prev,
                        unitsMin: e.target.value ? parseInt(e.target.value) : null
                      }));
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Max Units</label>
                  <input
                    type="number"
                    placeholder="e.g., 200"
                    value={filters.unitsMax ?? ''}
                    onChange={(e) => {
                      setFilters(prev => ({
                        ...prev,
                        unitsMax: e.target.value ? parseInt(e.target.value) : null
                      }));
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Reset Filters */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <button
                onClick={resetFilters}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('address')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-blue-600"
                >
                  Address
                  {getSortIcon('address')}
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('units')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-blue-600"
                >
                  Units
                  {getSortIcon('units')}
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('year_built')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-blue-600"
                >
                  Year Built
                  {getSortIcon('year_built')}
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('vintage_class')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-blue-600"
                >
                  Vintage Class
                  {getSortIcon('vintage_class')}
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('owner_name')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-blue-600"
                >
                  Owner
                  {getSortIcon('owner_name')}
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('sqft_per_unit')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-blue-600"
                >
                  Avg Unit Size
                  {getSortIcon('sqft_per_unit')}
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('hold_period_years')}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase tracking-wider hover:text-blue-600"
                >
                  Hold Period
                  {getSortIcon('hold_period_years')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentProperties.map((property) => (
              <tr
                key={property.id}
                onClick={() => onPropertyClick(property.id)}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{property.address}</div>
                      <div className="text-xs text-gray-500">{property.city}, GA {property.zip_code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-gray-900">{property.units}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{property.year_built}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    property.vintage_class === '2010+' ? 'bg-green-100 text-green-800' :
                    property.vintage_class === '2000-2009' ? 'bg-blue-100 text-blue-800' :
                    property.vintage_class === '1980-1999' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {property.vintage_class}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate" title={property.owner_name}>
                    {property.owner_name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{property.sqft_per_unit.toLocaleString()} SF</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {property.hold_period_years !== null 
                      ? `${property.hold_period_years} yrs` 
                      : '—'
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Empty State */}
      {currentProperties.length === 0 && (
        <div className="py-12 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No properties found</h3>
          <p className="text-sm text-gray-600">
            Try adjusting your search or filters
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 text-sm font-medium text-blue-600 hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-medium">{Math.min(endIndex, sortedProperties.length)}</span> of{' '}
            <span className="font-medium">{sortedProperties.length}</span> results
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
