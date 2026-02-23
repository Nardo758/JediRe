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
        const [benchmarkData, submarketData, ownerData, summaryData] = await Promise.all([
          propertyMetricsService.getNeighborhoodBenchmarks().catch(() => []),
          propertyMetricsService.getSubmarketComparison().catch(() => []),
          propertyMetricsService.getTopOwners(10).catch(() => []),
          propertyMetricsService.getMarketSummary().catch(() => null),
        ]);
        setBenchmarks(benchmarkData);
        setSubmarkets(submarketData);
        setTopOwners(ownerData);
        setMarketSummary(summaryData);
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

export default OverviewSection;
