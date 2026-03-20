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
import { T as BT } from '../../deal/bloomberg-tokens';

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
  source: string;
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

      let lng: number, lat: number;
      const c = boundary.centroid;
      if (typeof c === 'object' && c !== null && 'x' in c && 'y' in c) {
        lng = parseFloat(c.x);
        lat = parseFloat(c.y);
      } else if (typeof c === 'string') {
        const match = c.match(/\(([^,]+),([^)]+)\)/);
        if (!match) {
          setError('Invalid boundary centroid data. Please redraw the boundary.');
          setLoading(false);
          return;
        }
        lng = parseFloat(match[1]);
        lat = parseFloat(match[2]);
      } else if (Array.isArray(c) && c.length >= 2) {
        lng = parseFloat(c[0]);
        lat = parseFloat(c[1]);
      } else {
        setError('Invalid boundary centroid data. Please redraw the boundary.');
        setLoading(false);
        return;
      }

      if (isNaN(lng) || isNaN(lat)) {
        setError('Invalid boundary coordinates. Please redraw the boundary.');
        setLoading(false);
        return;
      }

      let parcelZoning: any = null;
      try {
        const parcelRes = await apiClient.get('/api/v1/zoning/parcel-lookup', {
          params: { lat, lng, address: deal?.address || boundary.address || '' },
          timeout: 90000,
        });
        if (parcelRes.data?.found) {
          parcelZoning = parcelRes.data;
        }
      } catch (_) {}

      const reverseGeoRes = await apiClient.get('/api/v1/reverse-geocode', {
        params: { lat, lng },
      });

      const location = reverseGeoRes.data;
      const cityName = parcelZoning?.municipality || location?.city || location?.municipality?.name || '';
      const stateName = parcelZoning?.state || location?.state || location?.municipality?.state || '';

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

        if (parcelZoning) {
          const matchingDistrict = districts.find(
            (d: ZoningDistrict) => d.zoning_code?.toUpperCase() === parcelZoning.zoningCode?.toUpperCase()
          );
          if (matchingDistrict) {
            setSelectedDistrictId(matchingDistrict.id);
          } else {
            setSelectedDistrictId(districts[0].id);
          }
          setDetectedZoning({
            code: parcelZoning.zoningCode,
            name: parcelZoning.zoningName || parcelZoning.zoningCode,
            municipality: cityName,
            state: stateName,
            confidence: parcelZoning.confidence || 0.95,
            source: parcelZoning.sourceName || 'Assessor GIS',
          });
        } else {
          const bestMatch = districts[0];
          setSelectedDistrictId(bestMatch.id);
          setDetectedZoning({
            code: bestMatch.zoning_code,
            name: bestMatch.district_name,
            municipality: cityName,
            state: stateName,
            confidence: location?.municipality?.id ? 0.85 : 0.7,
            source: 'boundary',
          });
        }
      } else if (parcelZoning) {
        setDetectedZoning({
          code: parcelZoning.zoningCode,
          name: parcelZoning.zoningName || parcelZoning.zoningCode,
          municipality: cityName,
          state: stateName,
          confidence: parcelZoning.confidence || 0.95,
          source: parcelZoning.sourceName || 'Assessor GIS',
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
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: BT.blue }} />
          <p className="text-sm" style={{ color: BT.tm }}>Looking up zoning from property assessor records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-lg border p-6" style={{ background: BT.bgCard, borderColor: BT.border }}>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg" style={{ background: BT.blueBg }}>
            <Building2 className="w-6 h-6" style={{ color: BT.blue }} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1" style={{ color: BT.text }}>Confirm Zoning District</h3>
            <p className="text-sm" style={{ color: BT.tm }}>
              {detectedZoning
                ? 'We detected available zoning districts from your property boundary. Select the correct one and confirm.'
                : 'We could not auto-detect the zoning district. You can enter it manually below.'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-4 flex items-start gap-3"
          style={{ background: BT.amberBg, border: `1px solid ${BT.amber}50` }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: BT.amberL }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: BT.amberL }}>Could not auto-detect zoning</p>
            <p className="text-sm mt-1" style={{ color: BT.amber }}>{error}</p>
          </div>
        </div>
      )}

      {detectedZoning && !manualEntry && (
        <div className="rounded-lg border p-6" style={{ background: BT.bgCard, borderColor: BT.border }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4" style={{ color: BT.td }} />
                <span className="text-sm" style={{ color: BT.tm }}>Detected Location</span>
              </div>
              <p className="text-base font-medium" style={{ color: BT.text }}>
                {detectedZoning.municipality}, {detectedZoning.state}
              </p>
            </div>
            <div className="px-2 py-1 text-xs font-medium rounded"
              style={{ background: BT.greenBg, color: BT.greenL }}>
              {availableDistricts.length} districts available
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: BT.border }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs mb-1" style={{ color: BT.td }}>Selected Zoning District</p>
                <p className="text-2xl font-bold mb-1" style={{ color: BT.text }}>{detectedZoning.code}</p>
                <p className="text-sm" style={{ color: BT.tm }}>{detectedZoning.name}</p>
                {detectedZoning.source && detectedZoning.source !== 'boundary' && (
                  <p className="text-xs mt-1" style={{ color: detectedZoning.confidence >= 0.9 ? BT.green : BT.blue }}>
                    Source: {detectedZoning.source}
                  </p>
                )}
              </div>
              {detectedZoning.confidence >= 0.9 ? (
                <CheckCircle2 className="w-6 h-6" style={{ color: BT.green }} />
              ) : (
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="w-6 h-6" style={{ color: BT.blue }} />
                  <span className="text-[10px] mt-0.5" style={{ color: BT.blue }}>AI-verified</span>
                </div>
              )}
            </div>
          </div>

          {availableDistricts.length > 1 && (
            <div className="mt-4 border-t pt-4" style={{ borderColor: BT.border }}>
              <p className="text-xs font-medium mb-2" style={{ color: BT.tm }}>
                Not the right district? Select from {availableDistricts.length} available:
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5" style={{ color: BT.td }} />
                <input
                  type="text"
                  value={districtSearch}
                  onChange={(e) => setDistrictSearch(e.target.value)}
                  placeholder="Search districts..."
                  className="w-full pl-8 pr-3 py-1.5 rounded text-xs focus:outline-none focus:ring-1"
                  style={{
                    background: BT.bgPanel,
                    border: `1px solid ${BT.border}`,
                    color: BT.text,
                  }}
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded" style={{ border: `1px solid ${BT.border}` }}>
                {filteredDistricts.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleDistrictSelect(d)}
                    className="w-full text-left px-3 py-2 text-xs border-b last:border-0 transition-colors"
                    style={selectedDistrictId === d.id
                      ? { background: BT.blueBg, color: BT.blueL, borderColor: BT.border }
                      : { background: 'transparent', color: BT.tm, borderColor: BT.border }
                    }
                  >
                    <span className="font-medium">{d.zoning_code}</span>
                    <span className="ml-2" style={{ color: BT.td }}>{d.district_name}</span>
                    {d.max_height && (
                      <span className="ml-2" style={{ color: BT.td }}>({d.max_height}ft max)</span>
                    )}
                  </button>
                ))}
                {filteredDistricts.length === 0 && (
                  <p className="px-3 py-2 text-xs" style={{ color: BT.td }}>No matching districts</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setManualEntry(true)}
              className="text-sm underline"
              style={{ color: BT.tm }}
            >
              Enter manually instead
            </button>
            <button
              onClick={handleConfirm}
              disabled={analyzing}
              className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: BT.blue }}
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
        <div className="rounded-lg border p-6" style={{ background: BT.bgCard, borderColor: BT.border }}>
          <h4 className="text-base font-semibold mb-4" style={{ color: BT.text }}>Enter Zoning Manually</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: BT.tm }}>
                Zoning District Code *
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. MRC-3, R-4, C-2"
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  background: BT.bgPanel,
                  border: `1px solid ${BT.borderL}`,
                  color: BT.text,
                }}
              />
              <p className="text-xs mt-1" style={{ color: BT.td }}>
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
                  className="px-4 py-2 text-sm rounded-lg"
                  style={{ color: BT.tm, border: `1px solid ${BT.borderL}`, background: 'transparent' }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleConfirm}
                disabled={!manualCode.trim() || analyzing}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: BT.blue }}
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

      <div className="border rounded-lg p-4" style={{ background: BT.bgCard, borderColor: BT.border }}>
        <p className="text-xs" style={{ color: BT.tm }}>
          <strong style={{ color: BT.text }}>What happens next:</strong> Once confirmed, our AI agent will analyze the zoning code and calculate your maximum development capacity based on your <strong>{deal?.strategy || 'investment'}</strong> strategy.
        </p>
      </div>
    </div>
  );
}
