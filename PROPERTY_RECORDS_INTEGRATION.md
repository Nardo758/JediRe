# 🔗 Property Records Integration Layer

**Purpose:** Connect Municipal Scraper → Market Research Engine → UI  
**Scope:** Complete integration for comparable sales analysis  
**Status:** Production-ready architecture

---

## 🎯 Integration Overview

### **Data Flow**
```
User requests Market Research
         ↓
Market Research Engine V2
         ↓
Comparable Sales Module ← NEW!
         ↓
Municipal Scraper Service
         ↓
County Assessor Websites
         ↓
Property Records Database
         ↓
Comp Analysis & Calculations
         ↓
Property Records Tab (UI)
```

---

## 🧩 Market Research Engine Integration

### **Enhanced Service** (`marketResearchEngine.ts`)

Add new module: **Comparable Sales Analysis**

```typescript
// ═════════════════════════════════════════════════════════════
// Add to MarketResearchEngine class
// ═════════════════════════════════════════════════════════════

import { MunicipalScraperService } from './municipalScraper.service';

export class MarketResearchEngine {
  private municipalScraper: MunicipalScraperService;
  
  constructor() {
    this.municipalScraper = new MunicipalScraperService();
  }
  
  /**
   * Generate complete market research report (ENHANCED)
   */
  async generateReport(dealId: string): Promise<MarketResearchReport> {
    // Existing modules
    const supply = await this.analyzeSupply(dealId);
    const demand = await this.analyzeDemand(dealId);
    const perCapita = await this.analyzePerCapita(dealId);
    const employment = await this.analyzeEmploymentImpact(dealId);
    const capacity = await this.analyzeMarketCapacity(dealId);
    
    // NEW: Comparable sales
    const comps = await this.analyzeComparableSales(dealId);
    
    return {
      ...existing fields,
      comps, // NEW
    };
  }
  
  /**
   * NEW MODULE: Analyze comparable sales
   */
  async analyzeComparableSales(dealId: string): Promise<ComparableSalesAnalysis> {
    // 1. Get deal details
    const deal = await this.getDeal(dealId);
    const { address, units, propertyType } = deal;
    
    // 2. Scrape subject property (if not already in DB)
    let subjectProperty = await this.getPropertyRecord(address);
    if (!subjectProperty) {
      subjectProperty = await this.municipalScraper.scrapePropertyByAddress(address);
    }
    
    // 3. Get comparable sales (radius: 3 miles, 12 months)
    const comps = await this.municipalScraper.getComparableSales(address, 3, 12);
    
    // 4. Calculate statistics
    const stats = this.calculateCompStats(comps, units);
    
    // 5. Tax burden analysis
    const taxAnalysis = this.analyzeTaxBurden(subjectProperty, comps);
    
    // 6. Ownership insights
    const ownershipInsights = await this.analyzeOwnership(comps);
    
    // 7. Transaction velocity
    const velocity = this.analyzeTransactionVelocity(comps);
    
    // 8. Price trends
    const priceTrends = this.analyzePriceTrends(comps);
    
    return {
      subjectProperty,
      comparables: comps,
      stats,
      taxAnalysis,
      ownershipInsights,
      velocity,
      priceTrends,
      generatedAt: new Date(),
    };
  }
  
  // ═════════════════════════════════════════════════════════════
  // Comp Statistics
  // ═════════════════════════════════════════════════════════════
  
  private calculateCompStats(comps: SaleHistory[], subjectUnits?: number): CompStats {
    if (comps.length === 0) {
      return {
        count: 0,
        medianPrice: 0,
        medianPricePerUnit: 0,
        avgCapRate: 0,
        avgHoldPeriod: 0,
      };
    }
    
    const prices = comps.map(c => c.salePrice);
    const pricesPerUnit = comps.map(c => c.salePrice / (c.units || 1));
    const capRates = comps.filter(c => c.capRate).map(c => c.capRate!);
    const holdPeriods = comps.filter(c => c.holdPeriod).map(c => c.holdPeriod!);
    
    return {
      count: comps.length,
      medianPrice: this.median(prices),
      avgPrice: this.average(prices),
      medianPricePerUnit: this.median(pricesPerUnit),
      avgPricePerUnit: this.average(pricesPerUnit),
      medianCapRate: capRates.length > 0 ? this.median(capRates) : null,
      avgCapRate: capRates.length > 0 ? this.average(capRates) : null,
      medianHoldPeriod: holdPeriods.length > 0 ? this.median(holdPeriods) : null,
      avgHoldPeriod: holdPeriods.length > 0 ? this.average(holdPeriods) : null,
      
      // Year-over-year change
      yoyPriceChange: this.calculateYoYChange(comps, 'salePrice'),
      yoyPricePerUnitChange: this.calculateYoYChange(comps, 'pricePerUnit'),
    };
  }
  
  // ═════════════════════════════════════════════════════════════
  // Tax Burden Analysis
  // ═════════════════════════════════════════════════════════════
  
  private analyzeTaxBurden(
    subject: PropertyRecordData,
    comps: SaleHistory[]
  ): TaxBurdenAnalysis {
    // Calculate subject property's tax burden per unit
    const subjectTaxPerUnit = subject.annualTaxes! / (subject.units || 1);
    
    // Get tax data for comps
    const compTaxes = comps
      .filter(c => c.annualTaxes && c.units)
      .map(c => ({
        address: c.address,
        taxPerUnit: c.annualTaxes! / c.units!,
        taxRate: c.taxRate,
        county: c.county,
      }));
    
    const compTaxPerUnit = compTaxes.map(c => c.taxPerUnit);
    const medianTaxPerUnit = this.median(compTaxPerUnit);
    const avgTaxPerUnit = this.average(compTaxPerUnit);
    
    // Compare subject to market
    const vsMedian = subjectTaxPerUnit - medianTaxPerUnit;
    const vsMedianPct = (vsMedian / medianTaxPerUnit) * 100;
    
    // Estimate NOI impact
    const noiImpactPerUnit = vsMedian;
    const noiImpactTotal = noiImpactPerUnit * (subject.units || 0);
    
    // Estimate value impact (cap at 5%)
    const capRate = 0.05;
    const valueImpact = noiImpactTotal / capRate;
    
    // Next reassessment risk
    const nextReassessment = this.estimateNextReassessment(subject);
    const reassessmentRisk = this.calculateReassessmentRisk(subject, comps);
    
    return {
      subject: {
        taxPerUnit: subjectTaxPerUnit,
        taxRate: subject.taxRate,
        annualTaxes: subject.annualTaxes,
      },
      market: {
        medianTaxPerUnit,
        avgTaxPerUnit,
        count: compTaxes.length,
      },
      comparison: {
        vsMedian,
        vsMedianPct,
        position: vsMedianPct > 10 ? 'ABOVE_MARKET' : vsMedianPct < -10 ? 'BELOW_MARKET' : 'AT_MARKET',
      },
      noiImpact: {
        perUnit: noiImpactPerUnit,
        total: noiImpactTotal,
        valueImpact,
      },
      reassessment: {
        nextDate: nextReassessment,
        riskLevel: reassessmentRisk,
        estimatedIncrease: this.estimateReassessmentIncrease(subject),
      },
      compTaxes, // Detailed comp tax data for table
    };
  }
  
  private estimateNextReassessment(property: PropertyRecordData): Date {
    // Most counties reassess every 3-5 years
    // Check property.assessmentYear, add cycle length
    const assessmentYear = property.assessmentYear || new Date().getFullYear();
    const cycleYears = 3; // TODO: make county-specific
    
    const nextYear = assessmentYear + cycleYears;
    return new Date(nextYear, 0, 1); // January 1st
  }
  
  private calculateReassessmentRisk(
    property: PropertyRecordData,
    comps: SaleHistory[]
  ): 'LOW' | 'MODERATE' | 'HIGH' {
    // If recent comps sold above assessed value → high reassessment risk
    const recentComps = comps.slice(0, 5); // Most recent 5
    const avgSalePrice = this.average(recentComps.map(c => c.salePrice));
    const currentAssessedValue = property.totalAssessedValue || 0;
    
    const saleToAssessedRatio = avgSalePrice / currentAssessedValue;
    
    if (saleToAssessedRatio > 1.2) return 'HIGH';
    if (saleToAssessedRatio > 1.1) return 'MODERATE';
    return 'LOW';
  }
  
  private estimateReassessmentIncrease(property: PropertyRecordData): number {
    // Simple model: assume assessment catches up to 85% of market value
    // Market value estimated from recent comps
    // For now, return conservative 15% increase
    return 0.15;
  }
  
  // ═════════════════════════════════════════════════════════════
  // Ownership Analysis
  // ═════════════════════════════════════════════════════════════
  
  private async analyzeOwnership(comps: SaleHistory[]): Promise<OwnershipInsights> {
    // Get owner data for all comps
    const owners = comps.map(c => ({
      name: c.buyerName,
      type: this.classifyOwnerType(c.buyerName),
      address: c.buyerAddress,
      isOutOfState: c.buyerState !== c.propertyState,
      holdPeriod: c.holdPeriod,
    }));
    
    // Distribution by owner type
    const typeDistribution = this.groupBy(owners, 'type');
    const typeStats = Object.entries(typeDistribution).map(([type, group]) => ({
      type,
      count: group.length,
      percentage: (group.length / owners.length) * 100,
    }));
    
    // Average hold period
    const holdPeriods = owners.filter(o => o.holdPeriod).map(o => o.holdPeriod!);
    const avgHoldPeriod = holdPeriods.length > 0 ? this.average(holdPeriods) : null;
    const medianHoldPeriod = holdPeriods.length > 0 ? this.median(holdPeriods) : null;
    
    // Out-of-state percentage
    const outOfStateCount = owners.filter(o => o.isOutOfState).length;
    const outOfStatePct = (outOfStateCount / owners.length) * 100;
    
    // Top states (for out-of-state owners)
    const outOfStateOwners = owners.filter(o => o.isOutOfState);
    const stateDistribution = this.groupBy(outOfStateOwners, 'state');
    const topStates = Object.entries(stateDistribution)
      .map(([state, group]) => ({ state, count: group.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      typeDistribution: typeStats,
      holdPeriod: {
        avg: avgHoldPeriod,
        median: medianHoldPeriod,
        range: [Math.min(...holdPeriods), Math.max(...holdPeriods)],
      },
      outOfState: {
        count: outOfStateCount,
        percentage: outOfStatePct,
        topStates,
      },
      insights: this.generateOwnershipInsights(typeStats, avgHoldPeriod, outOfStatePct),
    };
  }
  
  private classifyOwnerType(ownerName: string): 'Institutional' | 'LLC' | 'Individual' | 'Trust' | 'Other' {
    if (!ownerName) return 'Other';
    
    const name = ownerName.toLowerCase();
    
    // Institutional indicators
    if (
      name.includes('reit') ||
      name.includes('fund') ||
      name.includes('capital') ||
      name.includes('investment') ||
      name.includes('partners')
    ) {
      return 'Institutional';
    }
    
    // LLC
    if (name.includes('llc') || name.includes('l.l.c')) {
      return 'LLC';
    }
    
    // Trust
    if (name.includes('trust') || name.includes('trustee')) {
      return 'Trust';
    }
    
    // Individual (has comma, no entity suffix)
    if (name.includes(',') && !name.includes('inc') && !name.includes('corp')) {
      return 'Individual';
    }
    
    return 'Other';
  }
  
  private generateOwnershipInsights(
    typeStats: any[],
    avgHoldPeriod: number | null,
    outOfStatePct: number
  ): string[] {
    const insights: string[] = [];
    
    // Dominant owner type
    const dominant = typeStats.sort((a, b) => b.percentage - a.percentage)[0];
    if (dominant.percentage > 50) {
      insights.push(`Market dominated by ${dominant.type.toLowerCase()} capital (${dominant.percentage.toFixed(0)}%)`);
    }
    
    // Hold period
    if (avgHoldPeriod && avgHoldPeriod > 8) {
      insights.push(`Long hold periods (${avgHoldPeriod.toFixed(1)} years avg) indicate strong fundamentals`);
    } else if (avgHoldPeriod && avgHoldPeriod < 5) {
      insights.push(`Short hold periods (${avgHoldPeriod.toFixed(1)} years avg) suggest value-add plays`);
    }
    
    // Out-of-state interest
    if (outOfStatePct > 60) {
      insights.push(`High out-of-state interest (${outOfStatePct.toFixed(0)}%) shows national appeal`);
    }
    
    return insights;
  }
  
  // ═════════════════════════════════════════════════════════════
  // Transaction Velocity
  // ═════════════════════════════════════════════════════════════
  
  private analyzeTransactionVelocity(comps: SaleHistory[]): VelocityAnalysis {
    // Group by quarter
    const quarters = this.groupByQuarter(comps);
    
    // Calculate quarterly stats
    const quarterlyStats = quarters.map(q => ({
      quarter: q.quarter,
      count: q.sales.length,
      totalVolume: q.sales.reduce((sum, s) => sum + s.salePrice, 0),
    }));
    
    // Overall stats
    const totalSales = comps.length;
    const avgPerQuarter = totalSales / quarters.length;
    
    // Trend (compare recent 3 quarters to prior 3)
    const recentQuarters = quarterlyStats.slice(0, 3);
    const priorQuarters = quarterlyStats.slice(3, 6);
    const recentAvg = this.average(recentQuarters.map(q => q.count));
    const priorAvg = this.average(priorQuarters.map(q => q.count));
    const trend = recentAvg > priorAvg * 1.1 ? 'ACCELERATING' : recentAvg < priorAvg * 0.9 ? 'SLOWING' : 'STABLE';
    
    // Average days on market (if available)
    const daysOnMarket = comps.filter(c => c.daysOnMarket).map(c => c.daysOnMarket!);
    const avgDaysOnMarket = daysOnMarket.length > 0 ? this.average(daysOnMarket) : null;
    
    return {
      totalSales,
      avgPerQuarter,
      quarterlyStats,
      trend,
      avgDaysOnMarket,
      insights: this.generateVelocityInsights(trend, avgDaysOnMarket),
    };
  }
  
  private groupByQuarter(comps: SaleHistory[]): { quarter: string; sales: SaleHistory[] }[] {
    const grouped: Record<string, SaleHistory[]> = {};
    
    comps.forEach(comp => {
      const date = new Date(comp.saleDate);
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const key = `Q${quarter} ${year}`;
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(comp);
    });
    
    return Object.entries(grouped)
      .map(([quarter, sales]) => ({ quarter, sales }))
      .sort((a, b) => b.quarter.localeCompare(a.quarter)); // Most recent first
  }
  
  private generateVelocityInsights(
    trend: 'ACCELERATING' | 'SLOWING' | 'STABLE',
    avgDaysOnMarket: number | null
  ): string[] {
    const insights: string[] = [];
    
    if (trend === 'ACCELERATING') {
      insights.push('Transaction volume accelerating (strong demand)');
    } else if (trend === 'SLOWING') {
      insights.push('Transaction volume slowing (potential buyer hesitation)');
    } else {
      insights.push('Transaction volume stable (healthy market)');
    }
    
    if (avgDaysOnMarket) {
      if (avgDaysOnMarket < 60) {
        insights.push(`Fast sales (${avgDaysOnMarket.toFixed(0)} days avg) indicate seller\'s market`);
      } else if (avgDaysOnMarket > 120) {
        insights.push(`Slow sales (${avgDaysOnMarket.toFixed(0)} days avg) favor buyers`);
      }
    }
    
    return insights;
  }
  
  // ═════════════════════════════════════════════════════════════
  // Price Trends
  // ═════════════════════════════════════════════════════════════
  
  private analyzePriceTrends(comps: SaleHistory[]): PriceTrendAnalysis {
    // Sort by date
    const sorted = [...comps].sort((a, b) => 
      new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
    );
    
    // Calculate 24-month trend
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    const priceChange = last.pricePerUnit! - first.pricePerUnit!;
    const priceChangePct = (priceChange / first.pricePerUnit!) * 100;
    
    const months = this.monthsBetween(first.saleDate, last.saleDate);
    const annualAppreciation = (priceChangePct / months) * 12;
    
    // Recent acceleration (last 6 months vs prior 6)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    
    const recent = sorted.filter(s => new Date(s.saleDate) >= cutoffDate);
    const prior = sorted.filter(s => new Date(s.saleDate) < cutoffDate);
    
    const recentAvgPrice = this.average(recent.map(s => s.pricePerUnit!));
    const priorAvgPrice = this.average(prior.map(s => s.pricePerUnit!));
    const recentAcceleration = ((recentAvgPrice - priorAvgPrice) / priorAvgPrice) * 100;
    
    // Monthly data for chart
    const monthlyData = this.groupByMonth(sorted);
    
    return {
      firstSale: first,
      lastSale: last,
      priceChange,
      priceChangePct,
      annualAppreciation,
      recentAcceleration,
      monthlyData,
      insights: this.generatePriceTrendInsights(annualAppreciation, recentAcceleration),
    };
  }
  
  private monthsBetween(date1: Date, date2: Date): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  }
  
  private groupByMonth(comps: SaleHistory[]): { month: string; avgPrice: number; count: number }[] {
    const grouped: Record<string, SaleHistory[]> = {};
    
    comps.forEach(comp => {
      const date = new Date(comp.saleDate);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(comp);
    });
    
    return Object.entries(grouped).map(([month, sales]) => ({
      month,
      avgPrice: this.average(sales.map(s => s.pricePerUnit!)),
      count: sales.length,
    }));
  }
  
  private generatePriceTrendInsights(
    annualAppreciation: number,
    recentAcceleration: number
  ): string[] {
    const insights: string[] = [];
    
    if (annualAppreciation > 5) {
      insights.push(`Strong price appreciation (+${annualAppreciation.toFixed(1)}% annually)`);
    } else if (annualAppreciation < 0) {
      insights.push(`Price decline (${annualAppreciation.toFixed(1)}% annually) - market stress`);
    }
    
    if (recentAcceleration > 3) {
      insights.push(`Recent acceleration (+${recentAcceleration.toFixed(1)}% last 6mo) - increasing demand`);
    } else if (recentAcceleration < -3) {
      insights.push(`Recent deceleration (${recentAcceleration.toFixed(1)}% last 6mo) - cooling market`);
    }
    
    return insights;
  }
  
  // ═════════════════════════════════════════════════════════════
  // Utility Methods
  // ═════════════════════════════════════════════════════════════
  
  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }
  
  private groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
    return arr.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
  
  private calculateYoYChange(comps: SaleHistory[], field: string): number | null {
    // Compare sales from 12 months ago to recent
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12);
    
    const recent = comps.filter(c => new Date(c.saleDate) >= cutoffDate);
    const yearAgo = comps.filter(c => new Date(c.saleDate) < cutoffDate);
    
    if (recent.length === 0 || yearAgo.length === 0) return null;
    
    const recentAvg = this.average(recent.map(c => (c as any)[field]));
    const yearAgoAvg = this.average(yearAgo.map(c => (c as any)[field]));
    
    return ((recentAvg - yearAgoAvg) / yearAgoAvg) * 100;
  }
}

