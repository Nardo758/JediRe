/**
 * Property List - Display individual scraped properties
 */

import React from 'react';
import { Building2, MapPin, DollarSign, Bed, Bath, Maximize, ExternalLink } from 'lucide-react';

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  rent: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  occupancy?: number;
  amenities?: string[];
  specialOffers?: string;
  imageUrl?: string;
  websiteUrl?: string;
  distance?: number;
}

interface PropertyListProps {
  properties: Property[];
  loading?: boolean;
  viewMode?: 'grid' | 'list';
}

export function PropertyList({ properties, loading, viewMode = 'grid' }: PropertyListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 h-48 rounded-lg mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 mb-2">No Properties Found</h3>
        <p className="text-sm text-gray-600">Try adjusting your filters or selecting a different submarket.</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {properties.map((property) => (
          <PropertyListItem key={property.id} property={property} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const rentPerSqft = property.sqft ? property.rent / property.sqft : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      {property.imageUrl ? (
        <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${property.imageUrl})` }}>
          {property.specialOffers && (
            <div className="bg-green-600 text-white text-xs font-semibold px-2 py-1 inline-block m-2 rounded">
              Special Offer
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
          <Building2 className="w-12 h-12 text-gray-400" />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">{property.name}</h3>
        <div className="flex items-start gap-1 text-sm text-gray-600 mb-3">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-1">{property.address}</span>
        </div>

        {/* Rent */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              ${property.rent.toLocaleString()}
            </div>
            {rentPerSqft && (
              <div className="text-xs text-gray-500">
                ${rentPerSqft.toFixed(2)}/sqft
              </div>
            )}
          </div>
          {property.occupancy && (
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{property.occupancy}%</div>
              <div className="text-xs text-gray-500">Occupied</div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex items-center gap-3 text-sm text-gray-600 mb-3 pb-3 border-b border-gray-200">
          {property.bedrooms !== undefined && (
            <div className="flex items-center gap-1">
              <Bed className="w-4 h-4" />
              <span>{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms !== undefined && (
            <div className="flex items-center gap-1">
              <Bath className="w-4 h-4" />
              <span>{property.bathrooms}</span>
            </div>
          )}
          {property.sqft && (
            <div className="flex items-center gap-1">
              <Maximize className="w-4 h-4" />
              <span>{property.sqft.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Amenities */}
        {property.amenities && property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {property.amenities.slice(0, 3).map((amenity, idx) => (
              <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {amenity}
              </span>
            ))}
            {property.amenities.length > 3 && (
              <span className="text-xs text-gray-500">
                +{property.amenities.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        {property.websiteUrl && (
          <a
            href={property.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            View Details
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function PropertyListItem({ property }: { property: Property }) {
  const rentPerSqft = property.sqft ? property.rent / property.sqft : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Image */}
        {property.imageUrl ? (
          <div className="w-32 h-24 flex-shrink-0 bg-cover bg-center rounded" style={{ backgroundImage: `url(${property.imageUrl})` }} />
        ) : (
          <div className="w-32 h-24 flex-shrink-0 bg-gradient-to-br from-blue-50 to-purple-50 rounded flex items-center justify-center">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 mb-1">{property.name}</h3>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{property.address}</span>
              </div>
            </div>
            <div className="text-right ml-4">
              <div className="text-xl font-bold text-gray-900">${property.rent.toLocaleString()}</div>
              {rentPerSqft && (
                <div className="text-xs text-gray-500">${rentPerSqft.toFixed(2)}/sqft</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            {property.bedrooms !== undefined && (
              <div className="flex items-center gap-1">
                <Bed className="w-4 h-4" />
                <span>{property.bedrooms} bed</span>
              </div>
            )}
            {property.bathrooms !== undefined && (
              <div className="flex items-center gap-1">
                <Bath className="w-4 h-4" />
                <span>{property.bathrooms} bath</span>
              </div>
            )}
            {property.sqft && (
              <div className="flex items-center gap-1">
                <Maximize className="w-4 h-4" />
                <span>{property.sqft.toLocaleString()} sqft</span>
              </div>
            )}
            {property.occupancy && (
              <div className="text-green-600 font-medium">
                {property.occupancy}% occupied
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
