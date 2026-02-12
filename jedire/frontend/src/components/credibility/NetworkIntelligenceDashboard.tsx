/**
 * Network Intelligence Dashboard
 * Leaderboard showing top intelligence sources by value score
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  TrendingUp, 
  Award, 
  Clock, 
  Target, 
  CheckCircle2,
  AlertCircle,
  Users,
  BarChart3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface IntelligenceSource {
  contactEmail: string;
  contactName: string | null;
  intelligenceValueScore: number;
  tier: 'top' | 'mid' | 'low';
  avgLeadTimeDays: number;
  accuracy: number;
  avgImpact: number;
  consistency: number;
  totalSignals: number;
}

interface NetworkStats {
  totalSources: number;
  topTierCount: number;
  midTierCount: number;
  lowTierCount: number;
  avgIntelligenceValue: number;
}

export default function NetworkIntelligenceDashboard() {
  const [sources, setSources] = useState<IntelligenceSource[]>([]);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<'all' | 'top' | 'mid' | 'low'>('all');

  useEffect(() => {
    fetchNetworkValue();
  }, []);

  const fetchNetworkValue = async () => {
    try {
      const response = await fetch('/api/v1/credibility/network-value', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setSources(result.data.all);
        setStats(result.data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch network value:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierBadge = (tier: string) => {
    const configs = {
      top: { variant: 'default' as const, label: 'Top Tier', className: 'bg-green-500' },
      mid: { variant: 'secondary' as const, label: 'Mid Tier', className: 'bg-blue-500' },
      low: { variant: 'outline' as const, label: 'Low Tier', className: 'bg-gray-400' }
    };
    const config = configs[tier as keyof typeof configs];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getValueScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    return 'text-gray-600';
  };

  const filteredSources = selectedTier === 'all' 
    ? sources 
    : sources.filter(s => s.tier === selectedTier);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading intelligence network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sources</p>
                <p className="text-3xl font-bold">{stats?.totalSources || 0}</p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Tier</p>
                <p className="text-3xl font-bold text-green-600">{stats?.topTierCount || 0}</p>
              </div>
              <Award className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Mid Tier</p>
                <p className="text-3xl font-bold text-blue-600">{stats?.midTierCount || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Value</p>
                <p className="text-3xl font-bold">{stats?.avgIntelligenceValue.toFixed(0) || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligence Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Intelligence Network Leaderboard
          </CardTitle>
          <CardDescription>
            Sources ranked by intelligence value: lead time, accuracy, impact, and consistency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTier} onValueChange={(v: any) => setSelectedTier(v)}>
            <TabsList>
              <TabsTrigger value="all">All Sources</TabsTrigger>
              <TabsTrigger value="top">Top Tier</TabsTrigger>
              <TabsTrigger value="mid">Mid Tier</TabsTrigger>
              <TabsTrigger value="low">Low Tier</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTier} className="mt-6">
              <div className="space-y-4">
                {filteredSources.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No sources in this tier yet</p>
                  </div>
                ) : (
                  filteredSources.map((source, index) => (
                    <Card key={source.contactEmail} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl font-bold text-gray-400">
                                #{index + 1}
                              </span>
                              <div>
                                <h3 className="font-semibold text-lg">
                                  {source.contactName || source.contactEmail}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {source.contactEmail}
                                </p>
                              </div>
                              {getTierBadge(source.tier)}
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                  <BarChart3 className="h-3 w-3" />
                                  Value Score
                                </div>
                                <p className={`text-xl font-bold ${getValueScoreColor(source.intelligenceValueScore)}`}>
                                  {source.intelligenceValueScore.toFixed(0)}
                                </p>
                              </div>

                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                  <Clock className="h-3 w-3" />
                                  Lead Time
                                </div>
                                <p className="text-xl font-bold">
                                  {source.avgLeadTimeDays.toFixed(0)}d
                                </p>
                              </div>

                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Accuracy
                                </div>
                                <p className="text-xl font-bold">
                                  {source.accuracy.toFixed(0)}%
                                </p>
                              </div>

                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                  <Target className="h-3 w-3" />
                                  Impact
                                </div>
                                <p className="text-xl font-bold">
                                  {source.avgImpact.toFixed(0)}
                                </p>
                              </div>

                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                  <TrendingUp className="h-3 w-3" />
                                  Signals
                                </div>
                                <p className="text-xl font-bold">
                                  {source.totalSignals}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
