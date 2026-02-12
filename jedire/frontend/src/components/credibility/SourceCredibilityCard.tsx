/**
 * Source Credibility Card
 * Display when viewing email with news extraction
 * Shows sender's credibility score and predicted accuracy
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '../ui/card';
import { Badge } from '../ui/badge';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Target,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../ui/tooltip';

interface SourceCredibilityCardProps {
  contactEmail: string;
  eventId?: string;
  compact?: boolean;
}

interface SourceData {
  contactName: string | null;
  contactCompany: string | null;
  totalSignals: number;
  corroboratedSignals: number;
  failedSignals: number;
  pendingSignals: number;
  credibilityScore: number;
  avgLeadTimeDays: number;
  intelligenceValueScore: number;
  specialties: Array<{
    category: string;
    score: number;
    signalCount: number;
    accuracy: number;
  }>;
}

interface PredictionData {
  predictedAccuracy: number;
  predictedCorroborationDays: number | null;
  confidenceLevel: 'low' | 'medium' | 'high' | 'very_high';
  historicalAccuracy: number;
  specialtyMatch: boolean;
  specialtyAccuracy: number | null;
  sampleSize: number;
}

export default function SourceCredibilityCard({
  contactEmail,
  eventId,
  compact = false
}: SourceCredibilityCardProps) {
  const [source, setSource] = useState<SourceData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSourceData();
    if (eventId) {
      fetchPrediction();
    }
  }, [contactEmail, eventId]);

  const fetchSourceData = async () => {
    try {
      const response = await fetch(
        `/api/v1/credibility/source/${encodeURIComponent(contactEmail)}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const result = await response.json();
      
      if (result.success) {
        setSource(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch source data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrediction = async () => {
    if (!eventId) return;
    
    try {
      const response = await fetch(
        `/api/v1/credibility/predictions/${eventId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const result = await response.json();
      
      if (result.success) {
        setPrediction(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch prediction:', error);
    }
  };

  const getConfidenceBadge = (level: string) => {
    const configs = {
      very_high: { variant: 'default' as const, label: 'Very High', className: 'bg-green-600' },
      high: { variant: 'default' as const, label: 'High', className: 'bg-green-500' },
      medium: { variant: 'secondary' as const, label: 'Medium', className: 'bg-blue-500' },
      low: { variant: 'outline' as const, label: 'Low', className: 'bg-gray-400' }
    };
    const config = configs[level as keyof typeof configs] || configs.low;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label} Confidence
      </Badge>
    );
  };

  const getCredibilityColor = (score: number) => {
    if (score >= 0.75) return 'text-green-600';
    if (score >= 0.50) return 'text-blue-600';
    return 'text-orange-600';
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="pt-6">
          <div className="h-24 bg-gray-200 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  if (!source) {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">New Source - No Track Record</p>
          </div>
          <p className="text-sm text-yellow-700 mt-2">
            This is the first signal from this contact. Credibility will be tracked over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium">Source Credibility:</span>
          <span className={`text-lg font-bold ${getCredibilityColor(source.credibilityScore)}`}>
            {(source.credibilityScore * 100).toFixed(0)}%
          </span>
        </div>
        <div className="text-sm text-gray-600">
          {source.corroboratedSignals}/{source.totalSignals} confirmed
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Source Credibility
          </span>
          {prediction && getConfidenceBadge(prediction.confidenceLevel)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source Info */}
        <div>
          <h3 className="font-semibold text-lg">
            {source.contactName || contactEmail}
          </h3>
          {source.contactCompany && (
            <p className="text-sm text-gray-600">{source.contactCompany}</p>
          )}
        </div>

        {/* Credibility Score */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-sm text-gray-600">Overall Credibility</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Based on historical track record</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className={`text-3xl font-bold ${getCredibilityColor(source.credibilityScore)}`}>
              {(source.credibilityScore * 100).toFixed(0)}%
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-sm text-gray-600">Intelligence Value</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Lead time + accuracy + impact + consistency</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {source.intelligenceValueScore.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Track Record */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="font-medium text-sm mb-2">Historical Track Record</h4>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-600">Total</p>
              <p className="font-bold">{source.totalSignals}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Confirmed</p>
              <p className="font-bold text-green-600">{source.corroboratedSignals}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Pending</p>
              <p className="font-bold text-blue-600">{source.pendingSignals}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Failed</p>
              <p className="font-bold text-red-600">{source.failedSignals}</p>
            </div>
          </div>
        </div>

        {/* Lead Time */}
        {source.avgLeadTimeDays > 0 && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-600" />
            <span className="text-sm">
              Avg Lead Time: <strong>{source.avgLeadTimeDays.toFixed(0)} days</strong> ahead of public news
            </span>
          </div>
        )}

        {/* Specialties */}
        {source.specialties && source.specialties.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2">Specialties</h4>
            <div className="flex flex-wrap gap-2">
              {source.specialties.map((specialty) => (
                <Badge key={specialty.category} variant="secondary">
                  {specialty.category}: {specialty.score.toFixed(0)}%
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Prediction for Current Signal */}
        {prediction && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Predicted Accuracy for This Signal
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-600">Predicted Accuracy</p>
                <p className="text-2xl font-bold text-blue-600">
                  {prediction.predictedAccuracy.toFixed(0)}%
                </p>
              </div>
              {prediction.predictedCorroborationDays && (
                <div>
                  <p className="text-xs text-gray-600">Est. Confirmation</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {prediction.predictedCorroborationDays}d
                  </p>
                </div>
              )}
            </div>
            {prediction.specialtyMatch && (
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-700">
                <CheckCircle2 className="h-3 w-3" />
                <span>
                  Specialty match detected - using category-specific accuracy ({prediction.specialtyAccuracy?.toFixed(0)}%)
                </span>
              </div>
            )}
            <div className="mt-2 text-xs text-gray-600">
              Based on {prediction.sampleSize} historical signals
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
