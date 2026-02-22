import { useRef, useState, useEffect, useCallback } from 'react';
import Map, { Source, Layer, MapRef, Marker } from 'react-map-gl';
import { MapPinIcon, NewspaperIcon } from '@heroicons/react/24/solid';
import type { Deal } from '@/types';
import type {
  AssetNewsLink,
  AssetNote,
  MapFilters,
  MapLayers,
  NewsEvent,
} from '@/types/asset';
import MapLayerToggle from './MapLayerToggle';
import NewsEventPopup from './NewsEventPopup';
import NotePopup from './NotePopup';
import AddNoteModal from './AddNoteModal';
import { cn } from '@/utils/cn';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface MapViewProps {
  deal: Deal;
  permission?: 'view' | 'edit' | 'admin';
}

// Mock data - will be replaced with API calls
const mockNewsEvents: AssetNewsLink[] = [
  {
    id: '1',
    assetId: 'deal-1',
    newsEventId: 'news-1',
    linkType: 'auto',
    distanceMiles: 1.2,
    impactScore: 8,
    linkedAt: new Date().toISOString(),
    newsEvent: {
      id: 'news-1',
      title: 'Amazon Opens Distribution Center',
      date: '2026-02-08',
      type: 'employment',
      location: { lat: 33.801, lng: -84.401 },
      impactScore: 8,
      description: 'Expected +350 units housing demand within 3 years.',
    },
  },
  {
    id: '2',
    assetId: 'deal-1',
    newsEventId: 'news-2',
    linkType: 'auto',
    distanceMiles: 2.5,
    impactScore: 6,
    linkedAt: new Date().toISOString(),
    newsEvent: {
      id: 'news-2',
      title: 'New Transit Station Approved',
      date: '2026-02-10',
      type: 'infrastructure',
      location: { lat: 33.795, lng: -84.395 },
      impactScore: 6,
      description: 'MARTA expansion approved for 2027 completion.',
    },
  },
];

const mockNotes: AssetNote[] = [
  {
    id: 'note-1',
    assetId: 'deal-1',
    noteType: 'location',
    title: 'Site Visit - Parking Lot',
    content: 'Needs resurfacing. Est $15K',
    category: {
      id: 'cat-1',
      name: 'Issue',
      color: '#EF4444',
      icon: '⚠️',
    },
    location: { lat: 33.800, lng: -84.400 },
    attachments: [],
    totalAttachmentSizeBytes: 0,
    replyCount: 2,
    author: {
      id: 'user-1',
      name: 'Leon D',
    },
    authorId: 'user-1',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    isPrivate: false,
  },
];

