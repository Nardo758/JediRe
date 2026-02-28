import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../../services/api.client';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
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

interface Scenario {
  id: string;
  deal_id: string;
  name: string;
  is_active: boolean;
  use_mix: { residential_pct?: number; retail_pct?: number; office_pct?: number };
  avg_unit_size_sf: number;
  efficiency_factor: number;
  max_gba: number | null;
  max_footprint: number | null;
  net_leasable_sf: number | null;
  parking_required: number | null;
  open_space_sf: number | null;
  max_stories: number | null;
  max_units: number | null;
  applied_far: number | null;
  binding_constraint: string | null;
  flags: string[];
  target_district_id: string | null;
  target_district_code: string | null;
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

export default function DevelopmentCapacityTab({ dealId, deal }: DevelopmentCapacityTabProps) {
  const [profile, setProfile] = useState<ZoningProfile | null>(null);
  const [dealInfo, setDealInfo] = useState<any>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddScenario, setShowAddScenario] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newResidentialPct, setNewResidentialPct] = useState(100);
  const [newRetailPct, setNewRetailPct] = useState(0);
  const [newOfficePct, setNewOfficePct] = useState(0);
  const [newUnitSize, setNewUnitSize] = useState(900);
  const [newEfficiency, setNewEfficiency] = useState(0.85);
  const [newZoningCode, setNewZoningCode] = useState('');
  const [newZoningLookupResult, setNewZoningLookupResult] = useState<any>(null);
  const [newZoningLookupLoading, setNewZoningLookupLoading] = useState(false);
  const [newZoningLookupMessage, setNewZoningLookupMessage] = useState('');
  const [editingScenarioCode, setEditingScenarioCode] = useState<string | null>(null);
  const [scenarioCodeInput, setScenarioCodeInput] = useState('');
  const [scenarioCodeLookupResult, setScenarioCodeLookupResult] = useState<any>(null);
  const [scenarioCodeLookupLoading, setScenarioCodeLookupLoading] = useState(false);
  const [scenarioCodeLookupMessage, setScenarioCodeLookupMessage] = useState('');
  const [editingConstraint, setEditingConstraint] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [changingAssetType, setChangingAssetType] = useState(false);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [entitlementStrategy, setEntitlementStrategy] = useState<any>(null);
  const [municodeUrl, setMunicodeUrl] = useState<string | null>(null);
  const [rezoneAnalysis, setRezoneAnalysis] = useState<any>(null);
  const [loadingRezone, setLoadingRezone] = useState(false);
  const [enrichment, setEnrichment] = useState<EnvelopeEnrichment | null>(null);
  const rezoneScenarioCreatedRef = useRef(false);
  const [densityBenchmarks, setDensityBenchmarks] = useState<any>(null);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);
  const [showAllCodes, setShowAllCodes] = useState(false);

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

      const scenariosRes = await apiClient.get(`/api/v1/deals/${dealId}/scenarios`);
      let scenariosList = scenariosRes.data.scenarios || [];

      if (profileData.exists && scenariosList.length === 0) {
        try {
          const projectType = profileData.deal?.project_type || 'multifamily';
          const typeLabel = projectType.replace('_', '-').replace(/\b\w/g, (c: string) => c.toUpperCase());
          await apiClient.post(`/api/v1/deals/${dealId}/scenarios`, {
            name: `By-Right ${typeLabel}`,
            use_mix: { residential_pct: 100 },
            avg_unit_size_sf: 900,
            efficiency_factor: 0.85,
            is_active: true,
          });
          const refreshRes = await apiClient.get(`/api/v1/deals/${dealId}/scenarios`);
          scenariosList = refreshRes.data.scenarios || [];
        } catch {
        }
      }

      setScenarios(scenariosList);

      if (profileData.exists) {
        setLoadingRecs(true);
        setLoadingRezone(true);
        try {
          const recsRes = await apiClient.get(`/api/v1/deals/${dealId}/scenarios/recommendations`);
          const recsData = recsRes.data.recommendations || [];
          setRecommendations(recsData);
          const rezoneRec = recsData.find((r: any) => r.name === 'Rezone');
          if (rezoneRec?.entitlementPatterns) {
            setEntitlementStrategy({
              patterns: rezoneRec.entitlementPatterns,
              strategyInsight: rezoneRec.strategyInsight,
              recommendedPath: rezoneRec.recommendedPath,
            });
          }
        } catch {
          setRecommendations([]);
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
          const rezoneRes = await apiClient.get(`/api/v1/deals/${dealId}/rezone-analysis`);
          setRezoneAnalysis(rezoneRes.data);

          if (rezoneRes.data?.bestTarget && !rezoneScenarioCreatedRef.current) {
            const best = rezoneRes.data.bestTarget;
            const existingRezoneScenario = scenariosList.find(
              (s: any) => s.name?.startsWith('Rezone to ')
            );
            if (!existingRezoneScenario) {
              try {
                await apiClient.post(`/api/v1/deals/${dealId}/scenarios`, {
                  name: `Rezone to ${best.targetDistrictCode}`,
                  use_mix: { residential_pct: 100 },
                  avg_unit_size_sf: 900,
                  efficiency_factor: 0.85,
                  is_active: false,
                  target_district_id: best.targetDistrictId || null,
                  target_district_code: best.targetDistrictCode || null,
                });
                const refreshRes = await apiClient.get(`/api/v1/deals/${dealId}/scenarios`);
                scenariosList = refreshRes.data.scenarios || [];
                setScenarios(scenariosList);
                rezoneScenarioCreatedRef.current = true;
              } catch {}
            }
          }
        } catch {
          setRezoneAnalysis(null);
        } finally {
          setLoadingRezone(false);
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load capacity data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { loadData(); }, [loadData]);

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

  const lookupZoningCode = async (code: string, target: 'new' | 'edit') => {
    if (!dealId || !code.trim()) {
      if (target === 'new') {
        setNewZoningLookupResult(null);
        setNewZoningLookupMessage('');
      } else {
        setScenarioCodeLookupResult(null);
        setScenarioCodeLookupMessage('');
      }
      return;
    }
    if (target === 'new') {
      setNewZoningLookupLoading(true);
      setNewZoningLookupMessage('');
    } else {
      setScenarioCodeLookupLoading(true);
      setScenarioCodeLookupMessage('');
    }
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/scenarios/lookup-district`, {
        params: { code: code.trim() },
      });
      if (target === 'new') {
        if (res.data.found) {
          setNewZoningLookupResult(res.data.district);
          setNewZoningLookupMessage('');
        } else {
          setNewZoningLookupResult(null);
          setNewZoningLookupMessage(res.data.message || 'Code not in database — enter constraints manually');
        }
      } else {
        if (res.data.found) {
          setScenarioCodeLookupResult(res.data.district);
          setScenarioCodeLookupMessage('');
        } else {
          setScenarioCodeLookupResult(null);
          setScenarioCodeLookupMessage(res.data.message || 'Code not in database — enter constraints manually');
        }
      }
    } catch {
      if (target === 'new') {
        setNewZoningLookupResult(null);
        setNewZoningLookupMessage('Failed to look up code');
      } else {
        setScenarioCodeLookupResult(null);
        setScenarioCodeLookupMessage('Failed to look up code');
      }
    } finally {
      if (target === 'new') setNewZoningLookupLoading(false);
      else setScenarioCodeLookupLoading(false);
    }
  };

  const handleCreateScenario = async () => {
    if (!dealId) return;
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/scenarios`, {
        name: newScenarioName || 'New Scenario',
        use_mix: { residential_pct: newResidentialPct, retail_pct: newRetailPct, office_pct: newOfficePct },
        avg_unit_size_sf: newUnitSize,
        efficiency_factor: newEfficiency,
        is_active: scenarios.length === 0,
        target_district_code: newZoningCode.trim() || null,
      });
      setShowAddScenario(false);
      setNewScenarioName('');
      setNewResidentialPct(100);
      setNewRetailPct(0);
      setNewOfficePct(0);
      setNewUnitSize(900);
      setNewEfficiency(0.85);
      setNewZoningCode('');
      setNewZoningLookupResult(null);
      setNewZoningLookupMessage('');
      await loadData(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create scenario');
    }
  };

  const handleUpdateScenarioCode = async (scenarioId: string, code: string) => {
    if (!dealId) return;
    try {
      await apiClient.put(`/api/v1/deals/${dealId}/scenarios/${scenarioId}`, {
        target_district_code: code.trim() || null,
      });
      setEditingScenarioCode(null);
      setScenarioCodeInput('');
      setScenarioCodeLookupResult(null);
      setScenarioCodeLookupMessage('');
      await loadData(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update scenario zoning code');
    }
  };

  const handleActivateScenario = async (scenarioId: string) => {
    if (!dealId) return;
    try {
      await apiClient.put(`/api/v1/deals/${dealId}/scenarios/${scenarioId}/activate`);
      await loadData(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to activate scenario');
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!dealId) return;
    try {
      await apiClient.delete(`/api/v1/deals/${dealId}/scenarios/${scenarioId}`);
      await loadData(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete scenario');
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
      const scenarioIds = scenarios.map(s => s.id);
      for (const sid of scenarioIds) {
        await apiClient.put(`/api/v1/deals/${dealId}/scenarios/${sid}`, {});
      }
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

  const activeScenario = scenarios.find(s => s.is_active);

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
        const allDisplayProjects = [...codeProjects, ...nearbyProjectsList];
        const currentCode = densityBenchmarks.currentCode;
        const zonedMax = densityBenchmarks.zonedMaxDensity;
        const rezoneFrom = densityBenchmarks.rezoneFromCurrent;
        const zonedMaxFar = profile?.applied_far ?? profile?.combined_far ?? profile?.residential_far;
        const zonedMaxLotCov = profile?.max_lot_coverage_pct;
        const codeMatchCount = densityBenchmarks.codeMatchCount || 0;
        const nearbyMatchCount = densityBenchmarks.nearbyMatchCount || 0;
        const totalProjectCount = allDisplayProjects.length;
        const municipality = profile?.municipality || '';

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

        const invalidCodePattern = /site|plan|drive|thru|allowed|permit|admin/i;
        const isValidZoningCode = (c: string) => c && c !== 'Other' && !invalidCodePattern.test(c);

        const codeGroups: Record<string, any[]> = {};
        allDisplayProjects.forEach((p: any) => {
          const rawCode = p.zoningTo || p.zoningFrom || 'Other';
          const code = isValidZoningCode(rawCode) ? rawCode : 'Other';
          if (!codeGroups[code]) codeGroups[code] = [];
          codeGroups[code].push(p);
        });

        const getGroupAvgDensity = (projs: any[]) => {
          const d = projs.filter((p: any) => p.densityAchieved != null).map((p: any) => p.densityAchieved);
          return d.length > 0 ? d.reduce((s: number, v: number) => s + v, 0) / d.length : 0;
        };

        const sortedCodes = Object.keys(codeGroups).sort((a, b) => {
          if (a === 'Other') return 1;
          if (b === 'Other') return -1;
          return getGroupAvgDensity(codeGroups[b]) - getGroupAvgDensity(codeGroups[a]);
        });

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
              {codeMatchCount === 0 && nearbyMatchCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-100">
                  <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  No exact {currentCode} matches — showing nearby development data{municipality ? ` from ${municipality}` : ''}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
              {(showAllCodes ? sortedCodes : sortedCodes.slice(0, 3)).map((code) => {
                const groupProjects = codeGroups[code];
                const isDealCode = code === currentCode;
                const densities = groupProjects.filter((p: any) => p.densityAchieved != null).map((p: any) => p.densityAchieved);
                const avgDensity = densities.length > 0 ? densities.reduce((s: number, v: number) => s + v, 0) / densities.length : null;
                const fars = groupProjects.filter((p: any) => p.farAchieved != null).map((p: any) => p.farAchieved);
                const avgFar = fars.length > 0 ? fars.reduce((s: number, v: number) => s + v, 0) / fars.length : null;
                const lotCovs = groupProjects.filter((p: any) => p.lotCoverageAchieved != null).map((p: any) => p.lotCoverageAchieved);
                const avgLotCov = lotCovs.length > 0 ? lotCovs.reduce((s: number, v: number) => s + v, 0) / lotCovs.length : null;
                const bldgSfs = groupProjects.filter((p: any) => p.buildingSf != null).map((p: any) => p.buildingSf);
                const avgBldgSf = bldgSfs.length > 0 ? bldgSfs.reduce((s: number, v: number) => s + v, 0) / bldgSfs.length : null;
                const lotAcres = groupProjects.filter((p: any) => p.landAcres != null).map((p: any) => p.landAcres);
                const avgLot = lotAcres.length > 0 ? lotAcres.reduce((s: number, v: number) => s + v, 0) / lotAcres.length : null;

                const cardZonedMax = isDealCode ? zonedMax : null;
                const cardZonedFar = isDealCode ? zonedMaxFar : null;
                const cardZonedLotCov = isDealCode ? zonedMaxLotCov : null;
                const densityUtilPct = cardZonedMax && avgDensity ? (avgDensity / cardZonedMax) * 100 : null;
                const farUtilPct = cardZonedFar && avgFar ? (avgFar / cardZonedFar) * 100 : null;
                const lotCovUtilPct = cardZonedLotCov && avgLotCov ? ((avgLotCov * 100) / cardZonedLotCov) * 100 : null;

                const allDensities = [...(cardZonedMax ? [cardZonedMax] : []), ...(avgDensity ? [avgDensity] : []), ...densities];
                const barMaxVal = allDensities.length > 0 ? Math.max(...allDensities) : 1;
                const barScale = barMaxVal > 0 ? 100 / barMaxVal : 1;

                return (
                  <div key={code} className={`rounded-lg border overflow-hidden ${isDealCode ? 'border-teal-200 bg-teal-50/20' : 'border-gray-200'}`}>
                    <div className={`px-3 py-2 flex items-center justify-between ${isDealCode ? 'bg-teal-50 border-b border-teal-100' : 'bg-gray-50 border-b border-gray-100'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-bold ${isDealCode ? 'text-teal-800' : 'text-gray-700'}`}>{code}</span>
                        {isDealCode && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 font-medium">YOUR CODE</span>
                        )}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        {groupProjects.length} project{groupProjects.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="px-3 py-2 space-y-2">
                      {avgDensity != null && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-medium text-gray-600">
                            {cardZonedMax ? 'Zoned Max vs Achieved Density' : 'Achieved Density'}
                          </div>
                          <div className="space-y-1">
                            {cardZonedMax && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-gray-500 w-16 text-right shrink-0">Code allows</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden relative">
                                  <div className="bg-blue-200 h-full rounded-full transition-all" style={{ width: `${Math.min(cardZonedMax * barScale, 100)}%` }} />
                                  <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[8px] font-semibold text-blue-800">{cardZonedMax.toFixed(1)} u/ac</span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-gray-500 w-16 text-right shrink-0">Avg achieved</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden relative">
                                <div className="bg-teal-400 h-full rounded-full transition-all" style={{ width: `${Math.min(avgDensity * barScale, 100)}%` }} />
                                <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[8px] font-semibold text-teal-800">{avgDensity.toFixed(1)} u/ac</span>
                              </div>
                            </div>
                          </div>
                          {densityUtilPct != null && (
                            <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${
                              densityUtilPct > 70 ? 'bg-green-50 text-green-700 border-green-200' :
                              densityUtilPct > 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>{densityUtilPct.toFixed(0)}% utilization</span>
                          )}
                        </div>
                      )}

                      {avgFar != null && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-medium text-gray-600">
                            {cardZonedFar ? 'Zoned Max vs Achieved FAR' : 'Achieved FAR'}
                          </div>
                          {(() => {
                            const fMax = Math.max(cardZonedFar || 0, avgFar);
                            const fScale = fMax > 0 ? 100 / fMax : 1;
                            return (
                              <div className="space-y-1">
                                {cardZonedFar != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-gray-500 w-16 text-right shrink-0">Code allows</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden relative">
                                      <div className="bg-blue-200 h-full rounded-full transition-all" style={{ width: `${Math.min(cardZonedFar * fScale, 100)}%` }} />
                                      <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[8px] font-semibold text-blue-800">{cardZonedFar.toFixed(2)} FAR</span>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-gray-500 w-16 text-right shrink-0">Avg achieved</span>
                                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden relative">
                                    <div className="bg-teal-400 h-full rounded-full transition-all" style={{ width: `${Math.min(avgFar * fScale, 100)}%` }} />
                                    <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[8px] font-semibold text-teal-800">{avgFar.toFixed(2)} FAR</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {farUtilPct != null && (
                            <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${
                              farUtilPct > 70 ? 'bg-green-50 text-green-700 border-green-200' :
                              farUtilPct > 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>{farUtilPct.toFixed(0)}% utilization</span>
                          )}
                        </div>
                      )}

                      {avgLotCov != null && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-medium text-gray-600">
                            {cardZonedLotCov ? 'Zoned Max vs Achieved Lot Coverage' : 'Achieved Lot Coverage'}
                          </div>
                          {(() => {
                            const lMax = Math.max(cardZonedLotCov || 0, avgLotCov);
                            const lScale = lMax > 0 ? 100 / lMax : 1;
                            return (
                              <div className="space-y-1">
                                {cardZonedLotCov != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-gray-500 w-16 text-right shrink-0">Code allows</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden relative">
                                      <div className="bg-blue-200 h-full rounded-full transition-all" style={{ width: `${Math.min(cardZonedLotCov * lScale, 100)}%` }} />
                                      <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[8px] font-semibold text-blue-800">{cardZonedLotCov.toFixed(1)}%</span>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-gray-500 w-16 text-right shrink-0">Avg achieved</span>
                                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden relative">
                                    <div className="bg-teal-400 h-full rounded-full transition-all" style={{ width: `${Math.min(avgLotCov * lScale, 100)}%` }} />
                                    <span className="absolute inset-0 flex items-center justify-end pr-1.5 text-[8px] font-semibold text-teal-800">{(avgLotCov * 100).toFixed(1)}%</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {lotCovUtilPct != null && (
                            <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${
                              lotCovUtilPct > 70 ? 'bg-green-50 text-green-700 border-green-200' :
                              lotCovUtilPct > 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>{lotCovUtilPct.toFixed(0)}% utilization</span>
                          )}
                        </div>
                      )}

                      {(avgBldgSf != null || avgLot != null) && (
                        <div className="flex items-center gap-2 text-[9px] text-gray-500">
                          {avgBldgSf != null && <span>Avg Bldg: <span className="font-semibold text-gray-700">{formatNumber(Math.round(avgBldgSf))} SF</span></span>}
                          {avgBldgSf != null && avgLot != null && <span className="text-gray-300">|</span>}
                          {avgLot != null && <span>Avg Lot: <span className="font-semibold text-gray-700">{avgLot.toFixed(2)} ac</span></span>}
                        </div>
                      )}

                      <div className="border-t border-gray-100 pt-1.5 space-y-0.5">
                        <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">Projects</div>
                        {groupProjects.map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-medium text-gray-800 truncate">{p.address || 'Address not available'}</div>
                              <div className="flex flex-wrap gap-x-2 gap-y-0 text-[9px] text-gray-500">
                                {p.landAcres != null && <span>{p.landAcres.toFixed(2)} ac</span>}
                                {p.unitCount != null && <span>{p.unitCount.toLocaleString()} units</span>}
                                {p.buildingSf != null && <span>{formatNumber(p.buildingSf)} SF</span>}
                                {p.assessedValue != null && <span>${(p.assessedValue / 1000000).toFixed(1)}M assessed</span>}
                              </div>
                              {(p.zoningFrom || p.zoningTo || p.docketNumber) && (
                                <div className="flex items-center gap-1 text-[9px] text-gray-400">
                                  {p.zoningFrom && <span>{p.zoningFrom}</span>}
                                  {p.zoningFrom && p.zoningTo && <span>→</span>}
                                  {p.zoningTo && <span className="font-medium text-gray-600">{p.zoningTo}</span>}
                                  {p.totalEntitlementDays != null && <span className="ml-1">({Math.round(p.totalEntitlementDays / 30)} mo)</span>}
                                  {p.docketNumber && <span className="font-mono text-gray-500">{p.docketNumber}</span>}
                                  {p.ordinanceUrl && (
                                    <a href={p.ordinanceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">PDF</a>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
                              {p.densityAchieved != null && (
                                <span className="text-[11px] font-bold text-teal-700">{p.densityAchieved.toFixed(1)} u/ac</span>
                              )}
                              <span className={`text-[8px] px-1 py-0.5 rounded border ${
                                p.entitlementType === 'rezone' ? 'bg-violet-50 text-violet-600 border-violet-200' :
                                p.entitlementType === 'cup' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                p.entitlementType === 'variance' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                'bg-gray-50 text-gray-500 border-gray-200'
                              }`}>{p.entitlementType || '--'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              {sortedCodes.length > 3 && (
                <button
                  onClick={() => setShowAllCodes(!showAllCodes)}
                  className="text-[11px] text-teal-600 hover:text-teal-800 font-medium py-1"
                >
                  {showAllCodes ? 'Show less' : `Show ${sortedCodes.length - 3} more code${sortedCodes.length - 3 !== 1 ? 's' : ''}`}
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

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Development Scenarios</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {scenarios.length === 0 ? 'Create a scenario to model development capacity' : `${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => { setShowAddScenario(true); setNewZoningCode(profile.base_district_code || ''); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 flex items-center gap-1"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Scenario
          </button>
        </div>

        {showAddScenario && (
          <div className="border-b border-gray-200 px-5 py-4 bg-blue-50/30">
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Scenario Name</label>
                <input
                  type="text"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="e.g., 100% Residential"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Zoning Code</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newZoningCode}
                    onChange={(e) => setNewZoningCode(e.target.value)}
                    onBlur={() => { if (newZoningCode.trim()) lookupZoningCode(newZoningCode, 'new'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newZoningCode.trim()) lookupZoningCode(newZoningCode, 'new'); }}
                    placeholder={profile.base_district_code || 'e.g., MRC-3'}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  {newZoningLookupLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 flex-shrink-0" />
                  )}
                </div>
                {newZoningLookupResult && (
                  <span className="text-[10px] text-green-600 mt-0.5 block">
                    ✓ Found: {newZoningLookupResult.zoning_code || newZoningLookupResult.district_code} — constraints will auto-fill
                  </span>
                )}
                {newZoningLookupMessage && (
                  <span className="text-[10px] text-amber-600 mt-0.5 block">{newZoningLookupMessage}</span>
                )}
                {!newZoningCode.trim() && profile.base_district_code && (
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Leave blank to use current code ({profile.base_district_code})</span>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Avg Unit Size (SF)</label>
                <input
                  type="number"
                  value={newUnitSize}
                  onChange={(e) => setNewUnitSize(parseInt(e.target.value) || 900)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
            {newZoningLookupResult && (
              <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">Auto-filled from {newZoningLookupResult.zoning_code || newZoningLookupResult.district_code}</p>
                <div className="grid grid-cols-4 gap-3 text-[11px]">
                  {newZoningLookupResult.max_far != null && (
                    <div><span className="text-gray-500">FAR:</span> <span className="font-medium text-gray-800">{newZoningLookupResult.max_far}</span></div>
                  )}
                  {(newZoningLookupResult.max_density_per_acre || newZoningLookupResult.max_units_per_acre) != null && (
                    <div><span className="text-gray-500">Density:</span> <span className="font-medium text-gray-800">{newZoningLookupResult.max_density_per_acre || newZoningLookupResult.max_units_per_acre} u/ac</span></div>
                  )}
                  {(newZoningLookupResult.max_height_feet || newZoningLookupResult.max_building_height_ft) != null && (
                    <div><span className="text-gray-500">Height:</span> <span className="font-medium text-gray-800">{newZoningLookupResult.max_height_feet || newZoningLookupResult.max_building_height_ft} ft</span></div>
                  )}
                  {newZoningLookupResult.max_stories != null && (
                    <div><span className="text-gray-500">Stories:</span> <span className="font-medium text-gray-800">{newZoningLookupResult.max_stories}</span></div>
                  )}
                  {(newZoningLookupResult.max_lot_coverage || newZoningLookupResult.max_lot_coverage_percent) != null && (
                    <div><span className="text-gray-500">Lot Coverage:</span> <span className="font-medium text-gray-800">{newZoningLookupResult.max_lot_coverage || newZoningLookupResult.max_lot_coverage_percent}%</span></div>
                  )}
                  {(newZoningLookupResult.min_parking_per_unit || newZoningLookupResult.parking_per_unit) != null && (
                    <div><span className="text-gray-500">Parking:</span> <span className="font-medium text-gray-800">{newZoningLookupResult.min_parking_per_unit || newZoningLookupResult.parking_per_unit}/unit</span></div>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Residential %</label>
                <input
                  type="number" min="0" max="100"
                  value={newResidentialPct}
                  onChange={(e) => setNewResidentialPct(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Retail %</label>
                <input
                  type="number" min="0" max="100"
                  value={newRetailPct}
                  onChange={(e) => setNewRetailPct(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Office %</label>
                <input
                  type="number" min="0" max="100"
                  value={newOfficePct}
                  onChange={(e) => setNewOfficePct(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Efficiency</label>
                <input
                  type="number" min="0.5" max="1" step="0.01"
                  value={newEfficiency}
                  onChange={(e) => setNewEfficiency(parseFloat(e.target.value) || 0.85)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCreateScenario} className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Create</button>
              <button onClick={() => { setShowAddScenario(false); setNewZoningCode(''); setNewZoningLookupResult(null); setNewZoningLookupMessage(''); }} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300">Cancel</button>
              {newResidentialPct + newRetailPct + newOfficePct !== 100 && (
                <span className="text-xs text-amber-600">Use mix must total 100% (currently {newResidentialPct + newRetailPct + newOfficePct}%)</span>
              )}
            </div>
          </div>
        )}

        {scenarios.length === 0 && !showAddScenario && (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No scenarios yet. Click "Add Scenario" to model development capacity.
          </div>
        )}

        {scenarios.length > 0 && (
          <div className="divide-y divide-gray-100">
            {scenarios.map(scenario => {
              const isExpanded = expandedScenario === scenario.id;
              const useMix = scenario.use_mix || {};
              const mixParts = [];
              if (useMix.residential_pct) mixParts.push(`${useMix.residential_pct}% Res`);
              if (useMix.retail_pct) mixParts.push(`${useMix.retail_pct}% Retail`);
              if (useMix.office_pct) mixParts.push(`${useMix.office_pct}% Office`);
              const mixLabel = mixParts.join(' / ') || '100% Residential';

              return (
                <div key={scenario.id} className={`${scenario.is_active ? 'bg-blue-50/30' : ''}`}>
                  <div className="px-5 py-4 flex items-center gap-4">
                    <button
                      onClick={() => handleActivateScenario(scenario.id)}
                      className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center ${scenario.is_active ? 'border-blue-500 bg-blue-500' : 'border-gray-300 hover:border-blue-400'}`}
                      title={scenario.is_active ? 'Active scenario' : 'Set as active'}
                    >
                      {scenario.is_active && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{scenario.name}</span>
                        {scenario.is_active && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">ACTIVE</span>
                        )}
                        {scenario.name?.startsWith('Rezone to ') && (
                          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium border border-violet-200">REZONE OPPORTUNITY</span>
                        )}
                        <span className="text-xs text-gray-400">{mixLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{formatNumber(scenario.max_units)}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Units</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{formatNumber(scenario.max_gba)}</p>
                        <p className="text-[10px] text-gray-500 uppercase">GBA (SF)</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{scenario.max_stories ?? '--'}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Stories</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{formatNumber(scenario.parking_required)}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Parking</p>
                      </div>
                      {scenario.binding_constraint && (
                        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200">
                          {getLimitingLabel(scenario.binding_constraint)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedScenario(isExpanded ? null : scenario.id)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Show details"
                      >
                        <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteScenario(scenario.id)}
                        className="text-gray-300 hover:text-red-500"
                        title="Delete scenario"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-4">
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                        <div className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="text-gray-600">Zoning Code</span>
                          {editingScenarioCode === scenario.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={scenarioCodeInput}
                                onChange={(e) => setScenarioCodeInput(e.target.value)}
                                onBlur={() => { if (scenarioCodeInput.trim()) lookupZoningCode(scenarioCodeInput, 'edit'); }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateScenarioCode(scenario.id, scenarioCodeInput);
                                  if (e.key === 'Escape') { setEditingScenarioCode(null); setScenarioCodeLookupResult(null); setScenarioCodeLookupMessage(''); }
                                }}
                                placeholder={profile.base_district_code || 'Enter code'}
                                className="w-32 text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                autoFocus
                              />
                              {scenarioCodeLookupLoading && (
                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-500 flex-shrink-0" />
                              )}
                              <button onClick={() => handleUpdateScenarioCode(scenario.id, scenarioCodeInput)} className="text-green-600 hover:text-green-800">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button onClick={() => { setEditingScenarioCode(null); setScenarioCodeLookupResult(null); setScenarioCodeLookupMessage(''); }} className="text-gray-400 hover:text-gray-600">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-900">{scenario.target_district_code || profile.base_district_code || '--'}</span>
                              {scenario.target_district_code && scenario.target_district_code !== profile.base_district_code && (
                                <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded border border-violet-200">Target</span>
                              )}
                              <button
                                onClick={() => { setEditingScenarioCode(scenario.id); setScenarioCodeInput(scenario.target_district_code || profile.base_district_code || ''); }}
                                className="text-gray-400 hover:text-blue-600"
                                title="Change zoning code"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {editingScenarioCode === scenario.id && scenarioCodeLookupResult && (
                          <div className="bg-green-50 border border-green-200 rounded px-3 py-1.5 text-[11px]">
                            <span className="text-green-600 font-medium">✓ Found: {scenarioCodeLookupResult.zoning_code || scenarioCodeLookupResult.district_code}</span>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-gray-600">
                              {scenarioCodeLookupResult.max_far != null && <span>FAR: {scenarioCodeLookupResult.max_far}</span>}
                              {(scenarioCodeLookupResult.max_density_per_acre || scenarioCodeLookupResult.max_units_per_acre) != null && <span>Density: {scenarioCodeLookupResult.max_density_per_acre || scenarioCodeLookupResult.max_units_per_acre} u/ac</span>}
                              {(scenarioCodeLookupResult.max_height_feet || scenarioCodeLookupResult.max_building_height_ft) != null && <span>Height: {scenarioCodeLookupResult.max_height_feet || scenarioCodeLookupResult.max_building_height_ft} ft</span>}
                              {scenarioCodeLookupResult.max_stories != null && <span>Stories: {scenarioCodeLookupResult.max_stories}</span>}
                            </div>
                          </div>
                        )}
                        {editingScenarioCode === scenario.id && scenarioCodeLookupMessage && (
                          <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1">{scenarioCodeLookupMessage}</div>
                        )}
                        <div className="flex justify-between py-1 border-b border-gray-200">
                          <span className="text-gray-600">Use Mix</span>
                          <span className="font-medium text-gray-900">{mixLabel}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-200">
                          <span className="text-gray-600">Avg Unit Size</span>
                          <span className="font-medium text-gray-900">{formatNumber(scenario.avg_unit_size_sf)} SF</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-200">
                          <span className="text-gray-600">Efficiency Factor</span>
                          <span className="font-medium text-gray-900">{(parseFloat(String(scenario.efficiency_factor)) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-200">
                          <span className="text-gray-600">Lot Area</span>
                          <span className="font-medium text-gray-900">{formatNumber(parseFloat(String(profile.lot_area_sf)))} SF</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-200">
                          <span className="text-gray-600">Buildable Area (after setbacks)</span>
                          <span className="font-medium text-gray-900">{formatNumber(parseFloat(String(profile.buildable_area_sf)))} SF</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-200">
                          <span className="text-gray-600">Max Footprint</span>
                          <span className="font-medium text-gray-900">{formatNumber(scenario.max_footprint)} SF</span>
                        </div>
                        {scenario.applied_far != null && (
                          <div className="flex justify-between py-1 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">GBA by FAR ({scenario.applied_far})</span>
                              {hasSplitFAR && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                  {dealInfo?.project_type === 'office' || dealInfo?.project_type === 'retail' ? 'Nonresidential' : dealInfo?.project_type === 'mixed_use' ? 'Combined' : 'Residential'} FAR applied
                                </span>
                              )}
                            </div>
                            <span className="font-medium text-gray-900">{formatNumber(Math.round(parseFloat(String(scenario.applied_far)) * parseFloat(String(profile.lot_area_sf))))} SF</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 bg-blue-50 rounded px-3 -mx-1">
                          <span className="text-blue-800 font-semibold">Actual GBA</span>
                          <span className="font-bold text-blue-900">{formatNumber(scenario.max_gba)} SF</span>
                        </div>
                        <div className="flex justify-between py-1 text-gray-500">
                          <span>Net Leasable (~{(parseFloat(String(scenario.efficiency_factor)) * 100).toFixed(0)}% efficiency)</span>
                          <span className="font-medium">{formatNumber(scenario.net_leasable_sf)} SF</span>
                        </div>
                        {scenario.max_units != null && (
                          <div className="flex justify-between py-1 text-gray-500">
                            <span>Max Units ({formatNumber(scenario.avg_unit_size_sf)} SF avg)</span>
                            <span className="font-medium">{formatNumber(scenario.max_units)}</span>
                          </div>
                        )}
                        {scenario.flags && scenario.flags.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {scenario.flags.map((flag: string, i: number) => (
                              <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{flag}</p>
                            ))}
                          </div>
                        )}
                        {enrichment?.insights && scenario.is_active && (
                          <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-3">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Capacity Insights</p>
                            {enrichment.insights.envelope && (
                              <p className="text-[11px] text-gray-600">{enrichment.insights.envelope}</p>
                            )}
                            {enrichment.insights.density && (
                              <p className="text-[11px] text-gray-600">{enrichment.insights.density}</p>
                            )}
                            {enrichment.insights.height && (
                              <p className="text-[11px] text-gray-600">{enrichment.insights.height}</p>
                            )}
                            {enrichment.insights.parking && (
                              <p className="text-[11px] text-gray-600">{enrichment.insights.parking}</p>
                            )}
                          </div>
                        )}

                        {(() => {
                          const scenarioCode = scenario.target_district_code || profile.base_district_code;
                          const isRezone = scenario.target_district_code && scenario.target_district_code !== profile.base_district_code;

                          let refProjects: any[] = [];

                          if (isRezone && rezoneAnalysis?.bestTarget?.evidence?.examples) {
                            const rezoneExamples = rezoneAnalysis.bestTarget.evidence.examples
                              .filter((ex: any) => ex.toZone === scenario.target_district_code)
                              .map((ex: any) => ({
                                address: ex.address || ex.docketNumber || 'Rezone project',
                                landAcres: ex.landAcres ?? ex.lotAcres ?? null,
                                unitCount: ex.unitCount ?? ex.units ?? null,
                                buildingSf: ex.buildingSf ?? ex.building_sf ?? null,
                                farAchieved: ex.farAchieved ?? ex.far_achieved ?? null,
                                lotCoverageAchieved: ex.lotCoverageAchieved ?? ex.lot_coverage_achieved ?? null,
                                assessedValue: ex.assessedValue ?? ex.assessed_value ?? null,
                                densityAchieved: ex.densityAchieved ?? (ex.unitCount && ex.landAcres ? ex.unitCount / ex.landAcres : null),
                                source: 'rezone',
                              }));
                            refProjects = [...refProjects, ...rezoneExamples];
                          }

                          const allBenchProjects = [...(densityBenchmarks?.projects || []), ...(densityBenchmarks?.nearbyProjects || [])];
                          if (allBenchProjects.length > 0) {
                            const benchProjects = allBenchProjects
                              .filter((p: any) => {
                                const pCode = p.zoningTo || p.zoningCode || p.zoning_code || p.district_code;
                                return pCode === scenarioCode;
                              })
                              .map((p: any) => ({
                                address: p.address || 'Address not available',
                                landAcres: p.landAcres ?? p.land_acres ?? null,
                                unitCount: p.unitCount ?? p.unit_count ?? null,
                                buildingSf: p.buildingSf ?? p.building_sf ?? null,
                                farAchieved: p.farAchieved ?? p.far_achieved ?? null,
                                lotCoverageAchieved: p.lotCoverageAchieved ?? p.lot_coverage_achieved ?? null,
                                assessedValue: p.assessedValue ?? p.assessed_value ?? null,
                                densityAchieved: p.densityAchieved ?? p.density_achieved ?? null,
                                source: 'benchmark',
                              }));
                            refProjects = [...refProjects, ...benchProjects];
                          }

                          if (refProjects.length === 0 && allBenchProjects.length > 0) {
                            refProjects = allBenchProjects.map((p: any) => ({
                              address: p.address || 'Address not available',
                              landAcres: p.landAcres ?? p.land_acres ?? null,
                              unitCount: p.unitCount ?? p.unit_count ?? null,
                              buildingSf: p.buildingSf ?? p.building_sf ?? null,
                              farAchieved: p.farAchieved ?? p.far_achieved ?? null,
                              lotCoverageAchieved: p.lotCoverageAchieved ?? p.lot_coverage_achieved ?? null,
                              assessedValue: p.assessedValue ?? p.assessed_value ?? null,
                              densityAchieved: p.densityAchieved ?? p.density_achieved ?? null,
                              source: 'benchmark',
                            }));
                          }

                          const seen = new Set<string>();
                          refProjects = refProjects.filter(p => {
                            const key = p.address;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                          });

                          refProjects.sort((a, b) => {
                            const aDensity = a.densityAchieved || 0;
                            const bDensity = b.densityAchieved || 0;
                            if (bDensity !== aDensity) return bDensity - aDensity;
                            return (b.buildingSf || 0) - (a.buildingSf || 0);
                          });

                          const top3 = refProjects.slice(0, 3);

                          if (top3.length === 0) return null;

                          return (
                            <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                              <div className="flex items-center gap-2">
                                <svg className="h-3.5 w-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Reference Projects</p>
                                <span className="text-[10px] text-gray-400">
                                  {isRezone ? `Rezoned to ${scenario.target_district_code}` : `Built under ${scenarioCode}`}
                                </span>
                              </div>
                              <div className="grid gap-1.5">
                                {top3.map((p: any, idx: number) => (
                                  <div key={idx} className="bg-teal-50/50 rounded-md border border-teal-100 px-3 py-2">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-[11px] font-medium text-gray-800 truncate">{p.address}</div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-gray-500">
                                          {p.landAcres != null && <span>{parseFloat(p.landAcres).toFixed(2)} ac</span>}
                                          {p.unitCount != null && <span>{Number(p.unitCount).toLocaleString()} units</span>}
                                          {p.buildingSf != null && <span>{Number(p.buildingSf).toLocaleString()} SF</span>}
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-gray-500">
                                          {p.farAchieved != null && <span>FAR: {parseFloat(p.farAchieved).toFixed(2)}</span>}
                                          {p.lotCoverageAchieved != null && <span>Lot Cov: {(parseFloat(p.lotCoverageAchieved) * 100).toFixed(0)}%</span>}
                                          {p.assessedValue != null && <span>${(Number(p.assessedValue) / 1000000).toFixed(1)}M assessed</span>}
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        {p.densityAchieved != null && (
                                          <span className="text-xs font-bold text-teal-700 whitespace-nowrap">
                                            {parseFloat(p.densityAchieved).toFixed(1)} u/ac
                                          </span>
                                        )}
                                        {p.source === 'rezone' && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200">rezone</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {scenarios.length >= 2 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Scenario Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider w-[20%]" />
                  {scenarios.map(s => (
                    <th key={s.id} className="text-center px-4 py-3">
                      <div className="text-xs font-bold text-gray-900">{s.name}</div>
                      {s.is_active && <div className="text-[10px] text-blue-600 font-medium">ACTIVE</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Max Units', key: 'max_units', format: (v: number) => formatNumber(v) },
                  { label: 'GBA', key: 'max_gba', format: (v: number) => `${formatNumber(v)} SF` },
                  { label: 'Net Leasable', key: 'net_leasable_sf', format: (v: number) => `${formatNumber(v)} SF` },
                  { label: 'Stories', key: 'max_stories', format: (v: number) => `${v}` },
                  { label: 'Parking', key: 'parking_required', format: (v: number) => `${formatNumber(v)} spaces` },
                  { label: 'Binding Constraint', key: 'binding_constraint', format: (v: string) => getLimitingLabel(v) },
                  { label: 'Applied FAR', key: 'applied_far', format: (v: number) => `${v}` },
                  { label: 'Avg Unit Size', key: 'avg_unit_size_sf', format: (v: number) => `${formatNumber(v)} SF` },
                  { label: 'Efficiency', key: 'efficiency_factor', format: (v: number) => `${(v * 100).toFixed(0)}%` },
                ].map(row => (
                  <tr key={row.key} className="hover:bg-gray-50/50 border-b border-gray-50">
                    <td className="px-5 py-2.5 text-gray-600 font-medium text-xs">{row.label}</td>
                    {scenarios.map(scenario => {
                      const val = (scenario as any)[row.key];
                      return (
                        <td key={scenario.id} className={`text-center px-4 py-2.5 text-xs text-gray-900 ${scenario.is_active ? 'font-semibold' : ''}`}>
                          {val != null ? row.format(val) : '--'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {loadingRecs && recommendations.length === 0 && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
          <span className="ml-2 text-gray-500 text-xs">Loading entitlement strategies...</span>
        </div>
      )}

    </div>
  );
}
