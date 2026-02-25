import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  Search,
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface ZoningConfirmTabProps {
  deal?: any;
  dealId?: string;
  onConfirm?: (zoningData: any) => void;
}

interface DetectedZoning {
  code: string;
  name: string;
  municipality: string;
  state: string;
  confidence: number;
  source: 'boundary' | 'address' | 'manual';
}

interface ZoningDistrict {
  id: string;
  zoning_code: string;
  district_name: string;
  category?: string;
  max_density?: number;
  max_far?: number;
  max_height?: number;
  max_stories?: number;
}

export default function ZoningConfirmTab({ deal, dealId, onConfirm }: ZoningConfirmTabProps) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedZoning, setDetectedZoning] = useState<DetectedZoning | null>(null);
  const [availableDistricts, setAvailableDistricts] = useState<ZoningDistrict[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [districtSearch, setDistrictSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [locationInfo, setLocationInfo] = useState<{ city: string; state: string } | null>(null);

  useEffect(() => {
    fetchZoningFromBoundary();
  }, [dealId]);

  const fetchZoningFromBoundary = async () => {
    if (!dealId) {
      setError('No deal ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const boundaryRes = await apiClient.get(`/api/v1/deals/${dealId}/boundary`);
      const boundary = boundaryRes.data;

      if (!boundary?.centroid) {
        setError('No property boundary found. Please complete Step 1 first.');
        setLoading(false);
        return;
      }

      const centroidStr = typeof boundary.centroid === 'string' ? boundary.centroid : `(${boundary.centroid[0]},${boundary.centroid[1]})`;
      const match = centroidStr.match(/\(([^,]+),([^)]+)\)/);
      if (!match) {
        setError('Invalid boundary centroid data. Please redraw the boundary.');
        setLoading(false);
        return;
      }
      const [lng, lat] = [parseFloat(match[1]), parseFloat(match[2])];

      const reverseGeoRes = await apiClient.get('/api/v1/reverse-geocode', {
        params: { lat, lng },
      });

      const location = reverseGeoRes.data;
      const cityName = location?.city || location?.municipality?.name || '';
      const stateName = location?.state || location?.municipality?.state || '';

      if (!cityName) {
        setError('Could not determine city from boundary location. Try manual entry.');
        setLoading(false);
        return;
      }

      setLocationInfo({ city: cityName, state: stateName });

      const zoningRes = await apiClient.get('/api/v1/zoning/lookup', {
        params: {
          city: cityName,
          address: deal?.address || boundary.address,
        },
      });

      const zoningData = zoningRes.data;

      if (zoningData?.found && zoningData.districts?.length > 0) {
        const districts: ZoningDistrict[] = zoningData.districts;
        setAvailableDistricts(districts);

        const addressUpper = (deal?.address || '').toUpperCase();
        let bestMatch = districts[0];

        const residentialCodes = districts.filter(d => {
          const code = (d.zoning_code || '').toUpperCase();
          return code.startsWith('R-') || code.startsWith('MR-') || code.startsWith('RG-');
        });
        if (residentialCodes.length > 0) {
          bestMatch = residentialCodes[0];
        }

        setSelectedDistrictId(bestMatch.id);
        setDetectedZoning({
          code: bestMatch.zoning_code,
          name: bestMatch.district_name,
          municipality: cityName,
          state: stateName,
          confidence: location?.municipality?.id ? 0.85 : 0.7,
          source: 'boundary',
        });
      } else {
        setError(`No zoning data found for ${cityName}, ${stateName}. You can enter it manually.`);
      }
    } catch (err: any) {
      console.error('Error fetching zoning:', err);
      setError(err.response?.data?.error || 'Failed to detect zoning. Try manual entry.');
    } finally {
      setLoading(false);
    }
  };

  const handleDistrictSelect = (district: ZoningDistrict) => {
    setSelectedDistrictId(district.id);
    setDetectedZoning(prev => prev ? {
      ...prev,
      code: district.zoning_code,
      name: district.district_name,
    } : {
      code: district.zoning_code,
      name: district.district_name,
      municipality: locationInfo?.city || '',
      state: locationInfo?.state || '',
      confidence: 0.85,
      source: 'boundary',
    });
  };

  const handleConfirm = async () => {
    if (!detectedZoning && !manualCode) return;

    setAnalyzing(true);
    setError(null);

    try {
      const zoneCode = detectedZoning?.code || manualCode;

      const boundaryRes = await apiClient.get(`/api/v1/deals/${dealId}/boundary`);
      const boundary = boundaryRes.data;

      const analysisPayload = {
        dealId,
        zoningCode: zoneCode,
        municipality: detectedZoning?.municipality || locationInfo?.city,
        state: detectedZoning?.state || locationInfo?.state,
        landAreaSf: boundary.parcel_area_sf || boundary.parcelAreaSF || (boundary.parcel_area || boundary.parcelArea || 0) * 43560,
        dealType: deal?.strategy || deal?.dealType || 'BTS',
        boundaryId: boundary.id,
        setbacks: boundary.setbacks,
      };

      let analysisData = null;
      try {
        const analysisRes = await apiClient.post('/api/v1/zoning-intelligence/analyze', analysisPayload);
        analysisData = analysisRes.data;
      } catch {
      }

      const enrichedZoning = {
        ...detectedZoning,
        code: zoneCode,
        analysisData,
        confirmed: true,
      };

      await apiClient.post(`/api/v1/deals/${dealId}/zoning-confirmation`, {
        zoning_code: zoneCode,
        municipality: detectedZoning?.municipality || locationInfo?.city,
        state: detectedZoning?.state || locationInfo?.state,
        confirmed_at: new Date().toISOString(),
      });

      if (onConfirm) {
        onConfirm(enrichedZoning);
      }
    } catch (err: any) {
      console.error('Error analyzing zoning:', err);
      setError(err.response?.data?.error || 'Failed to save zoning confirmation');
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredDistricts = availableDistricts.filter(d => {
    if (!districtSearch) return true;
    const search = districtSearch.toUpperCase();
    return (
      (d.zoning_code || '').toUpperCase().includes(search) ||
      (d.district_name || '').toUpperCase().includes(search) ||
      (d.category || '').toUpperCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Detecting zoning from property boundary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Confirm Zoning District</h3>
            <p className="text-sm text-gray-600">
              {detectedZoning
                ? 'We detected available zoning districts from your property boundary. Select the correct one and confirm.'
                : 'We could not auto-detect the zoning district. You can enter it manually below.'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Could not auto-detect zoning</p>
            <p className="text-sm text-amber-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {detectedZoning && !manualEntry && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Detected Location</span>
              </div>
              <p className="text-base font-medium text-gray-900">
                {detectedZoning.municipality}, {detectedZoning.state}
              </p>
            </div>
            <div className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded">
              {availableDistricts.length} districts available
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Selected Zoning District</p>
                <p className="text-2xl font-bold text-gray-900 mb-1">{detectedZoning.code}</p>
                <p className="text-sm text-gray-600">{detectedZoning.name}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>

          {availableDistricts.length > 1 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-700 mb-2">
                Not the right district? Select from {availableDistricts.length} available:
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={districtSearch}
                  onChange={(e) => setDistrictSearch(e.target.value)}
                  placeholder="Search districts..."
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded">
                {filteredDistricts.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleDistrictSelect(d)}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-gray-100 last:border-0 transition-colors ${
                      selectedDistrictId === d.id
                        ? 'bg-blue-50 text-blue-900'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-medium">{d.zoning_code}</span>
                    <span className="text-gray-500 ml-2">{d.district_name}</span>
                    {d.max_height && (
                      <span className="text-gray-400 ml-2">({d.max_height}ft max)</span>
                    )}
                  </button>
                ))}
                {filteredDistricts.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-500">No matching districts</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setManualEntry(true)}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Enter manually instead
            </button>
            <button
              onClick={handleConfirm}
              disabled={analyzing}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Confirm & Analyze
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {(manualEntry || (!detectedZoning && !loading)) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">Enter Zoning Manually</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zoning District Code *
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. MRC-3, R-4, C-2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Find this on your municipality's zoning map or planning department website
              </p>
            </div>

            <div className="flex gap-3">
              {detectedZoning && (
                <button
                  onClick={() => {
                    setManualEntry(false);
                    setManualCode('');
                  }}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleConfirm}
                disabled={!manualCode.trim() || analyzing}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Confirm & Analyze
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-600">
          <strong className="text-gray-900">What happens next:</strong> Once confirmed, our AI agent will analyze the zoning code and calculate your maximum development capacity based on your <strong>{deal?.strategy || 'investment'}</strong> strategy.
        </p>
      </div>
    </div>
  );
}
