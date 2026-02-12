/**
 * DEVELOPMENT SECTION - Example Usage
 * 
 * This file demonstrates how to integrate the DevelopmentSection component
 * into your Deal detail page.
 */

import React, { useState } from 'react';
import { DevelopmentSection } from './DevelopmentSection';
import { Deal } from '../../../types';

/**
 * Example 1: Basic Integration
 * 
 * Simply add the DevelopmentSection to your deal page.
 * The component handles conditional rendering based on deal.isDevelopment.
 */
export const BasicIntegrationExample: React.FC = () => {
  const [deal, setDeal] = useState<Deal>({
    id: '123',
    name: 'Riverside Apartments Development',
    projectType: 'Multifamily',
    tier: 'Premium',
    status: 'active',
    budget: 5000000,
    boundary: null,
    acres: 2.5,
    propertyCount: 1,
    pendingTasks: 3,
    createdAt: new Date().toISOString(),
    isDevelopment: true, // This enables the section
  });

  const [hasZoningModule, setHasZoningModule] = useState(false);

  // Only render if this is a development deal
  if (!deal.isDevelopment) {
    return null;
  }

  return (
    <div className="development-section-container">
      <DevelopmentSection
        deal={deal}
        enhanced={hasZoningModule}
        onToggleModule={() => setHasZoningModule(!hasZoningModule)}
      />
    </div>
  );
};

/**
 * Example 2: With Accordion/Collapsible Section
 * 
 * Integrate within an accordion pattern like other sections.
 */
