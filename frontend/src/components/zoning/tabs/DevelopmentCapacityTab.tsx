import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { apiClient } from '../../../services/api.client';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import type { DevelopmentPath, BuildingEnvelope } from '../../../types/zoning.types';
import { MunicodeLink } from '../SourceCitation';

interface EnvelopeEnrichment {
  sources: Record<string, {
    field: string;
    displayLabel: string;
    value: number | string | null;
    unit: string;
    sectionNumber: string | null;
    sectionTitle: string | null;
    sourceUrl: string | null;
    sourceType: string;
  }>;
  calculations: Array<{
    name: string;
    formula: string;
    result: number;
    unit: string;
    sectionNumber: string | null;
    sourceUrl: string | null;
  }>;
  insights: {
    envelope: string;
    density: string;
    height: string;
    parking: string;
    controllingFactor: string;
  };
  limitingFactor: string;
  capacityByConstraint: {
    byDensity: number | null;
    byFAR: number | null;
    byHeight: number | null;
    byParking: number | null;
  };
}

interface ZoningProfile {
  id: string;
  deal_id: string;
  base_district_code: string | null;
  municipality: string | null;
  state: string | null;
  residential_far: number | null;
  nonresidential_far: number | null;
  combined_far: number | null;
  applied_far: number | null;
  density_method: string;
  max_density_per_acre: number | null;
  max_height_ft: number | null;
  max_stories: number | null;
  height_buffer_ft: number | null;
  height_beyond_buffer_ft: number | null;
  max_lot_coverage_pct: number | null;
  setback_front_ft: number | null;
  setback_side_ft: number | null;
  setback_rear_ft: number | null;
  min_parking_per_unit: number | null;
  open_space_pct: number | null;
  lot_area_sf: number | null;
  buildable_area_sf: number | null;
  constraint_source: string;
  resolution_errors: any[];
  user_overrides: Record<string, any>;
  overlays: any[];
}

interface DevelopmentCapacityTabProps {
  dealId?: string;
  deal?: any;
}

const PROJECT_TYPE_OPTIONS = [
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'residential', label: 'Residential' },
  { value: 'office', label: 'Commercial / Office' },
  { value: 'retail', label: 'Retail' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'mixed_use', label: 'Mixed-Use' },
  { value: 'land', label: 'Land' },
];

function formatNumber(v: number | null | undefined): string {
  if (v == null) return '--';
  return v.toLocaleString();
}

function getLimitingLabel(factor: string | null): string {
  switch (factor) {
    case 'density': return 'Density (units/acre)';
    case 'FAR': return 'Floor Area Ratio';
    case 'height': return 'Building Height';
    case 'parking': return 'Parking Capacity';
    default: return factor || '--';
  }
}

