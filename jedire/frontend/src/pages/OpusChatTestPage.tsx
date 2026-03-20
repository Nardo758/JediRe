/**
 * Opus Chat Test Page
 * Standalone page for testing the OpusChat component
 * Access at: /test/opus-chat
 */

import React, { useState } from 'react';
import { OpusChat } from '../components/Opus';
import type { OpusDealContext } from '../types/opus.types';

// Mock deal data for testing
const createMockDealContext = (scenario: 'basic' | 'complete' | 'minimal'): OpusDealContext => {
  const baseContext: OpusDealContext = {
    dealId: 'test-deal-001',
    dealName: 'Test Property - 123 Main St',
    status: 'pipeline',
    overview: {
      propertySpecs: {
        address: '123 Main Street, Austin, TX 78701',
        propertyType: 'multifamily',
        units: 120,
        yearBuilt: 2015,
        squareFeet: 96000,
        lotSize: 45000,
        condition: 'good',
        parking: '150 spaces',
        amenities: ['Pool', 'Fitness Center', 'Pet Friendly', 'Package Lockers']
      },
      metrics: {
        purchasePrice: 18500000,
        pricePerUnit: 154167,
        pricePerSF: 192.71,
        capRate: 5.8,
        cashOnCash: 8.2,
        irr: 14.5,
        equityMultiple: 2.1,
        dscr: 1.35,
        ltv: 0.72,
        noi: 1073000,
        grossYield: 6.2
      },
      location: {
        lat: 30.2672,
        lng: -97.7431,
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        neighborhood: 'Downtown',
        marketTier: 'A'
      },
      status: {
        stage: 'Underwriting',
        daysOnMarket: 45,
        lastUpdated: new Date().toISOString(),
        assignedTo: 'John Smith'
      }
    }
  };

  if (scenario === 'minimal') {
    return baseContext;
  }

  if (scenario === 'complete') {
    return {
      ...baseContext,
      financial: {
        proForma: {
          revenue: {
            grossRent: 1800000,
            otherIncome: 45000,
            vacancy: 90000,
            effectiveGrossIncome: 1755000
          },
          expenses: {
            operating: 682000,
            utilities: 48000,
            maintenance: 96000,
            propertyManagement: 54000,
            insurance: 42000,
            propertyTaxes: 148000,
            totalExpenses: 682000
          },
          noi: 1073000,
          debtService: 780000,
          cashFlow: 293000
        },
        financing: {
          loanAmount: 13320000,
          interestRate: 5.25,
          loanTerm: 30,
          loanType: 'Fixed',
          downPayment: 5180000,
          closingCosts: 185000
        },
        returns: {
          year1: 8.2,
          year5: 12.8,
          year10: 18.4,
          irr: 14.5,
          equityMultiple: 2.1
        }
      },
      competition: {
        comps: [
          {
            address: '456 Oak Ave',
            distance: 0.3,
            salePrice: 19200000,
            pricePerUnit: 160000,
            pricePerSF: 200,
            capRate: 5.5,
            units: 120,
            yearBuilt: 2016,
            similarity: 92,
            saleDate: '2024-01-15'
          },
          {
            address: '789 Elm St',
            distance: 0.5,
            salePrice: 17800000,
            pricePerUnit: 148333,
            pricePerSF: 185,
            capRate: 6.0,
            units: 120,
            yearBuilt: 2014,
            similarity: 88,
            saleDate: '2024-02-01'
          }
        ],
        marketPosition: {
          pricingCompetitiveness: 'competitive',
          demandLevel: 'high',
          occupancyRate: 94,
          vacancyRate: 6,
          rentGrowth: 4.2,
          absorptionRate: 85
        }
      },
      supply: {
        pipelineProjects: [
          {
            name: 'The Heights',
            units: 180,
            deliveryDate: '2025-Q2',
            distance: 0.8,
            status: 'Under Construction'
          },
          {
            name: 'Park Place',
            units: 240,
            deliveryDate: '2025-Q4',
            distance: 1.2,
            status: 'Planned'
          }
        ],
        totalPipelineUnits: 420,
        impactAnalysis: {
          nearTermRisk: 'moderate',
          longTermOutlook: 'positive',
          competitivePressure: 'manageable'
        }
      },
      market: {
        demographics: {
          population: 95000,
          medianIncome: 78000,
          medianAge: 32,
          householdSize: 2.4,
          rentersPercent: 52
        },
        economicIndicators: {
          employmentGrowth: 3.8,
          gdpGrowth: 4.2,
          unemploymentRate: 3.1,
          majorEmployers: ['Tech Corp', 'Healthcare System', 'University']
        },
        trends: {
          populationGrowth: 2.8,
          rentGrowth: 4.2,
          jobGrowth: 3.8,
          constructionActivity: 'high'
        },
        swot: {
          strengths: ['Growing job market', 'Strong demographics', 'Limited supply'],
          weaknesses: ['High property taxes', 'Traffic congestion'],
          opportunities: ['Value-add potential', 'Rent growth', 'Amenity upgrades'],
          threats: ['New supply pipeline', 'Interest rate risk']
        }
      }
    };
  }

  // Basic scenario
  return {
    ...baseContext,
    financial: {
      proForma: {
        revenue: {
          grossRent: 1800000,
          effectiveGrossIncome: 1755000
        },
        expenses: {
          totalExpenses: 682000
        },
        noi: 1073000,
        debtService: 780000,
        cashFlow: 293000
      }
    }
  };
};

