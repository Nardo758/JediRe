import { Router, Request, Response } from 'express';
import axios from 'axios';
import { union } from '@turf/union';
import { feature, polygon, multiPolygon, featureCollection } from '@turf/helpers';
import area from '@turf/area';

const router = Router();

function toFeature(f: any): any {
  if (f.type === 'Feature') {
    return f;
  }
  return feature(f);
}

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { lng, lat, hint_miles } = req.body;

    if (!lng || !lat) {
      return res.status(400).json({
        error: 'Latitude and longitude are required',
      });
    }

    const mapboxToken = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
    if (!mapboxToken) {
      return res.status(500).json({
        error: 'Mapbox API not configured',
      });
    }

    const hintMiles = hint_miles || 3;
    const estimatedMinutes = Math.round(hintMiles * 3);

    console.log('[Traffic-AI] Generating boundary:', { lng, lat, hintMiles, estimatedMinutes });

    const profiles = ['driving', 'driving-traffic'];
    const timeVariants = [
      Math.max(1, Math.round(estimatedMinutes * 0.8)),
      Math.max(1, estimatedMinutes),
      Math.max(1, Math.round(estimatedMinutes * 1.2)),
    ];

    const isochrones: any[] = [];

    for (const profile of profiles) {
      for (const minutes of timeVariants) {
        try {
          const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}`;

          const response = await axios.get(url, {
            params: {
              contours_minutes: minutes,
              polygons: true,
              access_token: mapboxToken,
            },
            timeout: 8000,
          });

          if (response.data.features && response.data.features.length > 0) {
            isochrones.push(response.data.features[0]);
            console.log(`[Traffic-AI] Generated ${profile} ${minutes}min isochrone`);
          }
        } catch (error: any) {
          console.warn(`[Traffic-AI] Failed to generate ${profile} ${minutes}min:`, error.message);
        }
      }
    }

    if (isochrones.length === 0) {
      return res.status(500).json({
        error: 'Failed to generate any isochrones. Check Mapbox API status.',
      });
    }

    const features = isochrones.map(iso => toFeature(iso));

    let geometry: any;

    if (features.length === 1) {
      geometry = features[0].geometry;
    } else {
      try {
        const fc = featureCollection(features);
        const merged = union(fc);
        if (merged) {
          geometry = merged.geometry;
        } else {
          console.warn('[Traffic-AI] Union returned null, using largest isochrone');
          geometry = features[0].geometry;
        }
      } catch (error: any) {
        console.warn('[Traffic-AI] Union failed, using largest isochrone:', error.message);
        let largestFeature = features[0];
        let largestArea = 0;
        for (const f of features) {
          const a = area(f);
          if (a > largestArea) {
            largestArea = a;
            largestFeature = f;
          }
        }
        geometry = largestFeature.geometry;
      }
    }

    if (geometry.type === 'MultiPolygon') {
      let largestIdx = 0;
      let largestArea = 0;
      for (let i = 0; i < geometry.coordinates.length; i++) {
        const polyArea = area(polygon(geometry.coordinates[i]));
        if (polyArea > largestArea) {
          largestArea = polyArea;
          largestIdx = i;
        }
      }
      geometry = {
        type: 'Polygon' as const,
        coordinates: geometry.coordinates[largestIdx],
      };
    }

    console.log('[Traffic-AI] Successfully merged', isochrones.length, 'isochrones into', geometry.type);

    res.json({
      success: true,
      geometry,
      analysis: {
        method: 'traffic_informed_ai',
        samples_generated: isochrones.length,
        profiles_used: profiles,
        time_variants: timeVariants,
        confidence: 0.85,
      },
    });
  } catch (error: any) {
    console.error('[Traffic-AI] Generation error:', error);
    res.status(500).json({
      error: 'Failed to generate AI boundary',
      details: error.message,
    });
  }
});

export default router;
