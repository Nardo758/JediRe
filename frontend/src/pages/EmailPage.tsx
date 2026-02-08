import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDealStore } from '../stores/dealStore';
import { PageHeader } from '../components/layout/PageHeader';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export function EmailPage() {
  const { deals, fetchDeals } = useDealStore();
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const emails = [
    { 
      id: 1,
      from: 'broker@example.com', 
      subject: 'New listing in Buckhead', 
      preview: 'Check out this amazing property...', 
      unread: true,
      dealRelated: true,
      timestamp: '2h ago'
    },
    { 
      id: 2,
      from: 'owner@example.com', 
      subject: 'RE: Offer on 123 Main St', 
      preview: 'We accept your offer of...', 
      unread: true,
      dealRelated: true,
      timestamp: '4h ago'
    },
    { 
      id: 3,
      from: 'team@jedi.com', 
      subject: 'Weekly Market Report', 
      preview: 'Here are this week\'s market insights...', 
      unread: false,
      dealRelated: false,
      timestamp: '1d ago'
    },
    { 
      id: 4,
      from: 'john@realty.com', 
      subject: 'Property showing scheduled', 
      preview: 'Confirmed for tomorrow at 2pm...', 
      unread: true,
      dealRelated: true,
      timestamp: '3h ago'
    },
    { 
      id: 5,
      from: 'alerts@jedi.com', 
      subject: 'New properties in Midtown', 
      preview: '5 new properties match your criteria...', 
      unread: false,
      dealRelated: false,
      timestamp: '2d ago'
    },
  ];

  const unreadCount = emails.filter(e => e.unread).length;

  useEffect(() => {
    fetchDeals();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-84.388, 33.749],
        zoom: 11
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    } catch (err: any) {
      setMapError(err.message || 'Failed to initialize map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map when deals change
  useEffect(() => {
    if (!map.current || !Array.isArray(deals) || !deals.length) return;

    // Add deal markers
    deals.forEach((deal) => {
      if (deal.boundary?.coordinates) {
        const coords = deal.boundary.coordinates[0];
        const center = coords.reduce(
          (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
          [0, 0]
        ).map(sum => sum / coords.length);

        new mapboxgl.Marker({ color: '#3b82f6' })
          .setLngLat(center as [number, number])
          .setPopup(
            new mapboxgl.Popup().setHTML(`
              <div class="p-2">
                <h3 class="font-semibold">${deal.name}</h3>
                <p class="text-sm text-gray-600">${deal.tier} tier</p>
              </div>
            `)
          )
          .addTo(map.current!);
      }
    });
  }, [deals]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="Email"
        subtitle={`${unreadCount} unread messages`}
        icon="📧"
        actions={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            ✉️ Compose
          </button>
        }
      />

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Email List */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">INBOX</h2>
            
            <div className="space-y-2">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    email.unread
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-sm text-gray-900 truncate flex-1">
                      {email.from}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {email.dealRelated && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          📁 Deal
                        </span>
                      )}
                      {email.unread && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </div>
                  </div>
                  
                  <div className={`text-sm mb-1 ${email.unread ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                    {email.subject}
                  </div>
                  
                  <div className="text-xs text-gray-600 truncate mb-2">
                    {email.preview}
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    {email.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Map Error</h3>
                <p className="text-gray-600">{mapError}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Check that VITE_MAPBOX_TOKEN is set correctly
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
