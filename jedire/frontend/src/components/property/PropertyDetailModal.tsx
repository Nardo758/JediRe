import React from 'react';
import { Property } from '../../types';

interface PropertyDetailModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  property,
  isOpen,
  onClose
}) => {
  if (!isOpen || !property) return null;

  const calculateNegotiationPower = () => {
    if (!property.lease_expiration_date) return null;

    const expirationDate = new Date(property.lease_expiration_date);
    const today = new Date();
    const daysUntilExpiration = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let score = 0;
    let signal: 'high' | 'moderate' | 'low' = 'low';
    let reason = '';

    // Score based on days until expiration
    if (daysUntilExpiration < 30) {
      score += 40;
    } else if (daysUntilExpiration < 90) {
      score += 30;
    } else if (daysUntilExpiration < 180) {
      score += 15;
    }

    // Score based on renewal status
    if (property.renewal_status === 'expiring') {
      score += 30;
      reason = 'Lease expiring soon';
    } else if (property.renewal_status === 'month_to_month') {
      score += 25;
      reason = 'Month-to-month lease';
    } else if (property.renewal_status === 'renewed') {
      score += 5;
      reason = 'Recently renewed';
    }

    // Score based on rent gap
    if (property.current_lease_amount && property.rent) {
      const rentGap = property.rent - property.current_lease_amount;
      if (rentGap > 200) {
        score += 20;
        reason = reason ? `${reason}, significant rent increase likely` : 'Significant rent increase likely';
      } else if (rentGap > 100) {
        score += 10;
      }
    }

    if (score >= 60) {
      signal = 'high';
    } else if (score >= 40) {
      signal = 'moderate';
    }

    return { score, signal, reason, daysUntilExpiration };
  };

  const negotiationPower = calculateNegotiationPower();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{property.address}</h2>
            <p className="text-gray-600 text-sm mt-1">
              {property.city}, {property.state} {property.zip}
            </p>
          </div>
          {property.building_class && (
            <span className={`px-4 py-2 text-lg font-bold rounded-full ${
              property.building_class === 'A+' ? 'bg-green-100 text-green-800' :
              property.building_class === 'A' ? 'bg-blue-100 text-blue-800' :
              property.building_class.startsWith('B') ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {property.building_class}
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Property Image Placeholder */}
              <div className="h-64 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-8xl">🏢</span>
              </div>

              {/* Basic Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">Property Details</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  {property.beds !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500">Bedrooms</div>
                      <div className="text-xl font-bold text-gray-900">{property.beds}</div>
                    </div>
                  )}
                  {property.baths !== undefined && (
                    <div>
                      <div className="text-xs text-gray-500">Bathrooms</div>
                      <div className="text-xl font-bold text-gray-900">{property.baths}</div>
                    </div>
                  )}
                  {property.sqft && (
                    <div>
                      <div className="text-xs text-gray-500">Square Feet</div>
                      <div className="text-xl font-bold text-gray-900">{property.sqft.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {property.yearBuilt && (
                  <div>
                    <div className="text-xs text-gray-500">Year Built</div>
                    <div className="text-lg font-semibold text-gray-900">{property.yearBuilt}</div>
                  </div>
                )}
              </div>

              {/* Amenities */}
              {property.amenities && property.amenities.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {property.amenities.map((amenity, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Rent Info */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                <div className="text-sm text-blue-700 font-medium mb-2">Current Market Rent</div>
                <div className="text-4xl font-bold text-blue-900 mb-2">
                  ${property.rent?.toLocaleString()}/mo
                </div>
                {property.rent && property.sqft && (
                  <div className="text-sm text-blue-700">
                    ${(property.rent / property.sqft).toFixed(2)}/sqft/month
                  </div>
                )}
              </div>

              {/* Lease Intelligence */}
              {(property.lease_expiration_date || property.current_lease_amount) && (
                <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span>📋</span>
                    <span>Lease Intelligence</span>
                  </h3>
                  
                  <div className="space-y-4">
                    {property.lease_expiration_date && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Lease Expiration</div>
                        <div className="text-lg font-semibold text-gray-900">
                          {new Date(property.lease_expiration_date).toLocaleDateString()}
                        </div>
                        {negotiationPower && (
                          <div className="text-sm text-gray-600 mt-1">
                            {negotiationPower.daysUntilExpiration} days remaining
                          </div>
                        )}
                      </div>
                    )}

                    {property.lease_start_date && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Lease Start</div>
                        <div className="text-sm text-gray-900">
                          {new Date(property.lease_start_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    {property.current_lease_amount && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Current Lease Amount</div>
                        <div className="text-lg font-semibold text-gray-900">
                          ${property.current_lease_amount.toLocaleString()}/mo
                        </div>
                      </div>
                    )}

                    {property.renewal_status && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Renewal Status</div>
                        <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                          property.renewal_status === 'renewed' ? 'bg-green-100 text-green-800' :
                          property.renewal_status === 'expiring' ? 'bg-red-100 text-red-800' :
                          property.renewal_status === 'month_to_month' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {property.renewal_status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Negotiation Power */}
                    {negotiationPower && negotiationPower.signal !== 'low' && (
                      <div className={`p-4 rounded-lg ${
                        negotiationPower.signal === 'high' 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <div className={`text-sm font-semibold mb-1 ${
                          negotiationPower.signal === 'high' ? 'text-green-800' : 'text-yellow-800'
                        }`}>
                          {negotiationPower.signal === 'high' ? '🎯 High' : '⚡ Moderate'} Negotiation Power
                        </div>
                        <div className={`text-xs ${
                          negotiationPower.signal === 'high' ? 'text-green-700' : 'text-yellow-700'
                        }`}>
                          {negotiationPower.reason}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Score: {negotiationPower.score}/100
                        </div>
                      </div>
                    )}

                    {/* Rent Gap Analysis */}
                    {property.current_lease_amount && property.rent && property.current_lease_amount < property.rent && (
                      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="text-sm font-semibold text-blue-800 mb-1">
                          💰 Below Market Rent
                        </div>
                        <div className="text-xs text-blue-700">
                          ${(property.rent - property.current_lease_amount).toLocaleString()}/mo gap
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          ${((property.rent - property.current_lease_amount) * 12).toLocaleString()}/year upside potential
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comparable Score */}
              {property.comparableScore !== undefined && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Comparable Score</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div 
                        className="bg-blue-600 h-4 rounded-full transition-all" 
                        style={{ width: `${property.comparableScore * 100}%` }}
                      />
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      {Math.round(property.comparableScore * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    How similar this property is to your target criteria
                  </p>
                </div>
              )}

              {/* Notes */}
              {property.notes && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {property.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            📍 View on Map
          </button>
          <button className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
            📝 Add Note
          </button>
          <button className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
            📤 Share
          </button>
        </div>
      </div>
    </div>
  );
};
