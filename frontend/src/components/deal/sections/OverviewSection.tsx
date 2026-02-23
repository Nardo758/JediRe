/**
 * Overview Section - Deal Page
 * Property Intelligence Dashboard with real metrics from backend API
 */

import React, { useEffect, useState } from 'react';
import { ActionStatusPanel } from '../ActionStatusPanel';
import { StrategyAnalysisResults } from '../StrategyAnalysisResults';
import {
  dealAnalysisService,
  AnalysisStatus,
  StrategyResults,
} from '@/services/dealAnalysis.service';
import {
  propertyMetricsService,
  NeighborhoodBenchmark,
  SubmarketComparison,
  OwnerPortfolio,
  MarketSummary,
} from '@/services/propertyMetrics.service';
import {
  propertyScoringService,
  SellerPropensityResult,
  CapRateEstimate,
  TaxBurdenResult,
} from '@/services/propertyScoring.service';

interface OverviewSectionProps {
  deal: any;
  onStrategySelected?: (strategyId: string) => void;
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '--';
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDecimal(val: number | null | undefined, digits = 1): string {
  if (val == null) return '--';
  return val.toFixed(digits);
}

function formatPercent(val: number | null | undefined): string {
  if (val == null) return '--';
  return val.toFixed(1) + '%';
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  deal,
  onStrategySelected,
}) => {
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    phase: 'initializing',
    progress: 0,
    message: 'Initializing analysis...',
  });
  const [strategyResults, setStrategyResults] = useState<StrategyResults | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [benchmarks, setBenchmarks] = useState<NeighborhoodBenchmark[]>([]);
  const [submarkets, setSubmarkets] = useState<SubmarketComparison[]>([]);
  const [topOwners, setTopOwners] = useState<OwnerPortfolio[]>([]);
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  const [sellerScores, setSellerScores] = useState<SellerPropensityResult[]>([]);
  const [capRates, setCapRates] = useState<CapRateEstimate[]>([]);
  const [taxBurden, setTaxBurden] = useState<TaxBurdenResult[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    if (!deal?.id) return;

    let stopPolling: (() => void) | undefined;

    const runAnalysis = async () => {
      stopPolling = await startAnalysis();
    };
    runAnalysis();

    return () => {
      stopPolling?.();
    };
  }, [deal?.id]);

  useEffect(() => {
    const fetchMetrics = async () => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const [benchmarkData, submarketData, ownerData, summaryData, sellerData, capRateData, taxData] = await Promise.all([
          propertyMetricsService.getNeighborhoodBenchmarks().catch(() => []),
          propertyMetricsService.getSubmarketComparison().catch(() => []),
          propertyMetricsService.getTopOwners(10).catch(() => []),
          propertyMetricsService.getMarketSummary().catch(() => null),
          propertyScoringService.getSellerPropensity(20).catch(() => []),
          propertyScoringService.getCapRateEstimates().catch(() => []),
          propertyScoringService.getTaxBurden(20).catch(() => []),
        ]);
        setBenchmarks(benchmarkData);
        setSubmarkets(submarketData);
        setTopOwners(ownerData);
        setMarketSummary(summaryData);
        setSellerScores(sellerData);
        setCapRates(capRateData);
        setTaxBurden(taxData);
      } catch (err: any) {
        setMetricsError(err.message || 'Failed to load property metrics');
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const startAnalysis = async (): Promise<(() => void) | undefined> => {
    try {
      const existingAnalysis = await dealAnalysisService.getLatestAnalysis(deal.id);

      if (existingAnalysis) {
        setStrategyResults(existingAnalysis);
        setAnalysisComplete(true);
        setAnalysisStatus({
          phase: 'complete',
          progress: 100,
          message: 'Analysis complete',
        });
        return;
      }

      setAnalysisStatus({
        phase: 'initializing',
        progress: 0,
        message: 'Starting analysis...',
      });

      await dealAnalysisService.triggerAnalysis(deal.id);

      const stopPolling = dealAnalysisService.pollAnalysisStatus(
        deal.id,
        (status) => {
          setAnalysisStatus(status);
        },
        (results) => {
          setStrategyResults(results);
          setAnalysisComplete(true);
        },
        2000
      );

      return stopPolling;
    } catch (error) {
      console.error('Failed to start analysis:', error);
      setAnalysisError((error as Error).message);
      setAnalysisStatus({
        phase: 'error',
        progress: 0,
        message: 'Failed to start analysis',
        error: (error as Error).message,
      });
    }
  };

  const handleStrategySelection = (strategyId: string) => {
    console.log('Strategy selected:', strategyId);
    onStrategySelected?.(strategyId);
  };

  const handleAnalysisComplete = () => {
    setAnalysisComplete(true);
  };

  const medianPerUnit = benchmarks.length > 0
    ? benchmarks.reduce((sum, b) => sum + (b.medianPerUnit || 0), 0) / benchmarks.filter(b => b.medianPerUnit != null).length || null
    : null;

  const avgDensity = benchmarks.length > 0
    ? benchmarks.reduce((sum, b) => sum + (b.avgDensity || 0), 0) / benchmarks.filter(b => b.avgDensity != null).length || null
    : null;

  const totalBenchmarkProps = benchmarks.reduce((sum, b) => sum + b.propertyCount, 0);
  const totalRentCompProps = marketSummary?.propertyCount || 0;
  const totalTracked = totalBenchmarkProps + totalRentCompProps;

  return (
    <div className="space-y-6">
      {!analysisComplete && (
        <ActionStatusPanel
          status={analysisStatus}
          dealType={deal.developmentType || 'Development'}
          propertyType={deal.propertyTypeKey || 'Multifamily'}
          onComplete={handleAnalysisComplete}
        />
      )}

      {strategyResults && (
        <StrategyAnalysisResults
          results={strategyResults}
          dealType={deal.developmentType || 'Development'}
          onChooseStrategy={handleStrategySelection}
        />
      )}

      {metricsLoading ? (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Loading property intelligence...</span>
          </div>
        </div>
      ) : metricsError ? (
        <div className="bg-white rounded-lg border-2 border-red-200 p-6">
          <p className="text-red-600 text-sm">Error loading metrics: {metricsError}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">$/Unit</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(medianPerUnit)}</p>
            </div>
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Units/Acre</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatDecimal(avgDensity)}</p>
            </div>
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Rent/SF</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{marketSummary ? formatCurrency(marketSummary.avgRentPerSf) : '--'}</p>
            </div>
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Occupancy %</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{marketSummary ? formatPercent(marketSummary.avgOccupancy) : '--'}</p>
            </div>
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Concession %</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{marketSummary ? formatPercent(marketSummary.avgConcession) : '--'}</p>
            </div>
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Properties Tracked</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalTracked.toLocaleString()}</p>
            </div>
          </div>

          <SellerPropensityCard sellers={sellerScores} />

          <CapRateCard capRates={capRates} />

          <TaxBurdenCard items={taxBurden} />

          <SubmarketComparisonTable submarkets={submarkets} />

          <TopOwnersCard owners={topOwners} />

          <MarketSummaryCard summary={marketSummary} />
        </>
      )}
    </div>
  );
};

