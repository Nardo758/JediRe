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

import { T as BT } from '../../deal/bloomberg-tokens';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Search,
  ExternalLink,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { PropertyBoundarySection } from '../../deal/sections/PropertyBoundarySection';
import { apiClient } from '../../../services/api.client';
import { MunicodeLink } from '../SourceCitation';

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
  municodeUrl?: string;
  planningUrl?: string;
  webSearchUrl?: string;
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

interface SourceRule {
  field: string;
  displayLabel: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  sourceUrl: string | null;
  sourceType: 'municode' | 'search' | 'chapter';
}

interface DistrictDetails {
  max_density_per_acre?: number | null;
  max_far?: number | null;
  max_height_feet?: number | null;
  max_stories?: number | null;
  min_parking_per_unit?: number | null;
  parking_per_1000_sqft?: number | null;
  setbacks?: {
    front?: number | null;
    side?: number | null;
    rear?: number | null;
  };
  max_lot_coverage?: number | null;
  source_rules?: SourceRule[];
  municode_url?: string | null;
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
  const [districtDetails, setDistrictDetails] = useState<DistrictDetails | null>(null);
  const [zoningDiscrepancy, setZoningDiscrepancy] = useState<{ liveCode: string; liveName: string; sourceUrl?: string } | null>(null);
  const [discrepancyUpdating, setDiscrepancyUpdating] = useState(false);

  const fetchDistrictDetails = useCallback(async (code: string, municipality?: string) => {
    try {
      const params: Record<string, string> = { code };
      if (municipality) params.municipality = municipality;
      const res = await apiClient.get('/api/v1/zoning-districts/by-code', { params });
      if (res.data?.found !== false) {
        setDistrictDetails(res.data);
      }
    } catch {}
  }, []);

  const handleBoundaryComplete = () => {
    setBoundaryComplete(true);
    setZoningExpanded(true);
    fetchZoningFromBoundary();
  };

