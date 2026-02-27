import { AnalysisResult } from '@/types/analysis';

/**
 * Mock analysis data for testing the UI without backend
 * To use: Import and return this instead of API call in analysisApi.ts
 */

export const mockStrongOpportunity: AnalysisResult = {
  verdict: 'STRONG_OPPORTUNITY',
  score: 87,
  confidence: 'high',
  keyFactors: [
    {
      factor: 'Population Growth Rate',
      impact: 'positive',
      description: '15% annual growth significantly exceeds housing supply increase of 3%'
    },
    {
      factor: 'Demand-Supply Ratio',
      impact: 'positive',
      description: 'Only 0.4 units per capita, well below healthy threshold of 0.45'
    },
    {
      factor: 'Market Momentum',
      impact: 'positive',
      description: 'Strong upward trend in absorption rates and property values'
    },
    {
      factor: 'Economic Indicators',
      impact: 'positive',
      description: 'High employment growth and rising median income support demand'
    }
  ],
  recommendation: 'This submarket presents a STRONG opportunity for development. The significant population growth combined with limited housing supply creates favorable conditions. Consider pursuing multifamily development projects targeting mid-to-upper income demographics. Market entry timing is optimal given current economic indicators and development pipeline constraints.',
  submarketName: 'Buckhead',
  analysisDate: new Date().toISOString()
};

export const mockCaution: AnalysisResult = {
  verdict: 'CAUTION',
  score: 45,
  confidence: 'medium',
  keyFactors: [
    {
      factor: 'Oversupply Risk',
      impact: 'negative',
      description: 'Large development pipeline may exceed absorption capacity'
    },
    {
      factor: 'Slowing Growth',
      impact: 'negative',
      description: 'Population growth rate declining from 8% to 3% year-over-year'
    },
    {
      factor: 'Economic Uncertainty',
      impact: 'neutral',
      description: 'Mixed signals from employment and income data'
    },
    {
      factor: 'Existing Inventory',
      impact: 'negative',
      description: 'Current vacancy rates elevated at 12%, above market average'
    }
  ],
  recommendation: 'Exercise caution in this submarket. While fundamentals are not entirely negative, several risk factors warrant careful consideration. If proceeding, focus on niche opportunities, secure pre-leasing commitments, and maintain conservative pro formas. Monitor market absorption rates closely over the next 6-12 months before major commitments.',
  submarketName: 'Midtown',
  analysisDate: new Date().toISOString()
};

export const mockAvoid: AnalysisResult = {
  verdict: 'AVOID',
  score: 22,
  confidence: 'high',
  keyFactors: [
    {
      factor: 'Population Decline',
      impact: 'negative',
      description: 'Net population outflow of 5% annually over past 3 years'
    },
    {
      factor: 'Severe Oversupply',
      impact: 'negative',
      description: '0.65 units per capita, significantly above sustainable levels'
    },
    {
      factor: 'Weak Economic Base',
      impact: 'negative',
      description: 'Major employer closures and declining job market'
    },
    {
      factor: 'High Vacancy',
      impact: 'negative',
      description: 'Persistent 18% vacancy rate with no improvement trend'
    }
  ],
  recommendation: 'DO NOT pursue development in this submarket at this time. Fundamental market conditions are unfavorable with declining population, excessive housing supply, and weak economic drivers. Existing properties face significant headwinds. Consider alternative markets with better growth prospects and healthier supply-demand dynamics.',
  submarketName: 'Old Downtown',
  analysisDate: new Date().toISOString()
};

export const mockOpportunity: AnalysisResult = {
  verdict: 'OPPORTUNITY',
  score: 68,
  confidence: 'medium',
  keyFactors: [
    {
      factor: 'Steady Growth',
      impact: 'positive',
      description: 'Consistent 5% annual population growth'
    },
    {
      factor: 'Balanced Supply',
      impact: 'neutral',
      description: 'Supply-demand ratio near equilibrium at 0.43 units per capita'
    },
    {
      factor: 'Infrastructure Investment',
      impact: 'positive',
      description: 'New transit station planned, improving accessibility'
    },
    {
      factor: 'Limited Pipeline',
      impact: 'positive',
      description: 'Few competing projects in development'
    }
  ],
  recommendation: 'This submarket shows solid opportunity for development. While not a "slam dunk," the fundamentals support careful investment. Focus on well-located sites near the planned transit hub. Consider phased development approach to match absorption. Target price points aligned with current median income levels to ensure demand capture.',
  submarketName: 'Westside',
  analysisDate: new Date().toISOString()
};

// Helper to get random mock data for testing
export const getRandomMockAnalysis = (): AnalysisResult => {
  const mocks = [mockStrongOpportunity, mockCaution, mockAvoid, mockOpportunity];
  return mocks[Math.floor(Math.random() * mocks.length)];
};