const SubmarketComparisonTable: React.FC<{ submarkets: SubmarketComparison[] }> = ({ submarkets }) => {
  if (submarkets.length === 0) {
    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Submarket Comparison</h3>
        <p className="text-sm text-gray-500">No submarket data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Submarket Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Neighborhood</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Properties</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Total Units</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Avg $/Unit</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Avg Density</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Avg SF/Unit</th>
            </tr>
          </thead>
          <tbody>
            {submarkets.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-900">{row.neighborhoodCode}</td>
                <td className="py-2 px-3 text-right text-gray-700">{row.properties.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-gray-700">{row.totalUnits.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-gray-700">{formatCurrency(row.avgValuePerUnit)}</td>
                <td className="py-2 px-3 text-right text-gray-700">{formatDecimal(row.avgDensity)}</td>
                <td className="py-2 px-3 text-right text-gray-700">{formatDecimal(row.avgSfPerUnit, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TopOwnersCard: React.FC<{ owners: OwnerPortfolio[] }> = ({ owners }) => {
  if (owners.length === 0) {
    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Owners</h3>
        <p className="text-sm text-gray-500">No owner data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Owners</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Owner</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Properties</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Total Units</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Total Assessed Value</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-900">{owner.ownerName}</td>
                <td className="py-2 px-3 text-right text-gray-700">{owner.propertyCount.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-gray-700">{owner.totalUnits.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-gray-700">{formatCurrency(owner.totalAssessedValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MarketSummaryCard: React.FC<{ summary: MarketSummary | null }> = ({ summary }) => {
  if (!summary) {
    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Summary</h3>
        <p className="text-sm text-gray-500">No market summary data available.</p>
      </div>
    );
  }

  const rows = [
    { label: 'Avg Rent/SF', value: formatCurrency(summary.avgRentPerSf) },
    { label: 'Median Rent/SF', value: formatCurrency(summary.medianRentPerSf) },
    { label: 'Occupancy Range', value: `${formatPercent(summary.occupancyRange?.min)} - ${formatPercent(summary.occupancyRange?.max)}` },
    { label: 'Avg Unit Size', value: summary.avgUnitSize ? `${formatDecimal(summary.avgUnitSize, 0)} SF` : '--' },
    { label: 'Avg Year Built', value: summary.avgYearBuilt ? formatDecimal(summary.avgYearBuilt, 0) : '--' },
    { label: 'Rent Range', value: `${formatCurrency(summary.rentRange?.min)} - ${formatCurrency(summary.rentRange?.max)}` },
  ];

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {rows.map((row, idx) => (
          <div key={idx}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{row.label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const scoreColor = (score: number): string => {
  if (score >= 70) return 'text-red-600';
  if (score >= 50) return 'text-orange-600';
  if (score >= 30) return 'text-yellow-600';
  return 'text-gray-600';
};

const scoreBg = (score: number): string => {
  if (score >= 70) return 'bg-red-100';
  if (score >= 50) return 'bg-orange-100';
  if (score >= 30) return 'bg-yellow-100';
  return 'bg-gray-100';
};

const SellerPropensityCard: React.FC<{ sellers: SellerPropensityResult[] }> = ({ sellers }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (sellers.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Seller Propensity Scores</h3>
          <p className="text-sm text-gray-500">Top {sellers.length} most likely sellers (scored 0-100)</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Acquisition Targets
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Owner</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Address</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Units</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Year Built</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Score</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">Details</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((s, idx) => (
              <React.Fragment key={idx}>
                <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === s.parcelId ? null : s.parcelId)}>
                  <td className="py-2 px-3 font-medium text-gray-900">{s.ownerName}</td>
                  <td className="py-2 px-3 text-gray-700 text-xs">{s.address}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{s.units}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{s.yearBuilt ?? '—'}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${scoreBg(s.score)} ${scoreColor(s.score)}`}>
                      {s.score}/100
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center text-gray-400 text-xs">{expanded === s.parcelId ? '▲' : '▼'}</td>
                </tr>
                {expanded === s.parcelId && (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 bg-gray-50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {s.factors.map((f, fi) => (
                          <div key={fi} className="text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-600">{f.name}</span>
                              <span className="font-semibold text-gray-900">{f.points}/{f.maxPoints}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-0.5">
                              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(f.points / f.maxPoints) * 100}%` }}></div>
                            </div>
                            <p className="text-gray-500 mt-0.5 truncate" title={f.reason}>{f.reason}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CapRateCard: React.FC<{ capRates: CapRateEstimate[] }> = ({ capRates }) => {
  if (capRates.length === 0) return null;

  const tierLabel = (t: string) => {
    if (t === 'premium') return { text: 'Premium', cls: 'bg-purple-100 text-purple-800' };
    if (t === 'value') return { text: 'Value', cls: 'bg-green-100 text-green-800' };
    return { text: 'Standard', cls: 'bg-blue-100 text-blue-800' };
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Implied Cap Rates by Neighborhood</h3>
          <p className="text-sm text-gray-500">Estimated from assessed values + NOI assumptions</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Neighborhood</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Properties</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Total Units</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Avg $/Unit</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Est. NOI/Unit</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Implied Cap Rate</th>
              <th className="text-center py-2 px-3 font-medium text-gray-600">Tier</th>
            </tr>
          </thead>
          <tbody>
            {capRates.slice(0, 15).map((cr, idx) => {
              const tl = tierLabel(cr.tier);
              return (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-900">{cr.neighborhoodCode}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{cr.propertyCount}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{cr.totalUnits.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{formatCurrency(cr.avgAssessedPerUnit)}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{formatCurrency(cr.estimatedNOIPerUnit)}</td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-900">{cr.impliedCapRate.toFixed(2)}%</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tl.cls}`}>
                      {tl.text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TaxBurdenCard: React.FC<{ items: TaxBurdenResult[] }> = ({ items }) => {
  const overtaxed = items.filter(i => i.flag === 'overtaxed');
  if (overtaxed.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tax Burden Outliers</h3>
          <p className="text-sm text-gray-500">{overtaxed.length} properties 25%+ above neighborhood median — tax appeal candidates</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Cost Savings
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Address</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Owner</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Units</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Effective Rate</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Nbhd Median</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Deviation</th>
            </tr>
          </thead>
          <tbody>
            {overtaxed.slice(0, 15).map((t, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-900 text-xs">{t.address}</td>
                <td className="py-2 px-3 text-gray-700 text-xs">{t.ownerName}</td>
                <td className="py-2 px-3 text-right text-gray-700">{t.units}</td>
                <td className="py-2 px-3 text-right text-gray-700">{t.effectiveTaxRate.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right text-gray-700">{t.neighborhoodMedianRate.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right font-semibold text-red-600">+{t.deviationPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OverviewSection;