export default function MapView({ deal, permission = 'view' }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: deal.boundary?.coordinates?.[0]?.[0]?.[0] || -84.4,
    latitude: deal.boundary?.coordinates?.[0]?.[0]?.[1] || 33.8,
    zoom: 14,
  });

  const [selectedNews, setSelectedNews] = useState<AssetNewsLink | null>(null);
  const [selectedNote, setSelectedNote] = useState<AssetNote | null>(null);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteLocation, setNewNoteLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data - replace with actual API calls
  const [newsLinks, setNewsLinks] = useState<AssetNewsLink[]>(mockNewsEvents);
  const [notes, setNotes] = useState<AssetNote[]>(mockNotes);

  const [filters, setFilters] = useState<MapFilters>({
    radiusMiles: 5,
    newsTypes: ['employment', 'development', 'infrastructure', 'transaction'],
    impactLevels: ['high', 'medium'],
    noteCategories: [],
    showDismissedNews: false,
  });

  const [layers, setLayers] = useState<MapLayers>({
    propertyBoundary: true,
    newsEvents: true,
    myNotes: true,
    teamNotes: true,
    supplyPipeline: false,
    comparables: false,
  });

  useEffect(() => {
    // Simulate API loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [deal.id]);

  const propertyBoundaryData = deal.boundary
    ? {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: deal.boundary,
            properties: {},
          },
        ],
      }
    : null;

  const handleMapClick = useCallback(
    (event: any) => {
      if (permission !== 'view' && !selectedNews && !selectedNote) {
        const { lngLat } = event;
        setNewNoteLocation({ lat: lngLat.lat, lng: lngLat.lng });
        setShowAddNoteModal(true);
      }
    },
    [permission, selectedNews, selectedNote]
  );

  const handleAddNote = useCallback(
    (noteData: Partial<AssetNote>) => {
      // TODO: Replace with API call
      const newNote: AssetNote = {
        id: `note-${Date.now()}`,
        assetId: deal.id,
        noteType: 'location',
        content: noteData.content || '',
        title: noteData.title,
        category: noteData.category,
        location: newNoteLocation || undefined,
        attachments: [],
        totalAttachmentSizeBytes: 0,
        replyCount: 0,
        author: {
          id: 'current-user',
          name: 'You',
        },
        authorId: 'current-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPrivate: noteData.isPrivate || false,
      };
      setNotes([...notes, newNote]);
      setShowAddNoteModal(false);
      setNewNoteLocation(null);
    },
    [deal.id, newNoteLocation, notes]
  );

  const handleDismissNews = useCallback(
    (newsLinkId: string) => {
      // TODO: Replace with API call
      setNewsLinks(newsLinks.filter((link) => link.id !== newsLinkId));
      setSelectedNews(null);
    },
    [newsLinks]
  );

  const filteredNewsLinks = newsLinks.filter((link) => {
    if (link.linkType === 'dismissed' && !filters.showDismissedNews) return false;
    if (!link.newsEvent) return false;
    if (!filters.newsTypes.includes(link.newsEvent.type)) return false;
    if (link.distanceMiles && link.distanceMiles > filters.radiusMiles) return false;

    const impactLevel =
      (link.impactScore || 0) >= 7 ? 'high' : (link.impactScore || 0) >= 4 ? 'medium' : 'low';
    if (!filters.impactLevels.includes(impactLevel)) return false;

    return true;
  });

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Map View</h2>
          <p className="text-gray-600 mb-4">
            To enable the interactive map, add a Mapbox token to your environment variables.
          </p>
          <p className="text-sm text-gray-500">
            Set <code className="bg-gray-100 px-2 py-1 rounded">VITE_MAPBOX_TOKEN</code> in your
            .env file
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Map</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
        cursor={permission !== 'view' ? 'crosshair' : 'grab'}
      >
        {/* Property Boundary */}
        {layers.propertyBoundary && propertyBoundaryData && (
          <Source id="property-boundary" type="geojson" data={propertyBoundaryData}>
            <Layer
              id="property-boundary-fill"
              type="fill"
              paint={{
                'fill-color': '#3B82F6',
                'fill-opacity': 0.1,
              }}
            />
            <Layer
              id="property-boundary-outline"
              type="line"
              paint={{
                'line-color': '#3B82F6',
                'line-width': 2,
                'line-dasharray': [2, 2],
              }}
            />
          </Source>
        )}

        {/* News Event Markers */}
        {layers.newsEvents &&
          filteredNewsLinks.map((link) => {
            if (!link.newsEvent?.location) return null;
            return (
              <Marker
                key={link.id}
                longitude={link.newsEvent.location.lng}
                latitude={link.newsEvent.location.lat}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedNews(link);
                  setSelectedNote(null);
                }}
              >
                <div className="relative cursor-pointer group">
                  <div
                    className={cn(
                      'p-2 rounded-full shadow-lg transition-all duration-200',
                      'bg-red-500 hover:bg-red-600 hover:scale-110',
                      selectedNews?.id === link.id && 'ring-4 ring-red-300 scale-110'
                    )}
                  >
                    <NewspaperIcon className="w-5 h-5 text-white" />
                  </div>
                  {link.impactScore && (
                    <div className="absolute -top-1 -right-1 bg-white text-red-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                      {link.impactScore}
                    </div>
                  )}
                </div>
              </Marker>
            );
          })}

        {/* Note Markers */}
        {layers.myNotes &&
          notes
            .filter((note) => note.location && note.noteType === 'location')
            .map((note) => {
              if (!note.location) return null;
              return (
                <Marker
                  key={note.id}
                  longitude={note.location.lng}
                  latitude={note.location.lat}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedNote(note);
                    setSelectedNews(null);
                  }}
                >
                  <div className="relative cursor-pointer group">
                    <div
                      className={cn(
                        'p-2 rounded-full shadow-lg transition-all duration-200',
                        'hover:scale-110',
                        selectedNote?.id === note.id && 'ring-4 ring-yellow-300 scale-110'
                      )}
                      style={{
                        backgroundColor: note.category?.color || '#F59E0B',
                      }}
                    >
                      <MapPinIcon className="w-5 h-5 text-white" />
                    </div>
                    {note.replyCount > 0 && (
                      <div className="absolute -top-1 -right-1 bg-white text-gray-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                        {note.replyCount}
                      </div>
                    )}
                  </div>
                </Marker>
              );
            })}
      </Map>

      {/* Layer Toggle Panel */}
      <div className="absolute top-4 right-4 z-10">
        <MapLayerToggle
          layers={layers}
          filters={filters}
          onLayersChange={setLayers}
          onFiltersChange={setFilters}
          newsCount={filteredNewsLinks.length}
          notesCount={notes.length}
        />
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
        <button
          onClick={() => {
            mapRef.current?.flyTo({
              zoom: viewState.zoom + 1,
              duration: 300,
            });
          }}
          className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
          aria-label="Zoom in"
        >
          <span className="text-xl font-bold">+</span>
        </button>
        <button
          onClick={() => {
            mapRef.current?.flyTo({
              zoom: viewState.zoom - 1,
              duration: 300,
            });
          }}
          className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
          aria-label="Zoom out"
        >
          <span className="text-xl font-bold">−</span>
        </button>
      </div>

      {/* Add Note Button (only for edit/admin) */}
      {permission !== 'view' && (
        <div className="absolute bottom-6 left-6 z-10">
          <button
            onClick={() => {
              // Set default location to center of property
              setNewNoteLocation({
                lat: viewState.latitude,
                lng: viewState.longitude,
              });
              setShowAddNoteModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <MapPinIcon className="w-5 h-5" />
            <span>Add Note</span>
          </button>
        </div>
      )}

      {/* News Event Popup */}
      {selectedNews && selectedNews.newsEvent && (
        <NewsEventPopup
          newsLink={selectedNews}
          onClose={() => setSelectedNews(null)}
          onDismiss={() => handleDismissNews(selectedNews.id)}
          canDismiss={permission !== 'view'}
        />
      )}

      {/* Note Popup */}
      {selectedNote && (
        <NotePopup
          note={selectedNote}
          onClose={() => setSelectedNote(null)}
          permission={permission || 'view'}
        />
      )}

      {/* Add Note Modal */}
      {showAddNoteModal && newNoteLocation && (
        <AddNoteModal
          location={newNoteLocation}
          onClose={() => {
            setShowAddNoteModal(false);
            setNewNoteLocation(null);
          }}
          onSave={handleAddNote}
        />
      )}
    </div>
  );
}
