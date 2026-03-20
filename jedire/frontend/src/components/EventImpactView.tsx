/**
 * EventImpactView - JEDI RE Phase 2 Component 4
 * Show all assumptions changed by a specific news event
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  TrendingUp,
  TrendingDown,
  Building,
  Calendar,
  DollarSign,
  Target,
  CheckCircle,
} from 'lucide-react';
import axios from 'axios';
import AssumptionDetailModal from './AssumptionDetailModal';

interface EventImpact {
  eventId: string;
  headline: string;
  eventDate: Date;
  source: string;
  credibility: number;
  dealsAffected: number;
  assumptionsAffected: number;
  totalFinancialImpact: number;
  avgFinancialImpact: number;
  maxFinancialImpact: number;
  avgAssumptionConfidence: number;
  affectedAssumptions: Array<{
    dealId: string;
    dealName: string;
    assumptionName: string;
    impact: number;
    confidence: number;
  }>;
}

interface EventImpactViewProps {
  eventId: string;
  onClose?: () => void;
}

const EventImpactView: React.FC<EventImpactViewProps> = ({ eventId, onClose }) => {
  const [impact, setImpact] = useState<EventImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedAssumption, setSelectedAssumption] = useState<{
    assumptionId: string;
    dealId: string;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEventImpact();
    }
  }, [eventId]);

  const fetchEventImpact = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`/api/v1/audit/event/${eventId}`);
      
      if (response.data.success) {
        setImpact(response.data.data);
      } else {
        setError('Failed to load event impact');
      }
    } catch (err) {
      console.error('Error fetching event impact:', err);
      setError('Error loading event impact');
    } finally {
      setLoading(false);
    }
  };

  const handleAssumptionClick = (dealId: string, assumptionName: string) => {
    // In real implementation, would need to fetch assumptionId from assumptionName
    // For now, using a placeholder
    setSelectedAssumption({
      assumptionId: 'placeholder-id',
      dealId,
    });
    setModalOpen(true);
  };

  const getCredibilityBadge = (credibility: number) => {
    if (credibility >= 0.9) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Confirmed
        </Badge>
      );
    } else if (credibility >= 0.7) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
          High Credibility
        </Badge>
      );
    } else if (credibility >= 0.4) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
          Moderate
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-300">
          Low
        </Badge>
      );
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

  if (!impact) {
    return <div>No impact data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{impact.headline}</h2>
          <div className="flex items-center space-x-4 mt-3 text-sm text-gray-600">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {new Date(impact.eventDate).toLocaleDateString()}
            </div>
            <div>Source: {impact.source}</div>
            <div>{getCredibilityBadge(impact.credibility)}</div>
          </div>
        </div>
        
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Impact Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          This event changed {impact.assumptionsAffected} assumption
          {impact.assumptionsAffected !== 1 ? 's' : ''} in your model
        </h3>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Deals Affected</div>
            <div className="text-2xl font-bold text-gray-900 flex items-center">
              <Building className="w-5 h-5 mr-2 text-blue-600" />
              {impact.dealsAffected}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-1">Assumptions Changed</div>
            <div className="text-2xl font-bold text-gray-900 flex items-center">
              <Target className="w-5 h-5 mr-2 text-purple-600" />
              {impact.assumptionsAffected}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-1">Total Impact</div>
            <div className="text-2xl font-bold text-gray-900 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-600" />
              ${(impact.totalFinancialImpact / 1000000).toFixed(2)}M
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-1">Avg Confidence</div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(impact.avgAssumptionConfidence * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Visual Impact Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Impact Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Group by deal */}
            {Object.entries(
              impact.affectedAssumptions.reduce((acc, assumption) => {
                if (!acc[assumption.dealName]) {
                  acc[assumption.dealName] = [];
                }
                acc[assumption.dealName].push(assumption);
                return acc;
              }, {} as Record<string, typeof impact.affectedAssumptions>)
            ).map(([dealName, assumptions]) => (
              <div key={dealName} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 flex items-center">
                    <Building className="w-4 h-4 mr-2 text-gray-600" />
                    {dealName}
                  </h4>
                  <Badge variant="outline">
                    {assumptions.length} assumption{assumptions.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="space-y-2 ml-6">
                  {assumptions.map((assumption, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                      onClick={() => handleAssumptionClick(assumption.dealId, assumption.assumptionName)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {assumption.assumptionName}
                          </div>
                          <div className="text-sm text-gray-600">
                            Confidence: {Math.round(assumption.confidence * 100)}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className={`text-right ${
                          assumption.impact >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <div className="flex items-center font-semibold">
                            {assumption.impact >= 0 ? (
                              <TrendingUp className="w-4 h-4 mr-1" />
                            ) : (
                              <TrendingDown className="w-4 h-4 mr-1" />
                            )}
                            ${Math.abs(assumption.impact).toLocaleString()}
                          </div>
                          <div className="text-xs">impact</div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssumptionClick(assumption.dealId, assumption.assumptionName);
                          }}
                        >
                          View Evidence
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Impact Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Impact Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {impact.affectedAssumptions
              .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
              .slice(0, 10)
              .map((assumption, idx) => {
                const maxImpact = Math.max(...impact.affectedAssumptions.map(a => Math.abs(a.impact)));
                const widthPercent = (Math.abs(assumption.impact) / maxImpact) * 100;
                const isPositive = assumption.impact >= 0;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900 truncate max-w-xs">
                        {assumption.assumptionName}
                      </span>
                      <span className={`font-semibold ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${Math.abs(assumption.impact).toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          isPositive ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Assumption Detail Modal */}
      {selectedAssumption && (
        <AssumptionDetailModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedAssumption(null);
          }}
          assumptionId={selectedAssumption.assumptionId}
          dealId={selectedAssumption.dealId}
        />
      )}
    </div>
  );
};

export default EventImpactView;
