/**
 * AI Agent (Opus) Section - JEDI RE Enhanced Deal Page
 * Integrates OpusChat component for AI-powered deal analysis
 */

import React, { useState, useEffect } from 'react';
import { Deal } from '../../../types/deal';
import { OpusChat } from '../../Opus';
import { OpusDealContext, OpusRecommendationResult } from '../../../types/opus.types';

interface AIAgentSectionProps {
  deal: Deal;
  mode?: 'acquisition' | 'performance';
  useMockData?: boolean;
}

/**
 * Build Opus deal context from deal data
 * Extracts data from all available tabs and formats for Opus API
 */
const buildDealContext = (dealTyped: Deal, mode: 'acquisition' | 'performance'): any => {
  const deal = dealTyped as any;
  return {
    dealId: deal.id,
    dealName: deal.name,
    status: mode === 'performance' ? 'owned' : 'pipeline',
    
    // Overview tab data
    overview: {
      propertySpecs: {
        address: deal.propertyAddress || deal.address || 'Unknown',
        propertyType: deal.projectType || deal.propertyType || 'multifamily',
        units: deal.targetUnits,
        yearBuilt: deal.yearBuilt,
        squareFeet: deal.squareFeet,
        lotSize: deal.lotSize,
        condition: deal.condition || 'good',
        parking: deal.parking,
        amenities: deal.amenities ? deal.amenities.split(',') : []
      },
      metrics: {
        purchasePrice: deal.dealValue,
        pricePerUnit: deal.dealValue && deal.targetUnits ? deal.dealValue / deal.targetUnits : undefined,
        pricePerSF: deal.dealValue && deal.squareFeet ? deal.dealValue / deal.squareFeet : undefined,
        capRate: deal.capRate,
        cashOnCash: deal.cashOnCash,
        irr: deal.irr,
        equityMultiple: deal.equityMultiple,
        dscr: deal.dscr,
        ltv: deal.ltv,
        noi: deal.noi,
        grossYield: deal.grossYield
      },
      location: deal.boundary?.center ? {
        lat: deal.boundary.center.lat,
        lng: deal.boundary.center.lng,
        city: deal.city || '',
        state: deal.state || '',
        zip: deal.zip || '',
        neighborhood: deal.neighborhood,
        marketTier: deal.marketTier
      } : undefined,
      status: {
        stage: deal.stage || 'Active',
        daysOnMarket: deal.daysOnMarket,
        lastUpdated: deal.updatedAt || deal.createdAt,
        assignedTo: deal.assignedTo
      }
    },
    
    // Financial tab data (if available)
    financial: deal.proForma ? {
      proForma: {
        revenue: {
          grossRent: deal.proForma.grossRent || deal.grossRent,
          otherIncome: deal.proForma.otherIncome,
          vacancy: deal.proForma.vacancy || deal.vacancy,
          effectiveGrossIncome: deal.proForma.egi
        },
        expenses: {
          operating: deal.proForma.opex,
          utilities: deal.proForma.utilities,
          maintenance: deal.proForma.maintenance,
          propertyManagement: deal.proForma.propertyManagement,
          insurance: deal.proForma.insurance,
          propertyTaxes: deal.proForma.propertyTaxes,
          totalExpenses: deal.proForma.totalExpenses
        },
        noi: deal.proForma.noi || deal.noi,
        debtService: deal.proForma.debtService,
        cashFlow: deal.proForma.cashFlow
      },
      financing: deal.financing ? {
        loanAmount: deal.financing.loanAmount,
        interestRate: deal.financing.interestRate,
        loanTerm: deal.financing.loanTerm,
        loanType: deal.financing.loanType,
        downPayment: deal.financing.downPayment,
        closingCosts: deal.financing.closingCosts
      } : undefined,
      returns: {
        year1: deal.returns?.year1,
        year5: deal.returns?.year5,
        year10: deal.returns?.year10,
        irr: deal.irr,
        equityMultiple: deal.equityMultiple
      }
    } : undefined,
    
    // Market/Competition data (if available)
    competition: deal.comps ? {
      comps: deal.comps.map((comp: any) => ({
        address: comp.address,
        distance: comp.distance,
        salePrice: comp.price,
        pricePerUnit: comp.pricePerUnit,
        pricePerSF: comp.pricePerSF,
        capRate: comp.capRate,
        units: comp.units,
        yearBuilt: comp.yearBuilt,
        similarity: comp.similarity,
        saleDate: comp.saleDate
      })),
      marketPosition: {
        pricingCompetitiveness: deal.marketPosition?.pricingCompetitiveness,
        demandLevel: deal.marketPosition?.demandLevel,
        occupancyRate: deal.occupancyRate,
        vacancyRate: deal.vacancy,
        rentGrowth: deal.rentGrowth,
        absorptionRate: deal.absorptionRate
      }
    } : undefined,
    
    // Supply tracking data (if available)
    supply: deal.supplyData ? {
      pipelineProjects: deal.supplyData.pipelineProjects?.map((proj: any) => ({
        name: proj.name,
        units: proj.units,
        deliveryDate: proj.deliveryDate,
        distance: proj.distance,
        status: proj.status
      })),
      totalPipelineUnits: deal.supplyData.totalPipelineUnits,
      impactAnalysis: {
        nearTermRisk: deal.supplyData.nearTermRisk,
        longTermOutlook: deal.supplyData.longTermOutlook,
        competitivePressure: deal.supplyData.competitivePressure
      }
    } : undefined,
    
    // Market data (demographics, trends)
    market: deal.marketData ? {
      demographics: deal.marketData.demographics,
      economicIndicators: deal.marketData.economicIndicators,
      trends: deal.marketData.trends,
      swot: deal.marketData.swot
    } : undefined,
    
    // Strategy data (if available)
    strategy: deal.strategies ? {
      strategies: deal.strategies.map((s: any) => ({
        type: s.type,
        description: s.description,
        expectedReturn: s.expectedReturn,
        risk: s.risk,
        timeline: s.timeline
      })),
      arbitrageOpportunities: deal.arbitrageOpportunities
    } : undefined,
    
    // Due diligence data (if available)
    dueDiligence: deal.dueDiligence ? {
      checklistItems: deal.dueDiligence.items,
      completionPercentage: deal.dueDiligence.completionPercentage,
      redFlags: deal.dueDiligence.redFlags,
      findings: deal.dueDiligence.findings,
      recommendations: deal.dueDiligence.recommendations
    } : undefined,
    
    // Team data (if available)
    team: deal.team ? {
      members: deal.team.members?.map((m: any) => ({
        name: m.name,
        role: m.role,
        email: m.email,
        phone: m.phone
      })),
      communications: deal.team.communications
    } : undefined,
    
    // Documents data (if available)
    documents: deal.documents ? {
      categories: deal.documents.categories,
      totalCount: deal.documents.totalCount,
      reviewStatus: deal.documents.reviewStatus
    } : undefined
  };
};

