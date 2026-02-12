/**
 * AI Agent Section - Usage Examples
 * Copy these examples to integrate into your deal page
 */

import React, { useState } from 'react';
import { AIAgentSection } from './AIAgentSection';
import { Deal } from '../../../types/deal';

// ============================================================================
// Example 1: Basic Usage (Acquisition Mode)
// ============================================================================

export function Example1_BasicAcquisition() {
  const mockDeal: Deal = {
    id: 'deal_123',
    name: 'Sunset Gardens Apartments',
    projectType: 'Multifamily Acquisition',
    tier: 'A',
    status: 'Due Diligence',
    budget: 45000000,
    boundary: null,
    acres: 12.5,
    propertyCount: 224,
    pendingTasks: 8,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Deal: {mockDeal.name}</h1>
      
      {/* AI Agent Section - Acquisition Mode */}
      <AIAgentSection 
        deal={mockDeal} 
        mode="acquisition"
      />
    </div>
  );
}

// ============================================================================
// Example 2: Performance Mode with Tabs
// ============================================================================

export function Example2_PerformanceMode() {
  const mockDeal: Deal = {
    id: 'deal_456',
    name: 'Riverside Plaza',
    projectType: 'Asset Management',
    tier: 'B+',
    status: 'Performing',
    budget: 32000000,
    boundary: null,
    acres: 8.2,
    propertyCount: 156,
    pendingTasks: 3,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Asset: {mockDeal.name}</h1>
      
      <div className="mb-4 flex gap-2">
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          Performance Analysis Mode
        </span>
      </div>
      
      {/* AI Agent Section - Performance Mode */}
      <AIAgentSection 
        deal={mockDeal} 
        mode="performance"
      />
    </div>
  );
}

// ============================================================================
// Example 3: Mode Toggle (Switch between Acquisition & Performance)
// ============================================================================

export function Example3_ModeToggle() {
  const [mode, setMode] = useState<'acquisition' | 'performance'>('acquisition');
  
  const mockDeal: Deal = {
    id: 'deal_789',
    name: 'Downtown Lofts',
    projectType: 'Mixed Use Development',
    tier: 'A-',
    status: 'Active',
    budget: 67000000,
    boundary: null,
    acres: 15.3,
    propertyCount: 312,
    pendingTasks: 12,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Deal: {mockDeal.name}</h1>
      
      {/* Mode Toggle */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setMode('acquisition')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'acquisition'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📊 Acquisition Analysis
        </button>
        <button
          onClick={() => setMode('performance')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'performance'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📈 Performance Analysis
        </button>
      </div>
      
      {/* AI Agent Section with Dynamic Mode */}
      <AIAgentSection 
        deal={mockDeal} 
        mode={mode}
      />
    </div>
  );
}

// ============================================================================
// Example 4: Integration with Other Sections (Tabbed Interface)
// ============================================================================

export function Example4_TabbedDealPage() {
  const [activeTab, setActiveTab] = useState('opus');
  
  const mockDeal: Deal = {
    id: 'deal_101',
    name: 'Harbor View Towers',
    projectType: 'High-Rise Acquisition',
    tier: 'A+',
    status: 'Underwriting',
    budget: 125000000,
    boundary: null,
    acres: 3.5,
    propertyCount: 428,
    pendingTasks: 15,
    createdAt: new Date().toISOString()
  };

  const tabs = [
    { id: 'overview', label: '📋 Overview', icon: '📋' },
    { id: 'opus', label: '🤖 Opus AI', icon: '🤖' },
    { id: 'financials', label: '💰 Financials', icon: '💰' },
    { id: 'market', label: '📊 Market', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">{mockDeal.name}</h1>
        <p className="text-gray-600 mb-6">{mockDeal.projectType}</p>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'opus' && (
            <AIAgentSection 
              deal={mockDeal} 
              mode="acquisition"
            />
          )}
          {activeTab === 'overview' && (
            <div className="text-center py-12 text-gray-400">
              Overview section placeholder
            </div>
          )}
          {activeTab === 'financials' && (
            <div className="text-center py-12 text-gray-400">
              Financials section placeholder
            </div>
          )}
          {activeTab === 'market' && (
            <div className="text-center py-12 text-gray-400">
              Market section placeholder
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 5: Side-by-Side Comparison (Advanced)
// ============================================================================

export function Example5_Comparison() {
  const deal1: Deal = {
    id: 'deal_a',
    name: 'Property A',
    projectType: 'Value-Add',
    tier: 'B',
    status: 'Underwriting',
    budget: 25000000,
    boundary: null,
    acres: 8,
    propertyCount: 180,
    pendingTasks: 5,
    createdAt: new Date().toISOString()
  };

  const deal2: Deal = {
    id: 'deal_b',
    name: 'Property B',
    projectType: 'Core Plus',
    tier: 'A-',
    status: 'Underwriting',
    budget: 35000000,
    boundary: null,
    acres: 10,
    propertyCount: 220,
    pendingTasks: 7,
    createdAt: new Date().toISOString()
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <h1 className="text-2xl font-bold mb-6">Deal Comparison</h1>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Deal A */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{deal1.name}</h2>
          <AIAgentSection 
            deal={deal1} 
            mode="acquisition"
          />
        </div>
        
        {/* Deal B */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{deal2.name}</h2>
          <AIAgentSection 
            deal={deal2} 
            mode="acquisition"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Programmatic Chat Interaction
// ============================================================================

export function Example6_ProgrammaticChat() {
  const mockDeal: Deal = {
    id: 'deal_prog',
    name: 'Test Deal',
    projectType: 'Test',
    tier: 'A',
    status: 'Active',
    budget: 10000000,
    boundary: null,
    acres: 5,
    propertyCount: 100,
    pendingTasks: 0,
    createdAt: new Date().toISOString()
  };

  const askOpusQuestion = async (question: string) => {
    const { opusService } = await import('../../../services/opus.service');
    const response = await opusService.chat({
      dealId: mockDeal.id,
      message: question,
      history: []
    });
    console.log('Opus Response:', response.message.content);
  };

  const quickQuestions = [
    "What's the biggest risk?",
    "Should I buy this deal?",
    "How can I optimize NOI?",
    "When should I sell?"
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Programmatic Chat Example</h1>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Quick Questions</h3>
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => askOpusQuestion(q)}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Check console for responses
        </p>
      </div>
      
      <AIAgentSection 
        deal={mockDeal} 
        mode="acquisition"
      />
    </div>
  );
}

// ============================================================================
// Export all examples
// ============================================================================

export const AIAgentExamples = {
  BasicAcquisition: Example1_BasicAcquisition,
  PerformanceMode: Example2_PerformanceMode,
  ModeToggle: Example3_ModeToggle,
  TabbedDealPage: Example4_TabbedDealPage,
  Comparison: Example5_Comparison,
  ProgrammaticChat: Example6_ProgrammaticChat
};
