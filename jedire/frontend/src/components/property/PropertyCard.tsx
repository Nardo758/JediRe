import React, { useEffect, useRef } from 'react';
import { Property } from '../../types';
import { calculateNegotiationPower } from '../../utils/leaseIntel';
import { trackPropertyEvent } from '@/hooks/useEventTracking';
import { DigitalTrafficCard } from '@/components/analytics/DigitalTrafficCard';

interface PropertyCardProps {
  property: Property;
  onClick?: () => void;
  loading?: boolean;
}

export function PropertyCard({ property, onClick, loading }: PropertyCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasTracked = useRef(false);

  // Track search impression when card becomes visible
  useEffect(() => {
    if (!cardRef.current || hasTracked.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTracked.current) {
            trackPropertyEvent(property.id, 'search_impression', {
              position: cardRef.current?.getBoundingClientRect(),
            });
            hasTracked.current = true;
          }
        });
      },
      { threshold: 0.5 } // Track when 50% visible
    );

    observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, [property.id]);

  if (loading) {
    return <PropertyCardSkeleton />;
  }

  const negotiation = property.lease_expiration_date
    ? calculateNegotiationPower(property)
    : null;

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-lg bg-white shadow-md transition-all hover:shadow-lg cursor-pointer border border-gray-200"
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 truncate font-medium">{property.address}</p>
          </div>
          {property.class && (
            <span className="ml-2 flex-shrink-0 inline-block px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-700">
              {property.class}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xl font-bold text-gray-900">
            ${property.rent?.toLocaleString()}<span className="text-sm font-normal text-gray-500">/mo</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          {property.beds !== undefined && (
            <span>{property.beds} bed</span>
          )}
          {property.baths !== undefined && (
            <span>{property.baths} bath</span>
          )}
          {property.sqft && (
            <span>{property.sqft.toLocaleString()} sqft</span>
          )}
        </div>

        {property.yearBuilt && (
          <div className="text-xs text-gray-500 mt-1">
            Built {property.yearBuilt}
          </div>
        )}

        {negotiation && negotiation.signal !== 'low' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
              negotiation.signal === 'high'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {negotiation.signal === 'high' ? 'High Negotiation Power' : 'Moderate Negotiation Window'}
            </span>
            <p className="text-xs text-gray-500 mt-1">{negotiation.reason}</p>
          </div>
        )}

        {property.current_lease_amount && property.rent && property.current_lease_amount < property.rent && (
          <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
            ${(property.rent - property.current_lease_amount).toLocaleString()}/mo below market
          </div>
        )}

        {/* Digital Traffic Score - Compact Display */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <DigitalTrafficCard propertyId={property.id} compact={true} />
        </div>
      </div>
    </div>
  );
}

function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md border border-gray-200">
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
        <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse" />
        <div className="flex gap-4">
          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
