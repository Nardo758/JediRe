/**
 * Boundary & Zoning Tab — Combined Step 1
 *
 * Merges the old separate Property Boundary (Step 1) and Confirm Zoning (Step 2)
 * into a single tab. Users see their parcel detection AND zoning verification
 * in one place, since every zoning parameter depends on lot size from the boundary.
 *
 * Section 1: Parcel Detection & Confirmation (PropertyBoundarySection)
 * Section 2: Zoning Verification & Parameters (inline ZoningConfirmTab content)
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Search,
  ExternalLink,
} from 'lucide-react';
import { PropertyBoundarySection } from '../../deal/sections/PropertyBoundarySection';
import { apiClient } from '../../../services/api.client';

interface BoundaryAndZoningTabProps {
  deal?: any;
  dealId?: string;
  onComplete?: (zoningData?: any) => void;
}

interface DetectedZoning {
  code: string;
  name: string;
  municipality: string;
  state: string;
  confidence: number;
  source: string;
}

interface ZoningDistrictOption {
  id: string;
  zoning_code: string;
  district_name: string;
  category?: string;
  max_density?: number;
  max_far?: number;
  max_height?: number;
  max_stories?: number;
}

export default function BoundaryAndZoningTab({ deal, dealId, onComplete }: BoundaryAndZoningTabProps) {
  const [boundaryComplete, setBoundaryComplete] = useState(false);
  const [zoningExpanded, setZoningExpanded] = useState(false);
  const [zoningLoading, setZoningLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedZoning, setDetectedZoning] = useState<DetectedZoning | null>(null);
  const [availableDistricts, setAvailableDistricts] = useState<ZoningDistrictOption[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [districtSearch, setDistrictSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [locationInfo, setLocationInfo] = useState<{ city: string; state: string } | null>(null);
  const [zoningConfirmed, setZoningConfirmed] = useState(false);

  // When boundary is completed, auto-expand zoning section and fetch data
  const handleBoundaryComplete = () => {
    setBoundaryComplete(true);
    setZoningExpanded(true);
    fetchZoningFromBoundary();
  };

  // Check if boundary already exists on mount
  useEffect(() => {
    if (!dealId) return;
    (async () => {
      try {
        const res = await apiClient.get(`/api/v1/deals/${dealId}/boundary`);
        if (res.data?.id || res.data?.boundary_geojson) {
          setBoundaryComplete(true);
          // Check if zoning is already confirmed
          try {
            const zoningRes = await apiClient.get(`/api/v1/deals/${dealId}/zoning-confirmation`);
            if (zoningRes.data?.confirmed_at) {
              setZoningConfirmed(true);
              setDetectedZoning({
                code: zoningRes.data.zoning_code || '',
                name: zoningRes.data.district_name || zoningRes.data.zoning_code || '',
                municipality: zoningRes.data.municipality || '',
                state: zoningRes.data.state || '',
                confidence: 1.0,
                source: 'confirmed',
              });
            } else {
              // Boundary exists but zoning not confirmed — fetch zoning options
              setZoningExpanded(true);
              fetchZoningFromBoundary();
            }
          } catch {
            setZoningExpanded(true);
            fetchZoningFromBoundary();
          }
        }
      } catch {
        // No boundary yet
      }
    })();
  }, [dealId]);

  const fetchZoningFromBoundary = async () => {
    if (!dealId) return;
    setZoningLoading(true);
    setError(null);

    try {
      const boundaryRes = await apiClient.get(`/api/v1/deals/${dealId}/boundary`);
      const boundary = boundaryRes.data;

      if (!boundary?.centroid) {
        setError('No property boundary found. Please draw boundary above first.');
        setZoningLoading(false);
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
          setError('Invalid boundary centroid data.');
          setZoningLoading(false);
          return;
        }
        lng = parseFloat(match[1]);
        lat = parseFloat(match[2]);
      } else if (Array.isArray(c) && c.length >= 2) {
        lng = parseFloat(c[0]);
        lat = parseFloat(c[1]);
      } else {
        setError('Invalid boundary centroid data.');
        setZoningLoading(false);
        return;
      }

      if (isNaN(lng) || isNaN(lat)) {
        setError('Invalid boundary coordinates.');
        setZoningLoading(false);
        return;
      }

      // Try parcel lookup first
      let parcelZoning: any = null;
      try {
        const parcelRes = await apiClient.get('/api/v1/zoning/parcel-lookup', {
          params: { lat, lng, address: deal?.address || boundary.address || '' },
          timeout: 90000,
        });
        if (parcelRes.data?.found) {
          parcelZoning = parcelRes.data;
        }
      } catch {}

      const reverseGeoRes = await apiClient.get('/api/v1/reverse-geocode', {
        params: { lat, lng },
      });

      const location = reverseGeoRes.data;
      const cityName = parcelZoning?.municipality || location?.city || location?.municipality?.name || '';
      const stateName = parcelZoning?.state || location?.state || location?.municipality?.state || '';

      if (!cityName) {
        setError('Could not determine city from boundary location. Try manual entry.');
        setZoningLoading(false);
        return;
      }

      setLocationInfo({ city: cityName, state: stateName });

      const zoningRes = await apiClient.get('/api/v1/zoning/lookup', {
        params: { city: cityName, address: deal?.address || boundary.address },
      });

      const zoningData = zoningRes.data;

      if (zoningData?.found && zoningData.districts?.length > 0) {
        const districts: ZoningDistrictOption[] = zoningData.districts;
        setAvailableDistricts(districts);

        if (parcelZoning) {
          const matchingDistrict = districts.find(
            (d) => d.zoning_code?.toUpperCase() === parcelZoning.zoningCode?.toUpperCase()
          );
          setSelectedDistrictId(matchingDistrict ? matchingDistrict.id : districts[0].id);
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
      setError(err.response?.data?.error || 'Failed to detect zoning. Try manual entry.');
    } finally {
      setZoningLoading(false);
    }
  };

  const handleDistrictSelect = (district: ZoningDistrictOption) => {
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

      // Run intelligence analysis
      try {
        await apiClient.post('/api/v1/zoning-intelligence/analyze', {
          dealId,
          zoningCode: zoneCode,
          municipality: detectedZoning?.municipality || locationInfo?.city,
          state: detectedZoning?.state || locationInfo?.state,
          landAreaSf: boundary.parcel_area_sf || boundary.parcelAreaSF || (boundary.parcel_area || boundary.parcelArea || 0) * 43560,
          dealType: deal?.strategy || deal?.dealType || 'BTS',
          boundaryId: boundary.id,
          setbacks: boundary.setbacks,
        });
      } catch {}

      // Save confirmation
      await apiClient.post(`/api/v1/deals/${dealId}/zoning-confirmation`, {
        zoning_code: zoneCode,
        municipality: detectedZoning?.municipality || locationInfo?.city,
        state: detectedZoning?.state || locationInfo?.state,
        confirmed_at: new Date().toISOString(),
      });

      setZoningConfirmed(true);

      if (onComplete) {
        onComplete({
          ...detectedZoning,
          code: zoneCode,
          confirmed: true,
        });
      }
    } catch (err: any) {
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

  return (
    <div className="space-y-6">
      {/* ─── SECTION 1: Parcel Detection & Confirmation ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</div>
          <h3 className="text-sm font-bold text-gray-900">Parcel Detection & Boundary</h3>
          {boundaryComplete && <CheckCircle2 className="w-4 h-4 text-green-600" />}
        </div>
        <PropertyBoundarySection
          deal={deal}
          dealId={dealId}
          onUpdate={handleBoundaryComplete}
          embedded={true}
        />
      </div>

      {/* ─── SECTION 2: Zoning Verification & Parameters ─── */}
      <div className={`border rounded-lg overflow-hidden transition-opacity ${boundaryComplete ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <button
          onClick={() => boundaryComplete && setZoningExpanded(!zoningExpanded)}
          className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Zoning Verification & Parameters</h3>
              {zoningConfirmed && (
                <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Confirmed
                </span>
              )}
            </div>
            {detectedZoning && (
              <p className="text-xs text-gray-500 mt-0.5">
                {detectedZoning.code} — {detectedZoning.name} ({detectedZoning.municipality}, {detectedZoning.state})
              </p>
            )}
          </div>
          {zoningExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        {zoningExpanded && (
          <div className="px-5 pb-5 bg-white border-t border-gray-100 space-y-4">
            {/* Loading */}
            {zoningLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-3" />
                <span className="text-sm text-gray-600">Looking up zoning from property assessor records...</span>
              </div>
            )}

            {/* Error */}
            {error && !zoningLoading && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-900">Could not auto-detect zoning</p>
                  <p className="text-xs text-amber-700 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Detected zoning card */}
            {detectedZoning && !zoningLoading && !manualEntry && (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">{detectedZoning.municipality}, {detectedZoning.state}</span>
                      {detectedZoning.source && detectedZoning.source !== 'boundary' && detectedZoning.source !== 'confirmed' && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          Source: {detectedZoning.source}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">{detectedZoning.code}</span>
                      <span className="text-sm text-gray-600">{detectedZoning.name}</span>
                    </div>
                  </div>
                  {detectedZoning.confidence >= 0.9 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      <span className="text-[9px] text-blue-500">AI-verified</span>
                    </div>
                  )}
                </div>

                {/* Selected district parameters preview */}
                {selectedDistrictId && availableDistricts.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3">
                    {(() => {
                      const d = availableDistricts.find(x => x.id === selectedDistrictId);
                      if (!d) return null;
                      return [
                        { label: 'Max Density', value: d.max_density ? `${d.max_density}/acre` : '—' },
                        { label: 'Max FAR', value: d.max_far ?? '—' },
                        { label: 'Max Height', value: d.max_height ? `${d.max_height} ft` : '—' },
                        { label: 'Max Stories', value: d.max_stories ?? '—' },
                      ].map((m, i) => (
                        <div key={i} className="text-center">
                          <div className="text-xs font-bold text-gray-900">{m.value}</div>
                          <div className="text-[9px] text-gray-400">{m.label}</div>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {/* District selection dropdown */}
                {availableDistricts.length > 1 && !zoningConfirmed && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1.5">
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
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded">
                      {filteredDistricts.map(d => (
                        <button
                          key={d.id}
                          onClick={() => handleDistrictSelect(d)}
                          className={`w-full text-left px-3 py-1.5 text-xs border-b border-gray-100 last:border-0 transition-colors ${
                            selectedDistrictId === d.id
                              ? 'bg-blue-50 text-blue-900'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span className="font-medium">{d.zoning_code}</span>
                          <span className="text-gray-500 ml-2">{d.district_name}</span>
                          {d.max_height && <span className="text-gray-400 ml-2">({d.max_height}ft)</span>}
                        </button>
                      ))}
                      {filteredDistricts.length === 0 && (
                        <p className="px-3 py-2 text-xs text-gray-500">No matching districts</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Confirm / Manual toggle */}
                {!zoningConfirmed && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setManualEntry(true)}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Enter manually instead
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={analyzing}
                      className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {analyzing ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" /> Confirm & Analyze</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Manual entry */}
            {(manualEntry || (!detectedZoning && !zoningLoading)) && !zoningConfirmed && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Enter Zoning Manually</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Zoning District Code *</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MRC-3, R-4, C-2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Find this on your municipality's zoning map or planning department website</p>
                </div>
                <div className="flex gap-2">
                  {detectedZoning && (
                    <button onClick={() => { setManualEntry(false); setManualCode(''); }}
                      className="px-3 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >Cancel</button>
                  )}
                  <button
                    onClick={handleConfirm}
                    disabled={!manualCode.trim() || analyzing}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {analyzing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</> : <>Confirm & Analyze</>}
                  </button>
                </div>
              </div>
            )}

            {/* What happens next */}
            {!zoningConfirmed && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] text-gray-600">
                  <strong className="text-gray-900">What happens next:</strong> Once confirmed, our AI agent will analyze the zoning code and calculate your maximum development capacity. Every zoning parameter will include a source link.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
