import React, { useEffect, useState } from 'react';
import { Property } from '../../types';
import { PropertyCard } from '../property/PropertyCard';
import { calculateNegotiationPower } from '../../utils/leaseIntel';

interface DealPropertiesProps {
  dealId: string;
}

export const DealProperties: React.FC<DealPropertiesProps> = ({ dealId }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    try {
      const params = new URLSearchParams();
      if (filters.class) params.append('class', filters.class);
      if (filters.minRent) params.append('minRent', filters.minRent);
      if (filters.maxRent) params.append('maxRent', filters.maxRent);
      if (filters.beds) params.append('beds', filters.beds);

      const response = await fetch(`/api/v1/deals/${dealId}/properties?${params}`);
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      console.error('Failed to fetch properties:', error);
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

  return (
    <div className="h-full flex">
      {/* Property List */}
      <div className="flex-1 flex flex-col">
        {/* Header with filters */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Properties in Boundary
            </h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class
              </label>
              <select
                value={filters.class}
                onChange={(e) => handleFilterChange('class', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Rent
              </label>
              <input
                type="number"
                value={filters.minRent}
                onChange={(e) => handleFilterChange('minRent', e.target.value)}
                placeholder="$1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Rent
              </label>
              <input
                type="number"
                value={filters.maxRent}
                onChange={(e) => handleFilterChange('maxRent', e.target.value)}
                placeholder="$3000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bedrooms
              </label>
              <select
                value={filters.beds}
                onChange={(e) => handleFilterChange('beds', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading properties...</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">
                {hasActiveFilters 
                  ? 'No properties match your filters'
                  : 'No properties found in this boundary'}
              </p>
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
        <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Property Details</h3>
              <button
                onClick={() => setSelectedProperty(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Property info */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Address</h4>
                <p className="text-gray-900">{selectedProperty.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Rent</h4>
                  <p className="text-xl font-bold text-gray-900">
                    ${selectedProperty.rent?.toLocaleString()}/mo
                  </p>
                </div>
                {selectedProperty.class && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Class</h4>
                    <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-sm font-medium">
                      {selectedProperty.class}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {selectedProperty.beds && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Beds</h4>
                    <p className="text-gray-900">{selectedProperty.beds}</p>
                  </div>
                )}
                {selectedProperty.baths && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Baths</h4>
                    <p className="text-gray-900">{selectedProperty.baths}</p>
                  </div>
                )}
                {selectedProperty.sqft && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Sqft</h4>
                    <p className="text-gray-900">{selectedProperty.sqft}</p>
                  </div>
                )}
              </div>

              {selectedProperty.yearBuilt && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Year Built</h4>
                  <p className="text-gray-900">{selectedProperty.yearBuilt}</p>
                </div>
              )}

              {selectedProperty.comparableScore && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Comparable Score</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${selectedProperty.comparableScore * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-blue-600">
                      {(selectedProperty.comparableScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              {selectedProperty.amenities && selectedProperty.amenities.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Amenities</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProperty.amenities.map((amenity, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProperty.notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                  <p className="text-sm text-gray-600">{selectedProperty.notes}</p>
                </div>
              )}

              {(selectedProperty.lease_expiration_date || selectedProperty.current_lease_amount) && (
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Lease Intelligence</h4>
                  <div className="space-y-3">
                    {selectedProperty.lease_expiration_date && (
                      <div>
                        <div className="text-xs text-gray-500">Lease Expiration</div>
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(selectedProperty.lease_expiration_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {selectedProperty.lease_start_date && (
                      <div>
                        <div className="text-xs text-gray-500">Lease Start</div>
                        <div className="text-sm text-gray-900">
                          {new Date(selectedProperty.lease_start_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {selectedProperty.current_lease_amount && (
                      <div>
                        <div className="text-xs text-gray-500">Current Lease Amount</div>
                        <div className="text-sm font-medium text-gray-900">
                          ${selectedProperty.current_lease_amount.toLocaleString()}/mo
                        </div>
                      </div>
                    )}
                    {selectedProperty.renewal_status && (
                      <div>
                        <div className="text-xs text-gray-500">Renewal Status</div>
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          selectedProperty.renewal_status === 'renewed' ? 'bg-green-100 text-green-800' :
                          selectedProperty.renewal_status === 'expiring' ? 'bg-red-100 text-red-800' :
                          selectedProperty.renewal_status === 'month_to_month' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedProperty.renewal_status.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    {selectedProperty.lease_expiration_date && (() => {
                      const neg = calculateNegotiationPower(selectedProperty);
                      return neg.signal !== 'low' ? (
                        <div className={`p-3 rounded-lg ${
                          neg.signal === 'high' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                        }`}>
                          <div className={`text-sm font-semibold ${
                            neg.signal === 'high' ? 'text-green-800' : 'text-yellow-800'
                          }`}>
                            {neg.signal === 'high' ? 'High' : 'Moderate'} Negotiation Power
                          </div>
                          <div className={`text-xs mt-1 ${
                            neg.signal === 'high' ? 'text-green-700' : 'text-yellow-700'
                          }`}>
                            {neg.reason}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Score: {neg.score}/100
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {selectedProperty.current_lease_amount && selectedProperty.rent && selectedProperty.current_lease_amount < selectedProperty.rent && (
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                        <div className="text-sm font-semibold text-green-800">
                          Below Market Rent
                        </div>
                        <div className="text-xs text-green-700 mt-1">
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
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                View on Map
              </button>
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
