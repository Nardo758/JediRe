/**
 * AssumptionDetailModal - JEDI RE Phase 2 Component 4
 * Display complete evidence chain for a financial assumption
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Download, 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import axios from 'axios';

interface EvidenceChainNode {
  type: 'event' | 'signal' | 'calculation' | 'adjustment' | 'assumption';
  id: string;
  title: string;
  subtitle?: string;
  confidence: number;
  details: any;
  timestamp?: Date;
}

interface CompleteEvidenceChain {
  assumptionId: string;
  assumptionName: string;
  baselineValue: number;
  adjustedValue: number;
  delta: number;
  deltaPercentage: number;
  units: string;
  overallConfidence: number;
  chain: EvidenceChainNode[];
  financialImpact: number;
}

interface AssumptionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  assumptionId: string;
  dealId: string;
}

const AssumptionDetailModal: React.FC<AssumptionDetailModalProps> = ({
  isOpen,
  onClose,
  assumptionId,
  dealId,
}) => {
  const [evidenceChain, setEvidenceChain] = useState<CompleteEvidenceChain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (isOpen && assumptionId) {
      fetchEvidenceChain();
    }
  }, [isOpen, assumptionId]);

  const fetchEvidenceChain = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`/api/v1/audit/assumption/${assumptionId}`);
      
      if (response.data.success) {
        setEvidenceChain(response.data.data);
        // Expand all nodes by default
        const allNodeIds = response.data.data.chain.map((node: EvidenceChainNode) => node.id);
        setExpandedNodes(new Set(allNodeIds));
      } else {
        setError('Failed to load evidence chain');
      }
    } catch (err) {
      console.error('Error fetching evidence chain:', err);
      setError('Error loading evidence chain');
    } finally {
      setLoading(false);
    }
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleExportEvidence = async () => {
    setExportingPdf(true);
    
    try {
      await axios.post(`/api/v1/audit/export/${dealId}`, {
        exportType: 'pdf',
        assumptionIds: [assumptionId],
        includeBaseline: true,
        includeCalculations: true,
        title: `Evidence for ${evidenceChain?.assumptionName}`,
      });

      alert('Evidence exported successfully!');
    } catch (err) {
      console.error('Error exporting evidence:', err);
      alert('Failed to export evidence');
    } finally {
      setExportingPdf(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Confirmed ({Math.round(confidence * 100)}%)
        </Badge>
      );
    } else if (confidence >= 0.7) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
          High ({Math.round(confidence * 100)}%)
        </Badge>
      );
    } else if (confidence >= 0.4) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Moderate ({Math.round(confidence * 100)}%)
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-300">
          <Eye className="w-3 h-3 mr-1" />
          Low ({Math.round(confidence * 100)}%)
        </Badge>
      );
    }
  };

  const getConfidenceIndicatorStyle = (confidence: number) => {
    if (confidence >= 0.9) return 'border-green-500 bg-green-50';
    if (confidence >= 0.7) return 'border-blue-500 bg-blue-50';
    if (confidence >= 0.4) return 'border-yellow-500 bg-yellow-50';
    return 'border-gray-400 bg-gray-50 border-dashed';
  };

  const renderChainNode = (node: EvidenceChainNode, index: number) => {
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} className="relative">
        {/* Connecting line */}
        {index > 0 && (
          <div className="absolute left-6 -top-4 w-0.5 h-4 bg-gray-300" />
        )}

        <Card className={`mb-4 ${getConfidenceIndicatorStyle(node.confidence)}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <button
                  onClick={() => toggleNodeExpansion(node.id)}
                  className="mt-1 p-1 hover:bg-white rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  )}
                </button>

                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {node.title}
                  </CardTitle>
                  {node.subtitle && (
                    <p className="text-sm text-gray-600 mt-1">{node.subtitle}</p>
                  )}
                </div>
              </div>

              <div className="ml-4">
                {getConfidenceBadge(node.confidence)}
              </div>
            </div>
          </CardHeader>

          {isExpanded && (
            <CardContent>
              {node.type === 'event' && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Date:</span>{' '}
                    {new Date(node.details.date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Source:</span> {node.details.source}
                  </div>
                  {node.details.summary && (
                    <div>
                      <span className="font-medium">Summary:</span>
                      <p className="mt-1 text-gray-700">{node.details.summary}</p>
                    </div>
                  )}
                  {node.details.jobCount && (
                    <div>
                      <span className="font-medium">Job Impact:</span>{' '}
                      {node.details.jobCount.toLocaleString()} jobs
                    </div>
                  )}
                </div>
              )}

              {(node.type === 'signal' || node.type === 'calculation') && (
                <div className="space-y-2 text-sm">
                  {node.details.formula && (
                    <div className="bg-gray-50 p-3 rounded font-mono text-xs">
                      {node.details.formula}
                    </div>
                  )}
                  {node.details.inputParameters && (
                    <div>
                      <span className="font-medium">Input Parameters:</span>
                      <pre className="mt-1 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(node.details.inputParameters, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Output:</span>{' '}
                    {node.details.outputValue} {node.details.outputUnit}
                  </div>
                  {node.details.tradeAreaName && (
                    <div>
                      <span className="font-medium">Trade Area:</span>{' '}
                      {node.details.tradeAreaName}
                      {node.details.impactWeight && (
                        <span className="text-gray-600">
                          {' '}(weight: {(node.details.impactWeight * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  )}
                  {node.details.phaseStartQuarter && (
                    <div>
                      <span className="font-medium">Timeline:</span>{' '}
                      {node.details.phaseStartQuarter}
                      {node.details.phaseDurationQuarters && (
                        <span> ({node.details.phaseDurationQuarters} quarters)</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {node.type === 'adjustment' && (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="font-medium text-gray-600">Baseline</div>
                      <div className="text-lg">
                        {node.details.baseline} {node.details.units}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-600">Adjusted</div>
                      <div className="text-lg font-semibold">
                        {node.details.adjusted} {node.details.units}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-600">Change</div>
                      <div className={`text-lg font-semibold flex items-center ${
                        node.details.delta > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {node.details.delta > 0 ? (
                          <TrendingUp className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 mr-1" />
                        )}
                        {node.details.delta > 0 ? '+' : ''}
                        {node.details.delta} {node.details.units}
                      </div>
                    </div>
                  </div>
                  {node.details.financialImpact && (
                    <div className="mt-3 p-3 bg-blue-50 rounded">
                      <span className="font-medium">Financial Impact:</span>{' '}
                      <span className="text-lg font-semibold">
                        ${node.details.financialImpact.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {node.type === 'assumption' && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Category:</span>{' '}
                    {node.details.category}
                  </div>
                  <div>
                    <span className="font-medium">Final Value:</span>{' '}
                    <span className="text-lg font-semibold">
                      {node.details.adjustedValue} {evidenceChain?.units}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Confidence Level:</span>{' '}
                    {node.details.confidenceLevel}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {evidenceChain?.assumptionName || 'Assumption Evidence'}
          </DialogTitle>
          <DialogDescription>
            Complete evidence chain from news events to financial model
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
            <AlertCircle className="w-5 h-5 inline mr-2" />
            {error}
          </div>
        )}

        {evidenceChain && (
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Baseline → Adjusted
                    </h3>
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl font-semibold">
                        {evidenceChain.baselineValue}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {evidenceChain.adjustedValue}
                      </span>
                      <span className="text-gray-600">{evidenceChain.units}</span>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className={evidenceChain.delta > 0 ? 'text-green-600' : 'text-red-600'}>
                        {evidenceChain.delta > 0 ? '+' : ''}
                        {evidenceChain.deltaPercentage?.toFixed(2)}% change
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-2">
                      Overall Confidence
                    </h3>
                    <div className="flex items-center space-x-3">
                      {getConfidenceBadge(evidenceChain.overallConfidence)}
                    </div>
                    {evidenceChain.financialImpact && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-600">Financial Impact: </span>
                        <span className="font-semibold">
                          ${evidenceChain.financialImpact.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Evidence Chain */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Evidence Chain</h3>
              <div className="space-y-0">
                {evidenceChain.chain.map((node, index) => renderChainNode(node, index))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                onClick={handleExportEvidence}
                disabled={exportingPdf}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                {exportingPdf ? 'Exporting...' : 'Defend This Assumption'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AssumptionDetailModal;
