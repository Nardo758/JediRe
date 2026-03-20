import React, { useState, useEffect } from 'react';
import { Search, FileText, ExternalLink, TrendingUp, BarChart3 } from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface RegulatoryMarketResearchProps {
  dealId: string;
  currentZoningCode?: string;
  municipality?: string;
}

interface RegulatoryRecord {
  id: string;
  projectName: string;
  address: string;
  zoningCode: string;
  zoningFrom: string | null;
  zoningTo: string | null;
  entitlementType: string;
  approved: boolean | null;
  unitCount: number | null;
  densityAchieved: number | null;
  farAchieved: number | null;
  lotCoverageAchieved: number | null;
  stories: number | null;
  buildingSf: number | null;
  landAcres: number | null;
  similarityScore: number | null;
  timelineMonths: number | null;
  ordinanceUrl: string | null;
  sourceUrl: string | null;
  docketNumber: string | null;
  isUpzone: boolean;
  matchesUserCode: boolean;
}

interface CommonTransition {
  fromCode: string;
  toCode: string;
  count: number;
  approvalRate: number;
  avgMonths: number;
  exampleOrdinanceUrl?: string;
}

const RegulatoryMarketResearch: React.FC<RegulatoryMarketResearchProps> = ({
  dealId,
  currentZoningCode,
  municipality,
}) => {
  const [entitlements, setEntitlements] = useState<any>(null);
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Fetch both APIs in parallel
  useEffect(() => {
    if (!dealId) return;

    setLoading(true);
    Promise.all([
      apiClient.get(`/api/v1/deals/${dealId}/nearby-entitlements`).catch(() => null),
      apiClient.get(`/api/v1/deals/${dealId}/density-benchmarks`).catch(() => null),
    ]).then(([entRes, benchRes]) => {
      setEntitlements(entRes?.data?.data || null);
      setBenchmarks(benchRes?.data?.data || benchRes?.data || null);
      setLoading(false);
    });
  }, [dealId]);

  // Build unified record list from both sources
  const buildRecords = (): RegulatoryRecord[] => {
    const records: Record<string, RegulatoryRecord> = {};

    // Add benchmark projects first (they have more detail)
    if (benchmarks?.projects) {
      benchmarks.projects.forEach((p: any) => {
        const key = `${p.address || ''}_${p.entitlementType || ''}`;
        records[key] = {
          id: key,
          projectName: p.projectName || p.address || '',
          address: p.address || '',
          zoningCode: p.zoningCode || currentZoningCode || '',
          zoningFrom: p.zoningFrom || null,
          zoningTo: p.zoningTo || null,
          entitlementType: p.entitlementType || 'by_right',
          approved: p.approved,
          unitCount: p.unitCount || null,
          densityAchieved: p.densityAchieved || null,
          farAchieved: p.farAchieved || null,
          lotCoverageAchieved: p.lotCoverageAchieved || null,
          stories: p.stories || null,
          buildingSf: p.buildingSf || null,
          landAcres: p.landAcres || null,
          similarityScore: p.similarityScore || null,
          timelineMonths: p.totalEntitlementDays ? Math.round(p.totalEntitlementDays / 30) : null,
          ordinanceUrl: p.ordinanceUrl || null,
          sourceUrl: p.sourceUrl || null,
          docketNumber: p.docketNumber || null,
          isUpzone: !!(p.zoningFrom && p.zoningTo && isUpzoneTransition(p.zoningFrom, p.zoningTo)),
          matchesUserCode: !!(
            currentZoningCode &&
            (p.zoningCode?.toUpperCase() === currentZoningCode.toUpperCase() ||
              p.zoningFrom?.toUpperCase() === currentZoningCode.toUpperCase())
          ),
        };
      });
    }

    // Add nearby projects (merge with benchmarks if duplicates)
    if (benchmarks?.nearbyProjects) {
      benchmarks.nearbyProjects.forEach((p: any) => {
        const key = `${p.address || ''}_${p.entitlementType || ''}`;
        if (!records[key]) {
          records[key] = {
            id: key,
            projectName: p.projectName || p.address || '',
            address: p.address || '',
            zoningCode: p.zoningCode || currentZoningCode || '',
            zoningFrom: p.zoningFrom || null,
            zoningTo: p.zoningTo || null,
            entitlementType: p.entitlementType || 'by_right',
            approved: p.approved,
            unitCount: p.unitCount || null,
            densityAchieved: p.densityAchieved || null,
            farAchieved: p.farAchieved || null,
            lotCoverageAchieved: p.lotCoverageAchieved || null,
            stories: p.stories || null,
            buildingSf: p.buildingSf || null,
            landAcres: p.landAcres || null,
            similarityScore: p.similarityScore || null,
            timelineMonths: p.totalEntitlementDays ? Math.round(p.totalEntitlementDays / 30) : null,
            ordinanceUrl: p.ordinanceUrl || null,
            sourceUrl: p.sourceUrl || null,
            docketNumber: p.docketNumber || null,
            isUpzone: !!(p.zoningFrom && p.zoningTo && isUpzoneTransition(p.zoningFrom, p.zoningTo)),
            matchesUserCode: !!(
              currentZoningCode &&
              (p.zoningCode?.toUpperCase() === currentZoningCode.toUpperCase() ||
                p.zoningFrom?.toUpperCase() === currentZoningCode.toUpperCase())
            ),
          };
        }
      });
    }

    // Add entitlements projects
    if (entitlements?.projects) {
      entitlements.projects.forEach((p: any) => {
        const key = `${p.address || ''}_${p.entitlementType || ''}`;
        if (!records[key]) {
          records[key] = {
            id: key,
            projectName: p.projectName || p.address || '',
            address: p.address || '',
            zoningCode: p.zoningCode || currentZoningCode || '',
            zoningFrom: p.zoningFrom || null,
            zoningTo: p.zoningTo || null,
            entitlementType: p.entitlementType || 'by_right',
            approved: p.approved,
            unitCount: p.unitCount || null,
            densityAchieved: p.densityAchieved || null,
            farAchieved: p.farAchieved || null,
            lotCoverageAchieved: p.lotCoverageAchieved || null,
            stories: p.stories || null,
            buildingSf: p.buildingSf || null,
            landAcres: p.landAcres || null,
            similarityScore: p.similarityScore || null,
            timelineMonths: p.totalDays ? Math.round(p.totalDays / 30) : null,
            ordinanceUrl: p.ordinanceUrl || null,
            sourceUrl: p.sourceUrl || null,
            docketNumber: p.docketNumber || null,
            isUpzone: !!(p.zoningFrom && p.zoningTo && isUpzoneTransition(p.zoningFrom, p.zoningTo)),
            matchesUserCode: !!(
              currentZoningCode &&
              (p.zoningCode?.toUpperCase() === currentZoningCode.toUpperCase() ||
                p.zoningFrom?.toUpperCase() === currentZoningCode.toUpperCase())
            ),
          };
        }
      });
    }

    return Object.values(records).sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
  };

  const isUpzoneTransition = (from: string, to: string): boolean => {
    const densityMap: Record<string, number> = {
      'MRC-1': 1,
      'MRC-2': 2,
      'MRC-3': 3,
      'MRC-4': 4,
      'MRC-5': 5,
    };
    return (densityMap[to?.toUpperCase()] || 0) > (densityMap[from?.toUpperCase()] || 0);
  };

  const parseSearchQuery = (query: string, records: RegulatoryRecord[]): RegulatoryRecord[] => {
    const q = query.toLowerCase().trim();
    if (!q) return records;

    if (q === 'rezones' || q === 'rezone' || q === 'rezonings') {
      return records.filter((r) => r.entitlementType === 'rezone');
    }
    if (q === 'upzones' || q === 'upzone' || q === 'upzonings') {
      return records.filter((r) => r.isUpzone);
    }
    if (q === 'variances' || q === 'variance') {
      return records.filter((r) => r.entitlementType === 'variance');
    }
    if (q === 'cup' || q === 'cups' || q === 'conditional use' || q === 'conditional') {
      return records.filter((r) => r.entitlementType === 'cup');
    }
    if (q === 'by-right' || q === 'by right' || q === 'site plan' || q === 'site plans') {
      return records.filter((r) => r.entitlementType === 'by_right' || r.entitlementType === 'site_plan');
    }
    if (q === 'approved') {
      return records.filter((r) => r.approved === true);
    }
    if (q === 'denied' || q === 'rejected') {
      return records.filter((r) => r.approved === false);
    }

    const unitMatch = q.match(/(?:>|over|above|\+)\s*(\d+)\s*unit/i);
    if (unitMatch) {
      const threshold = parseInt(unitMatch[1]);
      return records.filter((r) => r.unitCount != null && r.unitCount >= threshold);
    }

    const codeMatch = q.match(/^[a-z]{1,3}[-]?\d?[-]?[a-z]?$/i);
    if (codeMatch) {
      const code = q.toUpperCase();
      return records.filter(
        (r) =>
          r.zoningCode?.toUpperCase().includes(code) ||
          r.zoningFrom?.toUpperCase().includes(code) ||
          r.zoningTo?.toUpperCase().includes(code)
      );
    }

    return records.filter(
      (r) =>
        r.projectName?.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q) ||
        r.docketNumber?.toLowerCase().includes(q) ||
        r.zoningCode?.toLowerCase().includes(q) ||
        r.zoningFrom?.toLowerCase().includes(q) ||
        r.zoningTo?.toLowerCase().includes(q)
    );
  };

  const allRecords = buildRecords();
  let filteredRecords = allRecords;

  if (activeFilter) {
    const filterKeywords: Record<string, string> = {
      rezones: 'rezones',
      upzones: 'upzones',
      variances: 'variances',
      cups: 'cups',
      'by-right': 'by-right',
    };
    filteredRecords = parseSearchQuery(filterKeywords[activeFilter] || '', allRecords);
  } else if (searchQuery) {
    filteredRecords = parseSearchQuery(searchQuery, allRecords);
  }

  const visibleProjects = showAllProjects ? filteredRecords : filteredRecords.slice(0, 5);

  const buildCommonTransitions = (): CommonTransition[] => {
    const transitions: Record<string, any> = {};

    filteredRecords.forEach((r) => {
      if (r.zoningFrom && r.zoningTo) {
        const key = `${r.zoningFrom}→${r.zoningTo}`;
        if (!transitions[key]) {
          transitions[key] = {
            fromCode: r.zoningFrom,
            toCode: r.zoningTo,
            count: 0,
            approvedCount: 0,
            totalMonths: 0,
          };
        }
        transitions[key].count++;
        if (r.approved) transitions[key].approvedCount++;
        if (r.timelineMonths) transitions[key].totalMonths += r.timelineMonths;
      }
    });

    return Object.values(transitions)
      .map((t) => ({
        fromCode: t.fromCode,
        toCode: t.toCode,
        count: t.count,
        approvalRate: Math.round((t.approvedCount / t.count) * 100),
        avgMonths: t.count > 0 ? Math.round(t.totalMonths / t.count) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  };

  const avgDensity = (() => {
    const vals = filteredRecords.filter((r) => r.densityAchieved != null).map((r) => r.densityAchieved);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  const avgFar = (() => {
    const vals = filteredRecords.filter((r) => r.farAchieved != null).map((r) => r.farAchieved);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  const avgLotCov = (() => {
    const vals = filteredRecords.filter((r) => r.lotCoverageAchieved != null).map((r) => r.lotCoverageAchieved);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  const bestComp = filteredRecords.length > 0 ? filteredRecords[0] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500" />
        <span className="ml-2 text-xs text-gray-500">Loading regulatory market research...</span>
      </div>
    );
  }

  if (allRecords.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Regulatory Market Research</span>
        </div>
        <p className="text-xs text-gray-400">No regulatory or market data available for this location.</p>
      </div>
    );
  }

  const commonTransitions = buildCommonTransitions();
  const showTransitionsTable =
    !activeFilter || activeFilter === 'rezones' || activeFilter === 'upzones' || activeFilter === 'All';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-sm font-semibold text-gray-800">Regulatory Market Research</span>
          {municipality && <span className="text-[10px] text-gray-500">in {municipality}</span>}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            {allRecords.length} records
          </span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search: rezones, upzones, CUPs, code, address..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveFilter(null);
              setShowAllProjects(false);
            }}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 pl-9 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {['All', 'Rezones', 'Upzones', 'Variances', 'CUPs', 'By-Right'].map((label) => {
            const filterKey = label.toLowerCase();
            const isActive = activeFilter === filterKey;
            return (
              <button
                key={label}
                onClick={() => {
                  if (isActive) {
                    setActiveFilter(null);
                    setSearchQuery('');
                  } else {
                    setActiveFilter(filterKey);
                    setSearchQuery('');
                  }
                  setShowAllProjects(false);
                }}
                className={`text-[10px] px-3 py-1 rounded-full border transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Active Filter Badge */}
        {activeFilter && activeFilter !== 'all' && (
          <div className="text-[10px] text-gray-600 flex items-center gap-1">
            <span>Showing:</span>
            <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
              {activeFilter}
              <button
                onClick={() => setActiveFilter(null)}
                className="ml-1 hover:text-teal-900 font-semibold"
              >
                ×
              </button>
            </span>
          </div>
        )}

        {/* Summary Stats */}
        {(avgDensity || avgFar || avgLotCov) && (
          <div className="bg-teal-50 rounded-lg border border-teal-200 px-4 py-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px]">
              {avgDensity && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600">Avg Density:</span>
                  <span className="font-bold text-teal-700">{avgDensity.toFixed(1)}</span>
                  <span className="text-gray-500">u/ac</span>
                </div>
              )}
              {avgFar && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600">Avg FAR:</span>
                  <span className="font-bold text-teal-700">{avgFar.toFixed(2)}</span>
                </div>
              )}
              {avgLotCov && (
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600">Avg Lot Cov:</span>
                  <span className="font-bold text-teal-700">{(avgLotCov * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Best Comparable */}
        {bestComp && (
          <div className="bg-teal-50 rounded-lg border border-teal-200 px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-600 text-white font-bold uppercase tracking-wide">
                  Best Match
                </span>
                {bestComp.similarityScore && (
                  <span className="text-[10px] font-bold text-teal-800">{bestComp.similarityScore}% match</span>
                )}
              </div>
              <DocLinks record={bestComp} />
            </div>
            <div className="text-[12px] font-semibold text-gray-900 truncate">
              {bestComp.projectName || bestComp.address || 'Address not available'}
            </div>
            {bestComp.projectName && bestComp.address && bestComp.projectName !== bestComp.address && (
              <div className="text-[10px] text-gray-500 truncate">{bestComp.address}</div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px]">
              {bestComp.landAcres && <span className="text-gray-600">{bestComp.landAcres.toFixed(2)} ac</span>}
              {bestComp.unitCount && <span className="text-gray-600">{bestComp.unitCount.toLocaleString()} units</span>}
              {bestComp.densityAchieved && <span className="text-teal-700 font-bold">{bestComp.densityAchieved.toFixed(1)} u/ac</span>}
              {bestComp.farAchieved && <span className="text-gray-600">FAR {bestComp.farAchieved.toFixed(2)}</span>}
              {bestComp.stories && <span className="text-gray-600">{bestComp.stories} stories</span>}
              {bestComp.buildingSf && <span className="text-gray-600">{(bestComp.buildingSf / 1000).toFixed(0)}k SF</span>}
            </div>
          </div>
        )}

        {/* Project Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-1.5 text-gray-500 font-medium w-6">#</th>
                <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Project</th>
                <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Lot</th>
                <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Units</th>
                <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Density</th>
                <th className="text-center px-2 py-1.5 text-gray-500 font-medium">Type</th>
                <th className="text-center px-2 py-1.5 text-gray-500 font-medium">Docs</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-gray-100 last:border-0 ${
                    p.matchesUserCode ? 'bg-blue-50 border-l-3 border-l-blue-400' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-1.5 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="text-[11px] font-medium text-gray-900 truncate max-w-[200px]">
                      {p.projectName || p.address || 'N/A'}
                    </div>
                    {p.projectName && p.address && p.projectName !== p.address && (
                      <div className="text-[9px] text-gray-400 truncate max-w-[200px]">{p.address}</div>
                    )}
                    {p.matchesUserCode && (
                      <div className="text-[8px] text-blue-600 font-semibold mt-0.5">YOUR CODE</div>
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
                    <span className={`text-[8px] px-1.5 py-0.5 rounded border font-medium ${getEntitlementBadgeClass(
                      p.entitlementType
                    )}`}>
                      {p.entitlementType}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <DocLinks record={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Show All Button */}
        {filteredRecords.length > 5 && (
          <button
            onClick={() => setShowAllProjects(!showAllProjects)}
            className="text-[11px] text-teal-600 hover:text-teal-800 font-medium py-1"
          >
            {showAllProjects ? 'Show top 5 only' : `Show all ${filteredRecords.length} projects`}
          </button>
        )}

        {/* Common Rezone Transitions */}
        {showTransitionsTable && commonTransitions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-600">Common Rezone Transitions</div>
            <div className="space-y-1.5">
              {commonTransitions.slice(0, 5).map((t, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between text-xs bg-white rounded px-3 py-2 border ${
                    currentZoningCode &&
                    (t.fromCode.toUpperCase() === currentZoningCode.toUpperCase() ||
                      t.toCode.toUpperCase() === currentZoningCode.toUpperCase())
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-gray-700">{t.fromCode}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-mono font-bold text-violet-700">{t.toCode}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{t.count} proj</span>
                    <span className={`font-medium ${t.approvalRate >= 80 ? 'text-green-600' : t.approvalRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {t.approvalRate}%
                    </span>
                    <span className="text-gray-400">{t.avgMonths} mo</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function DocLinks({ record }: { record: RegulatoryRecord }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {record.ordinanceUrl && (
        <a
          href={record.ordinanceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-500 hover:text-red-700"
          title="Ordinance PDF"
        >
          <FileText className="w-3.5 h-3.5" />
        </a>
      )}
      {record.sourceUrl && (
        <a
          href={record.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700"
          title="Source / Case File"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      {record.docketNumber && (
        <span
          className="text-[8px] font-mono text-gray-500 bg-gray-100 px-1 py-0.5 rounded"
          title={`Docket: ${record.docketNumber}`}
        >
          {record.docketNumber}
        </span>
      )}
      {!record.ordinanceUrl && !record.sourceUrl && !record.docketNumber && (
        <span className="text-[8px] text-gray-300">no docs</span>
      )}
    </div>
  );
}

function getEntitlementBadgeClass(type: string): string {
  switch (type) {
    case 'rezone':
      return 'bg-violet-50 text-violet-600 border-violet-200';
    case 'cup':
      return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'variance':
      return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'by_right':
      return 'bg-green-50 text-green-600 border-green-200';
    case 'site_plan':
      return 'bg-cyan-50 text-cyan-600 border-cyan-200';
    default:
      return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

export default RegulatoryMarketResearch;
