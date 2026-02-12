import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ShowcaseDataService from '../services/showcase.service';
import { ActivityTimeline } from '../components/showcase/ActivityTimeline';
import { ContactMap } from '../components/showcase/ContactMap';
import { DocumentVault } from '../components/showcase/DocumentVault';
import { FinancialSnapshotComponent } from '../components/showcase/FinancialSnapshot';
import { KeyDates } from '../components/showcase/KeyDates';
import { DecisionLog } from '../components/showcase/DecisionLog';
import { RiskFlags } from '../components/showcase/RiskFlags';
import type { ViewMode } from '../types/showcase.types';

export function DealShowcasePage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<Record<string, ViewMode>>({});
  const [activeSection, setActiveSection] = useState<string>('overview');

  const deal = dealId ? ShowcaseDataService.getDealById(dealId) : ShowcaseDataService.getDeals()[0];
  
  if (!deal) {
    return <div className="p-8 text-center text-gray-600">Deal not found</div>;
  }

  const toggleViewMode = (sectionId: string) => {
    setViewMode(prev => ({
      ...prev,
      [sectionId]: prev[sectionId] === 'enhanced' ? 'basic' : 'enhanced'
    }));
  };

  const getSectionMode = (sectionId: string): ViewMode => {
    return viewMode[sectionId] || 'basic';
  };

  const sections = [
    { id: 'overview', name: '📊 Deal Overview', icon: '📊' },
    { id: 'financial', name: '💰 Financial Analysis', icon: '💰' },
    { id: 'strategy', name: '🎯 Strategy & Arbitrage', icon: '🎯' },
    { id: 'due-diligence', name: '✅ Due Diligence', icon: '✅' },
    { id: 'properties', name: '🏢 Properties', icon: '🏢' },
    { id: 'market', name: '📈 Market Analysis', icon: '📈' },
    { id: 'documents', name: '📄 Documents', icon: '📄' },
    { id: 'team', name: '👥 Team & Communications', icon: '👥' },
    { id: 'timeline', name: '⏰ Timeline & Milestones', icon: '⏰' },
    { id: 'notes', name: '📝 Notes & Comments', icon: '📝' }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/showcase')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ← Back
                </button>
                <h1 className="text-2xl font-bold text-gray-900">{deal.name}</h1>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold capitalize">
                  {deal.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {deal.address}, {deal.city}, {deal.state} • {deal.units} units • {formatCurrency(deal.purchasePrice)}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{deal.targetIRR}%</div>
                <div className="text-xs text-gray-500">Target IRR</div>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                View Full Deal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="sticky top-[73px] z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto py-3">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {section.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Deal Overview */}
        {activeSection === 'overview' && (
          <SectionContainer
            title="Deal Overview"
            mode={getSectionMode('overview')}
            onToggle={() => toggleViewMode('overview')}
          >
            {getSectionMode('overview') === 'basic' ? (
              <BasicOverview deal={deal} />
            ) : (
              <EnhancedOverview deal={deal} />
            )}
          </SectionContainer>
        )}

        {/* Financial Analysis */}
        {activeSection === 'financial' && (
          <SectionContainer
            title="Financial Analysis"
            mode={getSectionMode('financial')}
            onToggle={() => toggleViewMode('financial')}
          >
            {getSectionMode('financial') === 'basic' ? (
              <BasicFinancial deal={deal} />
            ) : (
              <div>
                <FinancialSnapshotComponent financials={deal.financials} />
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-900">
                    💡 <strong>Enhanced:</strong> Includes Financial Modeling Pro with 13 components, sensitivity analysis, Monte Carlo simulation, and waterfall modeling. 
                    <button className="ml-2 text-purple-600 underline hover:text-purple-700">
                      View Full Financial Module →
                    </button>
                  </p>
                </div>
              </div>
            )}
          </SectionContainer>
        )}

        {/* Strategy & Arbitrage */}
        {activeSection === 'strategy' && (
          <SectionContainer
            title="Strategy & Arbitrage"
            mode={getSectionMode('strategy')}
            onToggle={() => toggleViewMode('strategy')}
          >
            {getSectionMode('strategy') === 'basic' ? (
              <BasicStrategy deal={deal} />
            ) : (
              <EnhancedStrategy />
            )}
          </SectionContainer>
        )}

        {/* Due Diligence */}
        {activeSection === 'due-diligence' && (
          <SectionContainer
            title="Due Diligence"
            mode={getSectionMode('due-diligence')}
            onToggle={() => toggleViewMode('due-diligence')}
          >
            {getSectionMode('due-diligence') === 'basic' ? (
              <BasicDueDiligence tasks={deal.tasks} />
            ) : (
              <EnhancedDueDiligence tasks={deal.tasks} />
            )}
          </SectionContainer>
        )}

        {/* Properties */}
        {activeSection === 'properties' && (
          <SectionContainer
            title="Properties"
            mode={getSectionMode('properties')}
            onToggle={() => toggleViewMode('properties')}
          >
            {getSectionMode('properties') === 'basic' ? (
              <BasicProperties properties={deal.properties} />
            ) : (
              <EnhancedProperties properties={deal.properties} />
            )}
          </SectionContainer>
        )}

        {/* Market Analysis */}
        {activeSection === 'market' && (
          <SectionContainer
            title="Market Analysis"
            mode={getSectionMode('market')}
            onToggle={() => toggleViewMode('market')}
          >
            {getSectionMode('market') === 'basic' ? (
              <BasicMarket />
            ) : (
              <EnhancedMarket />
            )}
          </SectionContainer>
        )}

        {/* Documents */}
        {activeSection === 'documents' && (
          <SectionContainer
            title="Documents"
            mode={getSectionMode('documents')}
            onToggle={() => toggleViewMode('documents')}
          >
            {getSectionMode('documents') === 'basic' ? (
              <BasicDocuments documents={deal.documents} />
            ) : (
              <DocumentVault documents={deal.documents} />
            )}
          </SectionContainer>
        )}

        {/* Team & Communications */}
        {activeSection === 'team' && (
          <SectionContainer
            title="Team & Communications"
            mode={getSectionMode('team')}
            onToggle={() => toggleViewMode('team')}
          >
            {getSectionMode('team') === 'basic' ? (
              <BasicTeam team={deal.team} />
            ) : (
              <ContactMap team={deal.team} />
            )}
          </SectionContainer>
        )}

        {/* Timeline & Milestones */}
        {activeSection === 'timeline' && (
          <SectionContainer
            title="Timeline & Milestones"
            mode={getSectionMode('timeline')}
            onToggle={() => toggleViewMode('timeline')}
          >
            {getSectionMode('timeline') === 'basic' ? (
              <BasicTimeline activities={deal.activities} />
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <h3 className="font-semibold text-gray-900 mb-4">Activity Timeline</h3>
                    <ActivityTimeline activities={deal.activities} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Key Dates</h3>
                    <KeyDates dealId={deal.id} />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Decision Log</h3>
                  <DecisionLog decisions={deal.decisions} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Risk Flags</h3>
                  <RiskFlags risks={deal.risks} />
                </div>
              </div>
            )}
          </SectionContainer>
        )}

        {/* Notes & Comments */}
        {activeSection === 'notes' && (
          <SectionContainer
            title="Notes & Comments"
            mode={getSectionMode('notes')}
            onToggle={() => toggleViewMode('notes')}
          >
            {getSectionMode('notes') === 'basic' ? (
              <BasicNotes notes={deal.notes} />
            ) : (
              <EnhancedNotes notes={deal.notes} />
            )}
          </SectionContainer>
        )}

      </div>
    </div>
  );
}

