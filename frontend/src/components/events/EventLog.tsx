/**
 * Event Log Component
 * 
 * Table of recent platform events with filtering, search, and retry capabilities.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EventCascadeViewer from './EventCascadeViewer';

interface EventLogEntry {
  id: number;
  event_id: string;
  topic: string;
  event_type: string;
  published_by: string;
  published_at: string;
  magnitude: number | null;
  confidence_score: number | null;
  deal_id: string | null;
  trade_area_ids: string[] | null;
}

interface EventLogProps {
  dealId?: string;
  tradeAreaId?: string;
  autoRefresh?: boolean;
}

export const EventLog: React.FC<EventLogProps> = ({ dealId, tradeAreaId, autoRefresh = false }) => {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [showCascade, setShowCascade] = useState(false);

  // Filters
  const [topicFilter, setTopicFilter] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [publisherFilter, setPublisherFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const limit = 50;

  useEffect(() => {
    loadEvents();
    
    if (autoRefresh) {
      const interval = setInterval(loadEvents, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [dealId, tradeAreaId, topicFilter, eventTypeFilter, publisherFilter, page]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      
      const params: any = {
        limit,
        offset: page * limit,
      };
      
      if (dealId) params.dealId = dealId;
      if (tradeAreaId) params.tradeAreaId = tradeAreaId;
      if (topicFilter) params.topic = topicFilter;
      if (eventTypeFilter) params.eventType = eventTypeFilter;
      if (publisherFilter) params.publishedBy = publisherFilter;
      
      const response = await axios.get('/api/v1/events/log', { params });
      setEvents(response.data.events);
      setTotalEvents(response.data.pagination.total);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCascade = (eventId: string) => {
    setSelectedEvent(eventId);
    setShowCascade(true);
  };

  const getTopicBadgeColor = (topic: string): string => {
    const colorMap: Record<string, string> = {
      'news.events.extracted': 'bg-blue-100 text-blue-800',
      'signals.demand.updated': 'bg-green-100 text-green-800',
      'signals.supply.updated': 'bg-yellow-100 text-yellow-800',
      'signals.risk.updated': 'bg-red-100 text-red-800',
      'scores.jedi.updated': 'bg-purple-100 text-purple-800',
      'proforma.assumptions.updated': 'bg-indigo-100 text-indigo-800',
      'alerts.user.generated': 'bg-orange-100 text-orange-800',
    };
    return colorMap[topic] || 'bg-gray-100 text-gray-800';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (showCascade && selectedEvent) {
    return (
      <EventCascadeViewer
        eventId={selectedEvent}
        onClose={() => setShowCascade(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with filters */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Event Log</h2>
          <button
            onClick={loadEvents}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">Topic</label>
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded"
            >
              <option value="">All Topics</option>
              <option value="news.events.extracted">News Events</option>
              <option value="signals.demand.updated">Demand Signals</option>
              <option value="signals.supply.updated">Supply Signals</option>
              <option value="signals.risk.updated">Risk Signals</option>
              <option value="scores.jedi.updated">JEDI Scores</option>
              <option value="proforma.assumptions.updated">Pro Forma</option>
              <option value="alerts.user.generated">Alerts</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-gray-500">Event Type</label>
            <input
              type="text"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              placeholder="Filter by type..."
              className="w-full px-2 py-1 text-sm border rounded"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-500">Publisher</label>
            <input
              type="text"
              value={publisherFilter}
              onChange={(e) => setPublisherFilter(e.target.value)}
              placeholder="Filter by publisher..."
              className="w-full px-2 py-1 text-sm border rounded"
            />
          </div>
        </div>
      </div>

      {/* Event table */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded m-4">
            <p className="text-red-700">{error}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Topic</th>
                <th className="px-4 py-2 text-left">Event Type</th>
                <th className="px-4 py-2 text-left">Publisher</th>
                <th className="px-4 py-2 text-right">Magnitude</th>
                <th className="px-4 py-2 text-right">Confidence</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatTimestamp(event.published_at)}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${getTopicBadgeColor(event.topic)}`}>
                      {event.topic.split('.')[0]}
                    </span>
                  </td>
                  <td className="px-4 py-2">{event.event_type}</td>
                  <td className="px-4 py-2 text-gray-600">{event.published_by}</td>
                  <td className="px-4 py-2 text-right">
                    {event.magnitude !== null ? event.magnitude.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {event.confidence_score !== null ? (
                      <span className={`${event.confidence_score >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {event.confidence_score}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleViewCascade(event.event_id)}
                      className="text-blue-600 hover:text-blue-800 text-xs underline"
                    >
                      View Cascade
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {!loading && events.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No events found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalEvents > limit && (
        <div className="border-t p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {page * limit + 1} - {Math.min((page + 1) * limit, totalEvents)} of {totalEvents}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= totalEvents}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventLog;
