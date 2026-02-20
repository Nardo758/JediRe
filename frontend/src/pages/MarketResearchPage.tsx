/**
 * Market Research Page - Main Hub
 * Property records table with filtering and export
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Construction,
  Download,
  FileSpreadsheet,
  Copy,
  Search,
  Filter,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { MarketResearchExportService, ExportColumn } from '../services/marketResearchExport.service';

interface Property {
  id: string;
  address: string;
  city: string;
  units: number;
  owner_name: string;
  total_assessed_value: number;
  price_per_unit: number;
  year_built: number;
  building_sqft: number;
  property_class: string;
  latitude: number;
  longitude: number;
}

interface Stats {
  total_properties: number;
  total_units: number;
  avg_price_per_unit: number;
  unique_owners: number;
  cities_covered: number;
}

export const MarketResearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [minUnits, setMinUnits] = useState('');
  const [maxUnits, setMaxUnits] = useState('');
  const [minPricePerUnit, setMinPricePerUnit] = useState('');
  const [maxPricePerUnit, setMaxPricePerUnit] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Sorting
  const [sortBy, setSortBy] = useState('address');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchProperties();
    fetchStats();
  }, [page, sortBy, sortOrder, searchTerm, minUnits, maxUnits, minPricePerUnit, maxPricePerUnit, selectedCity]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        sortBy,
        sortOrder,
        ...(searchTerm && { search: searchTerm }),
        ...(minUnits && { minUnits }),
        ...(maxUnits && { maxUnits }),
        ...(minPricePerUnit && { minPricePerUnit }),
        ...(maxPricePerUnit && { maxPricePerUnit }),
        ...(selectedCity && { city: selectedCity })
      });

      const response = await fetch(`/api/v1/market-research/properties?${params}`);
      const result = await response.json();

      if (result.success) {
        setProperties(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/v1/market-research/stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const exportColumns: ExportColumn[] = [
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'units', label: 'Units', format: MarketResearchExportService.formatNumber },
    { key: 'owner_name', label: 'Owner' },
    { 
      key: 'total_assessed_value', 
      label: 'Appraised Value', 
      format: MarketResearchExportService.formatCurrency 
    },
    { 
      key: 'price_per_unit', 
      label: '$/Unit', 
      format: MarketResearchExportService.formatCurrency 
    },
    { key: 'year_built', label: 'Year Built' },
    { key: 'property_class', label: 'Class' }
  ];

  const handleExportCSV = () => {
    setExporting(true);
    try {
      MarketResearchExportService.downloadCSV(
        properties,
        exportColumns,
        `market-research-properties-${new Date().toISOString().split('T')[0]}`
      );
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting data');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    setExporting(true);
    try {
      MarketResearchExportService.downloadExcel(
        properties,
        exportColumns,
        `market-research-properties-${new Date().toISOString().split('T')[0]}`
      );
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting data');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    setExporting(true);
    try {
      await MarketResearchExportService.copyToClipboard(properties, exportColumns);
      alert('Data copied to clipboard!');
    } catch (error) {
      console.error('Copy error:', error);
      alert('Error copying data');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Building2 className="w-8 h-8 text-emerald-600" />
                Market Research Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Fulton County multifamily property intelligence
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/market-research/active-owners')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Active Owners
              </button>
              <button
                onClick={() => navigate('/market-research/future-supply')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Construction className="w-4 h-4" />
                Future Supply
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-5 gap-4 mt-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-emerald-900">
                  {stats.total_properties.toLocaleString()}
                </div>
                <div className="text-xs text-emerald-700 mt-1">Properties</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-900">
                  {stats.total_units.toLocaleString()}
                </div>
                <div className="text-xs text-blue-700 mt-1">Total Units</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-900">
                  {formatCurrency(stats.avg_price_per_unit)}
                </div>
                <div className="text-xs text-purple-700 mt-1">Avg $/Unit</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-900">
                  {stats.unique_owners.toLocaleString()}
                </div>
                <div className="text-xs text-orange-700 mt-1">Unique Owners</div>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-teal-900">
                  {stats.cities_covered}
                </div>
                <div className="text-xs text-teal-700 mt-1">Cities Covered</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters and Export */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search address or owner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                  showFilters 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={handleExportCSV}
                disabled={exporting || properties.length === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exporting || properties.length === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={handleCopyToClipboard}
                disabled={exporting || properties.length === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="grid grid-cols-5 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Units
                </label>
                <input
                  type="number"
                  value={minUnits}
                  onChange={(e) => setMinUnits(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Max Units
                </label>
                <input
                  type="number"
                  value={maxUnits}
                  onChange={(e) => setMaxUnits(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min $/Unit
                </label>
                <input
                  type="number"
                  value={minPricePerUnit}
                  onChange={(e) => setMinPricePerUnit(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Max $/Unit
                </label>
                <input
                  type="number"
                  value={maxPricePerUnit}
                  onChange={(e) => setMaxPricePerUnit(e.target.value)}
                  placeholder="e.g. 200000"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  City
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">All Cities</option>
                  <option value="Atlanta">Atlanta</option>
                  <option value="Sandy Springs">Sandy Springs</option>
                  <option value="Roswell">Roswell</option>
                  <option value="Johns Creek">Johns Creek</option>
                  <option value="Alpharetta">Alpharetta</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Properties Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              Loading properties...
            </div>
          ) : properties.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No properties found matching your filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        onClick={() => handleSort('address')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Address {sortBy === 'address' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('units')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Units {sortBy === 'units' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('owner_name')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Owner {sortBy === 'owner_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        onClick={() => handleSort('total_assessed_value')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Appraised Value {sortBy === 'total_assessed_value' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        $/Unit
                      </th>
                      <th
                        onClick={() => handleSort('year_built')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Year Built {sortBy === 'year_built' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {properties.map((property) => (
                      <tr key={property.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {property.address}
                              </div>
                              <div className="text-xs text-gray-500">{property.city}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">
                            {property.units}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {property.owner_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(property.total_assessed_value)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(property.price_per_unit)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {property.year_built || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {property.property_class && (
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              property.property_class === 'A' ? 'bg-blue-100 text-blue-800' :
                              property.property_class === 'B' ? 'bg-green-100 text-green-800' :
                              property.property_class === 'C' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              Class {property.property_class}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(page - 1) * 50 + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(page * 50, total)}</span> of{' '}
                      <span className="font-medium">{total}</span> properties
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketResearchPage;
