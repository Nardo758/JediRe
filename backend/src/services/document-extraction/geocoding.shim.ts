/**
 * Thin re-export of the existing GeocodingService singleton so the OM
 * extraction pipeline imports a stable name regardless of whether the
 * upstream service is exported as `geocodingService` (singleton) or as
 * the class. Keeps `om-geo.ts` decoupled from the upstream module shape.
 */

import { geocodingService as upstream } from '../geocoding.service';

export const geocodingService = upstream;
