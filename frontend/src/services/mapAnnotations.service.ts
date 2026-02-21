/**
 * Map Annotations Service
 * Handle CRUD operations for user map annotations (drawings, markers, notes, etc.)
 */

import api from './api';

export interface MapAnnotation {
  id: string;
  user_id: string;
  map_type: 'pipeline' | 'assets' | 'general' | 'deal';
  annotation_type: 'marker' | 'polygon' | 'line' | 'circle' | 'text' | 'rectangle';
  geometry: GeoJSON.Geometry;
  properties: Record<string, any>;
  label?: string;
  description?: string;
  color?: string;
  is_shared: boolean;
  shared_with_user_ids?: string[];
  shared_with_team: boolean;
  measurement_value?: number;
  measurement_unit?: string;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnotationRequest {
  map_type: string;
  annotation_type: string;
  geometry: GeoJSON.Geometry;
  properties?: Record<string, any>;
  label?: string;
  description?: string;
  color?: string;
  is_shared?: boolean;
  shared_with_user_ids?: string[];
  shared_with_team?: boolean;
  measurement_value?: number;
  measurement_unit?: string;
  z_index?: number;
}

export interface UpdateAnnotationRequest {
  geometry?: GeoJSON.Geometry;
  properties?: Record<string, any>;
  label?: string;
  description?: string;
  color?: string;
  is_shared?: boolean;
  shared_with_user_ids?: string[];
  shared_with_team?: boolean;
  measurement_value?: number;
  measurement_unit?: string;
  z_index?: number;
}

export interface AnnotationFilters {
  map_type?: string;
  include_shared?: boolean;
}

class MapAnnotationsService {
  private baseUrl = '/map-annotations';

  /**
   * Get all annotations for a user
   */
  async getAnnotations(filters?: AnnotationFilters): Promise<MapAnnotation[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.map_type) {
        params.append('map_type', filters.map_type);
      }
      if (filters?.include_shared) {
        params.append('include_shared', 'true');
      }