// ═════════════════════════════════════════════════════════════
// TypeScript Interfaces
// ═════════════════════════════════════════════════════════════

interface ComparableSalesAnalysis {
  subjectProperty: PropertyRecordData;
  comparables: SaleHistory[];
  stats: CompStats;
  taxAnalysis: TaxBurdenAnalysis;
  ownershipInsights: OwnershipInsights;
  velocity: VelocityAnalysis;
  priceTrends: PriceTrendAnalysis;
  generatedAt: Date;
}

interface CompStats {
  count: number;
  medianPrice: number;
  avgPrice: number;
  medianPricePerUnit: number;
  avgPricePerUnit: number;
  medianCapRate: number | null;
  avgCapRate: number | null;
  medianHoldPeriod: number | null;
  avgHoldPeriod: number | null;
  yoyPriceChange: number | null;
  yoyPricePerUnitChange: number | null;
}

interface TaxBurdenAnalysis {
  subject: {
    taxPerUnit: number;
    taxRate: number | undefined;
    annualTaxes: number | undefined;
  };
  market: {
    medianTaxPerUnit: number;
    avgTaxPerUnit: number;
    count: number;
  };
  comparison: {
    vsMedian: number;
    vsMedianPct: number;
    position: 'ABOVE_MARKET' | 'AT_MARKET' | 'BELOW_MARKET';
  };
  noiImpact: {
    perUnit: number;
    total: number;
    valueImpact: number;
  };
  reassessment: {
    nextDate: Date;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
    estimatedIncrease: number;
  };
  compTaxes: Array<{
    address: string;
    taxPerUnit: number;
    taxRate: number | undefined;
    county: string;
  }>;
}

