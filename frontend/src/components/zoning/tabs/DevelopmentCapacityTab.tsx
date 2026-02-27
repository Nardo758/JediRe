import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../../services/api.client';
import PathSelection from './PathSelection';
import PathComparisonTable from './PathComparisonTable';
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
  const [editingConstraint, setEditingConstraint] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [changingAssetType, setChangingAssetType] = useState(false);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [entitlementStrategy, setEntitlementStrategy] = useState<any>(null);
  const [municodeUrl, setMunicodeUrl] = useState<string | null>(null);
  const [rezoneAnalysis, setRezoneAnalysis] = useState<any>(null);
  const [loadingRezone, setLoadingRezone] = useState(false);
  const [enrichment, setEnrichment] = useState<EnvelopeEnrichment | null>(null);
  const [showCalculations, setShowCalculations] = useState(false);
  const rezoneScenarioCreatedRef = useRef(false);

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

  const handleCreateScenario = async () => {
    if (!dealId) return;
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/scenarios`, {
        name: newScenarioName || 'New Scenario',
        use_mix: { residential_pct: newResidentialPct, retail_pct: newRetailPct, office_pct: newOfficePct },
        avg_unit_size_sf: newUnitSize,
        efficiency_factor: newEfficiency,
        is_active: scenarios.length === 0,
      });
      setShowAddScenario(false);
      setNewScenarioName('');
      setNewResidentialPct(100);
      setNewRetailPct(0);
      setNewOfficePct(0);
      setNewUnitSize(900);
      setNewEfficiency(0.85);
      await loadData(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create scenario');
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

      {isConditionalVariant && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Conditional Variant Detected ({profile.base_district_code})</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The "-C" suffix indicates a conditional ordinance from City Council that may impose additional restrictions. Standards inherited from base district. Review the conditional ordinance before finalizing.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Constraint Set</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Resolved zoning constraints. Click the pencil icon to override.
              {profile.density_method === 'far_derived' && (
                <span className="ml-2 text-blue-600 font-medium">Density: FAR-derived (no cap)</span>
              )}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-gray-100">
          {constraintRows.map(row => {
            const isOverridden = profile.user_overrides?.[row.field] != null;
            const displayValue = row.value != null ? `${row.value}${row.suffix}` : '--';
            const sourceKey = fieldToSourceKey[row.field];
            const source = enrichment?.sources?.[sourceKey];
            return (
              <div key={row.field} className={`bg-white p-3 relative group ${isOverridden ? 'ring-1 ring-inset ring-purple-200' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs text-gray-500">{row.label}</p>
                    {source?.sectionNumber && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (source.sourceUrl) window.open(source.sourceUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 hover:text-violet-800 hover:underline cursor-pointer transition-colors"
                        title={source.sectionTitle ? `${source.sectionNumber} — ${source.sectionTitle}` : source.sectionNumber || ''}
                      >
                        <span>§{source.sectionNumber}</span>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditingConstraint(row.field); setEditValue(String(row.value ?? '')); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"
                    title="Override this constraint"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
                {editingConstraint === row.field ? (
                  <div className="flex items-center gap-1 mt-1">
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
                  <p className={`text-sm font-semibold ${isOverridden ? 'text-purple-700' : row.field === 'applied_far' ? 'text-blue-700' : 'text-gray-900'}`}>
                    {displayValue}
                  </p>
                )}
                {isOverridden && (
                  <span className="text-[9px] text-purple-500">User override</span>
                )}
              </div>
            );
          })}
        </div>
        {hasHeightBuffer && (
          <div className="border-t border-gray-100 px-5 py-3 bg-blue-50">
            <p className="text-xs text-blue-800">
              <span className="font-medium">Height Buffer Rule:</span>{' '}
              {profile.max_height_ft} ft within {profile.height_buffer_ft} ft of residential districts;{' '}
              {profile.height_beyond_buffer_ft} ft beyond
            </p>
          </div>
        )}
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-xs text-gray-500">
              Setbacks: Front {profile.setback_front_ft ?? '--'}ft, Side {profile.setback_side_ft ?? '--'}ft, Rear {profile.setback_rear_ft ?? '--'}ft
            </p>
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
        </div>
      </div>

      {enrichment?.insights?.controllingFactor && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 flex items-start gap-3">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-blue-900">Controlling Factor</h4>
            <p className="text-xs text-blue-700 mt-0.5">{enrichment.insights.controllingFactor}</p>
          </div>
          <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 font-medium flex-shrink-0">
            {getLimitingLabel(enrichment.limitingFactor)}
          </span>
        </div>
      )}

      {enrichment?.calculations && enrichment.calculations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowCalculations(!showCalculations)}
            className="w-full px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between"
          >
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Calculation Breakdowns</h3>
              <p className="text-xs text-gray-500 mt-0.5">Step-by-step formulas showing how capacity was derived</p>
            </div>
            <svg className={`h-4 w-4 text-gray-400 transition-transform ${showCalculations ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showCalculations && (
            <div className="divide-y divide-gray-100">
              {enrichment.calculations.map((calc, i) => (
                <div key={i} className="px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">{calc.name}</span>
                      {calc.sectionNumber && (
                        <button
                          onClick={() => {
                            if (calc.sourceUrl) window.open(calc.sourceUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-[10px] font-medium text-violet-600 hover:text-violet-800 hover:underline cursor-pointer"
                        >
                          §{calc.sectionNumber}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{calc.formula}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-bold text-gray-900">{calc.result.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-400 ml-1">{calc.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Development Scenarios</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {scenarios.length === 0 ? 'Create a scenario to model development capacity' : `${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowAddScenario(true)}
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
            <div className="grid grid-cols-2 gap-4 mb-3">
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
                <label className="text-xs font-medium text-gray-600 block mb-1">Avg Unit Size (SF)</label>
                <input
                  type="number"
                  value={newUnitSize}
                  onChange={(e) => setNewUnitSize(parseInt(e.target.value) || 900)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
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
              <button onClick={() => setShowAddScenario(false)} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300">Cancel</button>
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

      {/* ─── PATH SELECTION ─── */}
      {profile && activeScenario && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden p-5">
          <PathSelection
            byRightUnits={activeScenario.max_units || 0}
            overlayBonusPct={profile.overlays?.length > 0 ? (profile.overlays[0]?.density_bonus_pct ?? null) : null}
            lotAcres={(profile.lot_area_sf || 0) / 43560}
            maxDensityPerAcre={profile.max_density_per_acre || 0}
            avgUnitSizeSf={activeScenario.avg_unit_size_sf || 900}
            rezoneAnalysis={rezoneAnalysis}
          />
          <div className="mt-4">
            <PathComparisonTable
              byRightUnits={activeScenario.max_units || 0}
              overlayBonusPct={profile.overlays?.length > 0 ? (profile.overlays[0]?.density_bonus_pct ?? null) : null}
              lotAcres={(profile.lot_area_sf || 0) / 43560}
              maxDensityPerAcre={profile.max_density_per_acre || 0}
              avgUnitSizeSf={activeScenario.avg_unit_size_sf || 900}
              rezoneAnalysis={rezoneAnalysis}
            />
          </div>
        </div>
      )}

      {rezoneAnalysis?.bestTarget && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-violet-900">Rezone Opportunity Detected</h4>
                <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium border border-violet-200">REZONE OPPORTUNITY</span>
              </div>
              <p className="text-xs text-violet-700 mt-0.5">{rezoneAnalysis.bestTarget.insight}</p>
              {entitlementStrategy?.strategyInsight && entitlementStrategy.recommendedPath && entitlementStrategy.recommendedPath !== 'rezone' && (
                <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded p-2">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px] font-bold text-blue-800">
                      Consider {entitlementStrategy.recommendedPath === 'cup' ? 'CUP' : entitlementStrategy.recommendedPath === 'variance' ? 'Variance' : entitlementStrategy.recommendedPath}
                    </span>
                    {(() => {
                      const altStats = entitlementStrategy.patterns?.byType?.[entitlementStrategy.recommendedPath];
                      if (!altStats) return null;
                      return (
                        <span className="text-[10px] text-blue-700">
                          — {altStats.approvalRate}% approval, {altStats.avgDays != null ? `${Math.round(altStats.avgDays / 30)} mo avg` : ''}, {altStats.count} projects
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] text-blue-700 mt-1">{entitlementStrategy.strategyInsight}</p>
                </div>
              )}
              {rezoneAnalysis.bestTarget.evidence && rezoneAnalysis.bestTarget.evidence.count > 0 && (
                <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-medium">
                    {rezoneAnalysis.bestTarget.evidence.count} similar rezonings: {rezoneAnalysis.bestTarget.evidence.approvalRate}% approved, avg {Math.round(rezoneAnalysis.bestTarget.evidence.avgDays / 30)} months
                  </span>
                  <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded border border-violet-200">
                    Data Source: Real District Data ({rezoneAnalysis.bestTarget.evidence.count} projects)
                  </span>
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-violet-900">+{rezoneAnalysis.bestTarget.delta?.additionalUnits || 0} units</p>
              <p className="text-xs text-violet-600">+{formatNumber(rezoneAnalysis.bestTarget.delta?.additionalGFA || 0)} SF GFA</p>
              {rezoneAnalysis.bestTarget.revenue?.valueUplift > 0 && (
                <p className="text-[10px] text-violet-500">+${formatNumber(Math.round(rezoneAnalysis.bestTarget.revenue.valueUplift / 1000))}K est. value</p>
              )}
            </div>
          </div>
          {rezoneAnalysis.bestTarget.evidence?.examples && rezoneAnalysis.bestTarget.evidence.examples.length > 0 && (
            <div className="px-5 py-2 border-t border-violet-200 bg-violet-50/50">
              <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-1">Recent Precedents</p>
              <div className="space-y-1">
                {rezoneAnalysis.bestTarget.evidence.examples.slice(0, 3).map((ex: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-violet-700">
                    {ex.docketNumber && <span className="font-mono font-medium">{ex.docketNumber}</span>}
                    {ex.fromZone && ex.toZone && <span>{ex.fromZone} → {ex.toZone}</span>}
                    {ex.outcome && <span className={`px-1 py-0.5 rounded ${ex.outcome === 'approved' ? 'bg-green-100 text-green-700' : ex.outcome === 'denied' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{ex.outcome}</span>}
                    {ex.totalDays != null && <span>{Math.round(ex.totalDays / 30)}mo</span>}
                    {ex.ordinanceUrl && (
                      <a href={ex.ordinanceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">PDF</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {rezoneAnalysis.bestTarget.districtMunicodeUrl && (
            <div className="px-5 py-2 border-t border-violet-200 bg-violet-50/50 flex items-center gap-2">
              <span className="text-[10px] text-violet-500">Target District:</span>
              <MunicodeLink url={rezoneAnalysis.bestTarget.districtMunicodeUrl} label={rezoneAnalysis.bestTarget.targetDistrictCode} />
            </div>
          )}
        </div>
      )}

      {loadingRezone && !rezoneAnalysis && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-500" />
          <span className="ml-2 text-gray-500 text-xs">Analyzing rezone opportunities...</span>
        </div>
      )}

      {!rezoneAnalysis?.bestTarget && entitlementStrategy?.strategyInsight && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <svg className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-blue-900">Entitlement Strategy Insight</p>
              {entitlementStrategy.patterns?.totalRecords && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200">
                  {entitlementStrategy.patterns.totalRecords} records
                </span>
              )}
            </div>
            <p className="text-xs text-blue-800">{entitlementStrategy.strategyInsight}</p>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="w-full px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between"
          >
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Entitlement Strategy</h3>
              <p className="text-xs text-gray-500 mt-0.5">By-Right, Variance, and Rezone scenario comparison</p>
            </div>
            <svg className={`h-4 w-4 text-gray-400 transition-transform ${showRecommendations ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showRecommendations && (
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4">
                {recommendations.map((rec: any) => {
                  const riskColors: Record<string, string> = {
                    Low: 'bg-green-50 text-green-700 border-green-200',
                    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
                    High: 'bg-red-50 text-red-700 border-red-200',
                  };
                  const riskBorderColors: Record<string, string> = {
                    Low: 'border-green-300',
                    Medium: 'border-amber-300',
                    High: 'border-red-300',
                  };
                  const riskColor = riskColors[rec.risk] || riskColors.Low;
                  const borderColor = riskBorderColors[rec.risk] || '';

                  return (
                    <div key={rec.name} className={`border rounded-lg overflow-hidden ${rec.name === 'By-Right' ? 'border-green-300 ring-1 ring-green-100' : borderColor}`}>
                      <div className={`px-4 py-3 ${rec.name === 'By-Right' ? 'bg-green-50' : rec.name === 'Variance' ? 'bg-amber-50' : 'bg-red-50'}`}>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-900">{rec.name}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${riskColor}`}>
                            {rec.risk} Risk
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
                      </div>

                      <div className="px-4 py-3 space-y-2">
                        <div className="flex justify-between items-center py-1 border-b border-gray-100">
                          <span className="text-xs text-gray-500">Units</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{formatNumber(rec.maxUnits)}</span>
                            {rec.deltaUnits > 0 && (
                              <span className="text-[10px] text-green-600 font-medium">+{rec.deltaUnits}%</span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-100">
                          <span className="text-xs text-gray-500">GBA</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{formatNumber(rec.maxGba)} SF</span>
                            {rec.deltaGba > 0 && (
                              <span className="text-[10px] text-green-600 font-medium">+{rec.deltaGba}%</span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-100">
                          <span className="text-xs text-gray-500">Stories</span>
                          <span className="text-sm font-semibold text-gray-900">{rec.maxStories ?? '--'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-100">
                          <span className="text-xs text-gray-500">Height</span>
                          <span className="text-sm font-semibold text-gray-900">{rec.maxHeight ? `${rec.maxHeight} ft` : '--'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-100">
                          <span className="text-xs text-gray-500">Applied FAR</span>
                          <span className="text-sm font-semibold text-gray-900">{rec.appliedFar != null ? rec.appliedFar.toFixed(2) : '--'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-gray-100">
                          <span className="text-xs text-gray-500">Parking</span>
                          <span className="text-sm font-semibold text-gray-900">{formatNumber(rec.parkingRequired)} spaces</span>
                        </div>
                      </div>

                      <div className="px-4 py-3 bg-gray-50 space-y-1.5">
                        {(() => {
                          const typeKey = rec.name === 'By-Right' ? 'by_right' : rec.name === 'Variance' ? 'variance' : rec.name === 'CUP' ? 'cup' : 'rezone';
                          const orchStats = entitlementStrategy?.patterns?.byType?.[typeKey];
                          const hasOrchData = orchStats && orchStats.count > 0;
                          return (
                            <>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Success Rate</span>
                                <span className="font-medium text-gray-900">
                                  {hasOrchData ? `${orchStats.approvalRate}%` : rec.successRate}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Timeline</span>
                                <span className="font-medium text-gray-900">
                                  {hasOrchData && orchStats.avgDays != null ? `${Math.round(orchStats.avgDays / 30)} months` : rec.timeline}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Est. Cost</span>
                                <span className="font-medium text-gray-900">{rec.estimatedCost}</span>
                              </div>
                              {hasOrchData && (
                                <div className="flex items-center gap-1 pt-1">
                                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-200">
                                    {orchStats.count} projects analyzed
                                  </span>
                                </div>
                              )}
                              {!hasOrchData && rec.source === 'rezone-analysis' && (
                                <div className="flex items-center gap-1 pt-1 flex-wrap">
                                  <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded border border-violet-200">
                                    Real District Data{rec.evidence?.count ? ` (${rec.evidence.count} projects)` : ''}
                                  </span>
                                  {rec.districtMunicodeUrl && (
                                    <MunicodeLink url={rec.districtMunicodeUrl} label={rec.targetDistrictCode} />
                                  )}
                                </div>
                              )}
                              {!hasOrchData && (rec.source === 'rezone-multiplier' || rec.source === 'variance-multiplier') && (
                                <div className="flex items-center gap-1 pt-1">
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">Estimated</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
