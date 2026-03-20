import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  TrendingUp,
  Users,
  MapPin,
  DollarSign,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  Copy,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Home,
} from 'lucide-react';
import api from '@/services/api';
import {
  exportToCSV,
  exportToExcel,
  copyToClipboard,
  formatPropertyDataForExport,
} from '@/services/marketResearchExport.service';

interface Property {
  id: string;
  address: string;
  units: number;
  owner_name: string;
  appraised_value: number;
  price_per_unit: number;
  year_built: number;
  city: string;
}

interface Stats {
  totalProperties: number;
  totalUnits: number;
  avgPricePerUnit: number;
  totalOwners: number;
  citiesCovered: number;
}

type SortField = 'address' | 'units' | 'owner_name' | 'appraised_value' | 'price_per_unit' | 'year_built' | 'city';
type SortOrder = 'asc' | 'desc';

export default function MarketResearchPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalProperties: 0,
    totalUnits: 0,
    avgPricePerUnit: 0,
    totalOwners: 0,
    citiesCovered: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [minUnits, setMinUnits] = useState('');
  const [maxUnits, setMaxUnits] = useState('');
  const [minPricePerUnit, setMinPricePerUnit] = useState('');
  const [maxPricePerUnit, setMaxPricePerUnit] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;
  
  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('address');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, [page, sortBy, sortOrder]);

  const fetchProperties = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: any = {
        page,
        limit,
        sortBy,
        sortOrder,
      };
      
      if (minUnits) params.minUnits = parseInt(minUnits);
      if (maxUnits) params.maxUnits = parseInt(maxUnits);
      if (minPricePerUnit) params.minPricePerUnit = parseFloat(minPricePerUnit);
      if (maxPricePerUnit) params.maxPricePerUnit = parseFloat(maxPricePerUnit);
      if (selectedCity) params.city = selectedCity;
      if (searchQuery) params.search = searchQuery;
      
      const { data } = await api.get('/market-research/properties', { params });
      
      setProperties(data.properties || []);
      setStats(data.stats || stats);
      setTotalPages(Math.ceil((data.total || 0) / limit));
      
      // Extract unique cities
      if (data.cities) {
        setCities(data.cities);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load properties');
      console.error('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleFilter = () => {
    setPage(1);
    fetchProperties();
  };

  const handleClearFilters = () => {
    setMinUnits('');
    setMaxUnits('');
    setMinPricePerUnit('');
    setMaxPricePerUnit('');
    setSelectedCity('');
    setSearchQuery('');
    setPage(1);
    fetchProperties();
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const formatted = formatPropertyDataForExport(properties);
      exportToCSV(formatted, `market-research-properties-${new Date().toISOString().split('T')[0]}`);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      const formatted = formatPropertyDataForExport(properties);
      exportToExcel(formatted, `market-research-properties-${new Date().toISOString().split('T')[0]}`, 'Properties');
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const formatted = formatPropertyDataForExport(properties);
      await copyToClipboard(formatted);
      alert('Data copied to clipboard!');
    } catch (err) {
      console.error('Copy error:', err);
      alert('Failed to copy to clipboard');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4 opacity-30" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-emerald-600" />
              <h1 className="text-2xl font-bold text-gray-900">Market Research</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/market-research/active-owners"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Users className="w-4 h-4 inline mr-2" />
                Active Owners
              </Link>
              <Link
                to="/market-research/future-supply"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Future Supply
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Properties</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProperties.toLocaleString()}</p>
              </div>
              <Home className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Units</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUnits.toLocaleString()}</p>
              </div>
              <Building2 className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Avg $/Unit</p>
                <p className="text-2xl font-bold text-gray-900">${stats.avgPricePerUnit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <DollarSign className="w-10 h-10 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Owners</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalOwners.toLocaleString()}</p>
              </div>
              <Users className="w-10 h-10 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Cities Covered</p>
                <p className="text-2xl font-bold text-gray-900">{stats.citiesCovered}</p>
              </div>
              <MapPin className="w-10 h-10 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search address or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  showFilters ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={exportLoading || properties.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4 inline mr-1" />
                CSV
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportLoading || properties.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 inline mr-1" />
                Excel
              </button>
              <button
                onClick={handleCopyToClipboard}
                disabled={properties.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Copy className="w-4 h-4 inline mr-1" />
                Copy
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Units</label>
                <input
                  type="number"
                  value={minUnits}
                  onChange={(e) => setMinUnits(e.target.value)}
                  placeholder="e.g., 10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Units</label>
                <input
                  type="number"
                  value={maxUnits}
                  onChange={(e) => setMaxUnits(e.target.value)}
                  placeholder="e.g., 500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min $/Unit</label>
                <input
                  type="number"
                  value={minPricePerUnit}
                  onChange={(e) => setMinPricePerUnit(e.target.value)}
                  placeholder="e.g., 50000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max $/Unit</label>
                <input
                  type="number"
                  value={maxPricePerUnit}
                  onChange={(e) => setMaxPricePerUnit(e.target.value)}
                  placeholder="e.g., 200000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">All Cities</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end gap-2 md:col-span-3">
                <button
                  onClick={handleFilter}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading properties...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg p-12 border border-red-200 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('address')}
                          className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-emerald-600"
                        >
                          Address
                          <SortIcon field="address" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('units')}
                          className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-emerald-600"
                        >
                          Units
                          <SortIcon field="units" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('owner_name')}
                          className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-emerald-600"
                        >
                          Owner Name
                          <SortIcon field="owner_name" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('appraised_value')}
                          className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-emerald-600"
                        >
                          Appraised Value
                          <SortIcon field="appraised_value" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('price_per_unit')}
                          className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-emerald-600"
                        >
                          $/Unit
                          <SortIcon field="price_per_unit" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('year_built')}
                          className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-emerald-600"
                        >
                          Year Built
                          <SortIcon field="year_built" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('city')}
                          className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-emerald-600"
                        >
                          City
                          <SortIcon field="city" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {properties.map((property) => (
                      <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900">{property.address}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{property.units}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{property.owner_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          ${property.appraised_value?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-emerald-600">
                          ${property.price_per_unit?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{property.year_built || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{property.city}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({properties.length} properties)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
