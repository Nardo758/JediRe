import { useState, useCallback } from 'react';
import axios from 'axios';
import apiClient from '../services/api.client';
import type { ZoningLookupResult, ZoningDistrict, DevelopmentParameters, PermittedUse, StrategyAlignment } from '../types/zoning.types';

interface UseZoningLookupReturn {
  result: ZoningLookupResult | null;
  loading: boolean;
  error: string | null;
  lookup: (address: string) => Promise<void>;
  clear: () => void;
}

export function useZoningLookup(): UseZoningLookupReturn {
  const [result, setResult] = useState<ZoningLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (address: string) => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let cityName = '';
      let stateName = '';
      let municipalityId = '';

      const addressParts = address.split(',').map(p => p.trim());
      if (addressParts.length >= 2) {
        cityName = addressParts[addressParts.length - 2] || '';
        const stateZip = addressParts[addressParts.length - 1] || '';
        stateName = stateZip.replace(/\d+/g, '').trim();
      }

      try {
        const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
        if (mapboxToken) {
          const geoRes = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
            { params: { access_token: mapboxToken, types: 'address,poi', limit: 1 } }
          );
          if (geoRes.data.features?.length > 0) {
            const [lng, lat] = geoRes.data.features[0].center;
            try {
              const revRes = await apiClient.get('/api/v1/reverse-geocode', { params: { lat, lng } });
              const revData = revRes.data;
              if (revData?.found || revData?.city) {
                cityName = revData.city || cityName;
                stateName = revData.state || stateName;
                municipalityId = revData.municipality?.id || '';
              }
            } catch {}
          }
        }
      } catch {}

      if (!cityName) {
        setError('Could not determine city from address. Try entering the city name.');
        setResult(null);
        setLoading(false);
        return;
      }

      const lookupRes = await apiClient.get('/api/v1/zoning/lookup', {
        params: { city: cityName, address }
      });
      const lookupData = lookupRes.data;

      if (!lookupData?.found || !lookupData.districts?.length) {
        setError(`No zoning data found for ${cityName}. The municipality may not be in our database yet.`);
        setResult(null);
        setLoading(false);
        return;
      }

      const rawDistrict = lookupData.districts[0];
      const districtCode = rawDistrict.zoning_code || rawDistrict.district_code || rawDistrict.code || '';

      let detailDistrict: any = null;
      try {
        const detailParams: Record<string, string> = { code: districtCode };
        if (municipalityId) detailParams.municipality_id = municipalityId;
        else if (cityName) detailParams.municipality = cityName;

        const detailRes = await apiClient.get('/api/v1/zoning-districts/by-code', { params: detailParams });
        if (detailRes.data?.found) {
          detailDistrict = detailRes.data.district;
        }
      } catch {}

      const d = detailDistrict || rawDistrict;

      const district: ZoningDistrict = {
        id: d.id || '',
        code: districtCode,
        name: d.district_name || d.name || districtCode,
        municipalityId: municipalityId || lookupData.municipality?.id || '',
        municipality: lookupData.municipality?.name || cityName,
        state: lookupData.municipality?.state || stateName,
        maxDensityPerAcre: d.max_density_per_acre ?? d.max_density ?? d.max_units_per_acre ?? null,
        maxHeightFeet: d.max_height_feet ?? d.max_height ?? d.max_building_height_ft ?? null,
        maxFar: d.max_far ?? null,
        maxStories: d.max_stories ?? null,
        maxLotCoveragePercent: d.max_lot_coverage_percent ?? d.max_lot_coverage ?? null,
        minOpenSpacePercent: d.min_open_space_percent ?? null,
        setbackFrontFt: d.setback_front_ft ?? d.min_front_setback_ft ?? null,
        setbackSideFt: d.setback_side_ft ?? d.min_side_setback_ft ?? null,
        setbackRearFt: d.setback_rear_ft ?? d.min_rear_setback_ft ?? null,
        minParkingPerUnit: d.min_parking_per_unit ?? null,
        guestParkingPerUnit: d.guest_parking_per_unit ?? null,
        commercialParkingPer1000sf: d.commercial_parking_per_1000sf ?? null,
        bicycleParkingPerUnit: d.bicycle_parking_per_unit ?? null,
        source: d.source || 'database',
        lastAmended: d.last_amended ?? d.verified_at ?? null,
        codeReference: d.code_reference ?? d.municode_section ?? null,
        specialConditions: d.special_conditions ?? null,
      };

      const parameters: DevelopmentParameters = {
        maxDensity: district.maxDensityPerAcre,
        maxHeight: district.maxHeightFeet,
        maxFar: district.maxFar,
        maxLotCoverage: district.maxLotCoveragePercent,
        minOpenSpace: district.minOpenSpacePercent,
        setbacks: {
          front: district.setbackFrontFt,
          side: district.setbackSideFt,
          rear: district.setbackRearFt,
        },
        parking: {
          residential: district.minParkingPerUnit,
          guest: district.guestParkingPerUnit,
          commercial: district.commercialParkingPer1000sf,
          bicycle: district.bicycleParkingPerUnit,
        },
        aiNotes: [],
      };

      const permittedUses: PermittedUse[] = d.permitted_uses || [
        { name: 'Multi-family Residential', category: 'by_right' as const },
        { name: 'Single-family Attached', category: 'by_right' as const },
        { name: 'Neighborhood Commercial', category: 'conditional' as const },
        { name: 'Mixed Use', category: 'conditional' as const },
      ];

      const strategyAlignment: StrategyAlignment[] = [
        {
          strategy: 'Ground-Up Development',
          status: district.maxDensityPerAcre && district.maxDensityPerAcre >= 20 ? 'compatible' : 'conditional',
          note: district.maxDensityPerAcre
            ? `${district.maxDensityPerAcre} du/ac supports medium-to-high density`
            : 'Density limits not confirmed',
        },
        {
          strategy: 'Value-Add Repositioning',
          status: 'compatible',
          note: 'Existing use likely conforms to current zoning',
        },
      ];

      const zoningResult: ZoningLookupResult = {
        district,
        parameters,
        permittedUses,
        strategyAlignment,
        variancePotential: null,
      };

      setResult(zoningResult);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to lookup zoning data';
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, lookup, clear };
}