interface OwnershipInsights {
  typeDistribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  holdPeriod: {
    avg: number | null;
    median: number | null;
    range: [number, number];
  };
  outOfState: {
    count: number;
    percentage: number;
    topStates: Array<{ state: string; count: number }>;
  };
  insights: string[];
}

interface VelocityAnalysis {
  totalSales: number;
  avgPerQuarter: number;
  quarterlyStats: Array<{
    quarter: string;
    count: number;
    totalVolume: number;
  }>;
  trend: 'ACCELERATING' | 'SLOWING' | 'STABLE';
  avgDaysOnMarket: number | null;
  insights: string[];
}

interface PriceTrendAnalysis {
  firstSale: SaleHistory;
  lastSale: SaleHistory;
  priceChange: number;
  priceChangePct: number;
  annualAppreciation: number;
  recentAcceleration: number;
  monthlyData: Array<{
    month: string;
    avgPrice: number;
    count: number;
  }>;
  insights: string[];
}
```

---

## 📡 API Routes

### **New Endpoint** (`marketResearch.routes.ts`)

```typescript
// ═════════════════════════════════════════════════════════════
// Get comparable sales analysis
// ═════════════════════════════════════════════════════════════

router.get('/api/market-research/:dealId/comps', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    // Generate comp analysis
    const engine = new MarketResearchEngine();
    const analysis = await engine.analyzeComparableSales(dealId);
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Error analyzing comps:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ═════════════════════════════════════════════════════════════
// Refresh property records for a deal
// ═════════════════════════════════════════════════════════════

router.post('/api/market-research/:dealId/refresh-comps', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const deal = await getDeal(dealId);
    const scraper = new MunicipalScraperService();
    
    // Re-scrape subject property
    const subject = await scraper.scrapePropertyByAddress(deal.address);
    
    // Re-scrape comps (force refresh)
    const comps = await scraper.getComparableSales(deal.address, 3, 12);
    
    res.json({
      success: true,
      refreshed: {
        subject,
        compsCount: comps.length,
      },
    });
  } catch (error) {
    console.error('Error refreshing comps:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

---

## 🎨 Frontend Integration

### **Market Research Dashboard Component** (`MarketResearchDashboard.tsx`)

```typescript
import React, { useState, useEffect } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { PropertyRecordsTab } from './PropertyRecordsTab'; // NEW

export const MarketResearchDashboard: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [activeTab, setActiveTab] = useState('supply');
  const [data, setData] = useState<MarketResearchReport | null>(null);
  
  useEffect(() => {
    fetchMarketResearch();
  }, [dealId]);
  
  const fetchMarketResearch = async () => {
    const response = await fetch(`/api/market-research/${dealId}`);
    const result = await response.json();
    setData(result.data);
  };
  
  return (
    <div className="market-research-dashboard">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tab value="supply">Supply Analysis</Tab>
        <Tab value="demand">Demand Indicators</Tab>
        <Tab value="per-capita">Per Capita Metrics</Tab>
        <Tab value="employment">Employment Impact</Tab>
        <Tab value="capacity">Market Capacity</Tab>
        <Tab value="data-sources">Data Sources</Tab>
        <Tab value="comps">Property Records & Comps</Tab> {/* NEW */}
      </Tabs>
      
      {activeTab === 'comps' && (
        <PropertyRecordsTab dealId={dealId} data={data?.comps} />
      )}
      
      {/* Other tabs... */}
    </div>
  );
};
```

### **Property Records Tab Component** (`PropertyRecordsTab.tsx`)

```typescript
import React from 'react';
import { ComparableSalesTable } from './ComparableSalesTable';
import { SubjectPropertyCard } from './SubjectPropertyCard';
import { TaxBurdenAnalysis } from './TaxBurdenAnalysis';
import { PriceTrendChart } from './PriceTrendChart';
import { VelocityChart } from './VelocityChart';

export const PropertyRecordsTab: React.FC<{ dealId: string; data: ComparableSalesAnalysis }> = ({
  dealId,
  data,
}) => {
  if (!data) {
    return <div>Loading comparable sales...</div>;
  }
  
  return (
    <div className="property-records-tab">
      {/* Hero Metrics */}
      <div className="hero-metrics grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Recent Sales"
          value={data.stats.count}
          subtitle="Last 12 months"
        />
        <MetricCard
          title="Median $/Unit"
          value={`$${(data.stats.medianPricePerUnit / 1000).toFixed(0)}k`}
          subtitle={`+${data.stats.yoyPricePerUnitChange?.toFixed(1)}% YoY`}
        />
        <MetricCard
          title="Cap Rate Trend"
          value={`${data.stats.medianCapRate?.toFixed(1)}%`}
          subtitle="Compressing"
        />
        <MetricCard
          title="Avg Hold Period"
          value={`${data.stats.avgHoldPeriod?.toFixed(1)}y`}
          subtitle="Institutional"
        />
      </div>
      
      {/* Two-Column Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: 60% */}
        <div className="col-span-7">
          <ComparableSalesTable comps={data.comparables} />
          <PriceTrendChart data={data.priceTrends} />
          <TaxBurdenAnalysis data={data.taxAnalysis} />
          <VelocityChart data={data.velocity} />
        </div>
        
        {/* Right Column: 40% */}
        <div className="col-span-5">
          <SubjectPropertyCard property={data.subjectProperty} />
        </div>
      </div>
    </div>
  );
};
```

---

## 🔄 Data Refresh Strategy

### **Caching Layer**
```typescript
// Cache comp queries for 24 hours
// Cache subject property for 7 days
// Force refresh available via UI button

const CACHE_TTL = {
  comps: 24 * 60 * 60, // 24 hours
  subject: 7 * 24 * 60 * 60, // 7 days
};

async function getCachedComps(dealId: string): Promise<ComparableSalesAnalysis | null> {
  const cached = await redis.get(`comps:${dealId}`);
  if (cached) {
    const data = JSON.parse(cached);
    const age = Date.now() - new Date(data.generatedAt).getTime();
    
    if (age < CACHE_TTL.comps * 1000) {
      return data;
    }
  }
  
  return null;
}
```

### **Scheduled Updates**
```javascript
// Cron job: Update comps for active deals nightly
// Priority: deals in underwriting phase
// Batch: 100 deals per run

{
  "schedule": "0 3 * * *", // 3 AM daily
  "task": "refresh-active-deal-comps",
  "batchSize": 100
}
```

---

## 🚀 Deployment Checklist

### **Database**
- [ ] Run migration: `023_property_records_integration.sql`
- [ ] Add indexes for performance
- [ ] Test PostGIS spatial queries

### **Backend**
- [ ] Deploy MunicipalScraperService
- [ ] Deploy updated MarketResearchEngine
- [ ] Deploy new API endpoints
- [ ] Configure caching (Redis)

### **Frontend**
- [ ] Build PropertyRecordsTab component
- [ ] Build 5 sub-components (table, cards, charts)
- [ ] Add tab to Market Research Dashboard
- [ ] Test data display

### **Testing**
- [ ] Unit tests for comp analysis functions
- [ ] Integration tests for scraper → engine flow
- [ ] E2E test: deal → market research → comps tab
- [ ] Performance test: 100 comps load time

### **Documentation**
- [ ] API documentation (comps endpoints)
- [ ] User guide (how to read Property Records tab)
- [ ] Admin guide (managing scrapers, cache)

---

## 📊 Success Metrics

### **Adoption**
- % of deals with comps analyzed: Target 80%+
- Average comps per deal: Target 10-15
- User time in Property Records tab: Target 3+ minutes

### **Quality**
- Comp relevance score: Target >85%
- Data completeness: Target >90%
- Scraping success rate: Target >95%

### **Performance**
- Comp query response time: Target <500ms (cached)
- Scrape time per property: Target <5 seconds
- Dashboard load time: Target <2 seconds

---

## 🎯 Future Enhancements

### **Phase 2** (Post-Launch)
- [ ] Machine learning comp selection (better relevance)
- [ ] Automated valuation model (AVM) using comps
- [ ] Cap rate compression alerts
- [ ] Portfolio-level comp analysis

### **Phase 3** (Advanced)
- [ ] Predictive tax modeling
- [ ] Historical price replay (see market evolution)
- [ ] Comp recommendation engine
- [ ] Integration with financial model (auto-populate assumptions)

---

**Integration Complete:** Property Records → Market Research Engine  
**Estimated Build:** 1 week (after scraper ready)  
**Status:** Ready for development  
**Dependencies:** Municipal Scraper (Agent 2), UI Design (Agent 1)

