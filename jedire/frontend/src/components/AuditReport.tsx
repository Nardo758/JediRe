/**
 * AuditReport - JEDI RE Phase 2 Component 4
 * Full deal audit view with assumptions, events, sources, and export
 */

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import {
  Download,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';
import axios from 'axios';
import AssumptionDetailModal from './AssumptionDetailModal';

interface DealAuditSummary {
  dealId: string;
  dealName: string;
  totalAssumptions: number;
  confirmedAssumptions: number;
  highConfidenceAssumptions: number;
  moderateConfidenceAssumptions: number;
  lowConfidenceAssumptions: number;
  sourceEvents: number;
  totalFinancialImpact: number;
  avgConfidence: number;
  minConfidence: number;
  totalCalculationSteps: number;
  assumptionsByCategory: { [category: string]: number };
}

interface AssumptionConfidence {
  assumptionId: string;
  assumptionName: string;
  confidence: number;
  confidenceLevel: string;
  chainLinkCount: number;
}

interface AuditReportProps {
  dealId: string;
}

const AuditReport: React.FC<AuditReportProps> = ({ dealId }) => {
  const [summary, setSummary] = useState<DealAuditSummary | null>(null);
  const [assumptions, setAssumptions] = useState<AssumptionConfidence[]>([]);
  const [filteredAssumptions, setFilteredAssumptions] = useState<AssumptionConfidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [showBaseline, setShowBaseline] = useState(false);
  
  // Modal state
  const [selectedAssumption, setSelectedAssumption] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (dealId) {
      fetchAuditData();
    }
  }, [dealId]);

  useEffect(() => {
    applyFilters();
  }, [assumptions, searchQuery, confidenceThreshold]);

  const fetchAuditData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch audit summary
      const summaryResponse = await axios.get(`/api/v1/audit/deal/${dealId}`);
      
      // Fetch confidence scores
      const confidenceResponse = await axios.get(`/api/v1/audit/confidence/${dealId}`);

      if (summaryResponse.data.success && confidenceResponse.data.success) {
        setSummary(summaryResponse.data.data);
        setAssumptions(confidenceResponse.data.data);
      } else {
        setError('Failed to load audit data');
      }
    } catch (err) {
      console.error('Error fetching audit data:', err);
      setError('Error loading audit data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...assumptions];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.assumptionName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply confidence threshold
    if (confidenceThreshold > 0) {
      filtered = filtered.filter(a => a.confidence >= confidenceThreshold);
    }

    setFilteredAssumptions(filtered);
  };

  const handleAssumptionClick = (assumptionId: string) => {
    setSelectedAssumption(assumptionId);
    setModalOpen(true);
  };

  const handleExport = async (exportType: 'pdf' | 'excel' | 'json') => {
    setExporting(true);

    try {
      await axios.post(`/api/v1/audit/export/${dealId}`, {
        exportType,
        includeBaseline: showBaseline,
        includeCalculations: true,
        confidenceThreshold: confidenceThreshold > 0 ? confidenceThreshold : undefined,
        title: `Audit Report - ${summary?.dealName}`,
        description: `Complete audit trail for all assumptions`,
      });

      alert(`${exportType.toUpperCase()} export generated successfully!`);
    } catch (err) {
      console.error('Error exporting audit report:', err);
      alert('Failed to export audit report');
    } finally {
      setExporting(false);
    }
  };

  const getConfidenceLevelColor = (level: string) => {
    switch (level) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'high':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
        {error}
      </div>
    );
  }

  if (!summary) {
    return <div>No audit data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Trail</h2>
          <p className="text-gray-600 mt-1">{summary.dealName}</p>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            disabled={exporting}
          >
            <FileJson className="w-4 h-4 mr-2" />
            JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('excel')}
            disabled={exporting}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Assumptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.totalAssumptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Source Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.sourceEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(summary.avgConfidence * 100)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Financial Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(summary.totalFinancialImpact / 1000000).toFixed(1)}M
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confidence Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Confidence Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {summary.confirmedAssumptions}
              </div>
              <div className="text-sm text-gray-600">Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {summary.highConfidenceAssumptions}
              </div>
              <div className="text-sm text-gray-600">High</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {summary.moderateConfidenceAssumptions}
              </div>
              <div className="text-sm text-gray-600">Moderate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {summary.lowConfidenceAssumptions}
              </div>
              <div className="text-sm text-gray-600">Low</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Interface */}
      <Tabs defaultValue="assumptions" className="w-full">
        <TabsList>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="export">Export Options</TabsTrigger>
        </TabsList>

        {/* Assumptions Tab */}
        <TabsContent value="assumptions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Search Assumptions
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Min Confidence: {Math.round(confidenceThreshold * 100)}%
                  </label>
                  <Slider
                    value={[confidenceThreshold]}
                    onValueChange={(values) => setConfidenceThreshold(values[0])}
                    min={0}
                    max={1}
                    step={0.1}
                    className="mt-2"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBaseline}
                      onChange={(e) => setShowBaseline(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Show Baseline Comparison
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assumptions List */}
          <Card>
            <CardHeader>
              <CardTitle>
                Assumptions ({filteredAssumptions.length} of {assumptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredAssumptions.map((assumption) => (
                  <div
                    key={assumption.assumptionId}
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                    onClick={() => handleAssumptionClick(assumption.assumptionId)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {assumption.assumptionName}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {assumption.chainLinkCount} evidence links
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right mr-4">
                        <div className="text-2xl font-bold">
                          {Math.round(assumption.confidence * 100)}%
                        </div>
                        <div className="text-xs text-gray-600">confidence</div>
                      </div>

                      <Badge className={getConfidenceLevelColor(assumption.confidenceLevel)}>
                        {assumption.confidenceLevel}
                      </Badge>
                    </div>
                  </div>
                ))}

                {filteredAssumptions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No assumptions match the current filters
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Source Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                Event impact view coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Source Credibility</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                Source credibility tracking coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Options Tab */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Export Formats</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    className="h-24 flex-col"
                    onClick={() => handleExport('pdf')}
                    disabled={exporting}
                  >
                    <FileText className="w-8 h-8 mb-2" />
                    <span>PDF Report</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-24 flex-col"
                    onClick={() => handleExport('excel')}
                    disabled={exporting}
                  >
                    <FileSpreadsheet className="w-8 h-8 mb-2" />
                    <span>Excel Workbook</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-24 flex-col"
                    onClick={() => handleExport('json')}
                    disabled={exporting}
                  >
                    <FileJson className="w-8 h-8 mb-2" />
                    <span>JSON Data</span>
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Export Settings</h4>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBaseline}
                      onChange={(e) => setShowBaseline(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Include baseline comparison</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded"
                    />
                    <span className="text-sm">Include detailed calculations</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded"
                    />
                    <span className="text-sm">Include source citations</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assumption Detail Modal */}
      {selectedAssumption && (
        <AssumptionDetailModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedAssumption(null);
          }}
          assumptionId={selectedAssumption}
          dealId={dealId}
        />
      )}
    </div>
  );
};

export default AuditReport;
