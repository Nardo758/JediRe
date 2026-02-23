'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle2, AlertCircle, TrendingUp, MapPin, Zap, Shield, Activity, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SiteIntelligenceProps {
  dealId: string;
}

interface SiteIntelligenceData {
  environmental?: any;
  infrastructure?: any;
  accessibility?: any;
  regulatory?: any;
  natural_hazards?: any;
  market_context?: any;
  overall_score?: number;
  data_completeness?: number;
}

export function SiteIntelligenceSection({ dealId }: SiteIntelligenceProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SiteIntelligenceData>({});
  const [activeTab, setActiveTab] = useState('environmental');

  useEffect(() => {
    fetchSiteIntelligence();
  }, [dealId]);

  const fetchSiteIntelligence = async () => {
    try {
      const response = await fetch(`/api/properties/${dealId}/site-intelligence`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching site intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSiteIntelligence = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/properties/${dealId}/site-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to save');

      const result = await response.json();
      setData(result);

      toast({
        title: 'Site Intelligence Saved',
        description: `Overall Score: ${result.overall_score}/100 | Completeness: ${result.data_completeness}%`,
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Could not save site intelligence data',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (category: string, field: string, value: any) => {
    setData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category as keyof SiteIntelligenceData],
        [field]: value,
      },
    }));
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return 'secondary';
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getScoreBadge = (score: number | null | undefined) => {
    if (!score) return <Badge variant="outline">Not Scored</Badge>;
    return (
      <Badge variant={getScoreColor(score)}>
        {score}/100
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Site Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Site Intelligence
            </CardTitle>
            <CardDescription>
              Comprehensive site analysis and due diligence
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {data.data_completeness !== undefined && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Completeness</div>
                <div className="text-2xl font-bold">{data.data_completeness}%</div>
              </div>
            )}
            {data.overall_score !== undefined && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Overall Score</div>
                <div className="text-2xl font-bold">{data.overall_score}/100</div>
              </div>
            )}
            <Button onClick={saveSiteIntelligence} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="environmental" className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Environmental
            </TabsTrigger>
            <TabsTrigger value="infrastructure" className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              Infrastructure
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Access
            </TabsTrigger>
            <TabsTrigger value="regulatory" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Regulatory
            </TabsTrigger>
            <TabsTrigger value="hazards" className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Hazards
            </TabsTrigger>
            <TabsTrigger value="market" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Market
            </TabsTrigger>
          </TabsList>

          {/* Environmental Tab */}
          <TabsContent value="environmental" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Environmental Analysis</h3>
              {getScoreBadge(data.environmental?.score)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Soil Type</Label>
                <Input
                  value={data.environmental?.soilType || ''}
                  onChange={(e) => updateCategory('environmental', 'soilType', e.target.value)}
                  placeholder="e.g., Clay, Sand, Loam"
                />
              </div>

              <div className="space-y-2">
                <Label>Soil Bearing Capacity (PSF)</Label>
                <Input
                  type="number"
                  value={data.environmental?.soilBearingCapacity || ''}
                  onChange={(e) => updateCategory('environmental', 'soilBearingCapacity', parseFloat(e.target.value))}
                  placeholder="e.g., 2000"
                />
              </div>

              <div className="space-y-2">
                <Label>Tree Canopy Coverage (%)</Label>
                <Input
                  type="number"
                  value={data.environmental?.treeCanopyCoverage || ''}
                  onChange={(e) => updateCategory('environmental', 'treeCanopyCoverage', parseFloat(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={data.environmental?.wetlandsPresent || false}
                  onCheckedChange={(checked) => updateCategory('environmental', 'wetlandsPresent', checked)}
                />
                <Label>Wetlands Present</Label>
              </div>

              <div className="space-y-2">
                <Label>Category Score (0-100)</Label>
                <Input
                  type="number"
                  value={data.environmental?.score || ''}
                  onChange={(e) => updateCategory('environmental', 'score', parseInt(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>
            </div>
          </TabsContent>

          {/* Infrastructure Tab */}
          <TabsContent value="infrastructure" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Infrastructure & Utilities</h3>
              {getScoreBadge(data.infrastructure?.score)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Water Capacity</Label>
                <Input
                  value={data.infrastructure?.waterCapacity || ''}
                  onChange={(e) => updateCategory('infrastructure', 'waterCapacity', e.target.value)}
                  placeholder="e.g., 500 GPM"
                />
              </div>

              <div className="space-y-2">
                <Label>Sewer Type</Label>
                <Select
                  value={data.infrastructure?.sewerType || ''}
                  onValueChange={(value) => updateCategory('infrastructure', 'sewerType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="municipal">Municipal</SelectItem>
                    <SelectItem value="septic">Septic</SelectItem>
                    <SelectItem value="package-plant">Package Plant</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Power Grid Capacity</Label>
                <Input
                  value={data.infrastructure?.powerGridCapacity || ''}
                  onChange={(e) => updateCategory('infrastructure', 'powerGridCapacity', e.target.value)}
                  placeholder="e.g., 200A, 3-phase"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={data.infrastructure?.gasAvailable || false}
                  onCheckedChange={(checked) => updateCategory('infrastructure', 'gasAvailable', checked)}
                />
                <Label>Natural Gas Available</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={data.infrastructure?.fiberAvailable || false}
                  onCheckedChange={(checked) => updateCategory('infrastructure', 'fiberAvailable', checked)}
                />
                <Label>Fiber Internet Available</Label>
              </div>

              <div className="space-y-2">
                <Label>Category Score (0-100)</Label>
                <Input
                  type="number"
                  value={data.infrastructure?.score || ''}
                  onChange={(e) => updateCategory('infrastructure', 'score', parseInt(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>
            </div>
          </TabsContent>

          {/* Accessibility Tab */}
          <TabsContent value="accessibility" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Accessibility & Transportation</h3>
              {getScoreBadge(data.accessibility?.score)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Road Access</Label>
                <Select
                  value={data.accessibility?.roadAccess || ''}
                  onValueChange={(value) => updateCategory('accessibility', 'roadAccess', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select access type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="easement">Easement</SelectItem>
                    <SelectItem value="limited">Limited</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Road Type</Label>
                <Input
                  value={data.accessibility?.roadType || ''}
                  onChange={(e) => updateCategory('accessibility', 'roadType', e.target.value)}
                  placeholder="e.g., Paved, Collector"
                />
              </div>

              <div className="space-y-2">
                <Label>Walkability Score</Label>
                <Input
                  type="number"
                  value={data.accessibility?.walkabilityScore || ''}
                  onChange={(e) => updateCategory('accessibility', 'walkabilityScore', parseInt(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Bike Score</Label>
                <Input
                  type="number"
                  value={data.accessibility?.bikeScore || ''}
                  onChange={(e) => updateCategory('accessibility', 'bikeScore', parseInt(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Transit Distance (miles)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={data.accessibility?.transitDistance || ''}
                  onChange={(e) => updateCategory('accessibility', 'transitDistance', parseFloat(e.target.value))}
                  placeholder="e.g., 0.5"
                />
              </div>

              <div className="space-y-2">
                <Label>Category Score (0-100)</Label>
                <Input
                  type="number"
                  value={data.accessibility?.score || ''}
                  onChange={(e) => updateCategory('accessibility', 'score', parseInt(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>
            </div>
          </TabsContent>

          {/* Regulatory Tab */}
          <TabsContent value="regulatory" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Regulatory & Compliance</h3>
              {getScoreBadge(data.regulatory?.score)}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={data.regulatory?.historicDistrict || false}
                  onCheckedChange={(checked) => updateCategory('regulatory', 'historicDistrict', checked)}
                />
                <Label>Located in Historic District</Label>
              </div>

              <div className="space-y-2">
                <Label>Required Permits (comma-separated)</Label>
                <Input
                  value={data.regulatory?.permitsRequired?.join(', ') || ''}
                  onChange={(e) => updateCategory('regulatory', 'permitsRequired', e.target.value.split(',').map((s: string) => s.trim()))}
                  placeholder="e.g., Building, Zoning, Environmental"
                />
              </div>

              <div className="space-y-2">
                <Label>Easements (comma-separated)</Label>
                <Input
                  value={data.regulatory?.easements?.join(', ') || ''}
                  onChange={(e) => updateCategory('regulatory', 'easements', e.target.value.split(',').map((s: string) => s.trim()))}
                  placeholder="e.g., Utility, Access, Drainage"
                />
              </div>

              <div className="space-y-2">
                <Label>Category Score (0-100)</Label>
                <Input
                  type="number"
                  value={data.regulatory?.score || ''}
                  onChange={(e) => updateCategory('regulatory', 'score', parseInt(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>
            </div>
          </TabsContent>

          {/* Natural Hazards Tab */}
          <TabsContent value="hazards" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Natural Hazards</h3>
              {getScoreBadge(data.natural_hazards?.score)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Flood Zone</Label>
                <Input
                  value={data.natural_hazards?.floodZone || ''}
                  onChange={(e) => updateCategory('natural_hazards', 'floodZone', e.target.value)}
                  placeholder="e.g., X, AE, A"
                />
              </div>

              <div className="space-y-2">
                <Label>Flood Risk</Label>
                <Select
                  value={data.natural_hazards?.floodRisk || ''}
                  onValueChange={(value) => updateCategory('natural_hazards', 'floodRisk', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="very-high">Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Seismic Risk</Label>
                <Select
                  value={data.natural_hazards?.seismicRisk || ''}
                  onValueChange={(value) => updateCategory('natural_hazards', 'seismicRisk', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="very-high">Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Wildfire Risk</Label>
                <Select
                  value={data.natural_hazards?.wildfireRisk || ''}
                  onValueChange={(value) => updateCategory('natural_hazards', 'wildfireRisk', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="very-high">Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category Score (0-100)</Label>
                <Input
                  type="number"
                  value={data.natural_hazards?.score || ''}
                  onChange={(e) => updateCategory('natural_hazards', 'score', parseInt(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>
            </div>
          </TabsContent>

          {/* Market Context Tab */}
          <TabsContent value="market" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Market Context</h3>
              {getScoreBadge(data.market_context?.score)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Median Income</Label>
                <Input
                  type="number"
                  value={data.market_context?.medianIncome || ''}
                  onChange={(e) => updateCategory('market_context', 'medianIncome', parseFloat(e.target.value))}
                  placeholder="e.g., 65000"
                />
              </div>

              <div className="space-y-2">
                <Label>Population</Label>
                <Input
                  type="number"
                  value={data.market_context?.population || ''}
                  onChange={(e) => updateCategory('market_context', 'population', parseInt(e.target.value))}
                  placeholder="e.g., 50000"
                />
              </div>

              <div className="space-y-2">
                <Label>Population Growth (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={data.market_context?.populationGrowth || ''}
                  onChange={(e) => updateCategory('market_context', 'populationGrowth', parseFloat(e.target.value))}
                  placeholder="e.g., 2.5"
                />
              </div>

              <div className="space-y-2">
                <Label>Employment Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={data.market_context?.employmentRate || ''}
                  onChange={(e) => updateCategory('market_context', 'employmentRate', parseFloat(e.target.value))}
                  placeholder="e.g., 96.5"
                  max="100"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Average Daily Traffic</Label>
                <Input
                  type="number"
                  value={data.market_context?.trafficCount || ''}
                  onChange={(e) => updateCategory('market_context', 'trafficCount', parseInt(e.target.value))}
                  placeholder="e.g., 15000"
                />
              </div>

              <div className="space-y-2">
                <Label>School Rating (1-10)</Label>
                <Input
                  type="number"
                  value={data.market_context?.schoolRating || ''}
                  onChange={(e) => updateCategory('market_context', 'schoolRating', parseInt(e.target.value))}
                  placeholder="1-10"
                  max="10"
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <Label>Category Score (0-100)</Label>
                <Input
                  type="number"
                  value={data.market_context?.score || ''}
                  onChange={(e) => updateCategory('market_context', 'score', parseInt(e.target.value))}
                  placeholder="0-100"
                  max="100"
                  min="0"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
