import React, { useEffect, useState } from 'react';
import { Property } from '../../types';
import { PropertyCard } from '../property/PropertyCard';
import { calculateNegotiationPower } from '../../utils/leaseIntel';
import { api } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

interface DealPropertiesProps {
  dealId: string;
}

export const DealProperties: React.FC<DealPropertiesProps> = ({ dealId }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    class: '',
    minRent: '',
    maxRent: '',
    beds: ''
  });

  useEffect(() => {
    fetchProperties();
  }, [dealId, filters]);

  const fetchProperties = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filterParams: any = {};
      if (filters.class) filterParams.class = filters.class;
      if (filters.minRent) filterParams.minRent = parseInt(filters.minRent);
      if (filters.maxRent) filterParams.maxRent = parseInt(filters.maxRent);
      if (filters.beds) filterParams.beds = parseInt(filters.beds);

      const response = await api.deals.properties(dealId, filterParams);
      setProperties(response.data || []);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to fetch properties';
      setError(errorMsg);
      console.error('Failed to fetch properties:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      class: '',
      minRent: '',
      maxRent: '',
      beds: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const selectStyle: React.CSSProperties = {
    background: BT.bg.input,
    border: `1px solid ${BT.border.medium}`,
    borderRadius: 0,
    color: BT.text.primary,
    fontFamily: BT.font.label,
    fontSize: '11px',
    outline: 'none',
  };

  return (
    <div className="h-full flex">
      {/* Property List */}
      <div className="flex-1 flex flex-col">
        {/* Header with filters */}
        <div className="p-6" style={{ background: BT.bg.panel, borderBottom: `1px solid ${BT.border.medium}` }}>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
              Properties in Boundary
            </h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{ fontSize: '10px', color: BT.text.cyan, fontFamily: BT.font.mono, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block mb-1" style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label }}>
                Class
              </label>
              <select
                id="dealPropertyClass"
                name="dealPropertyClass"
                value={filters.class}
                onChange={(e) => handleFilterChange('class', e.target.value)}
                aria-label="Property class filter"
                className="w-full px-3 py-2"
                style={selectStyle}
              >
                <option value="">All Classes</option>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B+">B+</option>
                <option value="B">B</option>
                <option value="C+">C+</option>
                <option value="C">C</option>
              </select>
            </div>

            <div>
              <label className="block mb-1" style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label }}>
                Min Rent
              </label>
              <input
                id="dealMinRent"
                name="dealMinRent"
                type="number"
                value={filters.minRent}
                onChange={(e) => handleFilterChange('minRent', e.target.value)}
                placeholder="$1000"
                aria-label="Minimum rent filter"
                className="w-full px-3 py-2"
                style={selectStyle}
              />
            </div>

            <div>
              <label className="block mb-1" style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label }}>
                Max Rent
              </label>
              <input
                id="dealMaxRent"
                name="dealMaxRent"
                type="number"
                value={filters.maxRent}
                onChange={(e) => handleFilterChange('maxRent', e.target.value)}
                placeholder="$3000"
                aria-label="Maximum rent filter"
                className="w-full px-3 py-2"
                style={selectStyle}
              />
            </div>

            <div>
              <label className="block mb-1" style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label }}>
                Bedrooms
              </label>
              <select
                id="dealBedrooms"
                name="dealBedrooms"
                value={filters.beds}
                onChange={(e) => handleFilterChange('beds', e.target.value)}
                aria-label="Bedrooms filter"
                className="w-full px-3 py-2"
                style={selectStyle}
              >
                <option value="">Any</option>
                <option value="0">Studio</option>
                <option value="1">1 Bed</option>
                <option value="2">2 Beds</option>
                <option value="3">3+ Beds</option>
              </select>
            </div>
          </div>
        </div>

        {/* Property List */}
        <div className="flex-1 overflow-y-auto p-6">
          {error ? (
            <div className="text-center py-12">
              <div style={{ fontSize: '48px' }} className="mb-4">⚠️</div>
              <p style={{ color: BT.text.primary, fontWeight: 600, fontFamily: BT.font.mono, fontSize: '12px', marginBottom: '8px' }}>Failed to load properties</p>
              <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px', marginBottom: '16px' }}>{error}</p>
              <button
                onClick={fetchProperties}
                className="px-4 py-2"
                style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0, fontFamily: BT.font.mono, fontSize: '10px', fontWeight: 600, border: 'none' }}
              >
                Try Again
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 mx-auto mb-4" style={{ borderRadius: '50%', borderBottom: `2px solid ${BT.text.cyan}` }}></div>
              <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>Loading properties...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <div style={{ fontSize: '48px' }} className="mb-4">🏢</div>
              <p style={{ color: BT.text.secondary, fontWeight: 600, fontFamily: BT.font.label, fontSize: '11px', marginBottom: '8px' }}>
                {hasActiveFilters
                  ? 'No properties match your filters'
                  : 'No properties found in this boundary'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{ color: BT.text.cyan, fontSize: '10px', fontFamily: BT.font.mono, background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Clear filters to see all properties
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map(property => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onClick={() => setSelectedProperty(property)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Property Detail Sidebar */}
      {selectedProperty && (
        <div className="w-96 overflow-y-auto" style={{ background: BT.bg.panel, borderLeft: `1px solid ${BT.border.medium}` }}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>Property Details</h3>
              <button
                onClick={() => setSelectedProperty(null)}
                style={{ color: BT.text.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Property info */}
            <div className="space-y-4">
              <div>
                <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Address</h4>
                <p style={{ color: BT.text.primary, fontFamily: BT.font.label, fontSize: '11px' }}>{selectedProperty.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Rent</h4>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                    ${selectedProperty.rent?.toLocaleString()}/mo
                  </p>
                </div>
                {selectedProperty.class && (
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Class</h4>
                    <span className="inline-block px-3 py-1" style={{ background: BT.bg.active, borderRadius: '2px', fontSize: '11px', fontWeight: 500, color: BT.text.primary, fontFamily: BT.font.mono }}>
                      {selectedProperty.class}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {selectedProperty.beds && (
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Beds</h4>
                    <p style={{ color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px' }}>{selectedProperty.beds}</p>
                  </div>
                )}
                {selectedProperty.baths && (
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Baths</h4>
                    <p style={{ color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px' }}>{selectedProperty.baths}</p>
                  </div>
                )}
                {selectedProperty.sqft && (
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Sqft</h4>
                    <p style={{ color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px' }}>{selectedProperty.sqft}</p>
                  </div>
                )}
              </div>

              {selectedProperty.yearBuilt && (
                <div>
                  <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Year Built</h4>
                  <p style={{ color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px' }}>{selectedProperty.yearBuilt}</p>
                </div>
              )}

              {selectedProperty.comparableScore && (
                <div>
                  <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Comparable Score</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2" style={{ background: BT.bg.active, borderRadius: '1px' }}>
                      <div
                        className="h-2"
                        style={{ width: `${selectedProperty.comparableScore * 100}%`, background: BT.text.cyan, borderRadius: '1px' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: BT.text.cyan, fontFamily: BT.font.mono }}>
                      {(selectedProperty.comparableScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              {selectedProperty.amenities && selectedProperty.amenities.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '8px' }}>Amenities</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProperty.amenities.map((amenity, index) => (
                      <span
                        key={index}
                        className="px-2 py-1"
                        style={{ background: BT.bg.active, color: BT.text.cyan, borderRadius: '2px', fontSize: '10px', fontFamily: BT.font.label }}
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProperty.notes && (
                <div>
                  <h4 style={{ fontSize: '10px', fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Notes</h4>
                  <p style={{ fontSize: '11px', color: BT.text.secondary, fontFamily: BT.font.label }}>{selectedProperty.notes}</p>
                </div>
              )}

              {(selectedProperty.lease_expiration_date || selectedProperty.current_lease_amount) && (
                <div className="pt-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '12px' }}>Lease Intelligence</h4>
                  <div className="space-y-3">
                    {selectedProperty.lease_expiration_date && (
                      <div>
                        <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>Lease Expiration</div>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: BT.text.primary, fontFamily: BT.font.mono }}>
                          {new Date(selectedProperty.lease_expiration_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {selectedProperty.lease_start_date && (
                      <div>
                        <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>Lease Start</div>
                        <div style={{ fontSize: '11px', color: BT.text.primary, fontFamily: BT.font.mono }}>
                          {new Date(selectedProperty.lease_start_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {selectedProperty.current_lease_amount && (
                      <div>
                        <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>Current Lease Amount</div>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: BT.text.primary, fontFamily: BT.font.mono }}>
                          ${selectedProperty.current_lease_amount.toLocaleString()}/mo
                        </div>
                      </div>
                    )}
                    {selectedProperty.renewal_status && (
                      <div>
                        <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>Renewal Status</div>
                        <span
                          className="inline-block px-2 py-0.5"
                          style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            borderRadius: '2px',
                            fontFamily: BT.font.mono,
                            background: BT.bg.active,
                            color: selectedProperty.renewal_status === 'renewed' ? BT.text.green :
                                   selectedProperty.renewal_status === 'expiring' ? BT.text.red :
                                   selectedProperty.renewal_status === 'month_to_month' ? BT.text.amber :
                                   BT.text.secondary,
                          }}
                        >
                          {selectedProperty.renewal_status.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    {selectedProperty.lease_expiration_date && (() => {
                      const neg = calculateNegotiationPower(selectedProperty);
                      return neg.signal !== 'low' ? (
                        <div className="p-3" style={{
                          borderRadius: 0,
                          background: BT.bg.panelAlt,
                          border: `1px solid ${neg.signal === 'high' ? BT.text.green : BT.text.amber}`,
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, fontFamily: BT.font.mono, color: neg.signal === 'high' ? BT.text.green : BT.text.amber }}>
                            {neg.signal === 'high' ? 'High' : 'Moderate'} Negotiation Power
                          </div>
                          <div style={{ fontSize: '10px', marginTop: '4px', fontFamily: BT.font.label, color: neg.signal === 'high' ? BT.text.green : BT.text.amber }}>
                            {neg.reason}
                          </div>
                          <div style={{ marginTop: '4px', fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label }}>
                            Score: {neg.score}/100
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {selectedProperty.current_lease_amount && selectedProperty.rent && selectedProperty.current_lease_amount < selectedProperty.rent && (
                      <div className="p-3" style={{ borderRadius: 0, background: BT.bg.panelAlt, border: `1px solid ${BT.text.green}` }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: BT.text.green, fontFamily: BT.font.mono }}>
                          Below Market Rent
                        </div>
                        <div style={{ fontSize: '10px', color: BT.text.green, fontFamily: BT.font.label, marginTop: '4px' }}>
                          ${(selectedProperty.rent - selectedProperty.current_lease_amount).toLocaleString()}/mo gap
                          (${((selectedProperty.rent - selectedProperty.current_lease_amount) * 12).toLocaleString()}/yr upside)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 pt-6 space-y-2" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
              <button
                className="w-full px-4 py-2 transition"
                style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0, fontFamily: BT.font.mono, fontSize: '10px', fontWeight: 600, border: 'none' }}
              >
                View on Map
              </button>
              <button
                className="w-full px-4 py-2 transition"
                style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.secondary, fontFamily: BT.font.mono, fontSize: '10px', background: 'transparent' }}
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
