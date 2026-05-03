import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDealStore } from '../stores/dealStore';
import { inboxService, Email, InboxStats } from '../services/inbox.service';
import { HorizontalBar } from '../components/map/HorizontalBar';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export function EmailPage({ view = 'inbox' }: { view?: string }) {
  const { deals, fetchDeals } = useDealStore();
  const [mapError, setMapError] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<number | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Fetch emails and stats
  useEffect(() => {
    const loadInbox = async () => {
      try {
        setLoading(true);
        const [emailsRes, statsRes] = await Promise.all([
          inboxService.getEmails({ limit: 50 }),
          inboxService.getStats(),
        ]);
        
        if (emailsRes.success) {
          setEmails(emailsRes.data);
        }
        
        if (statsRes.success) {
          setStats(statsRes.data);
        }
      } catch (error) {
        console.error('Error loading inbox:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInbox();
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

  const handleEmailClick = async (email: Email) => {
    setSelectedEmail(email.id);
    
    // Mark as read if not already
    if (!email.is_read) {
      try {
        await inboxService.updateEmail(email.id, { is_read: true });
        // Update local state
        setEmails(emails.map(e => 
          e.id === email.id ? { ...e, is_read: true } : e
        ));
        // Update stats
        if (stats) {
          setStats({ ...stats, unread: stats.unread - 1 });
        }
      } catch (error) {
        console.error('Error marking email as read:', error);
      }
    }
  };

  const handleToggleFlag = async (emailId: number, isFlagged: boolean) => {
    try {
      await inboxService.updateEmail(emailId, { is_flagged: !isFlagged });
      setEmails(emails.map(e => 
        e.id === emailId ? { ...e, is_flagged: !e.is_flagged } : e
      ));
    } catch (error) {
      console.error('Error toggling flag:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return '1d ago';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <HorizontalBar />
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Email List */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            {/* Compose Button */}
            <button className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              ✉️ Compose
            </button>

            {/* Stats */}
            {stats && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-600">Total</div>
                    <div className="font-semibold text-gray-900">{stats.total}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Unread</div>
                    <div className="font-semibold text-blue-600">{stats.unread}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Flagged</div>
                    <div className="font-semibold text-yellow-600">{stats.flagged}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Deal Related</div>
                    <div className="font-semibold text-purple-600">{stats.deal_related}</div>
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-sm font-semibold text-gray-700 mb-3">INBOX</h2>
            
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading emails...
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📭</div>
                <div>No emails yet</div>
              </div>
            ) : (
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => handleEmailClick(email)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedEmail === email.id
                        ? 'bg-blue-100 border-blue-300 shadow-sm'
                        : email.is_read
                        ? 'bg-white border-gray-200 hover:border-gray-300'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium text-sm text-gray-900 truncate flex-1">
                        {email.from_name || email.from_address}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {email.deal_id && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                            📁 {email.deal_name || 'Deal'}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFlag(email.id, email.is_flagged);
                          }}
                          className="text-lg hover:scale-110 transition-transform"
                        >
                          {email.is_flagged ? '⭐' : '☆'}
                        </button>
                        {!email.is_read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </div>
                    
                    <div className={`text-sm mb-1 truncate ${email.is_read ? 'text-gray-700' : 'font-medium text-gray-900'}`}>
                      {email.subject}
                    </div>
                    
                    <div className="text-xs text-gray-600 truncate mb-2">
                      {email.body_preview}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{formatTimestamp(email.received_at)}</span>
                      {email.has_attachments && (
                        <span className="flex items-center gap-1">
                          📎 {email.attachment_count || 1}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