export const AIAgentSection: React.FC<AIAgentSectionProps> = ({
  deal,
  mode = 'acquisition',
  useMockData = true
}) => {
  const [dealContext, setDealContext] = useState<OpusDealContext | null>(null);
  const [analysisResult, setAnalysisResult] = useState<OpusRecommendationResult | null>(null);

  // Build deal context when deal changes
  useEffect(() => {
    if (deal) {
      const context = buildDealContext(deal, mode);
      setDealContext(context);
    }
  }, [deal, mode]);

  // Handle analysis completion
  const handleAnalysisComplete = (result: OpusRecommendationResult) => {
    setAnalysisResult(result);
    console.log('Opus analysis complete:', result);
  };

  // Loading state
  if (!dealContext) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Preparing deal analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-1">
              AI-Powered Analysis by Opus (Claude 3)
            </h4>
            <p className="text-sm text-blue-800">
              This AI agent analyzes your deal across all tabs and provides recommendations, 
              risk assessment, and conversational insights. Ask it anything!
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-blue-700">
              <span className={`px-2 py-1 rounded ${useMockData ? 'bg-green-200' : 'bg-orange-200'}`}>
                {useMockData ? '🟢 Mock Mode (Free)' : '🔴 Live API (Costs apply)'}
              </span>
              <span>•</span>
              <span>Mode: {mode === 'acquisition' ? '🎯 Acquisition' : '📊 Performance'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Opus Chat Interface */}
      <OpusChat
        dealContext={dealContext}
        mode={mode}
        useMockData={useMockData}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Additional Info Footer */}
      {analysisResult && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Analysis Date:</span>
              <p className="font-medium text-gray-900">
                {new Date(analysisResult.analysisDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Model Version:</span>
              <p className="font-medium text-gray-900">{analysisResult.modelVersion}</p>
            </div>
            <div>
              <span className="text-gray-600">Processing Time:</span>
              <p className="font-medium text-gray-900">
                {analysisResult.processingTime 
                  ? `${(analysisResult.processingTime / 1000).toFixed(1)}s`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgentSection;