  useEffect(() => {
    if (!dealId) return;
    (async () => {
      try {
        const res = await apiClient.get(`/api/v1/deals/${dealId}/boundary`);
        if (res.data?.id || res.data?.boundary_geojson) {
          setBoundaryComplete(true);
          try {
            const zoningRes = await apiClient.get(`/api/v1/deals/${dealId}/zoning-confirmation`);
            if (zoningRes.data?.confirmed_at) {
              setZoningConfirmed(true);
              const confirmedCode = zoningRes.data.zoning_code || '';
              const confirmedMunicipality = zoningRes.data.municipality || '';
              setDetectedZoning({
                code: confirmedCode,
                name: zoningRes.data.district_name || confirmedCode,
                municipality: confirmedMunicipality,
                state: zoningRes.data.state || '',
                confidence: 1.0,
                source: 'confirmed',
              });
              if (confirmedCode) {
                fetchDistrictDetails(confirmedCode, confirmedMunicipality || undefined);
              }
              if (res.data?.centroid) {
                const c = res.data.centroid;
                let clng: number | null = null, clat: number | null = null;
                if (typeof c === 'object' && c !== null && 'x' in c && 'y' in c) {
                  clng = parseFloat(c.x); clat = parseFloat(c.y);
                } else if (typeof c === 'string') {
                  const m = c.match(/\(([^,]+),([^)]+)\)/);
                  if (m) { clng = parseFloat(m[1]); clat = parseFloat(m[2]); }
                } else if (Array.isArray(c) && c.length >= 2) {
                  clng = parseFloat(c[0]); clat = parseFloat(c[1]);
                }
                if (clng !== null && clat !== null && !isNaN(clng) && !isNaN(clat)) {
                  apiClient.get('/api/v1/zoning/parcel-lookup', {
                    params: { lat: clat, lng: clng, address: deal?.address || '' },
                    timeout: 12000,
                  }).then(parcelRes => {
                    const liveCode = parcelRes.data?.zoningCode;
                    if (liveCode && liveCode.toUpperCase() !== confirmedCode.toUpperCase()) {
                      setZoningDiscrepancy({
                        liveCode,
                        liveName: parcelRes.data.zoningName || liveCode,
                        sourceUrl: parcelRes.data.sourceUrl || undefined,
                      });
                    }
                  }).catch(() => {});
                }
              }
            } else {
              setZoningExpanded(true);
              fetchZoningFromBoundary();
            }
          } catch {
            setZoningExpanded(true);
            fetchZoningFromBoundary();
          }
        }
      } catch {}
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

        const municipalityId = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateName.toLowerCase()}`;
        const resolveDistrictMunicode = async (code: string) => {
          try {
            const res = await apiClient.get('/api/v1/municode/resolve', {
              params: { municipality: municipalityId, section: code },
            });
            return res.data?.url || undefined;
          } catch { return undefined; }
        };

        if (parcelZoning) {
          const matchingDistrict = districts.find(
            (d) => d.zoning_code?.toUpperCase() === parcelZoning.zoningCode?.toUpperCase()
          );
          setSelectedDistrictId(matchingDistrict ? matchingDistrict.id : districts[0].id);
          const municodeUrl = await resolveDistrictMunicode(parcelZoning.zoningCode);
          setDetectedZoning({
            code: parcelZoning.zoningCode,
            name: parcelZoning.zoningName || parcelZoning.zoningCode,
            municipality: cityName,
            state: stateName,
            confidence: parcelZoning.confidence || 0.95,
            source: parcelZoning.sourceName || 'Assessor GIS',
            municodeUrl,
            planningUrl: parcelZoning.planningUrl || undefined,
            webSearchUrl: parcelZoning.webSearchUrl || undefined,
          });
          fetchDistrictDetails(parcelZoning.zoningCode, cityName);
        } else {
          const bestMatch = districts[0];
          setSelectedDistrictId(bestMatch.id);
          const municodeUrl = await resolveDistrictMunicode(bestMatch.zoning_code);
          setDetectedZoning({
            code: bestMatch.zoning_code,
            name: bestMatch.district_name,
            municipality: cityName,
            state: stateName,
            confidence: location?.municipality?.id ? 0.85 : 0.7,
            source: 'boundary',
            municodeUrl,
          });
          fetchDistrictDetails(bestMatch.zoning_code, cityName);
        }
      } else if (parcelZoning) {
        let municodeUrl: string | undefined;
        try {
          const municipalityId = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateName.toLowerCase()}`;
          const res = await apiClient.get('/api/v1/municode/resolve', {
            params: { municipality: municipalityId, section: parcelZoning.zoningCode },
          });
          municodeUrl = res.data?.url || undefined;
        } catch {}
        setDetectedZoning({
          code: parcelZoning.zoningCode,
          name: parcelZoning.zoningName || parcelZoning.zoningCode,
          municipality: cityName,
          state: stateName,
          confidence: parcelZoning.confidence || 0.95,
          source: parcelZoning.sourceName || 'Assessor GIS',
          municodeUrl,
          planningUrl: parcelZoning.planningUrl || undefined,
          webSearchUrl: parcelZoning.webSearchUrl || undefined,
        });
        fetchDistrictDetails(parcelZoning.zoningCode, cityName);
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
    fetchDistrictDetails(district.zoning_code, locationInfo?.city || detectedZoning?.municipality);
  };

