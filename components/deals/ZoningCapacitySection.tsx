'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, Building2, TrendingUp, FileText, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ZoningCapacityProps {
  dealId: string;
}

interface UnitMixItem {
  percent: number;
  count: number;
}

interface UnitMix {
  studio?: UnitMixItem;
  oneBR?: UnitMixItem;
  twoBR?: UnitMixItem;
  threeBR?: UnitMixItem;
}

interface ZoningCapacityData {
  zoning_code?: string;
  base_zoning?: string;
  max_density?: number;
  max_far?: number;
  max_height_feet?: number;
  max_stories?: number;
  min_parking_per_unit?: number;
  affordable_housing_bonus?: boolean;
  affordable_bonus_percent?: number;
  tdr_available?: boolean;
  tdr_bonus_percent?: number;
  overlay_zones?: string[];
  special_restrictions?: string[];
  zoning_notes?: string;
  max_units_by_right?: number;
  max_units_with_incentives?: number;
  limiting_factor?: string;
  buildable_sq_ft?: number;
  coverage_ratio?: number;
  unit_mix?: UnitMix;
  avg_rent_per_unit?: number;
  annual_revenue?: number;
  pro_forma_noi?: number;
  estimated_value?: number;
}

export function ZoningCapacitySection({ dealId }: ZoningCapacityProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ZoningCapacityData>({
    unit_mix: {
      studio: { percent: 0, count: 0 },
      oneBR: { percent: 0, count: 0 },
      twoBR: { percent: 0, count: 0 },
      threeBR: { percent: 0, count: 0 },
    },
  });

  useEffect(() => {
    fetchZoningCapacity();
  }, [dealId]);

  const fetchZoningCapacity = async () => {
    try {
      const response = await fetch(`/api/properties/${dealId}/zoning-capacity`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching zoning capacity:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveZoningCapacity = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/properties/${dealId}/zoning-capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to save');

      const result = await response.json();
      setData(result);

      toast({
        title: 'Zoning Capacity Saved',
        description: `Max Units: ${result.max_units_with_incentives} | Limiting Factor: ${result.limiting_factor}`,
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Could not save zoning capacity data',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateUnitMixPercent = (type: string, percent: number) => {
    const totalUnits = data.max_units_with_incentives || 0;
    const count = Math.floor((percent / 100) * totalUnits);
    
    setData((prev) => ({
      ...prev,
      unit_mix: {
        ...prev.unit_mix,
        [type]: { percent, count },
      },
    }));
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value?: number) => {
    if (!value) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  };

  const getLimitingFactorColor = (factor?: string) => {
    switch (factor) {
      case 'density':
        return 'default';
      case 'far':
        return 'secondary';
      case 'height':
        return 'outline';
      case 'parking':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zoning & Development Capacity</CardTitle>
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
              <Building2 className="h-5 w-5" />
              Zoning & Development Capacity
            </CardTitle>
            <CardDescription>
              Calculate maximum buildable units and development potential
            </CardDescription>
          </div>
          <Button onClick={saveZoningCapacity} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel - Zoning Information */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Zoning Information</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Zoning Code</Label>
                  <Input
                    value={data.zoning_code || ''}
                    onChange={(e) => updateField('zoning_code', e.target.value)}
                    placeholder="e.g., R-5, MU-3"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Base Zoning</Label>
                  <Select
                    value={data.base_zoning || ''}
                    onValueChange={(value) => updateField('base_zoning', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select zoning type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="mixed-use">Mixed-Use</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="industrial">Industrial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Density (units/acre)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={data.max_density || ''}
                      onChange={(e) => updateField('max_density', parseFloat(e.target.value))}
                      placeholder="e.g., 40"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max FAR</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={data.max_far || ''}
                      onChange={(e) => updateField('max_far', parseFloat(e.target.value))}
                      placeholder="e.g., 3.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Height (feet)</Label>
                    <Input
                      type="number"
                      value={data.max_height_feet || ''}
                      onChange={(e) => updateField('max_height_feet', parseInt(e.target.value))}
                      placeholder="e.g., 75"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Stories</Label>
                    <Input
                      type="number"
                      value={data.max_stories || ''}
                      onChange={(e) => updateField('max_stories', parseInt(e.target.value))}
                      placeholder="e.g., 7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Min Parking (spaces/unit)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={data.min_parking_per_unit || ''}
                    onChange={(e) => updateField('min_parking_per_unit', parseFloat(e.target.value))}
                    placeholder="e.g., 1.5"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Affordable Housing Bonus</Label>
                      <p className="text-sm text-muted-foreground">
                        Density increase for affordable units
                      </p>
                    </div>
                    <Switch
                      checked={data.affordable_housing_bonus || false}
                      onCheckedChange={(checked) => updateField('affordable_housing_bonus', checked)}
                    />
                  </div>

                  {data.affordable_housing_bonus && (
                    <div className="space-y-2 ml-4">
                      <Label>Bonus Percentage</Label>
                      <Input
                        type="number"
                        value={data.affordable_bonus_percent || 25}
                        onChange={(e) => updateField('affordable_bonus_percent', parseFloat(e.target.value))}
                        placeholder="25"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>TDR Available</Label>
                      <p className="text-sm text-muted-foreground">
                        Transfer Development Rights
                      </p>
                    </div>
                    <Switch
                      checked={data.tdr_available || false}
                      onCheckedChange={(checked) => updateField('tdr_available', checked)}
                    />
                  </div>

                  {data.tdr_available && (
                    <div className="space-y-2 ml-4">
                      <Label>Bonus Percentage</Label>
                      <Input
                        type="number"
                        value={data.tdr_bonus_percent || 15}
                        onChange={(e) => updateField('tdr_bonus_percent', parseFloat(e.target.value))}
                        placeholder="15"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Overlay Zones (comma-separated)</Label>
                  <Input
                    value={data.overlay_zones?.join(', ') || ''}
                    onChange={(e) => updateField('overlay_zones', e.target.value.split(',').map((s) => s.trim()))}
                    placeholder="e.g., Historic, Transit-Oriented"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Special Restrictions (comma-separated)</Label>
                  <Input
                    value={data.special_restrictions?.join(', ') || ''}
                    onChange={(e) => updateField('special_restrictions', e.target.value.split(',').map((s) => s.trim()))}
                    placeholder="e.g., Height limit, Setback requirements"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Zoning Notes</h3>
              <Textarea
                value={data.zoning_notes || ''}
                onChange={(e) => updateField('zoning_notes', e.target.value)}
                placeholder="Notes about zoning variances, pending applications, etc."
                rows={4}
              />
            </div>
          </div>

          {/* Right Panel - Development Capacity */}
          <div className="space-y-6">
            {/* Maximum Units Display */}
            <div className="p-6 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">📊 Maximum Units</p>
                <p className="text-5xl font-bold mb-2">{formatNumber(data.max_units_with_incentives)}</p>
                <p className="text-sm text-muted-foreground">
                  (Based on current zoning)
                </p>
                {data.limiting_factor && (
                  <div className="mt-3">
                    <Badge variant={getLimitingFactorColor(data.limiting_factor)}>
                      Limiting Factor: {data.limiting_factor.toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* By Right vs With Incentives */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Development Scenarios</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium mb-2">By Right</p>
                  <p className="text-2xl font-bold">{formatNumber(data.max_units_by_right)}</p>
                  <p className="text-xs text-muted-foreground">units</p>
                  {data.max_far && (
                    <>
                      <p className="text-sm mt-2">{data.max_far} FAR</p>
                      <p className="text-sm">{data.max_stories || 0} stories</p>
                    </>
                  )}
                </div>

                <div className="p-4 border rounded-lg bg-primary/5">
                  <p className="text-sm font-medium mb-2">With Incentives</p>
                  <p className="text-2xl font-bold">{formatNumber(data.max_units_with_incentives)}</p>
                  <p className="text-xs text-muted-foreground">units</p>
                  {data.max_far && (
                    <>
                      <p className="text-sm mt-2">{(data.max_far * 1.25).toFixed(1)} FAR</p>
                      <p className="text-sm">{Math.ceil((data.max_stories || 0) * 1.25)} stories</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Unit Mix */}
            <div>
              <h3 className="text-lg font-semibold mb-4">📈 Unit Mix Potential</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label>Studio:</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={data.unit_mix?.studio?.percent || 0}
                    onChange={(e) => updateUnitMixPercent('studio', parseFloat(e.target.value) || 0)}
                    placeholder="%"
                    className="text-right"
                  />
                  <span className="text-sm text-muted-foreground">
                    = {data.unit_mix?.studio?.count || 0} units
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label>1BR:</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={data.unit_mix?.oneBR?.percent || 0}
                    onChange={(e) => updateUnitMixPercent('oneBR', parseFloat(e.target.value) || 0)}
                    placeholder="%"
                    className="text-right"
                  />
                  <span className="text-sm text-muted-foreground">
                    = {data.unit_mix?.oneBR?.count || 0} units
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label>2BR:</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={data.unit_mix?.twoBR?.percent || 0}
                    onChange={(e) => updateUnitMixPercent('twoBR', parseFloat(e.target.value) || 0)}
                    placeholder="%"
                    className="text-right"
                  />
                  <span className="text-sm text-muted-foreground">
                    = {data.unit_mix?.twoBR?.count || 0} units
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label>3BR:</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={data.unit_mix?.threeBR?.percent || 0}
                    onChange={(e) => updateUnitMixPercent('threeBR', parseFloat(e.target.value) || 0)}
                    placeholder="%"
                    className="text-right"
                  />
                  <span className="text-sm text-muted-foreground">
                    = {data.unit_mix?.threeBR?.count || 0} units
                  </span>
                </div>
              </div>
            </div>

            {/* Revenue Potential */}
            <div>
              <h3 className="text-lg font-semibold mb-4">💰 Revenue Potential</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Avg Rent per Unit (monthly)</Label>
                  <Input
                    type="number"
                    value={data.avg_rent_per_unit || ''}
                    onChange={(e) => updateField('avg_rent_per_unit', parseFloat(e.target.value))}
                    placeholder="e.g., 1850"
                  />
                </div>

                {data.annual_revenue && (
                  <>
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-muted-foreground">Annual Revenue:</span>
                      <span className="font-semibold">{formatCurrency(data.annual_revenue)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-muted-foreground">Pro Forma NOI:</span>
                      <span className="font-semibold">{formatCurrency(data.pro_forma_noi)}</span>
                    </div>
                    <div className="flex justify-between py-2 pt-2 border-t">
                      <span className="text-sm font-medium">Est. Value (5% cap):</span>
                      <span className="text-lg font-bold">{formatCurrency(data.estimated_value)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Buildable Area Analysis */}
            {data.buildable_sq_ft && (
              <div>
                <h3 className="text-lg font-semibold mb-4">🏗️ Buildable Area Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buildable Area:</span>
                    <span className="font-medium">{(data.buildable_sq_ft / 43560).toFixed(2)} acres</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coverage Ratio:</span>
                    <span className="font-medium">{data.coverage_ratio?.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Sq Ft:</span>
                    <span className="font-medium">{formatNumber(data.buildable_sq_ft)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Generate Pro Forma
              </Button>
              <Button variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