// Section Container Component
function SectionContainer({ 
  title, 
  mode, 
  onToggle, 
  children 
}: { 
  title: string; 
  mode: ViewMode; 
  onToggle: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors"
          >
            <span className={`w-12 h-6 rounded-full flex items-center transition-all ${
              mode === 'enhanced' ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              <span className={`w-5 h-5 bg-white rounded-full shadow-sm transition-all ${
                mode === 'enhanced' ? 'ml-6' : 'ml-0.5'
              }`} />
            </span>
            <span className="font-medium text-sm">
              {mode === 'basic' ? 'BASIC' : 'ENHANCED'}
            </span>
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {mode === 'basic' && (
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⬆️</span>
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900 mb-1">Upgrade to unlock enhanced features</h4>
                <p className="text-sm text-yellow-800 mb-3">
                  Get advanced analytics, AI-powered insights, and premium tools by upgrading to the Enhanced tier.
                </p>
                <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium">
                  Upgrade Now - $299/mo
                </button>
              </div>
            </div>
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
}

// Basic & Enhanced Component Implementations
function BasicOverview({ deal }: any) {
  return (
    <div className="space-y-4">
      <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
        <img src={deal.imageUrl} alt={deal.name} className="w-full h-full object-cover" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Purchase Price</div>
          <div className="text-lg font-bold text-gray-900">${(deal.purchasePrice / 1000000).toFixed(2)}M</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Units</div>
          <div className="text-lg font-bold text-gray-900">{deal.units}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Cap Rate</div>
          <div className="text-lg font-bold text-gray-900">{deal.capRate}%</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Target IRR</div>
          <div className="text-lg font-bold text-gray-900">{deal.targetIRR}%</div>
        </div>
      </div>
    </div>
  );
}

function EnhancedOverview({ deal }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
            <img src={deal.imageUrl} alt={deal.name} className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Purchase Price', value: `$${(deal.purchasePrice / 1000000).toFixed(2)}M`, change: '+2.1%' },
            { label: 'Current Value', value: `$${(deal.currentValue / 1000000).toFixed(2)}M`, change: '+6.0%' },
            { label: 'NOI', value: `$${(deal.noi / 1000).toFixed(0)}K`, change: '+8.2%' },
            { label: 'Cap Rate', value: `${deal.capRate}%`, change: '+0.4%' },
            { label: 'Cash-on-Cash', value: `${deal.cashOnCash}%`, change: '+2.5%' },
            { label: 'Target IRR', value: `${deal.targetIRR}%`, change: 'On track' }
          ].map(metric => (
            <div key={metric.label} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{metric.label}</span>
                <span className="text-xs text-green-600 font-semibold">{metric.change}</span>
              </div>
              <div className="text-lg font-bold text-gray-900">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <button className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors">
          <div className="text-2xl mb-2">📊</div>
          <div className="font-semibold text-blue-900">Financial Model</div>
        </button>
        <button className="p-4 bg-green-50 rounded-lg border-2 border-green-200 hover:border-green-400 transition-colors">
          <div className="text-2xl mb-2">✅</div>
          <div className="font-semibold text-green-900">Task Manager</div>
        </button>
        <button className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-colors">
          <div className="text-2xl mb-2">📄</div>
          <div className="font-semibold text-purple-900">Document Vault</div>
        </button>
      </div>
    </div>
  );
}

function BasicFinancial({ deal }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {[
        { label: 'NOI', value: `$${(deal.noi / 1000).toFixed(0)}K` },
        { label: 'Cap Rate', value: `${deal.capRate}%` },
        { label: 'Cash-on-Cash', value: `${deal.cashOnCash}%` },
        { label: 'Target IRR', value: `${deal.targetIRR}%` },
        { label: 'Purchase Price', value: `$${(deal.purchasePrice / 1000000).toFixed(2)}M` },
        { label: 'Units', value: deal.units }
      ].map(metric => (
        <div key={metric.label} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">{metric.label}</div>
          <div className="text-xl font-bold text-gray-900">{metric.value}</div>
        </div>
      ))}
    </div>
  );
}

function BasicStrategy({ deal }: any) {
  return (
    <div className="space-y-4">
      <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 text-lg mb-2">Primary Strategy</h3>
        <p className="text-blue-800">{deal.primaryStrategy}</p>
      </div>
      <div className="text-sm text-gray-600">
        Switch to Enhanced mode to compare 39 strategies with ROI projections, risk scoring, and implementation plans.
      </div>
    </div>
  );
}

function EnhancedStrategy() {
  const strategies = ShowcaseDataService.getStrategies().slice(0, 5);
  return (
    <div className="space-y-4">
      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 mb-4">
        <p className="text-sm text-purple-900">
          💡 Viewing top 5 of 39 strategies. <button className="underline hover:text-purple-700">View all strategies →</button>
        </p>
      </div>
      {strategies.map(strategy => (
        <div key={strategy.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900">{strategy.name}</h4>
            <div className="text-xl font-bold text-green-600">{strategy.projectedROI.toFixed(1)}%</div>
          </div>
          <p className="text-sm text-gray-600 mb-3">{strategy.description}</p>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-600">Cost: ${(strategy.implementationCost / 1000).toFixed(0)}K</span>
            <span className="text-gray-600">Time: {strategy.timeframe}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              strategy.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
              strategy.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {strategy.riskLevel} risk
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BasicDueDiligence({ tasks }: any) {
  const completed = tasks.filter((t: any) => t.status === 'completed').length;
  const percentage = Math.round((completed / tasks.length) * 100);
  
  return (
    <div className="space-y-4">
      <div className="p-6 bg-blue-50 rounded-lg">
        <div className="text-3xl font-bold text-blue-900 mb-2">{percentage}%</div>
        <div className="text-sm text-blue-800">{completed} of {tasks.length} tasks completed</div>
        <div className="mt-3 h-3 bg-white rounded-full overflow-hidden">
          <div className="h-full bg-blue-600" style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <div className="space-y-2">
        {tasks.slice(0, 10).map((task: any) => (
          <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input type="checkbox" checked={task.status === 'completed'} readOnly className="w-5 h-5" />
            <span className={task.status === 'completed' ? 'line-through text-gray-600' : 'text-gray-900'}>
              {task.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnhancedDueDiligence({ tasks }: any) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <p className="text-sm text-purple-900">
          💡 Enhanced: Smart checklist with 40+ contextual tasks, risk scoring, and AI-generated recommendations. 
          <button className="ml-2 underline hover:text-purple-700">View full DD Suite →</button>
        </p>
      </div>
      
      {['Financial', 'Legal', 'Property', 'Environmental'].map(category => {
        const catTasks = tasks.filter((t: any) => t.category.toLowerCase() === category.toLowerCase());
        const completed = catTasks.filter((t: any) => t.status === 'completed').length;
        const percentage = Math.round((completed / catTasks.length) * 100);
        
        return (
          <div key={category} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">{category}</h4>
              <span className="text-sm font-semibold text-gray-700">{percentage}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BasicProperties({ properties }: any) {
  return (
    <div className="space-y-4">
      {properties.map((prop: any) => (
        <div key={prop.id} className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">{prop.address}</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Units:</span> <span className="font-semibold">{prop.units}</span>
            </div>
            <div>
              <span className="text-gray-600">Year Built:</span> <span className="font-semibold">{prop.yearBuilt}</span>
            </div>
            <div>
              <span className="text-gray-600">Value:</span> <span className="font-semibold">${(prop.estimatedValue / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EnhancedProperties({ properties }: any) {
  return (
    <div className="space-y-6">
      {properties.map((prop: any) => (
        <div key={prop.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-3 gap-4 p-4">
            <div className="col-span-2 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 text-lg mb-2">{prop.address}</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Units</div>
                    <div className="font-semibold">{prop.units}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Sq Ft</div>
                    <div className="font-semibold">{prop.sqft.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Year Built</div>
                    <div className="font-semibold">{prop.yearBuilt}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Condition</div>
                    <div className="font-semibold capitalize">{prop.condition}</div>
                  </div>
                </div>
              </div>
              
              {prop.comps && (
                <div>
                  <h5 className="font-semibold text-gray-700 text-sm mb-2">Comparable Sales (Top 3)</h5>
                  <div className="space-y-2">
                    {prop.comps.slice(0, 3).map((comp: any) => (
                      <div key={comp.id} className="p-3 bg-blue-50 rounded-lg text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium text-gray-900">{comp.address}</span>
                          <span className="font-semibold text-blue-900">${(comp.salePrice / 1000000).toFixed(2)}M</span>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-600">
                          <span>{comp.distance.toFixed(1)} mi</span>
                          <span>{comp.units} units</span>
                          <span>${comp.pricePerUnit.toLocaleString()}/unit</span>
                          <span className="text-green-600 font-semibold">{comp.similarity}% similar</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              {prop.images.slice(0, 4).map((img: string, i: number) => (
                <div key={i} className="aspect-video bg-gray-200 rounded overflow-hidden">
                  <img src={img} alt={`Property ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BasicMarket() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Market Rent Growth</div>
          <div className="text-2xl font-bold text-gray-900">4.2%</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Vacancy Rate</div>
          <div className="text-2xl font-bold text-gray-900">5.8%</div>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        Switch to Enhanced mode for supply pipeline maps, competitive intelligence, and market signals.
      </p>
    </div>
  );
}

function EnhancedMarket() {
  const signals = ShowcaseDataService.getMarketSignals().slice(0, 5);
  const pipeline = ShowcaseDataService.getSupplyPipeline().slice(0, 5);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Supply Pipeline (Top 5 of 25+)</h3>
        <div className="space-y-2">
          {pipeline.map(unit => (
            <div key={unit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{unit.name}</div>
                <div className="text-sm text-gray-600">{unit.units} units • {unit.distance.toFixed(1)} mi away</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{unit.status}</div>
                <div className="text-xs text-gray-600">{new Date(unit.completionDate).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Market Signals</h3>
        <div className="space-y-2">
          {signals.map(signal => (
            <div key={signal.id} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-semibold capitalize ${
                      signal.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      signal.severity === 'alert' ? 'bg-orange-100 text-orange-800' :
                      signal.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {signal.severity}
                    </span>
                    <span className="font-medium text-gray-900">{signal.title}</span>
                  </div>
                  <p className="text-sm text-gray-600">{signal.description}</p>
                </div>
                <span className={`ml-3 text-xl ${
                  signal.impact === 'positive' ? '📈' :
                  signal.impact === 'negative' ? '📉' : '➡️'
                }`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BasicDocuments({ documents }: any) {
  return (
    <div className="space-y-2">
      {documents.slice(0, 10).map((doc: any) => (
        <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-gray-900">{doc.name}</span>
          <button className="text-blue-600 hover:text-blue-700 text-sm">View</button>
        </div>
      ))}
    </div>
  );
}

function BasicTeam({ team }: any) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {team.map((member: any) => (
        <div key={member.id} className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-semibold text-gray-900">{member.name}</h4>
          <p className="text-sm text-gray-600 capitalize">{member.role.replace('-', ' ')}</p>
          <p className="text-sm text-gray-600">{member.email}</p>
        </div>
      ))}
    </div>
  );
}

function BasicTimeline({ activities }: any) {
  return (
    <div className="space-y-3">
      {activities.slice(0, 10).map((activity: any) => (
        <div key={activity.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
          <span className="text-xl">{activity.icon}</span>
          <div className="flex-1">
            <div className="font-medium text-gray-900 text-sm">{activity.title}</div>
            <div className="text-xs text-gray-500">{new Date(activity.date).toLocaleDateString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BasicNotes({ notes }: any) {
  return (
    <div className="space-y-3">
      {notes.map((note: any) => (
        <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start justify-between mb-2">
            <span className="font-semibold text-gray-900">{note.author}</span>
            <span className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-gray-700">{note.content}</p>
        </div>
      ))}
    </div>
  );
}

function EnhancedNotes({ notes }: any) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <textarea
          placeholder="Add a note... Use @ to mention team members"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
          rows={3}
        />
        <div className="flex items-center gap-2 mt-2">
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Post</button>
          <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">📎 Attach</button>
          <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">🏷️ Tag</button>
        </div>
      </div>
      
      {notes.map((note: any) => (
        <div key={note.id} className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{note.author}</span>
              {note.mentions.length > 0 && (
                <span className="text-xs text-blue-600">mentioned {note.mentions.join(', ')}</span>
              )}
            </div>
            <span className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-gray-700 mb-3">{note.content}</p>
          
          {note.tags.length > 0 && (
            <div className="flex gap-2 mb-3">
              {note.tags.map((tag: string) => (
                <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          
          {note.comments.length > 0 && (
            <div className="pl-4 border-l-2 border-gray-200 space-y-2">
              {note.comments.map((comment: any) => (
                <div key={comment.id} className="text-sm">
                  <span className="font-semibold text-gray-700">{comment.author}:</span>
                  <span className="text-gray-600 ml-2">{comment.content}</span>
                </div>
              ))}
            </div>
          )}
          
          <button className="text-sm text-blue-600 hover:text-blue-700 mt-2">+ Add comment</button>
        </div>
      ))}
    </div>
  );
}

export default DealShowcasePage;