      const url = params.toString() ? `${this.baseUrl}?${params}` : this.baseUrl;
      const response = await api.get(url);

      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch annotations');
    } catch (error) {
      console.error('Error fetching annotations:', error);
      throw error;
    }
  }

  /**
   * Get a specific annotation by ID
   */
  async getAnnotation(id: string): Promise<MapAnnotation> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch annotation');
    } catch (error) {
      console.error('Error fetching annotation:', error);
      throw error;
    }
  }

  /**
   * Create a new annotation
   */
  async createAnnotation(data: CreateAnnotationRequest): Promise<MapAnnotation> {
    try {
      const response = await api.post(this.baseUrl, data);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to create annotation');
    } catch (error) {
      console.error('Error creating annotation:', error);
      throw error;
    }
  }

  /**
   * Update an existing annotation
   */
  async updateAnnotation(id: string, data: UpdateAnnotationRequest): Promise<MapAnnotation> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, data);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to update annotation');
    } catch (error) {
      console.error('Error updating annotation:', error);
      throw error;
    }
  }

  /**
   * Delete an annotation
   */
  async deleteAnnotation(id: string): Promise<void> {
    try {
      const response = await api.delete(`${this.baseUrl}/${id}`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete annotation');
      }
    } catch (error) {
      console.error('Error deleting annotation:', error);
      throw error;
    }
  }

  /**
   * Delete all annotations for a map type
   */
  async deleteAllAnnotations(mapType?: string): Promise<number> {
    try {
      const params = new URLSearchParams({ confirm: 'true' });
      if (mapType) {
        params.append('map_type', mapType);
      }

      const response = await api.delete(`${this.baseUrl}?${params}`);
      if (response.data.success) {
        return response.data.deletedCount;
      }
      throw new Error(response.data.error || 'Failed to delete annotations');
    } catch (error) {
      console.error('Error deleting annotations:', error);
      throw error;
    }
  }

  /**
   * Export annotations as GeoJSON
   */
  async exportAnnotations(mapType?: string): Promise<GeoJSON.FeatureCollection> {
    try {
      const response = await api.post(`${this.baseUrl}/export`, {
        map_type: mapType,
        format: 'geojson',
      });

      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to export annotations');
    } catch (error) {
      console.error('Error exporting annotations:', error);
      throw error;
    }
  }

  /**
   * Import annotations from GeoJSON
   */
  async importAnnotations(
    geojson: GeoJSON.FeatureCollection,
    mapType: string
  ): Promise<{ imported: number; errors: number }> {
    try {
      const response = await api.post(`${this.baseUrl}/import`, {
        geojson,
        map_type: mapType,
      });

      if (response.data.success) {
        return {
          imported: response.data.imported,
          errors: response.data.errors,
        };
      }
      throw new Error(response.data.error || 'Failed to import annotations');
    } catch (error) {
      console.error('Error importing annotations:', error);
      throw error;
    }
  }

  /**
   * Download annotations as GeoJSON file
   */
  async downloadAsGeoJSON(mapType?: string, filename: string = 'map-annotations.geojson'): Promise<void> {
    try {
      const geojson = await this.exportAnnotations(mapType);
      const blob = new Blob([JSON.stringify(geojson, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading annotations:', error);
      throw error;
    }
  }

  /**
   * Convert Mapbox Draw feature to annotation format
   */
  mapboxFeatureToAnnotation(
    feature: any,
    mapType: string,
    additionalProps?: Partial<CreateAnnotationRequest>
  ): CreateAnnotationRequest {
    // Determine annotation type from Mapbox Draw feature
    let annotationType: CreateAnnotationRequest['annotation_type'] = 'polygon';
    const geomType = feature.geometry.type;

    if (geomType === 'Point') {
      annotationType = 'marker';
    } else if (geomType === 'LineString') {
      annotationType = 'line';
    } else if (geomType === 'Polygon') {
      annotationType = feature.properties?.drawType === 'circle' ? 'circle' : 'polygon';
    }

    return {
      map_type: mapType,
      annotation_type: annotationType,
      geometry: feature.geometry,
      properties: feature.properties || {},
      color: feature.properties?.color || '#3B82F6',
      label: feature.properties?.label,
      description: feature.properties?.description,
      ...additionalProps,
    };
  }

  /**
   * Convert annotation to Mapbox Draw feature
   */
  annotationToMapboxFeature(annotation: MapAnnotation): any {
    return {
      id: annotation.id,
      type: 'Feature',
      geometry: annotation.geometry,
      properties: {
        ...annotation.properties,
        color: annotation.color,
        label: annotation.label,
        description: annotation.description,
        annotation_type: annotation.annotation_type,
      },
    };
  }

  /**
   * Calculate distance for a line annotation
   */
  calculateLineDistance(coordinates: number[][]): { miles: number; km: number } {
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lng1, lat1] = coordinates[i];
      const [lng2, lat2] = coordinates[i + 1];
      totalDistance += this.haversineDistance(lat1, lng1, lat2, lng2);
    }
    return {
      miles: totalDistance / 1609.34,
      km: totalDistance / 1000,
    };
  }

  /**
   * Calculate area for a polygon annotation
   */
  calculatePolygonArea(coordinates: number[][][]): { sqMiles: number; acres: number } {
    // This is a simplified calculation - for accurate results, use turf.js
    const ring = coordinates[0];
    let area = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      area += (lng2 - lng1) * (lat2 + lat1);
    }

    area = Math.abs(area) / 2;

    // Convert to square miles (rough approximation)
    const sqMiles = area * 3090; // Approximate conversion factor
    const acres = sqMiles * 640;

    return { sqMiles, acres };
  }

  /**
   * Haversine distance calculation (meters)
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const mapAnnotationsService = new MapAnnotationsService();
export default mapAnnotationsService;