function getSourceBadge(source: string) {
  const styles: Record<string, string> = {
    auto: 'bg-green-50 text-green-700 border-green-200',
    user_modified: 'bg-purple-50 text-purple-700 border-purple-200',
    conditional: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  const labels: Record<string, string> = {
    auto: 'Base District',
    user_modified: 'User Override',
    conditional: 'Conditional',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${styles[source] || styles.auto}`}>
      {labels[source] || source}
    </span>
  );
}

const PATH_KEY_MAP: Record<string, DevelopmentPath> = {
  byRight: 'by_right',
  variance: 'variance',
  rezone: 'rezone',
};

function colKeyToPathId(colKey: string): DevelopmentPath {
  if (colKey.startsWith('overlay')) return 'overlay_bonus';
  return PATH_KEY_MAP[colKey] || 'by_right';
}

export default function DevelopmentCapacityTab({ dealId, deal }: DevelopmentCapacityTabProps) {
  const { development_path, selectDevelopmentPath } = useZoningModuleStore();
  const [profile, setProfile] = useState<ZoningProfile | null>(null);
  const [dealInfo, setDealInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingConstraint, setEditingConstraint] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [changingAssetType, setChangingAssetType] = useState(false);
  const [profileExists, setProfileExists] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [municodeUrl, setMunicodeUrl] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<EnvelopeEnrichment | null>(null);
  const [densityBenchmarks, setDensityBenchmarks] = useState<any>(null);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);
  const [showAllCodes, setShowAllCodes] = useState(false);
  const [variancePct, setVariancePct] = useState(20);
  const [rezoneTargetCode, setRezoneTargetCode] = useState('');
  const [customRezoneCode, setCustomRezoneCode] = useState('');
  const [avgUnitSize, setAvgUnitSize] = useState(900);
  const variancePctRef = useRef(variancePct);
  const rezoneTargetCodeRef = useRef(rezoneTargetCode);
  const avgUnitSizeRef = useRef(avgUnitSize);
  const initialLoadDone = useRef(false);
  const recsAbortRef = useRef<AbortController | null>(null);
  const isCancelled = (err: any) => axios.isCancel(err) || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError';
  const [selectedColKey, setSelectedColKey] = useState<string | null>(null);

  const handleSelectPath = useCallback((colKey: string, rec: any) => {
    setSelectedColKey(colKey);
    const pathId = colKeyToPathId(colKey);
    const units = rec.maxUnits || 0;
    const gba = rec.maxGba || 0;
    const stories = rec.maxStories || 1;
    const parking = rec.parkingRequired || 0;
    const footprint = stories > 0 ? Math.round(gba / stories / 0.82) : 0;
    const constructionType: BuildingEnvelope['construction_type'] =
      stories <= 4 ? 'wood_frame' : stories <= 7 ? 'podium_wood' : 'steel_concrete';
    const parkingType: BuildingEnvelope['parking_structure_type'] =
      units > 200 ? 'podium' : units > 100 ? 'garage' : 'surface';

    const envelope: BuildingEnvelope = {
      max_units: units,
      max_gfa_sf: gba,
      max_stories: stories,
      max_footprint_sf: footprint,
      buildable_polygon: null,
      required_parking_spaces: parking,
      parking_structure_type: parkingType,
      parking_levels: parkingType === 'surface' ? 0 : Math.ceil(parking * 350 / Math.max(footprint, 1)),
      residential_floors: stories - (parkingType !== 'surface' ? 1 : 0),
      ground_floor_retail_sf: units > 150 ? 5000 : 0,
      construction_type: constructionType,
    };

    selectDevelopmentPath(pathId, envelope);
  }, [selectDevelopmentPath]);

  const loadData = useCallback(async (autoResolve = false) => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      let profileRes = await apiClient.get(`/api/v1/deals/${dealId}/zoning-profile`);
      let profileData = profileRes.data;

      if (!profileData.exists && !autoResolve) {
        try {
          await apiClient.post(`/api/v1/deals/${dealId}/zoning-profile/resolve`);
          profileRes = await apiClient.get(`/api/v1/deals/${dealId}/zoning-profile`);
          profileData = profileRes.data;
        } catch {
        }
      }

      if (!profileData.exists) {
        setProfileExists(false);
        setProfile(null);
      } else {
        setProfileExists(true);
        setProfile(profileData.profile);
        setDealInfo(profileData.deal);

        if (profileData.profile?.base_district_code && profileData.profile?.municipality) {
          try {
            const municipalityId = `${(profileData.profile.municipality as string).toLowerCase().replace(/\s+/g, '-')}-${(profileData.profile.state || 'ga').toLowerCase()}`;
            const municodeRes = await apiClient.get('/api/v1/municode/resolve', {
              params: { municipality: municipalityId, section: profileData.profile.base_district_code },
            });
            if (municodeRes.data?.url) setMunicodeUrl(municodeRes.data.url);
          } catch {}
        }
      }

      if (profileData.exists) {
        setLoadingRecs(true);
        try {
          recsAbortRef.current?.abort();
          const controller = new AbortController();
          recsAbortRef.current = controller;
          const params: any = {};
          if (variancePctRef.current !== 20) params.variance_density_pct = variancePctRef.current;
          if (rezoneTargetCodeRef.current) params.rezone_target_code = rezoneTargetCodeRef.current;
          const recsRes = await apiClient.get(`/api/v1/deals/${dealId}/scenarios/recommendations`, { params, timeout: 45000, signal: controller.signal });
          setRecommendations(recsRes.data.recommendations || []);
          setComparison(recsRes.data.comparison || null);
        } catch (err) {
          if (!isCancelled(err)) {
            setRecommendations([]);
            setComparison(null);
          }
        } finally {
          setLoadingRecs(false);
        }

        try {
          const enrichRes = await apiClient.get(`/api/v1/deals/${dealId}/envelope-enrichment`);
          setEnrichment(enrichRes.data);
        } catch {
          setEnrichment(null);
        }

        setLoadingBenchmarks(true);
        try {
          const benchRes = await apiClient.get(`/api/v1/deals/${dealId}/density-benchmarks`);
          setDensityBenchmarks(benchRes.data?.data || benchRes.data || null);
        } catch {
          setDensityBenchmarks(null);
        } finally {
          setLoadingBenchmarks(false);
        }

        try {
          await apiClient.get(`/api/v1/deals/${dealId}/rezone-analysis`);
        } catch {}
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load capacity data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    return () => { recsAbortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    variancePctRef.current = variancePct;
    rezoneTargetCodeRef.current = rezoneTargetCode;
    avgUnitSizeRef.current = avgUnitSize;
    if (!dealId || !profile) return;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    const timer = setTimeout(async () => {
      recsAbortRef.current?.abort();
      const controller = new AbortController();
      recsAbortRef.current = controller;
      setLoadingRecs(true);
      try {
        const params: any = {};
        if (variancePct !== 20) params.variance_density_pct = variancePct;
        if (rezoneTargetCode && rezoneTargetCode !== '__custom__') params.rezone_target_code = rezoneTargetCode;
        if (avgUnitSize !== 900) params.avg_unit_size_sf = avgUnitSize;
        const recsRes = await apiClient.get(`/api/v1/deals/${dealId}/scenarios/recommendations`, { params, timeout: 45000, signal: controller.signal });
        setRecommendations(recsRes.data.recommendations || []);
        setComparison(recsRes.data.comparison || null);
      } catch (err) {
        if (!isCancelled(err)) {
          setRecommendations([]);
          setComparison(null);
        }
      } finally {
        setLoadingRecs(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [variancePct, rezoneTargetCode, avgUnitSize, dealId]);

  const handleResolveProfile = async () => {
    if (!dealId) return;
    setResolving(true);
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/zoning-profile/resolve`);
      await loadData(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to resolve profile');
    } finally {
      setResolving(false);
    }
  };

  const handleSaveOverride = async (field: string) => {
    if (!dealId) return;
    try {
      await apiClient.put(`/api/v1/deals/${dealId}/zoning-profile/overrides`, {
        overrides: { [field]: parseFloat(editValue) },
      });
      setEditingConstraint(null);
      setEditValue('');
      await loadData(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save override');
    }
  };

  const handleChangeAssetType = async (newType: string) => {
    if (!dealId) return;
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}`, { project_type: newType });
      await apiClient.post(`/api/v1/deals/${dealId}/zoning-profile/resolve`);
      setChangingAssetType(false);
      await loadData(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to change asset type');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-3 text-gray-600 text-sm">Loading development capacity...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <svg className="mx-auto h-10 w-10 mb-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-amber-800">{error}</p>
        <button onClick={() => { setError(null); loadData(); }} className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline">
          Try again
        </button>
      </div>
    );
  }

  if (!profileExists) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm text-gray-600 mb-2">No zoning profile found for this deal.</p>
        <p className="text-xs text-gray-500 mb-4">Save a property boundary and confirm zoning in the previous tabs, then the profile will auto-generate.</p>
        <button
          onClick={handleResolveProfile}
          disabled={resolving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {resolving ? 'Resolving...' : 'Resolve Profile Now'}
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const isConditionalVariant = profile.base_district_code?.match(/-[A-Z]{1,2}$/);
  const hasSplitFAR = profile.residential_far != null || profile.nonresidential_far != null;
  const lotAreaAcres = profile.lot_area_sf ? parseFloat(String(profile.lot_area_sf)) / 43560 : null;
  const hasResolutionErrors = profile.resolution_errors && profile.resolution_errors.length > 0;
  const hasHeightBuffer = profile.height_buffer_ft != null && profile.height_beyond_buffer_ft != null;

  const fieldToSourceKey: Record<string, string> = {
    applied_far: 'maxFAR',
    residential_far: 'maxFAR',
    nonresidential_far: 'maxFAR',
    combined_far: 'maxFAR',
    max_density_per_acre: 'maxDensity',
    max_height_ft: 'maxHeight',
    max_stories: 'maxStories',
    max_lot_coverage_pct: 'maxLotCoverage',
    min_parking_per_unit: 'parking',
    open_space_pct: 'maxLotCoverage',
  };

  const constraintRows = [
    { field: 'applied_far', label: 'Applied FAR', value: profile.applied_far, suffix: '' },
    ...(hasSplitFAR ? [
      { field: 'residential_far', label: 'Residential FAR', value: profile.residential_far, suffix: '' },
      { field: 'nonresidential_far', label: 'Nonresidential FAR', value: profile.nonresidential_far, suffix: '' },
      { field: 'combined_far', label: 'Combined FAR', value: profile.combined_far, suffix: '' },
    ] : []),
    { field: 'max_density_per_acre', label: 'Max Density', value: profile.max_density_per_acre, suffix: ' units/acre' },
    { field: 'max_height_ft', label: 'Max Height', value: profile.max_height_ft, suffix: ' ft' },
    { field: 'max_stories', label: 'Max Stories', value: profile.max_stories, suffix: '' },
    { field: 'max_lot_coverage_pct', label: 'Lot Coverage', value: profile.max_lot_coverage_pct, suffix: '%' },
    { field: 'min_parking_per_unit', label: 'Parking Ratio', value: profile.min_parking_per_unit, suffix: ' per unit' },
    { field: 'open_space_pct', label: 'Open Space', value: profile.open_space_pct, suffix: '%' },
  ].filter(r => r.value != null || profile.user_overrides?.[r.field]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">Zoning:</span>
          <span className="text-gray-900 font-semibold">{profile.base_district_code || '--'}</span>
          {profile.municipality && <span className="text-gray-400">({profile.municipality})</span>}
          {municodeUrl && <MunicodeLink url={municodeUrl} />}
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">Lot:</span>
          <span className="text-gray-900">{formatNumber(parseFloat(String(profile.lot_area_sf)))} SF</span>
          {lotAreaAcres != null && <span className="text-gray-400">({lotAreaAcres.toFixed(2)} ac)</span>}
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">Asset Type:</span>
          {changingAssetType ? (
            <select
              value={dealInfo?.project_type || 'multifamily'}
              onChange={(e) => handleChangeAssetType(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              {PROJECT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <>
              <span className="text-gray-900 font-semibold capitalize">{(dealInfo?.project_type || 'multifamily').replace('_', '-')}</span>
              <button onClick={() => setChangingAssetType(true)} className="text-blue-500 hover:text-blue-700" title="Change asset type">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </>
          )}
        </div>
        <div className="w-px h-5 bg-gray-200" />
        {getSourceBadge(profile.constraint_source)}
        <button onClick={handleResolveProfile} disabled={resolving} className="ml-auto text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1" title="Re-resolve from base data">
          <svg className={`h-3.5 w-3.5 ${resolving ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {resolving ? 'Resolving...' : 'Re-resolve'}
        </button>
      </div>

      {hasResolutionErrors && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Resolution Warnings</p>
            {profile.resolution_errors.map((err: any, i: number) => (
              <p key={i} className="text-xs text-amber-700 mt-0.5">{err.step}: {err.message}</p>
            ))}
          </div>
        </div>
      )}

      {loadingBenchmarks && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500" />
          <span className="ml-2 text-gray-500 text-xs">Loading density benchmarks...</span>
        </div>
      )}

      {!loadingBenchmarks && densityBenchmarks && (() => {
        const avail = densityBenchmarks.dataAvailability || 'none';
        const codeProjects: any[] = densityBenchmarks.projects || [];
        const nearbyProjectsList: any[] = densityBenchmarks.nearbyProjects || [];
        const allDisplayProjects = [...codeProjects, ...nearbyProjectsList]
          .sort((a: any, b: any) => (b.similarityScore || 0) - (a.similarityScore || 0));
        const currentCode = densityBenchmarks.currentCode;
        const zonedMax = densityBenchmarks.zonedMaxDensity;
        const rezoneFrom = densityBenchmarks.rezoneFromCurrent;
        const zonedMaxFar = profile?.applied_far ?? profile?.combined_far ?? profile?.residential_far;
        const zonedMaxLotCov = profile?.max_lot_coverage_pct;
        const codeMatchCount = densityBenchmarks.codeMatchCount || 0;
        const nearbyMatchCount = densityBenchmarks.nearbyMatchCount || 0;
        const totalProjectCount = allDisplayProjects.length;
        const municipality = profile?.municipality || '';
        const bestComp = densityBenchmarks.bestComparable;

        if (avail === 'none' || allDisplayProjects.length === 0) {
          return (
            <div className="bg-gray-50 rounded-lg border border-gray-200 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm font-medium text-gray-500">Market Reality Check</span>
              </div>
              <p className="text-xs text-gray-400">
                No density benchmarks available for {currentCode || 'this zoning code'}.
              </p>
            </div>
          );
        }

        const avgDensityAll = (() => {
          const d = allDisplayProjects.filter((p: any) => p.densityAchieved != null).map((p: any) => p.densityAchieved);
          return d.length > 0 ? d.reduce((s: number, v: number) => s + v, 0) / d.length : null;
        })();
        const avgFarAll = (() => {
          const f = allDisplayProjects.filter((p: any) => p.farAchieved != null).map((p: any) => p.farAchieved);
          return f.length > 0 ? f.reduce((s: number, v: number) => s + v, 0) / f.length : null;
        })();
        const avgLotCovAll = (() => {
          const l = allDisplayProjects.filter((p: any) => p.lotCoverageAchieved != null).map((p: any) => p.lotCoverageAchieved);
          return l.length > 0 ? l.reduce((s: number, v: number) => s + v, 0) / l.length : null;
        })();
        const densityUtilPct = zonedMax && avgDensityAll ? (avgDensityAll / zonedMax) * 100 : null;
        const farUtilPct = zonedMaxFar && avgFarAll ? (avgFarAll / zonedMaxFar) * 100 : null;
        const lotCovUtilPct = zonedMaxLotCov && avgLotCovAll ? ((avgLotCovAll * 100) / zonedMaxLotCov) * 100 : null;

        const entBadgeClass = (t: string) =>
          t === 'rezone' ? 'bg-violet-50 text-violet-600 border-violet-200' :
          t === 'cup' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          t === 'variance' ? 'bg-amber-50 text-amber-600 border-amber-200' :
          'bg-gray-50 text-gray-500 border-gray-200';

        const utilBadge = (pct: number | null) => {
          if (pct == null) return null;
          const cls = pct > 70 ? 'bg-green-50 text-green-700 border-green-200' :
                      pct > 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200';
          return <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${cls}`}>{pct.toFixed(0)}%</span>;
        };

        const docLinks = (p: any) => (
          <div className="flex items-center gap-1.5">
            {p.ordinanceUrl && (
              <a href={p.ordinanceUrl} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-700" title="Ordinance PDF">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
              </a>
            )}
            {p.sourceUrl && (
              <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700" title="Source">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            )}
            {p.docketNumber && (
              <span className="text-[8px] font-mono text-gray-500 bg-gray-100 px-1 py-0.5 rounded" title="Docket">{p.docketNumber}</span>
            )}
          </div>
        );

        const visibleProjects = showAllCodes ? allDisplayProjects : allDisplayProjects.slice(0, 5);

        return (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm font-semibold text-gray-800">Market Reality Check</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  {totalProjectCount} project{totalProjectCount !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-[10px] text-gray-400">
                {codeMatchCount > 0
                  ? `${codeMatchCount} in ${currentCode}${nearbyMatchCount > 0 ? ` + ${nearbyMatchCount} nearby` : ''}`
                  : `${nearbyMatchCount} nearby${municipality ? ` in ${municipality}` : ''}`}
              </span>
            </div>

            <div className="px-5 py-4 space-y-3">
              {avail === 'sparse' && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-100">
                  <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Limited benchmark data — {totalProjectCount} comparable project{totalProjectCount !== 1 ? 's' : ''} found
                </div>
              )}

              <div className="flex items-center gap-4 flex-wrap text-[10px]">
                {avgDensityAll != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">Density:</span>
                    <span className="font-bold text-teal-700">{avgDensityAll.toFixed(1)}</span>
                    {zonedMax && <span className="text-gray-400">/ {zonedMax.toFixed(1)} u/ac</span>}
                    {utilBadge(densityUtilPct)}
                  </div>
                )}
                {avgFarAll != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">FAR:</span>
                    <span className="font-bold text-teal-700">{avgFarAll.toFixed(2)}</span>
                    {zonedMaxFar && <span className="text-gray-400">/ {zonedMaxFar.toFixed(2)}</span>}
                    {utilBadge(farUtilPct)}
                  </div>
                )}
                {avgLotCovAll != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">Lot Cov:</span>
                    <span className="font-bold text-teal-700">{(avgLotCovAll * 100).toFixed(1)}%</span>
                    {zonedMaxLotCov && <span className="text-gray-400">/ {zonedMaxLotCov.toFixed(1)}%</span>}
                    {utilBadge(lotCovUtilPct)}
                  </div>
                )}
              </div>

              {bestComp && (
                <div className="bg-teal-50 rounded-lg border border-teal-200 px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-600 text-white font-bold uppercase tracking-wide">Best Comp</span>
                      <span className="text-[10px] font-bold text-teal-800">{bestComp.similarityScore}% match</span>
                    </div>
                    {docLinks(bestComp)}
                  </div>
                  <div className="text-[12px] font-semibold text-gray-900 truncate">
                    {bestComp.projectName || bestComp.address || 'Address not available'}
                  </div>
                  {bestComp.projectName && bestComp.address && bestComp.projectName !== bestComp.address && (
                    <div className="text-[10px] text-gray-500 truncate">{bestComp.address}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px]">
                    {bestComp.landAcres != null && (
                      <span className="text-gray-600"><span className="font-semibold">{bestComp.landAcres.toFixed(2)}</span> ac</span>
                    )}
                    {bestComp.unitCount != null && (
                      <span className="text-gray-600"><span className="font-semibold">{bestComp.unitCount.toLocaleString()}</span> units</span>
                    )}
                    {bestComp.densityAchieved != null && (
                      <span className="text-teal-700 font-bold">{bestComp.densityAchieved.toFixed(1)} u/ac</span>
                    )}
                    {bestComp.farAchieved != null && (
                      <span className="text-gray-600">FAR <span className="font-semibold">{bestComp.farAchieved.toFixed(2)}</span></span>
                    )}
                    {bestComp.stories != null && (
                      <span className="text-gray-600"><span className="font-semibold">{bestComp.stories}</span> stories</span>
                    )}
                    {bestComp.buildingSf != null && (
                      <span className="text-gray-600"><span className="font-semibold">{formatNumber(bestComp.buildingSf)}</span> SF</span>
                    )}
                    {bestComp.entitlementType && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${entBadgeClass(bestComp.entitlementType)}`}>
                        {bestComp.entitlementType}
                      </span>
                    )}
                    {(bestComp.zoningFrom || bestComp.zoningTo) && (
                      <span className="text-gray-500">
                        {bestComp.zoningFrom && <span>{bestComp.zoningFrom}</span>}
                        {bestComp.zoningFrom && bestComp.zoningTo && <span> → </span>}
                        {bestComp.zoningTo && <span className="font-medium text-gray-700">{bestComp.zoningTo}</span>}
                      </span>
                    )}
                    {bestComp.totalEntitlementDays != null && (
                      <span className="text-gray-500">{Math.round(bestComp.totalEntitlementDays / 30)} mo timeline</span>
                    )}
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-1.5 text-gray-500 font-medium w-6">#</th>
                      <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Project</th>
                      <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Lot</th>
                      <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Units</th>
                      <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Density</th>
                      <th className="text-center px-2 py-1.5 text-gray-500 font-medium">Path</th>
                      <th className="text-center px-2 py-1.5 text-gray-500 font-medium">Score</th>
                      <th className="text-center px-2 py-1.5 text-gray-500 font-medium">Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProjects.map((p: any, i: number) => (
                      <tr key={i} className={`border-b border-gray-100 last:border-0 ${bestComp && p.address === bestComp.address && p.similarityScore === bestComp.similarityScore ? 'bg-teal-50/30' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-1.5 text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          <div className="text-[11px] font-medium text-gray-800 truncate max-w-[200px]">
                            {p.projectName || p.address || 'N/A'}
                          </div>
                          {p.projectName && p.address && p.projectName !== p.address && (
                            <div className="text-[9px] text-gray-400 truncate max-w-[200px]">{p.address}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">
                          {p.landAcres != null ? `${p.landAcres.toFixed(2)} ac` : '--'}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">
                          {p.unitCount != null ? p.unitCount.toLocaleString() : '--'}
                        </td>
                        <td className="px-2 py-1.5 text-right font-bold text-teal-700 whitespace-nowrap">
                          {p.densityAchieved != null ? `${p.densityAchieved.toFixed(1)}` : '--'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`text-[8px] px-1 py-0.5 rounded border ${entBadgeClass(p.entitlementType || '')}`}>
                            {p.entitlementType || '--'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`text-[9px] font-bold ${
                            p.similarityScore >= 60 ? 'text-green-600' :
                            p.similarityScore >= 30 ? 'text-amber-600' :
                            'text-gray-400'
                          }`}>{p.similarityScore}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {docLinks(p)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allDisplayProjects.length > 5 && (
                <button
                  onClick={() => setShowAllCodes(!showAllCodes)}
                  className="text-[11px] text-teal-600 hover:text-teal-800 font-medium py-1"
                >
                  {showAllCodes ? 'Show top 5 only' : `Show all ${allDisplayProjects.length} projects`}
                </button>
              )}

              {rezoneFrom && rezoneFrom.projectCount > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-600">
                    Projects That Left {currentCode}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rezoneFrom.targetCodes.map((code: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                        → {code}
                      </span>
                    ))}
                  </div>
                  <div className="grid gap-1.5">
                    {rezoneFrom.projects.slice(0, 5).map((p: any, i: number) => (
                      <div key={i} className="bg-violet-50/50 rounded px-3 py-1.5 border border-violet-100">
                        <div className="flex items-center justify-between text-[11px] text-gray-600">
                          <span className="truncate mr-2">{p.address || '--'}</span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-violet-600 font-medium">→ {p.zoningTo}</span>
                            {p.densityAchieved != null && (
                              <span className="font-bold text-teal-700">{p.densityAchieved.toFixed(1)} u/ac</span>
                            )}
                            {p.unitCount != null && (
                              <span className="text-gray-400">{p.unitCount} units</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Entitlement Comparison */}
      {(() => {
        const cols = comparison?.columns || [];
        const dynRows = comparison?.rows || [];
        const cells = comparison?.cells || {};
        const hasData = cols.length > 0 || recommendations.length > 0;
        if (!hasData && !loadingRecs && !loading && profileExists) return null;
        if (!profileExists && !loading) return null;

        const allBenchProjects = [...(densityBenchmarks?.projects || []), ...(densityBenchmarks?.nearbyProjects || [])];

        const mrcCodes = (() => {
          const invalidCodePattern = /site|plan|drive|thru|allowed|permit|admin/i;
          const codes = new Set<string>();
          allBenchProjects.forEach((p: any) => {
            const c = p.zoningTo || p.zoningFrom;
            if (c && !invalidCodePattern.test(c)) codes.add(c);
          });
          return Array.from(codes).sort();
        })();

        const rezone = recommendations.find((r: any) => r.name === 'Rezone');

        const colWidth = cols.length > 0 ? `${Math.floor(82 / cols.length)}%` : '27%';

        return (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Entitlement Comparison</h3>
                  <p className="text-xs text-gray-500 mt-0.5">AI-analyzed development capacity across entitlement paths</p>
                </div>
                {(loadingRecs || loading) && !comparison && (
                  <div className="flex items-center gap-1.5">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-500" />
                    <span className="text-[10px] text-gray-400">{loadingRecs ? 'Analyzing paths...' : 'Loading profile...'}</span>
                  </div>
                )}
              </div>
            </div>

            {(loadingRecs || loading) && cols.length === 0 ? (
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50">
                        <th className="text-left px-4 py-2.5 w-[18%]" />
                        {[1, 2, 3, 4].map(i => (
                          <th key={i} className="text-center px-3 py-2.5" style={{ width: '20%' }}>
                            <div className="flex flex-col items-center gap-1">
                              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                              <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {['Zoning Code', 'Density', 'FAR', 'Max Units', 'GBA', 'Stories', 'Parking', 'Binding Constraint'].map((label, idx) => (
                        <tr key={label} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          <td className="px-4 py-2.5 text-xs font-medium text-gray-400">{label}</td>
                          {[1, 2, 3, 4].map(i => (
                            <td key={i} className="px-3 py-2.5 text-center">
                              <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mx-auto" />
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                        <td className="px-4 py-3 text-xs font-bold text-gray-400">Select Path</td>
                        {[1, 2, 3, 4].map(i => (
                          <td key={i} className="px-3 py-3 text-center">
                            <div className="h-7 w-16 bg-gray-200 rounded-lg animate-pulse mx-auto" />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-center py-4 border-t border-gray-100 gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                  <span className="text-xs text-gray-500">Computing entitlement paths across zoning constraints...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50">
                        <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[10px] uppercase tracking-wider w-[18%]" />
                        {cols.map((col: any) => (
                          <th key={col.key} className="text-center px-3 py-2.5" style={{ width: colWidth }}>
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs font-bold text-gray-900">{col.label}</span>
                              {col.risk && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                  col.risk === 'Low' ? 'bg-green-50 text-green-700 border border-green-200' :
                                  col.risk === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-red-50 text-red-700 border border-red-200'
                                }`}>{col.risk}</span>
                              )}
                            </div>
                            {col.successRate && (
                              <div className="text-[10px] text-gray-400 mt-0.5">{col.successRate} success · {col.timeline}</div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 bg-blue-50/30">
                        <td className="px-4 py-2 text-xs font-medium text-gray-600">Avg Unit Size</td>
                        <td colSpan={cols.length} className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="400"
                              max="2000"
                              step="50"
                              value={avgUnitSize}
                              onChange={(e) => setAvgUnitSize(Math.max(400, Math.min(2000, parseInt(e.target.value) || 900)))}
                              className="w-16 text-xs text-center border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            />
                            <span className="text-xs text-gray-500">SF</span>
                            {avgUnitSize !== 900 && (
                              <button onClick={() => setAvgUnitSize(900)} className="text-[10px] text-blue-500 hover:text-blue-700 ml-1">reset</button>
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-blue-50/30">
                        <td className="px-4 py-2 text-xs font-medium text-gray-600">Controls</td>
                        {cols.map((col: any) => (
                          <td key={col.key} className="px-3 py-2 text-center">
                            {col.key === 'variance' ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs text-gray-500">+</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={variancePct}
                                  onChange={(e) => setVariancePct(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                                  className="w-14 text-xs text-center border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            ) : col.key === 'rezone' ? (
                              <div>
                                <div className="relative">
                                  <select
                                    value={rezoneTargetCode}
                                    onChange={(e) => setRezoneTargetCode(e.target.value)}
                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white appearance-none pr-6"
                                  >
                                    <option value="">{rezone?.zoningCode ? `${rezone.zoningCode} (auto)` : 'Select code...'}</option>
                                    {mrcCodes.map((c: string) => (
                                      <option key={c} value={c}>{c}{c === profile?.base_district_code ? ' (current)' : ''}</option>
                                    ))}
                                    <option value="__custom__">Custom code...</option>
                                  </select>
                                  <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                                {rezoneTargetCode === '__custom__' && (
                                  <input
                                    type="text"
                                    placeholder="Enter code..."
                                    value={customRezoneCode}
                                    onChange={(e) => setCustomRezoneCode(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && customRezoneCode.trim()) setRezoneTargetCode(customRezoneCode.trim()); }}
                                    onBlur={() => { if (customRezoneCode.trim()) setRezoneTargetCode(customRezoneCode.trim()); }}
                                    className="mt-1 w-full text-xs border border-violet-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                                    autoFocus
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">--</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      {dynRows.map((row: any) => (
                        <tr key={row.key} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2 text-xs font-medium text-gray-600">{row.label}</td>
                          {cols.map((col: any) => {
                            const cellVal = cells[col.key]?.[row.key] || '--';
                            const displayVal = row.key === 'bindingConstraint' && cellVal !== '--' ? getLimitingLabel(cellVal) : cellVal;
                            const deltaUnits = parseInt(cells[col.key]?.deltaUnits || '0');
                            const showDelta = col.key !== 'byRight' && row.key === 'maxUnits' && deltaUnits !== 0;
                            return (
                              <td key={col.key} className={`px-3 py-2 text-center text-xs ${col.key === 'byRight' ? 'text-gray-900 font-medium' : 'text-gray-800'}`}>
                                {displayVal}
                                {showDelta && (
                                  <span className={`ml-1 text-[10px] ${deltaUnits > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {deltaUnits > 0 ? '+' : ''}{deltaUnits}%
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {cols.some((col: any) => col.aiInsight) && (
                        <tr className="border-b border-gray-100">
                          <td className="px-4 py-2.5 text-xs font-medium text-gray-600 align-top">AI Insight</td>
                          {cols.map((col: any) => (
                            <td key={col.key} className="px-3 py-2.5 text-left">
                              {col.aiInsight ? (
                                <p className="text-[11px] text-gray-600 leading-relaxed bg-gray-50 rounded px-2 py-1.5">{col.aiInsight}</p>
                              ) : (
                                <span className="text-xs text-gray-400">--</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      )}
                      <tr className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                        <td className="px-4 py-3 text-xs font-bold text-gray-700">Select Path</td>
                        {cols.map((col: any, colIdx: number) => {
                          const isSelected = selectedColKey === col.key;
                          const rec = recommendations[colIdx];
                          return (
                            <td key={col.key} className="px-3 py-3 text-center">
                              <button
                                onClick={() => rec && handleSelectPath(col.key, rec)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                                    : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 hover:border-blue-400'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    Selected
                                  </>
                                ) : (
                                  <>Select</>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {comparison?.aiSummary && (
                  <div className="px-5 py-3 border-t border-gray-100 bg-blue-50/30">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5 flex-shrink-0">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <p className="text-[11px] text-gray-700 leading-relaxed">{comparison.aiSummary}</p>
                    </div>
                  </div>
                )}
                {development_path && (
                  <div className="px-5 py-3 border-t border-blue-200 bg-blue-50">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <span className="text-xs font-bold text-blue-900">
                          Path: {development_path.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span className="text-[10px] text-blue-600 ml-3">
                          Envelope sent to 3D Design, Strategy, ProForma, and Risk modules
                        </span>
                      </div>
                      <button
                        onClick={() => { selectDevelopmentPath(null, null); setSelectedColKey(null); }}
                        className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}



      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Zoning Constraint Matrix</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                All constraints in one view. Click the pencil icon to override values.
                {profile.density_method === 'far_derived' && (
                  <span className="ml-2 text-blue-600 font-medium">Density: FAR-derived (no cap)</span>
                )}
              </p>
            </div>
            {enrichment?.limitingFactor && (
              <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 font-medium flex-shrink-0">
                Controlling: {getLimitingLabel(enrichment.limitingFactor)}
              </span>
            )}
          </div>
          {isConditionalVariant && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-[11px] text-amber-800">
                <span className="font-medium">Conditional Variant ({profile.base_district_code}):</span>{' '}
                The "-C" suffix indicates a conditional ordinance. Standards inherited from base district. Review before finalizing.
              </p>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[10px] uppercase tracking-wider w-[15%]">Constraint</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[10px] uppercase tracking-wider w-[15%]">Zoned Value</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[10px] uppercase tracking-wider w-[10%]">Citation</th>
                <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-[10px] uppercase tracking-wider w-[15%]">Capacity</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[10px] uppercase tracking-wider w-[35%]">Formula</th>
                <th className="text-center px-4 py-2.5 text-gray-500 font-medium text-[10px] uppercase tracking-wider w-[10%]">Controlling</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const capacityKeyMap: Record<string, string> = {
                  applied_far: 'byFAR',
                  residential_far: 'byFAR',
                  max_density_per_acre: 'byDensity',
                  max_height_ft: 'byHeight',
                  min_parking_per_unit: 'byParking',
                };
                const limitingFieldMap: Record<string, string[]> = {
                  FAR: ['applied_far', 'residential_far', 'nonresidential_far', 'combined_far'],
                  density: ['max_density_per_acre'],
                  height: ['max_height_ft', 'max_stories'],
                  parking: ['min_parking_per_unit'],
                };
                const calcNameFieldMap: Record<string, string[]> = {
                  applied_far: ['far', 'floor area', 'gba by far'],
                  residential_far: ['far', 'floor area', 'residential far'],
                  nonresidential_far: ['nonresidential far'],
                  combined_far: ['combined far'],
                  max_density_per_acre: ['density', 'units by density'],
                  max_height_ft: ['height', 'stories by height'],
                  max_stories: ['stories', 'height'],
                  max_lot_coverage_pct: ['lot coverage', 'footprint', 'max footprint'],
                  min_parking_per_unit: ['parking'],
                  open_space_pct: ['open space'],
                };

                return constraintRows.map(row => {
                  const isOverridden = profile.user_overrides?.[row.field] != null;
                  const displayValue = row.value != null ? `${row.value}${row.suffix}` : '--';
                  const sourceKey = fieldToSourceKey[row.field];
                  const source = enrichment?.sources?.[sourceKey];
                  const capacityKey = capacityKeyMap[row.field];
                  const capacity = capacityKey ? enrichment?.capacityByConstraint?.[capacityKey as keyof typeof enrichment.capacityByConstraint] : null;
                  const isControlling = enrichment?.limitingFactor ? (limitingFieldMap[enrichment.limitingFactor] || []).includes(row.field) : false;
                  const matchingCalc = enrichment?.calculations?.find(calc => {
                    const keywords = calcNameFieldMap[row.field] || [];
                    const calcNameLower = calc.name.toLowerCase();
                    return keywords.some(kw => calcNameLower.includes(kw));
                  });

                  return (
                    <tr
                      key={row.field}
                      className={`border-b border-gray-50 group hover:bg-gray-50/50 ${isControlling ? 'bg-red-50/40' : ''}`}
                    >
                      <td className={`px-4 py-2.5 ${isControlling ? 'border-l-3 border-l-red-400' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium ${isControlling ? 'text-red-800' : 'text-gray-700'}`}>{row.label}</span>
                          {isOverridden && <span className="text-[9px] text-purple-500 bg-purple-50 px-1 rounded">override</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {editingConstraint === row.field ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                autoFocus
                              />
                              <button onClick={() => handleSaveOverride(row.field)} className="text-green-600 hover:text-green-800">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button onClick={() => setEditingConstraint(null)} className="text-gray-400 hover:text-gray-600">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className={`text-sm font-semibold ${isOverridden ? 'text-purple-700' : isControlling ? 'text-red-800' : row.field === 'applied_far' ? 'text-blue-700' : 'text-gray-900'}`}>
                                {displayValue}
                              </span>
                              <button
                                onClick={() => { setEditingConstraint(row.field); setEditValue(String(row.value ?? '')); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"
                                title="Override this constraint"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {source?.sectionNumber ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (source.sourceUrl) window.open(source.sourceUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 hover:text-violet-800 hover:underline cursor-pointer transition-colors"
                            title={source.sectionTitle ? `${source.sectionNumber} — ${source.sectionTitle}` : source.sectionNumber || ''}
                          >
                            §{source.sectionNumber}
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-300">--</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {capacity != null ? (
                          <span className={`text-xs font-semibold ${isControlling ? 'text-red-700' : 'text-gray-900'}`}>
                            {formatNumber(capacity)} units
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300">--</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {matchingCalc ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500 font-mono truncate">{matchingCalc.formula}</span>
                            {matchingCalc.sectionNumber && (
                              <button
                                onClick={() => {
                                  if (matchingCalc.sourceUrl) window.open(matchingCalc.sourceUrl, '_blank', 'noopener,noreferrer');
                                }}
                                className="text-[10px] font-medium text-violet-600 hover:text-violet-800 hover:underline cursor-pointer flex-shrink-0"
                              >
                                §{matchingCalc.sectionNumber}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300">--</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isControlling && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
                            <svg className="h-3 w-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
              <tr className="bg-gray-50/50">
                <td className="px-4 py-2.5">
                  <span className="text-xs font-medium text-gray-700">Setbacks</span>
                </td>
                <td className="px-4 py-2.5" colSpan={4}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-gray-600">Front: <span className="font-semibold text-gray-900">{profile.setback_front_ft ?? '--'} ft</span></span>
                    <span className="text-xs text-gray-600">Side: <span className="font-semibold text-gray-900">{profile.setback_side_ft ?? '--'} ft</span></span>
                    <span className="text-xs text-gray-600">Rear: <span className="font-semibold text-gray-900">{profile.setback_rear_ft ?? '--'} ft</span></span>
                    {enrichment?.sources?.frontSetback?.sectionNumber && (
                      <button
                        onClick={() => {
                          if (enrichment.sources.frontSetback.sourceUrl) window.open(enrichment.sources.frontSetback.sourceUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="text-[10px] font-medium text-violet-600 hover:text-violet-800 hover:underline cursor-pointer"
                      >
                        §{enrichment.sources.frontSetback.sectionNumber}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5" />
              </tr>
            </tbody>
          </table>
        </div>
        {hasHeightBuffer && (
          <div className="border-t border-gray-100 px-5 py-2.5 bg-blue-50">
            <p className="text-xs text-blue-800">
              <span className="font-medium">Height Buffer Rule:</span>{' '}
              {profile.max_height_ft} ft within {profile.height_buffer_ft} ft of residential districts;{' '}
              {profile.height_beyond_buffer_ft} ft beyond
            </p>
          </div>
        )}
        {enrichment?.insights?.controllingFactor && (
          <div className="border-t border-gray-100 px-5 py-2.5 bg-blue-50/50">
            <p className="text-xs text-blue-800">{enrichment.insights.controllingFactor}</p>
          </div>
        )}
      </div>

    </div>
  );
}
