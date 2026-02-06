import React from 'react';
import { Property } from '../../stores/mapStore';
import { Button } from '../shared/Button';
import { calculateNegotiationPower } from '../../utils/leaseIntel';

interface PropertyCardProps {
  property: Property;
  onSelect?: () => void;
  onSave?: () => void;
  loading?: boolean;
}

export function PropertyCard({ property, onSelect, onSave, loading }: PropertyCardProps) {
  if (loading) {
    return <PropertyCardSkeleton />;
  }

  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow-md transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer">
      {/* Property Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={property.photos[0] || '/placeholder.jpg'}
          alt={property.address}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        
        {/* Save Button */}
        <button
          className="absolute top-2 right-2 rounded-full bg-white p-2 shadow-md hover:bg-gray-100"
          onClick={(e) => {
            e.stopPropagation();
            onSave?.();
          }}
          aria-label="Save property"
        >
          ❤️
        </button>
      </div>

      {/* Property Details */}
      <div className="p-4" onClick={onSelect}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-2xl font-bold text-gray-900">
            ${property.price.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500">
            {property.city}, {property.state}
          </span>
        </div>

        <p className="mb-3 text-sm text-gray-700 truncate">{property.address}</p>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center">
            🛏️ {property.bedrooms} bed
          </span>
          <span className="flex items-center">
            🛁 {property.bathrooms} bath
          </span>
          <span className="flex items-center">
            📐 {property.sqft.toLocaleString()} sqft
          </span>
        </div>

        {property.lease_expiration_date && (
          <div className="mt-2">
            {calculateNegotiationPower(property as any).signal === 'high' && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                High Negotiation Power
              </span>
            )}
            {calculateNegotiationPower(property as any).signal === 'medium' && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                Moderate Negotiation Window
              </span>
            )}
          </div>
        )}

        <Button className="mt-3 w-full" variant="outline" size="sm">
          View Details
        </Button>
      </div>
    </div>
  );
}

function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md">
      <div className="h-48 bg-gray-200 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
        <div className="flex gap-4">
          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
