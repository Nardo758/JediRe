/**
 * Deal News Events Panel
 *
 * Surfaces market events extracted from news articles (source_type='news')
 * that are within a configurable radius of the deal's location.
 *
 * Backed by GET /api/v1/proximity/events/news/by-deal/:dealId.
 */

import React, { useEffect, useState } from 'react';

interface DealNewsEventsPanelProps {
  dealId: string;
  defaultRadiusMiles?: number;
}

interface NewsMarketEvent {
  id: string;
  eventType: string;
  eventName: string;
  eventDescription?: string;
  entityName?: string;
  entityType?: string;
  effectiveDate: string;
  sourceUrl?: string;
  sourceType?: string;
  status?: string;
  confidenceScore?: number;
  latitude?: number;
  longitude?: number;
}

interface ApiResponse {
  dealId: string;
  coordSource: 'deal' | 'city_centroid' | null;
  radiusMiles: number;
  count: number;
  events: NewsMarketEvent[];
  message?: string;
}

const RADIUS_OPTIONS = [1, 3, 5, 10];

export const DealNewsEventsPanel: React.FC<DealNewsEventsPanelProps> = ({
  dealId,
  defaultRadiusMiles = 3,
}) => {
  const [radius, setRadius] = useState<number>(defaultRadiusMiles);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/proximity/events/news/by-deal/${dealId}?radius=${radius}&limit=10`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load news events');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (dealId) load();
    return () => {
      cancelled = true;
    };
  }, [dealId, radius]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📰</span>
            Market News Events
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            News-extracted market events near this deal, sorted by most recent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Radius</label>
          <select
            value={radius}
            onChange={e => setRadius(parseFloat(e.target.value))}
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
          >
            {RADIUS_OPTIONS.map(r => (
              <option key={r} value={r}>{r} mi</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded">
          Loading news events…
        </div>
      )}

      {!loading && error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {!loading && !error && data && data.coordSource === null && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
          {data.message || 'No coordinates resolved for this deal — cannot search for nearby events.'}
        </div>
      )}

      {!loading && !error && data && data.coordSource && data.events.length === 0 && (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
          No news-sourced market events found within {data.radiusMiles} miles
          {data.coordSource === 'city_centroid' ? ' of the deal city centroid.' : ' of this deal.'}
        </div>
      )}

      {!loading && !error && data && data.events.length > 0 && (
        <>
          {data.coordSource === 'city_centroid' && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Showing events near the deal city centroid (deal-level coordinates not set).
            </div>
          )}
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden bg-white">
            {data.events.map(ev => (
              <NewsEventRow key={ev.id} event={ev} />
            ))}
          </ul>
          <div className="text-xs text-gray-500">
            Showing {data.events.length} of up to 10 events within {data.radiusMiles} mi
            {data.coordSource === 'deal' ? ' of the deal location' : ''}.
          </div>
        </>
      )}
    </div>
  );
};

interface NewsEventRowProps {
  event: NewsMarketEvent;
}

const NewsEventRow: React.FC<NewsEventRowProps> = ({ event }) => {
  const date = event.effectiveDate ? new Date(event.effectiveDate) : null;
  const dateStr = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  return (
    <li className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <EventTypeBadge eventType={event.eventType} />
            <span className="text-xs text-gray-500">{dateStr}</span>
            {event.status && (
              <span className="text-xs text-gray-400 uppercase tracking-wide">{event.status}</span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mt-1 truncate">
            {event.eventName}
          </h4>
          {event.entityName && (
            <p className="text-xs text-gray-600 mt-0.5">
              <span className="font-medium">{event.entityName}</span>
              {event.entityType ? ` · ${event.entityType}` : ''}
            </p>
          )}
          {event.eventDescription && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{event.eventDescription}</p>
          )}
        </div>
        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex-shrink-0 mt-1"
          >
            Source ↗
          </a>
        )}
      </div>
    </li>
  );
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  employer_move: 'bg-purple-100 text-purple-800',
  employer_expansion: 'bg-purple-100 text-purple-800',
  employer_layoff: 'bg-red-100 text-red-800',
  transit_opening: 'bg-blue-100 text-blue-800',
  supply_announced: 'bg-amber-100 text-amber-800',
  supply_groundbreaking: 'bg-amber-100 text-amber-800',
  supply_delivery: 'bg-amber-100 text-amber-800',
  infrastructure: 'bg-teal-100 text-teal-800',
  policy_change: 'bg-indigo-100 text-indigo-800',
  economic_shock: 'bg-red-100 text-red-800',
};

const EventTypeBadge: React.FC<{ eventType: string }> = ({ eventType }) => {
  const cls = EVENT_TYPE_COLORS[eventType] || 'bg-gray-100 text-gray-700';
  const label = (eventType || 'unknown').replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
};

export default DealNewsEventsPanel;
