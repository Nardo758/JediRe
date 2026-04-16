import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { architectureMetadata } from '../data/architectureMetadata';
import { usePropertyStore } from '../stores/propertyStore';
import { BT } from '@/components/deal/bloomberg-ui';

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

  const inputStyle: React.CSSProperties = {
    background: BT.bg.input,
    border: `1px solid ${BT.border.medium}`,
    borderRadius: 0,
    color: BT.text.primary,
    outline: 'none',
  };

  return (
    <div className="min-h-screen" style={{ background: BT.bg.terminal }}>
      {/* Header */}
      <PageHeader
        title="Properties"
        description="Manage and analyze your property portfolio"
        icon="🏢"
        architectureInfo={architectureMetadata.properties}
      />

      <div className="p-6">
        {/* Filters Bar */}
        <div className="p-4 mb-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <div className="flex gap-4 items-center">
            <input
              type="text"
              id="properties-search"
              name="propertiesSearch"
              placeholder="Search properties..."
              aria-label="Search properties"
              value={localFilters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="flex-1 px-4 py-2"
              style={inputStyle}
            />
            <select
              id="properties-building-class"
              name="propertiesBuildingClass"
              value={localFilters.building_class}
              onChange={(e) => handleFilterChange('building_class', e.target.value)}
              aria-label="Filter by building class"
              className="px-4 py-2"
              style={inputStyle}
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
              id="properties-neighborhood"
              name="propertiesNeighborhood"
              value={localFilters.neighborhood}
              onChange={(e) => handleFilterChange('neighborhood', e.target.value)}
              aria-label="Filter by neighborhood"
              className="px-4 py-2"
              style={inputStyle}
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
              className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}
            >
              {isLoading ? 'Loading...' : 'Filter'}
            </button>
            {Object.values(localFilters).some(v => v) && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 transition-colors"
                style={{ color: BT.text.secondary }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4" style={{ background: BT.bg.panel, border: `1px solid ${BT.text.red}`, borderRadius: 0 }}>
            <p className="text-sm" style={{ color: BT.text.red }}>
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-2xl font-bold" style={{ color: BT.text.primary }}>{stats.total}</div>
            <div className="text-sm" style={{ color: BT.text.secondary }}>Total Properties</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-2xl font-bold" style={{ color: BT.text.primary }}>
              {stats.avgRent > 0 ? `$${stats.avgRent.toLocaleString()}` : '-'}
            </div>
            <div className="text-sm" style={{ color: BT.text.secondary }}>Avg Rent</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-2xl font-bold" style={{ color: BT.text.primary }}>{stats.occupancy}%</div>
            <div className="text-sm" style={{ color: BT.text.secondary }}>Occupancy</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="text-2xl font-bold" style={{ color: BT.text.cyan }}>{stats.opportunities}</div>
            <div className="text-sm" style={{ color: BT.text.secondary }}>Opportunities</div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && properties.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12" style={{ border: `4px solid ${BT.text.cyan}`, borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p className="mt-4" style={{ color: BT.text.secondary }}>Loading properties...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && properties.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: BT.text.primary }}>No properties found</h3>
            <p style={{ color: BT.text.secondary }}>
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
                className="overflow-hidden cursor-pointer"
                style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}
              >
                {/* Property Image Placeholder */}
                <div className="h-48 flex items-center justify-center" style={{ background: BT.bg.panelAlt }}>
                  <span className="text-6xl">🏢</span>
                </div>

                {/* Property Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate" style={{ color: BT.text.primary }}>
                        {property.address}
                      </h3>
                      <p className="text-sm" style={{ color: BT.text.muted }}>
                        {property.city}, {property.state} {property.zip}
                      </p>
                    </div>
                    {property.building_class && (
                      <span className="ml-2 px-2 py-1 text-xs font-semibold flex-shrink-0" style={{
                        borderRadius: 0,
                        border: `1px solid ${BT.border.subtle}`,
                        background: BT.bg.active,
                        color: property.building_class === 'A+' ? BT.text.green :
                          property.building_class === 'A' ? BT.text.cyan :
                          property.building_class.startsWith('B') ? BT.text.amber :
                          BT.text.secondary,
                      }}>
                        {property.building_class}
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-bold mb-2" style={{ color: BT.text.cyan }}>
                    ${property.rent.toLocaleString()}/mo
                  </div>

                  <div className="flex gap-4 text-sm mb-3" style={{ color: BT.text.secondary }}>
                    <span>{property.beds} bd</span>
                    <span>{property.baths} ba</span>
                    <span>{property.sqft} sqft</span>
                  </div>

                  {/* Lease Info (if available) */}
                  {property.lease_expiration_date && (
                    <div className="mb-3 p-2 text-xs" style={{ background: BT.bg.panelAlt, borderRadius: 0, color: BT.text.amber, border: `1px solid ${BT.border.subtle}` }}>
                      Lease expires: {new Date(property.lease_expiration_date).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 text-sm transition-colors" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>
                      Analyze
                    </button>
                    <button className="px-3 py-2 text-sm transition-colors" style={{ border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, borderRadius: 0, background: 'transparent' }}>
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
            <div className="inline-block h-8 w-8" style={{ border: `4px solid ${BT.text.cyan}`, borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
