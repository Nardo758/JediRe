import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { architectureMetadata } from '../data/architectureMetadata';
import { usePropertyStore } from '../stores/propertyStore';

export function PropertiesPage() {
  const { 
    properties, 
    filters, 
    isLoading, 
    error, 
    fetchProperties, 
    setFilters 
  } = usePropertyStore();

  const [localFilters, setLocalFilters] = useState({
    search: '',
    building_class: '',
    neighborhood: ''
  });

  // Fetch properties on mount
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Calculate stats from properties
  const stats = {
    total: properties.length,
    avgRent: properties.length > 0 
      ? Math.round(properties.reduce((sum, p) => sum + p.rent, 0) / properties.length)
      : 0,
    // Mock occupancy and opportunities for now
    occupancy: 94,
    opportunities: 8
  };

  const handleFilterChange = (field: string, value: string) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    const apiFilters: any = {};
    
    if (localFilters.search) apiFilters.search = localFilters.search;
    if (localFilters.building_class) apiFilters.building_class = localFilters.building_class;
    if (localFilters.neighborhood) apiFilters.neighborhood = localFilters.neighborhood;
    
    setFilters(apiFilters);
  };

  const handleClearFilters = () => {
    setLocalFilters({ search: '', building_class: '', neighborhood: '' });
    setFilters({});
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PageHeader
        title="Properties"
        description="Manage and analyze your property portfolio"
        icon="🏢"
        architectureInfo={architectureMetadata.properties}
      />
      
      <div className="p-6">
        {/* Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-4 items-center">
            <input
              type="text"
              placeholder="Search properties..."
              aria-label="Search properties"
              value={localFilters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select 
              value={localFilters.building_class}
              onChange={(e) => handleFilterChange('building_class', e.target.value)}
              aria-label="Filter by building class"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Classes</option>
              <option value="A+">A+</option>
              <option value="A">A</option>
              <option value="B+">B+</option>
              <option value="B">B</option>
              <option value="C+">C+</option>
              <option value="C">C</option>
            </select>
            <select 
              value={localFilters.neighborhood}
              onChange={(e) => handleFilterChange('neighborhood', e.target.value)}
              aria-label="Filter by neighborhood"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Neighborhoods</option>
              <option value="Buckhead">Buckhead</option>
              <option value="Midtown">Midtown</option>
              <option value="Virginia Highland">Virginia Highland</option>
              <option value="Old Fourth Ward">Old Fourth Ward</option>
            </select>
            <button 
              onClick={handleApplyFilters}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Loading...' : 'Filter'}
            </button>
            {Object.values(localFilters).some(v => v) && (
              <button 
                onClick={handleClearFilters}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Properties</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">
              {stats.avgRent > 0 ? `$${stats.avgRent.toLocaleString()}` : '-'}
            </div>
            <div className="text-sm text-gray-600">Avg Rent</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.occupancy}%</div>
            <div className="text-sm text-gray-600">Occupancy</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.opportunities}</div>
            <div className="text-sm text-gray-600">Opportunities</div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && properties.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading properties...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && properties.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No properties found</h3>
            <p className="text-gray-600">
              {Object.values(localFilters).some(v => v) 
                ? 'Try adjusting your filters'
                : 'Properties will appear here once data is loaded'}
            </p>
          </div>
        )}

        {/* Property Grid */}
        {properties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <div 
                key={property.id} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                {/* Property Image Placeholder */}
                <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <span className="text-6xl">🏢</span>
                </div>

                {/* Property Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {property.address}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {property.city}, {property.state} {property.zip}
                      </p>
                    </div>
                    {property.building_class && (
                      <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded flex-shrink-0 ${
                        property.building_class === 'A+' ? 'bg-green-100 text-green-800' :
                        property.building_class === 'A' ? 'bg-blue-100 text-blue-800' :
                        property.building_class.startsWith('B') ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {property.building_class}
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    ${property.rent.toLocaleString()}/mo
                  </div>

                  <div className="flex gap-4 text-sm text-gray-600 mb-3">
                    <span>{property.beds} bd</span>
                    <span>{property.baths} ba</span>
                    <span>{property.sqft} sqft</span>
                  </div>

                  {/* Lease Info (if available) */}
                  {property.lease_expiration_date && (
                    <div className="mb-3 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                      Lease expires: {new Date(property.lease_expiration_date).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                      Analyze
                    </button>
                    <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading More Indicator */}
        {isLoading && properties.length > 0 && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        )}
      </div>
    </div>
  );
}
