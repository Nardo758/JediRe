/**
 * Email Page - Using ThreePanelLayout
 * 
 * Views: Inbox, Sent, Drafts, Flagged
 * Content: Email list with cards
 * Map: Deal boundaries + email locations
 */

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout, ViewItem } from '../components/layout/ThreePanelLayout';
import { useDealStore } from '../stores/dealStore';
import { inboxService, Email, InboxStats } from '../services/inbox.service';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

type ViewType = 'inbox' | 'sent' | 'drafts' | 'flagged';

export function EmailPage() {
  const { deals, fetchDeals } = useDealStore();
  
  const [activeView, setActiveView] = useState<ViewType>('inbox');
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<number | null>(null);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Define views
  const views: ViewItem[] = [
    { id: 'inbox', label: 'Inbox', icon: '📥', count: stats?.unread || 0 },
    { id: 'sent', label: 'Sent', icon: '📤' },
    { id: 'drafts', label: 'Drafts', icon: '📝' },
    { id: 'flagged', label: 'Flagged', icon: '⭐', count: stats?.flagged || 0 },
  ];

  // Load data on mount
  useEffect(() => {
    loadInbox();
    fetchDeals();
  }, []);

  // Reload emails when view changes
  useEffect(() => {
    loadInbox();
  }, [activeView]);

  const loadInbox = async () => {
    try {
      setLoading(true);
      
      // Build filter based on active view
      const filters: any = { limit: 50 };
      if (activeView === 'flagged') filters.is_flagged = true;
      // Add more filters for sent/drafts when backend supports them
      
      const [emailsRes, statsRes] = await Promise.all([
        inboxService.getEmails(filters),
        inboxService.getStats(),
      ]);

      if (emailsRes.success) setEmails(emailsRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading inbox:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-84.388, 33.749],
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map with deals
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !deals.length) return;
    addDealsToMap(map.current, deals);
  }, [deals]);

  const addDealsToMap = (m: mapboxgl.Map, deals: any[]) => {
    // Remove existing layers
    if (m.getSource('deals')) {
      if (m.getLayer('deal-fills')) m.removeLayer('deal-fills');
      if (m.getLayer('deal-borders')) m.removeLayer('deal-borders');
      m.removeSource('deals');
    }

    const geojson = {
      type: 'FeatureCollection',
      features: deals
        .filter((deal) => deal.boundary?.type && deal.boundary?.coordinates)
        .map((deal) => ({
          type: 'Feature',
          geometry: deal.boundary,
          properties: {
            id: deal.id,
            name: deal.name,
            tier: deal.tier,
          },
        })),
    };

    m.addSource('deals', { type: 'geojson', data: geojson as any });

    m.addLayer({
      id: 'deal-fills',
      type: 'fill',
      source: 'deals',
      paint: {
        'fill-color': [
          'match',
          ['get', 'tier'],
          'basic', '#fbbf24',
          'pro', '#3b82f6',
          'enterprise', '#10b981',
          '#6b7280',
        ],
        'fill-opacity': 0.2,
      },
    });

    m.addLayer({
      id: 'deal-borders',
      type: 'line',
      source: 'deals',
      paint: {
        'line-color': [
          'match',
          ['get', 'tier'],
          'basic', '#f59e0b',
          'pro', '#2563eb',
          'enterprise', '#059669',
          '#4b5563',
        ],
        'line-width': 2,
      },
    });
  };

  const handleToggleFlag = async (emailId: number, currentFlag: boolean) => {
    try {
      await inboxService.updateEmail(emailId, { is_flagged: !currentFlag });
      setEmails(
        emails.map((e) =>
          e.id === emailId ? { ...e, is_flagged: !currentFlag } : e
        )
      );
    } catch (error) {
      console.error('Error toggling flag:', error);
    }
  };

  const handleEmailClick = async (email: Email) => {
    setSelectedEmail(email.id);
    
    // Mark as read if unread
    if (!email.is_read) {
      try {
        await inboxService.updateEmail(email.id, { is_read: true });
        setEmails(
          emails.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
        );
      } catch (error) {
        console.error('Error marking email as read:', error);
      }
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

  // Content renderer
  const renderContent = (viewId: string) => {
    if (loading) {
      return <div className="text-center py-8 text-gray-500">Loading emails...</div>;
    }

    // Stats card
    const statsCard = stats && (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Inbox Stats</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-600">Total</div>
            <div className="font-semibold text-lg">{stats.total}</div>
          </div>
          <div>
            <div className="text-gray-600">Unread</div>
            <div className="font-semibold text-lg text-blue-600">{stats.unread}</div>
          </div>
          <div>
            <div className="text-gray-600">Flagged</div>
            <div className="font-semibold text-lg text-yellow-600">{stats.flagged}</div>
          </div>
          <div>
            <div className="text-gray-600">Deal-related</div>
            <div className="font-semibold text-lg text-green-600">{stats.deal_related}</div>
          </div>
        </div>
      </div>
    );

    // Email list
    const emailList = emails.length === 0 ? (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">📧</div>
        <div>No emails found</div>
      </div>
    ) : (
      <div className="space-y-2">
        {emails.map((email) => (
          <div
            key={email.id}
            onClick={() => handleEmailClick(email)}
            className={`bg-white rounded-lg border p-3 cursor-pointer transition-all ${
              email.is_read
                ? 'border-gray-200 hover:border-gray-300'
                : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
            } ${selectedEmail === email.id ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${email.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {email.from_name || email.from_email}
                  </span>
                  {!email.is_read && (
                    <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                  )}
                </div>
                <div className={`text-sm ${email.is_read ? 'text-gray-600' : 'text-gray-900'} truncate`}>
                  {email.subject}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFlag(email.id, email.is_flagged);
                }}
                className="ml-2 text-lg hover:scale-110 transition-transform"
              >
                {email.is_flagged ? '⭐' : '☆'}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{formatTimestamp(email.received_at)}</span>
              {email.deal_id && (
                <>
                  <span>•</span>
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                    📁 Deal
                  </span>
                </>
              )}
              {email.attachments_count > 0 && (
                <>
                  <span>•</span>
                  <span>📎 {email.attachments_count}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );

    return (
      <>
        {statsCard}
        {emailList}
      </>
    );
  };

  // Map renderer
  const renderMap = () => (
    <div ref={mapContainer} className="absolute inset-0" />
  );

  return (
    <ThreePanelLayout
      storageKey="email"
      views={views}
      activeView={activeView}
      onViewChange={(viewId) => setActiveView(viewId as ViewType)}
      renderContent={renderContent}
      renderMap={renderMap}
    />
  );
}

export default EmailPage;
