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
  const [nearbyEntitlements, setNearbyEntitlements] = useState<any>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyProjectsExpanded, setNearbyProjectsExpanded] = useState(false);
  const fetchNearbyEntitlements = useCallback(async () => {
    if (!dealId) return;
    setNearbyLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/nearby-entitlements`);
      if (res.data?.data) {
        setNearbyEntitlements(res.data.data);
      }
    } catch {}
    setNearbyLoading(false);
  }, [dealId]);

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
                fetchNearbyEntitlements();
              }
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

        const municipalityId = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateName.toLowerCase()}`;
        let municodeUrl: string | undefined;
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
          municodeUrl = await resolveDistrictMunicode(parcelZoning.zoningCode);
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
          municodeUrl = await resolveDistrictMunicode(bestMatch.zoning_code);
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

      try {
        await apiClient.post(`/api/v1/deals/${dealId}/zoning-profile/resolve`);
      } catch {}

      fetchNearbyEntitlements();

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

      {/* ─── SECTION 2: Nearby Entitlement Activity ─── */}
      <div className={`transition-opacity ${boundaryComplete ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
          <h3 className="text-sm font-bold text-gray-900">Nearby Entitlement Activity</h3>
        </div>
        <div className="border rounded-lg bg-white px-5 py-4 space-y-4">
                {/* Nearby Entitlement Activity */}
                {nearbyLoading && !nearbyEntitlements && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin mr-2" />
                    <span className="text-xs text-gray-600">Loading entitlement activity...</span>
                  </div>
                )}

                {nearbyEntitlements && nearbyEntitlements.totalRecords === 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <BarChart3 className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No entitlement records found for {nearbyEntitlements.scopeName || 'this area'}.</p>
                    <p className="text-[10px] text-gray-400 mt-1">Data coverage is expanding — check back as more jurisdictions are added.</p>
                  </div>
                )}

                {nearbyEntitlements && nearbyEntitlements.totalRecords > 0 && (() => {
                  const ne = nearbyEntitlements;
                  const typeLabels: Record<string, string> = { rezone: 'Rezone', cup: 'CUP', variance: 'Variance', by_right: 'By-Right', site_plan: 'Site Plan' };
                  const typeColors: Record<string, { bg: string; text: string; border: string }> = {
                    rezone: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
                    cup: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                    variance: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                    by_right: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
                    site_plan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
                  };
                  const insightColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
                    opportunity: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: 'text-emerald-600' },
                    trend: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' },
                    caution: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'text-amber-600' },
                  };
                  const types = Object.entries(ne.summary || {}).filter(([, s]: any) => s.count > 0);

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-indigo-600" />
                          <p className="text-xs font-semibold text-gray-700">Nearby Entitlement Activity</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                            {ne.totalRecords} records
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                            {ne.scope === 'county' ? `${ne.scopeName} County` : ne.scopeName}
                          </span>
                        </div>
                        <button
                          onClick={fetchNearbyEntitlements}
                          disabled={nearbyLoading}
                          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700"
                        >
                          <RefreshCw className={`w-3 h-3 ${nearbyLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {ne.insights?.length > 0 && (
                        <div className="space-y-1.5">
                          {ne.insights.map((insight: any, i: number) => {
                            const ic = insightColors[insight.type] || insightColors.trend;
                            return (
                              <div key={i} className={`${ic.bg} border ${ic.border} rounded-lg p-2.5 flex items-start gap-2`}>
                                {insight.type === 'opportunity' ? (
                                  <TrendingUp className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${ic.icon}`} />
                                ) : insight.type === 'caution' ? (
                                  <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${ic.icon}`} />
                                ) : (
                                  <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${ic.icon}`} />
                                )}
                                <p className={`text-xs ${ic.text} leading-relaxed`}>{insight.text}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {types.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {types.map(([type, stats]: any) => {
                            const tc = typeColors[type] || typeColors.rezone;
                            return (
                              <div key={type} className={`${tc.bg} border ${tc.border} rounded-lg p-2.5`}>
                                <p className={`text-xs font-bold ${tc.text} mb-1.5`}>{typeLabels[type] || type}</p>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-500">Projects</span>
                                    <span className="font-bold text-gray-900">{stats.count}</span>
                                  </div>
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-500">Approval</span>
                                    <span className={`font-bold ${stats.approvalRate >= 80 ? 'text-green-700' : stats.approvalRate >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                                      {stats.approvalRate}%
                                    </span>
                                  </div>
                                  {stats.avgDays != null && (
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-gray-500">Avg Time</span>
                                      <span className="font-bold text-gray-900">{Math.round(stats.avgDays / 30)} mo</span>
                                    </div>
                                  )}
                                  {stats.avgUnits != null && (
                                    <div className="flex justify-between text-[10px]">
                                      <span className="text-gray-500">Avg Units</span>
                                      <span className="font-bold text-gray-900">{stats.avgUnits}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {ne.commonTransitions?.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Common Rezone Transitions</p>
                          <div className="space-y-1.5">
                            {ne.commonTransitions.slice(0, 5).map((t: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-xs bg-white rounded p-2 border border-gray-100">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium text-gray-700">{t.fromCode}</span>
                                  <span className="text-gray-400">&rarr;</span>
                                  <span className="font-mono font-bold text-violet-700">{t.toCode}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-500">{t.count} project{t.count !== 1 ? 's' : ''}</span>
                                  <span className={`font-medium ${t.approvalRate >= 80 ? 'text-green-600' : t.approvalRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {t.approvalRate}%
                                  </span>
                                  {t.avgDays != null && (
                                    <span className="text-gray-400 flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5" />
                                      {Math.round(t.avgDays / 30)} mo
                                    </span>
                                  )}
                                  {t.exampleOrdinanceUrl && (
                                    <a href={t.exampleOrdinanceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {ne.projects?.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <button
                            onClick={() => setNearbyProjectsExpanded(!nearbyProjectsExpanded)}
                            className="w-full flex items-center justify-between"
                          >
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                              Project Records ({ne.projects.length})
                            </p>
                            {nearbyProjectsExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </button>
                          {nearbyProjectsExpanded && (
                            <div className="space-y-1.5 mt-2">
                              {ne.projects.map((p: any, i: number) => {
                                const ptc = typeColors[p.entitlementType] || typeColors.rezone;
                                return (
                                  <div key={i} className="flex items-center justify-between text-xs bg-white rounded p-2 border border-gray-100">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 truncate">{p.address || p.projectName || 'Unknown'}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${ptc.bg} ${ptc.text}`}>
                                          {typeLabels[p.entitlementType] || p.entitlementType}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                                        {p.zoningFrom && p.zoningTo && <span>{p.zoningFrom} &rarr; {p.zoningTo}</span>}
                                        {p.unitCount != null && <span>{p.unitCount} units</span>}
                                        {p.stories != null && <span>{p.stories} stories</span>}
                                        {p.municipality && ne.scope === 'county' && (
                                          <span className="text-gray-400">({p.municipality})</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                      {p.totalDays != null && (
                                        <span className="text-[10px] text-gray-400">{Math.round(p.totalDays / 30)} mo</span>
                                      )}
                                      {p.outcome && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                          p.outcome === 'approved' ? 'bg-green-100 text-green-700' :
                                          p.outcome === 'modified' ? 'bg-amber-100 text-amber-700' :
                                          p.outcome === 'denied' ? 'bg-red-100 text-red-700' :
                                          'bg-gray-100 text-gray-600'
                                        }`}>
                                          {p.outcome}
                                        </span>
                                      )}
                                      {p.ordinanceUrl && (
                                        <a href={p.ordinanceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
        </div>
      </div>

      {/* ─── SECTION 3: Zoning Selection & Confirmation ─── */}
      <div className={`border rounded-lg overflow-hidden transition-opacity ${boundaryComplete ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="px-5 py-4 bg-white space-y-4">

            {/* Confirmed state header — always visible when zoning is locked */}
            {zoningConfirmed && detectedZoning && (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-green-900">Zoning Confirmed:</span>
                  <span className="text-xs font-bold text-green-800">{detectedZoning.code}</span>
                  {detectedZoning.municipality && (
                    <span className="text-xs text-green-700">({detectedZoning.municipality})</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setZoningConfirmed(false);
                    setDetectedZoning(null);
                    setZoningExpanded(true);
                    setError(null);
                    fetchZoningFromBoundary();
                  }}
                  className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 border border-green-300 hover:border-green-400 rounded px-2.5 py-1 transition-colors bg-white hover:bg-green-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  Change Zoning
                </button>
              </div>
            )}

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

            {/* Detected zoning - district selection & confirm */}
            {detectedZoning && !zoningLoading && !manualEntry && (
              <div className="space-y-3">
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
      </div>

    </div>
  );
}
