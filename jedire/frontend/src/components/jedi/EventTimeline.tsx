/**
 * Event Timeline Component
 * 
 * Displays chronological events affecting a deal with impact indicators
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, TrendingUp, TrendingDown, ArrowRight, ExternalLink } from 'lucide-react';

interface NewsEvent {
  id: string;
  eventCategory: string;
  eventType: string;
  locationRaw: string;
  publishedAt: string;
  extractedData: any;
  impactScore: number;
  distanceMiles: number;
  decayScore: number;
  tradeAreaName?: string;
  sourceUrl?: string;
}

interface EventTimelineProps {
  dealId: string;
  limit?: number;
  compact?: boolean;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  dealId,
  limit = 20,
  compact = false,
}) => {
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'employment' | 'development' | 'amenities'>('all');

  useEffect(() => {
    fetchEvents();
  }, [dealId, limit]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/v1/jedi/impact/${dealId}?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setEvents(data.data.events || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'employment': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'development': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'amenities': return 'bg-green-100 text-green-800 border-green-200';
      case 'transactions': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'government': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getImpactIcon = (score: number) => {
    if (score >= 70) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (score >= 40) return <ArrowRight className="w-4 h-4 text-yellow-600" />;
    return <TrendingDown className="w-4 h-4 text-red-600" />;
  };

  const getImpactLabel = (score: number) => {
    if (score >= 70) return 'High Impact';
    if (score >= 40) return 'Medium Impact';
    return 'Low Impact';
  };

  const formatEventType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getEventDescription = (event: NewsEvent) => {
    const data = event.extractedData || {};
    
    if (event.eventCategory === 'employment') {
      const company = data.company_name || 'Company';
      const employees = data.employee_count;
      return employees 
        ? `${company} - ${employees.toLocaleString()} employees`
        : company;
    }
    
    if (event.eventCategory === 'development') {
      const units = data.unit_count;
      return units 
        ? `${units.toLocaleString()} units`
        : 'New development';
    }
    
    if (event.eventCategory === 'transactions') {
      const price = data.price_per_unit;
      return price 
        ? `$${price.toLocaleString()}/unit`
        : 'Property transaction';
    }
    
    return event.locationRaw;
  };

  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter(e => e.eventCategory === filter);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Event Timeline</h3>
          </div>
          <span className="text-sm text-gray-500">{filteredEvents.length} events</span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('employment')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'employment'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Employment
          </button>
          <button
            onClick={() => setFilter('development')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'development'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Development
          </button>
          <button
            onClick={() => setFilter('amenities')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'amenities'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Amenities
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No events to display</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {/* Events */}
            <div className="space-y-6">
              {filteredEvents.map((event, index) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Timeline Dot */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      getCategoryColor(event.eventCategory).replace('text-', 'bg-').replace('-800', '-500')
                    } border-4 border-white shadow-md z-10 relative`}>
                      {getImpactIcon(event.impactScore)}
                    </div>
                  </div>

                  {/* Event Content */}
                  <div className="flex-1 pt-2">
                    <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getCategoryColor(event.eventCategory)}`}>
                              {event.eventCategory}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              event.impactScore >= 70 ? 'bg-green-100 text-green-800' :
                              event.impactScore >= 40 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {getImpactLabel(event.impactScore)}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-1">
                            {formatEventType(event.eventType)}
                          </h4>
                        </div>
                        {event.sourceUrl && (
                          <a
                            href={event.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      {/* Details */}
                      <p className="text-sm text-gray-700 mb-2">
                        {getEventDescription(event)}
                      </p>

                      {/* Location & Distance */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{event.locationRaw}</span>
                        </div>
                        {event.distanceMiles !== undefined && (
                          <span>{event.distanceMiles.toFixed(1)} mi away</span>
                        )}
                        {event.tradeAreaName && (
                          <span className="italic">{event.tradeAreaName}</span>
                        )}
                      </div>

                      {/* Impact Metrics */}
                      <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Impact Score:</span>
                          <span className="ml-1 font-semibold text-gray-900">
                            {event.impactScore.toFixed(1)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Decay Score:</span>
                          <span className="ml-1 font-semibold text-gray-900">
                            {event.decayScore.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="mt-2 text-xs text-gray-400">
                        {new Date(event.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventTimeline;
