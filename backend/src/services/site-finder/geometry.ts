import area from '@turf/area';
import union from '@turf/union';
import { SiteParcel } from '../../types/site-finder';
export type ParcelGeometry = NonNullable<SiteParcel['geometry']>;
function signed(r: number[][]) {
  return r.reduce((sum, p, i) => { const next = r[(i + 1) % r.length]; return sum + p[0] * next[1] - next[0] * p[1]; }, 0) / 2;
}
function contains(point: number[], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** ArcGIS exterior rings are clockwise; retain holes and separate islands. */
export function fromEsri(rings: number[][][]): ParcelGeometry {
  if (!rings?.length || rings.some(r => r.length < 4 || r.some(p => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])))) throw new Error('Invalid official polygon geometry');
  const outer = rings.filter(r => signed(r) < 0).map(r => [r]);
  if (!outer.length) throw new Error('Official polygon winding could not be verified');
  for (const hole of rings.filter(r => signed(r) >= 0)) {
    const owner = outer.filter(p => contains(hole[0], p[0]));
    if (owner.length !== 1) throw new Error('Official polygon hole membership is ambiguous');
    owner[0].push(hole);
  }
  return outer.length === 1 ? { type: 'Polygon', coordinates: outer[0] } : { type: 'MultiPolygon', coordinates: outer };
}
export const esriRings = (g: ParcelGeometry) => g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
export const geometryArea = (geometry: ParcelGeometry) => area({ type: 'Feature', geometry, properties: {} } as any);
/** Positive-area overlap avoids treating adjacent shared edges as split zoning. */
export function overlapArea(a: ParcelGeometry, b: ParcelGeometry) {
  const merged = union({ type: 'FeatureCollection', features: [a,b].map(geometry => ({ type: 'Feature', geometry, properties: {} })) } as any);
  if (!merged) throw new Error('Official boundary intersection failed');
  return Math.max(0, geometryArea(a) + geometryArea(b) - area(merged));
}