export const AccordionIntegrationExample: React.FC = () => {
  const [deal] = useState<Deal>({
    id: '456',
    name: 'Downtown Mixed-Use Project',
    projectType: 'Mixed-Use',
    tier: 'Premium',
    status: 'active',
    budget: 12000000,
    boundary: null,
    acres: 5.0,
    propertyCount: 3,
    pendingTasks: 8,
    createdAt: new Date().toISOString(),
    isDevelopment: true,
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview'])
  );
  const [hasZoningModule, setHasZoningModule] = useState(false);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Other sections... */}
      
      {/* Development Section - Only show if isDevelopment === true */}
      {deal.isDevelopment && (
        <div className="bg-white rounded-lg shadow">
          {/* Section Header (clickable to expand/collapse) */}
          <button
            onClick={() => toggleSection('development')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏗️</span>
              <div className="text-left">
                <h3 className="font-bold text-gray-900">Development Analysis</h3>
                <p className="text-sm text-gray-500">
                  Zoning capacity and compliance
                </p>
              </div>
            </div>
            <span className="text-gray-400">
              {expandedSections.has('development') ? '▼' : '▶'}
            </span>
          </button>

          {/* Section Content (expanded) */}
          {expandedSections.has('development') && (
            <div className="border-t border-gray-200">
              <DevelopmentSection
                deal={deal}
                enhanced={hasZoningModule}
                onToggleModule={() => setHasZoningModule(!hasZoningModule)}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Other sections... */}
    </div>
  );
};

/**
 * Example 3: Module Check with User Subscription
 * 
 * Check if the user has the Zoning Interpreter module active.
 */
export const WithModuleCheckExample: React.FC = () => {
  const [deal] = useState<Deal>({
    id: '789',
    name: 'Suburban Townhomes',
    projectType: 'Residential',
    tier: 'Standard',
    status: 'active',
    budget: 3000000,
    boundary: null,
    acres: 1.8,
    propertyCount: 1,
    pendingTasks: 5,
    createdAt: new Date().toISOString(),
    isDevelopment: true,
  });

  // Mock function - replace with actual module check
  const checkUserHasModule = (moduleName: string): boolean => {
    // Example: Check from user context or subscription API
    const userModules = ['map', 'properties', 'zoning']; // From user.subscription.modules
    return userModules.includes(moduleName);
  };

  const hasZoningModule = checkUserHasModule('zoning');

  const handleUpgradeModule = () => {
    console.log('Redirect to upgrade page or open modal');
    // Navigate to: /billing/upgrade?module=zoning
    // Or open a modal to purchase the module
  };

  if (!deal.isDevelopment) {
    return null;
  }

  return (
    <DevelopmentSection
      deal={deal}
      enhanced={hasZoningModule}
      onToggleModule={handleUpgradeModule}
    />
  );
};

/**
 * Example 4: Mock API Response
 * 
 * Example of what the backend API should return for capacity analysis.
 */
export const mockCapacityAnalysisResponse = {
  parcelId: '123',
  districtCode: 'R-4',
  districtName: 'Residential Medium Density',
  
  // Capacity metrics
  maxUnits: 120,
  maxUnitsByRight: true,
  
  // Physical constraints
  maxHeightFt: 75,
  maxStories: 6,
  lotCoveragePercent: 60,
  lotCoverageSqft: 80000,
  availableCoverageSqft: 48000,
  
  // Parking
  parkingRequired: 180,
  parkingRatio: 1.5,
  
  // Setbacks
  setbacks: {
    frontFt: 20,
    sideFt: 10,
    rearFt: 15,
  },
  
  // Compliance
  complianceChecks: [
    {
      item: 'Height Compliance',
      status: 'compliant',
      message: 'Proposed height of 72 feet meets maximum requirement of 75 feet',
      details: 'Reference: Section 12.04.050(A)',
    },
    {
      item: 'Parking Requirement',
      status: 'warning',
      message: 'Proposed 175 spaces slightly below required 180 spaces',
      details: 'Consider requesting a parking reduction or adding 5 spaces',
    },
    {
      item: 'Lot Coverage',
      status: 'compliant',
      message: 'Building footprint of 45,000 sqft within 48,000 sqft limit',
    },
    {
      item: 'Front Setback',
      status: 'violation',
      message: 'Proposed 15-foot setback violates required 20-foot minimum',
      details: 'Variance or design modification required',
    },
  ],
  overallCompliance: 'warning',
  
  // Recommendations
  recommendations: [
    'Consider reducing building footprint by 5% to provide buffer for lot coverage',
    'Request parking reduction from planning department citing transit proximity',
    'Modify site plan to achieve 20-foot front setback or pursue variance',
    'Schedule pre-application meeting to discuss setback concerns',
    'Consider stacked parking or mechanical systems to maximize space',
  ],
  
  // References
  zoningReferences: [
    {
      section: '12.04.050',
      title: 'R-4 District Height Regulations',
      url: 'https://library.municode.com/example/12.04.050',
    },
    {
      section: '12.04.060',
      title: 'Parking Requirements - Residential',
      url: 'https://library.municode.com/example/12.04.060',
    },
    {
      section: '12.04.070',
      title: 'Setback Standards',
      url: 'https://library.municode.com/example/12.04.070',
    },
  ],
  
  lotSizeSqft: 80000,
  analysisDate: new Date().toISOString(),
};

/**
 * Example 5: Integration in Deal Page Router
 * 
 * How to conditionally render in your main deal page.
 */
export const DealPageIntegrationExample: React.FC = () => {
  const [deal] = useState<Deal>({
    id: '999',
    name: 'Example Development Project',
    projectType: 'Commercial',
    tier: 'Premium',
    status: 'active',
    budget: 8000000,
    boundary: null,
    acres: 3.2,
    propertyCount: 2,
    pendingTasks: 10,
    createdAt: new Date().toISOString(),
    isDevelopment: true,
  });

  const [hasZoningModule] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', name: 'Overview', icon: '📋', always: true },
    { id: 'properties', name: 'Properties', icon: '🏠', always: true },
    { id: 'financial', name: 'Financial Analysis', icon: '💰', always: true },
    { id: 'strategy', name: 'Strategy', icon: '🎯', always: true },
    { id: 'development', name: 'Development', icon: '🏗️', condition: deal.isDevelopment },
    { id: 'documents', name: 'Documents', icon: '📄', always: true },
  ].filter(section => section.always || section.condition);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <h2 className="font-bold text-lg mb-4">{deal.name}</h2>
        <nav className="space-y-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                activeSection === section.id
                  ? 'bg-blue-100 text-blue-600 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="mr-2">{section.icon}</span>
              {section.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeSection === 'development' && deal.isDevelopment && (
          <DevelopmentSection
            deal={deal}
            enhanced={hasZoningModule}
            onToggleModule={() => console.log('Toggle module')}
          />
        )}
        {/* Other section content... */}
      </div>
    </div>
  );
};
