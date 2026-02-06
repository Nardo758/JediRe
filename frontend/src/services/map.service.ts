import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

mapboxgl.accessToken = MAPBOX_TOKEN;

export interface MapOptions {
  container: string | HTMLElement;
  center?: [number, number];
  zoom?: number;
  style?: string;
}

export class MapService {
  private map: mapboxgl.Map | null = null;
  private draw: MapboxDraw | null = null;
  private markers: mapboxgl.Marker[] = [];

  initialize(options: MapOptions): mapboxgl.Map {
    this.map = new mapboxgl.Map({
      container: options.container,
      style: options.style || 'mapbox://styles/mapbox/streets-v12',
      center: options.center || [-84.3880, 33.7490], // Atlanta
      zoom: options.zoom || 12,
    });

    // Add navigation controls
    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add fullscreen control
    this.map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Add geolocate control
    this.map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
      'top-right'
    );

    return this.map;
  }

  enableDrawing(): MapboxDraw {
    if (!this.map) throw new Error('Map not initialized');

    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'draw_polygon',
    });

    this.map.addControl(this.draw, 'top-left');

    return this.draw;
  }

  getDrawnPolygon(): GeoJSON.Feature | null {
    if (!this.draw) return null;

    const data = this.draw.getAll();
    return data.features.length > 0 ? data.features[0] : null;
  }

  clearDrawing() {
    if (this.draw) {
      this.draw.deleteAll();
    }
  }

  addPropertyMarkers(properties: any[]) {
    // Clear existing markers
    this.clearMarkers();

    if (!this.map) return;

    properties.forEach((property) => {
      const el = document.createElement('div');
      el.className = 'property-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = this.getMarkerColor(property.building_class);
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([property.lng, property.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; min-width: 200px;">
              <h3 style="font-weight: bold; margin-bottom: 8px;">${property.address}</h3>
              <p style="font-size: 18px; color: #2563eb; font-weight: bold;">$${property.rent.toLocaleString()}/mo</p>
              <p style="font-size: 14px; color: #666;">${property.beds} bd • ${property.baths} ba • ${property.sqft} sqft</p>
              ${property.building_class ? `<span style="display: inline-block; margin-top: 4px; padding: 2px 8px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-size: 12px;">Class ${property.building_class}</span>` : ''}
            </div>
          `)
        )
        .addTo(this.map!);

      this.markers.push(marker);
    });
  }

  private getMarkerColor(buildingClass?: string): string {
    const colors: Record<string, string> = {
      'A+': '#10b981',
      'A': '#3b82f6',
      'A-': '#6366f1',
      'B+': '#8b5cf6',
      'B': '#a855f7',
      'B-': '#d946ef',
      'C+': '#ec4899',
      'C': '#f43f5e',
      'C-': '#ef4444',
    };
    return colors[buildingClass || ''] || '#6b7280';
  }

  clearMarkers() {
    this.markers.forEach((marker) => marker.remove());
    this.markers = [];
  }

  addBoundary(geojson: GeoJSON.Feature) {
    if (!this.map) return;

    // Remove existing boundary layer if it exists
    if (this.map.getLayer('boundary-fill')) {
      this.map.removeLayer('boundary-fill');
    }
    if (this.map.getLayer('boundary-outline')) {
      this.map.removeLayer('boundary-outline');
    }
    if (this.map.getSource('boundary')) {
      this.map.removeSource('boundary');
    }

    // Add boundary source
    this.map.addSource('boundary', {
      type: 'geojson',
      data: geojson,
    });

    // Add fill layer
    this.map.addLayer({
      id: 'boundary-fill',
      type: 'fill',
      source: 'boundary',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.2,
      },
    });

    // Add outline layer
    this.map.addLayer({
      id: 'boundary-outline',
      type: 'line',
      source: 'boundary',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 3,
      },
    });

    // Fit bounds to boundary
    const coordinates = (geojson.geometry as any).coordinates[0];
    const bounds = coordinates.reduce(
      (bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
        return bounds.extend(coord as [number, number]);
      },
      new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
    );

    this.map.fitBounds(bounds, {
      padding: 50,
    });
  }

  destroy() {
    this.clearMarkers();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  getMap(): mapboxgl.Map | null {
    return this.map;
  }
}

export const mapService = new MapService();