  const handleConfirm = async () => {
    if (!detectedZoning && !manualCode) return;
    setAnalyzing(true);
    setError(null);

    try {
      const zoneCode = detectedZoning?.code || manualCode;
      const boundaryRes = await apiClient.get(`/api/v1/deals/${dealId}/boundary`);
      const boundary = boundaryRes.data;

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

      await apiClient.post(`/api/v1/deals/${dealId}/zoning-confirmation`, {
        zoning_code: zoneCode,
        municipality: detectedZoning?.municipality || locationInfo?.city,
        state: detectedZoning?.state || locationInfo?.state,
        confirmed_at: new Date().toISOString(),
      });

      setZoningConfirmed(true);

      try {
        await apiClient.post(`/api/v1/deals/${dealId}/zoning-profile/resolve`);
      } catch {}

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

  const handleUpdateToGisCode = async () => {
    if (!zoningDiscrepancy || !dealId) return;
    setDiscrepancyUpdating(true);
    try {
      const boundaryRes = await apiClient.get(`/api/v1/deals/${dealId}/boundary`);
      const boundary = boundaryRes.data;
      const municipality = detectedZoning?.municipality || locationInfo?.city || '';
      const state = detectedZoning?.state || locationInfo?.state || '';
      try {
        await apiClient.post('/api/v1/zoning-intelligence/analyze', {
          dealId,
          zoningCode: zoningDiscrepancy.liveCode,
          municipality,
          state,
          landAreaSf: boundary.parcel_area_sf || (boundary.parcel_area || 0) * 43560,
          dealType: deal?.strategy || deal?.dealType || 'BTS',
          boundaryId: boundary.id,
          setbacks: boundary.setbacks,
        });
      } catch {}
      await apiClient.post(`/api/v1/deals/${dealId}/zoning-confirmation`, {
        zoning_code: zoningDiscrepancy.liveCode,
        municipality,
        state,
        confirmed_at: new Date().toISOString(),
      });
      await apiClient.post(`/api/v1/deals/${dealId}/zoning-profile/resolve`).catch(() => {});
      setDetectedZoning(prev => prev ? {
        ...prev,
        code: zoningDiscrepancy.liveCode,
        name: zoningDiscrepancy.liveName,
      } : null);
      setZoningDiscrepancy(null);
      fetchDistrictDetails(zoningDiscrepancy.liveCode, municipality || undefined);
      if (onComplete) {
        onComplete({ code: zoningDiscrepancy.liveCode, confirmed: true, municipality, state });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update zoning confirmation');
    } finally {
      setDiscrepancyUpdating(false);
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
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: BT.blueBg, color: BT.blueL }}>1</div>
          <h3 className="text-sm font-bold" style={{ color: BT.text }}>Parcel Detection & Boundary</h3>
          {boundaryComplete && <CheckCircle2 className="w-4 h-4" style={{ color: BT.greenL }} />}
        </div>
        <PropertyBoundarySection
          deal={deal}
          dealId={dealId}
          onUpdate={handleBoundaryComplete}
          embedded={true}
        />
      </div>

      {/* ─── SECTION 2: Zoning Selection & Confirmation ─── */}
      <div className={`rounded-lg overflow-hidden transition-opacity ${boundaryComplete ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
        style={{ border: `1px solid ${BT.border}` }}>
        <div className="px-5 py-4 space-y-4" style={{ background: BT.bgCard }}>

          {/* Confirmed state header */}
          {zoningConfirmed && detectedZoning && (
            <div className="flex items-center justify-between rounded-lg px-4 py-2.5"
              style={{ background: BT.greenBg, border: `1px solid ${BT.green}50` }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: BT.greenL }} />
                <span className="text-xs font-semibold" style={{ color: BT.greenL }}>Zoning Confirmed:</span>
                <span className="text-xs font-bold" style={{ color: BT.greenL }}>{detectedZoning.code}</span>
                {detectedZoning.municipality && (
                  <span className="text-xs" style={{ color: BT.green }}>({detectedZoning.municipality})</span>
                )}
              </div>
              <button
                onClick={() => {
                  setZoningConfirmed(false);
                  setDetectedZoning(null);
                  setZoningExpanded(true);
                  setZoningDiscrepancy(null);
                  setError(null);
                  fetchZoningFromBoundary();
                }}
                className="flex items-center gap-1.5 text-xs rounded px-2.5 py-1 transition-colors"
                style={{ color: BT.greenL, border: `1px solid ${BT.green}50`, background: BT.bgCard }}
              >
                <RefreshCw className="w-3 h-3" />
                Change Zoning
              </button>
            </div>
          )}

          {/* GIS discrepancy warning */}
          {zoningDiscrepancy && zoningConfirmed && (
            <div className="rounded-lg px-4 py-3" style={{ background: BT.amberBg, border: `1px solid ${BT.amber}` }}>
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BT.amberL }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: BT.amberL }}>City GIS Mismatch Detected</p>
                  <p className="text-xs mt-0.5" style={{ color: BT.amber }}>
                    {detectedZoning?.municipality || 'City'}'s official zoning map shows this parcel as{' '}
                    <span className="font-bold">{zoningDiscrepancy.liveCode}</span>{' '}
                    ({zoningDiscrepancy.liveName}), but your confirmation says{' '}
                    <span className="font-bold">{detectedZoning?.code}</span>.
                    {zoningDiscrepancy.sourceUrl && (
                      <a
                        href={zoningDiscrepancy.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 underline"
                        style={{ color: BT.amberL }}
                      >
                        View GIS source <ExternalLink className="w-2.5 h-2.5 inline" />
                      </a>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setZoningDiscrepancy(null)}
                    className="text-[10px] rounded px-2 py-1 transition-colors"
                    style={{ color: BT.amberL, border: `1px solid ${BT.amber}50`, background: BT.bgCard }}
                  >
                    Keep {detectedZoning?.code}
                  </button>
                  <button
                    onClick={handleUpdateToGisCode}
                    disabled={discrepancyUpdating}
                    className="flex items-center gap-1 text-[10px] font-medium text-white rounded px-2.5 py-1 transition-colors disabled:opacity-50"
                    style={{ background: BT.amber }}
                  >
                    {discrepancyUpdating ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Updating...</>
                    ) : (
                      <>Update to {zoningDiscrepancy.liveCode}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {zoningLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-3" style={{ color: BT.blueL }} />
              <span className="text-sm" style={{ color: BT.tm }}>Looking up zoning from property assessor records...</span>
            </div>
          )}

          {/* Error */}
          {error && !zoningLoading && (
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: BT.amberBg, border: `1px solid ${BT.amber}50` }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BT.amberL }} />
              <div>
                <p className="text-xs font-medium" style={{ color: BT.amberL }}>Could not auto-detect zoning</p>
                <p className="text-xs mt-0.5" style={{ color: BT.amber }}>{error}</p>
              </div>
            </div>
          )}

          {/* Detected zoning - district selection & confirm */}
          {detectedZoning && !zoningLoading && !manualEntry && (
            <div className="space-y-3">
              {availableDistricts.length > 1 && !zoningConfirmed && (
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: BT.tm }}>
                    Not the right district? Select from {availableDistricts.length} available:
                  </p>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5" style={{ color: BT.td }} />
                    <input
                      type="text"
                      value={districtSearch}
                      onChange={(e) => setDistrictSearch(e.target.value)}
                      placeholder="Search districts..."
                      className="w-full pl-8 pr-3 py-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      style={{ border: `1px solid ${BT.border}`, background: BT.bgPanel, color: BT.text }}
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded" style={{ border: `1px solid ${BT.border}` }}>
                    {filteredDistricts.map(d => (
                      <button
                        key={d.id}
                        onClick={() => handleDistrictSelect(d)}
                        className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                        style={{
                          borderBottom: `1px solid ${BT.border}`,
                          background: selectedDistrictId === d.id ? BT.blueBg : 'transparent',
                          color: selectedDistrictId === d.id ? BT.blueL : BT.tm,
                        }}
                        onMouseEnter={e => { if (selectedDistrictId !== d.id) (e.currentTarget as HTMLElement).style.background = BT.bgPanel; }}
                        onMouseLeave={e => { if (selectedDistrictId !== d.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span className="font-medium">{d.zoning_code}</span>
                        <span className="ml-2" style={{ color: BT.td }}>{d.district_name}</span>
                        {d.max_height && <span className="ml-2" style={{ color: BT.td }}>({d.max_height}ft)</span>}
                      </button>
                    ))}
                    {filteredDistricts.length === 0 && (
                      <p className="px-3 py-2 text-xs" style={{ color: BT.td }}>No matching districts</p>
                    )}
                  </div>
                </div>
              )}

              {!zoningConfirmed && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setManualEntry(true)}
                    className="text-xs underline"
                    style={{ color: BT.td }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BT.tm; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BT.td; }}
                  >
                    Enter manually instead
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={analyzing}
                    className="flex items-center gap-2 px-5 py-2 text-white text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ background: BT.blue }}
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
              <h4 className="text-sm font-semibold" style={{ color: BT.text }}>Enter Zoning Manually</h4>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: BT.tm }}>Zoning District Code *</label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MRC-3, R-4, C-2"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ border: `1px solid ${BT.borderL}`, background: BT.bgPanel, color: BT.text }}
                />
                <p className="text-[10px] mt-1" style={{ color: BT.td }}>Find this on your municipality's zoning map or planning department website</p>
              </div>
              <div className="flex gap-2">
                {detectedZoning && (
                  <button onClick={() => { setManualEntry(false); setManualCode(''); }}
                    className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                    style={{ color: BT.tm, border: `1px solid ${BT.borderL}`, background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BT.bgPanel; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >Cancel</button>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={!manualCode.trim() || analyzing}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2 text-white text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ background: BT.blue }}
                >
                  {analyzing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</> : <>Confirm & Analyze</>}
                </button>
              </div>
            </div>
          )}

          {/* What happens next */}
          {!zoningConfirmed && (
            <div className="rounded-lg p-3" style={{ background: BT.bgPanel, border: `1px solid ${BT.border}` }}>
              <p className="text-[10px]" style={{ color: BT.tm }}>
                <strong style={{ color: BT.text }}>What happens next:</strong> Once confirmed, our AI agent will analyze the zoning code and calculate your maximum development capacity. Every zoning parameter will include a source link.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