export const OpusChatTestPage: React.FC = () => {
  const [scenario, setScenario] = useState<'basic' | 'complete' | 'minimal'>('basic');
  const [mode, setMode] = useState<'acquisition' | 'performance'>('acquisition');
  const [useMockData, setUseMockData] = useState(true);
  const [key, setKey] = useState(0); // Force re-render

  const dealContext = createMockDealContext(scenario);

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🧪 Opus Chat Test Page
          </h1>
          <p className="text-sm text-gray-600">
            Test the OpusChat component with different scenarios and modes
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Controls</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Scenario Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Scenario
              </label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="minimal">Minimal (Overview only)</option>
                <option value="basic">Basic (Overview + Financial)</option>
                <option value="complete">Complete (All tabs)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {scenario === 'minimal' && 'Only basic property data'}
                {scenario === 'basic' && 'Property + financial data'}
                {scenario === 'complete' && 'Full data from all tabs'}
              </p>
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="acquisition">Acquisition</option>
                <option value="performance">Performance</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {mode === 'acquisition' && 'For deals in pipeline'}
                {mode === 'performance' && 'For owned assets'}
              </p>
            </div>

            {/* Mock/Live Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setUseMockData(true)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    useMockData
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🟢 Mock
                </button>
                <button
                  onClick={() => setUseMockData(false)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    !useMockData
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🔴 Live API
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {useMockData ? 'Free, instant responses' : 'Requires API key, real AI'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🔄 Refresh Component
            </button>
            <button
              onClick={() => window.location.href = '/deals'}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              ← Back to Deals
            </button>
          </div>
        </div>

        {/* Component Display */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <OpusChat
            key={key}
            dealContext={dealContext}
            mode={mode}
            useMockData={useMockData}
            onAnalysisComplete={(result) => {
              console.log('Analysis Complete:', result);
            }}
          />
        </div>

        {/* Debug Info */}
        <div className="mt-6 bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Debug Info</span>
            <span className="text-gray-400">Check browser console for logs</span>
          </div>
          <pre className="overflow-x-auto">
{`Deal Context Summary:
- Deal ID: ${dealContext.dealId}
- Deal Name: ${dealContext.dealName}
- Status: ${dealContext.status}
- Mode: ${mode}
- Mock Data: ${useMockData}
- Scenario: ${scenario}
- Overview: ${dealContext.overview ? '✓' : '✗'}
- Financial: ${dealContext.financial ? '✓' : '✗'}
- Competition: ${dealContext.competition ? '✓' : '✗'}
- Supply: ${dealContext.supply ? '✓' : '✗'}
- Market: ${dealContext.market ? '✓' : '✗'}`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default OpusChatTestPage;
