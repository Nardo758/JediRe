/**
 * Corroboration Feed
 * Real-time feed showing when private intelligence gets confirmed
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
  CheckCircle2,
  TrendingUp,
  Clock,
  Newspaper,
  Mail,
  Award,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Corroboration {
  id: string;
  privateEventId: string;
  publicEventId: string;
  matchScore: number;
  leadTimeDays: number;
  matchConfidence: 'low' | 'medium' | 'high' | 'very_high';
  privateCompany: string;
  privateDate: string;
  publicCompany: string;
  publicDate: string;
  publicSource: string;
  contactEmail: string;
  contactName: string | null;
  createdAt: string;
}

interface CorroborationFeedProps {
  limit?: number;
  showHeader?: boolean;
}

export default function CorroborationFeed({ 
  limit = 10,
  showHeader = true 
}: CorroborationFeedProps) {
  const [corroborations, setCorroborations] = useState<Corroboration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCorroborations();
    // Optionally, set up polling for real-time updates
    const interval = setInterval(fetchCorroborations, 60000); // Every minute
    return () => clearInterval(interval);
  }, [limit]);

  const fetchCorroborations = async () => {
    try {
      const response = await fetch(
        `/api/v1/credibility/corroborations?limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const result = await response.json();
      
      if (result.success) {
        setCorroborations(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch corroborations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const configs = {
      very_high: { variant: 'default' as const, className: 'bg-green-600' },
      high: { variant: 'default' as const, className: 'bg-green-500' },
      medium: { variant: 'secondary' as const, className: 'bg-blue-500' },
      low: { variant: 'outline' as const, className: 'bg-gray-400' }
    };
    const config = configs[confidence as keyof typeof configs] || configs.low;
    return (
      <Badge variant={config.variant} className={config.className}>
        {confidence.replace('_', ' ')}
      </Badge>
    );
  };

  const getLeadTimeBadge = (days: number) => {
    if (days >= 30) {
      return <Badge className="bg-purple-600">1+ month early</Badge>;
    } else if (days >= 14) {
      return <Badge className="bg-green-600">{days} days early</Badge>;
    } else if (days >= 7) {
      return <Badge className="bg-blue-600">{days} days early</Badge>;
    } else {
      return <Badge variant="secondary">{days} days early</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Recent Corroborations
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (corroborations.length === 0) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Recent Corroborations
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No corroborations yet</p>
            <p className="text-sm mt-2">
              When your contacts' private intelligence gets confirmed by public sources, they'll appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Recent Corroborations
            <Badge variant="secondary">{corroborations.length}</Badge>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          {corroborations.map((corr) => (
            <div
              key={corr.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50 to-white"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">
                      Your contact was right!
                    </h3>
                    <p className="text-sm text-gray-600">
                      {corr.contactName || corr.contactEmail}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getLeadTimeBadge(corr.leadTimeDays)}
                  {getConfidenceBadge(corr.matchConfidence)}
                </div>
              </div>

              {/* Timeline */}
              <div className="relative pl-8 space-y-3">
                {/* Private Signal */}
                <div className="relative">
                  <div className="absolute left-[-24px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-blue-600 mt-1" />
                    <div>
                      <p className="text-sm font-medium">
                        Private Intelligence (Email)
                      </p>
                      <p className="text-xs text-gray-600">
                        {corr.privateCompany}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(corr.privateDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connection Line */}
                <div className="absolute left-[-17px] top-6 w-0.5 h-8 bg-gray-300"></div>

                {/* Public Confirmation */}
                <div className="relative">
                  <div className="absolute left-[-24px] top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
                  <div className="flex items-start gap-2">
                    <Newspaper className="h-4 w-4 text-green-600 mt-1" />
                    <div>
                      <p className="text-sm font-medium">
                        Public Confirmation
                      </p>
                      <p className="text-xs text-gray-600">
                        {corr.publicCompany}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {format(new Date(corr.publicDate), 'MMM d, yyyy')}
                        </p>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-gray-500">
                          {corr.publicSource}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  <span>
                    Detected {formatDistanceToNow(new Date(corr.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600">Match confidence:</span>
                  <span className="font-semibold">
                    {(corr.matchScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Competitive Advantage Highlight */}
              {corr.leadTimeDays >= 14 && (
                <div className="mt-3 bg-purple-50 border border-purple-200 rounded p-2">
                  <p className="text-xs text-purple-900 font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Significant competitive advantage: Your network gave you {corr.leadTimeDays} days head start
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {corroborations.length >= limit && (
          <div className="mt-4 text-center">
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              View all corroborations →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
