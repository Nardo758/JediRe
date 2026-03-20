import type { ParcelBoundary, Coordinates } from '@/types/design/design3d.types';

export function geoJsonToParcelBoundary(
  geoJson: any,
  parcelId?: string
): ParcelBoundary | null {
  if (!geoJson) return null;

  let coordinates: number[][] = [];

  if (geoJson.type === 'Polygon') {
    coordinates = geoJson.coordinates?.[0] || [];
  } else if (geoJson.type === 'MultiPolygon') {
    coordinates = geoJson.coordinates?.[0]?.[0] || [];
  } else if (geoJson.type === 'Feature') {
    return geoJsonToParcelBoundary(geoJson.geometry, parcelId);
  } else if (geoJson.type === 'FeatureCollection') {
    const firstFeature = geoJson.features?.[0];
    if (firstFeature) return geoJsonToParcelBoundary(firstFeature, parcelId);
    return null;
  } else if (Array.isArray(geoJson)) {
    if (Array.isArray(geoJson[0]?.[0])) {
      coordinates = geoJson[0];
    } else {
      coordinates = geoJson;
    }
  }

  if (coordinates.length < 3) return null;

  const coords: Coordinates[] = coordinates.map((coord) => ({
    lat: coord[1],
    lng: coord[0],
  }));

  const area = calculateAreaSqFt(coords);

  return {
    id: parcelId || `parcel-${Date.now()}`,
    coordinates: coords,
    area,
    extrusionHeight: 2,
    color: '#10b981',
    opacity: 0.3,
  };
}

export function calculateAreaSqFt(coords: Coordinates[]): number {
  if (coords.length < 3) return 0;

  const refLat = coords[0].lat;
  const refLng = coords[0].lng;

  const latToFt = 364000;
  const lngToFt = 364000 * Math.cos((refLat * Math.PI) / 180);

  const projected = coords.map((c) => ({
    x: (c.lng - refLng) * lngToFt,
    y: (c.lat - refLat) * latToFt,
  }));

  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const j = (i + 1) % projected.length;
    area += projected[i].x * projected[j].y;
    area -= projected[j].x * projected[i].y;
  }

  return Math.abs(area / 2);
}
