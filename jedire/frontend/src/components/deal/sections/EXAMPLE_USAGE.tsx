/**
 * Example Usage of FinancialAnalysisSection
 * 
 * This file demonstrates how to integrate the FinancialAnalysisSection
 * component into a deal page.
 */

import React, { useState } from 'react';
import { FinancialAnalysisSection } from './FinancialAnalysisSection';
import { Deal } from '../../../types';

// Example: Integration in a Deal Page
export const DealFinancialPage: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock user ID - replace with actual auth context
  const userId = 'user-123';

  // Check if user has Financial Modeling Pro module
  // TODO: Replace with actual module checking logic
  const hasFinancialModelingPro = false; // checkModule(userId, 'financial-modeling-pro');

  React.useEffect(() => {
    // Fetch deal data
    fetchDeal(dealId).then(data => {
      setDeal(data);
      setLoading(false);
    });
  }, [dealId]);

  const handleModuleActivation = async () => {
    // Handle module purchase/activation
    console.log('Activating Financial Modeling Pro module...');
    
    // Example flow:
    // 1. Show payment modal
    // 2. Process payment
    // 3. Update user subscription
    // 4. Refresh component
    
    // For now, just show an alert
    alert('Module activation coming soon! This would open the payment modal.');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (!deal) {
    return <div className="text-center text-gray-600">Deal not found</div>;
  }

  return (
    <FinancialAnalysisSection
      deal={deal}
      enhanced={hasFinancialModelingPro}
      onToggleModule={handleModuleActivation}
    />
  );
};

// Mock fetch function - replace with actual API call
async function fetchDeal(dealId: string): Promise<Deal> {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: dealId,
        name: 'Sunset Gardens Apartments',
        projectType: 'Multifamily',
        tier: 'Premium',
        status: 'Active',
        budget: 5000000,
        boundary: null,
        acres: 2.5,
        propertyCount: 1,
        pendingTasks: 3,
        createdAt: new Date().toISOString(),
        dealValue: 4500000,
        dealType: 'acquisition',
        stage: 'due_diligence',
        propertyAddress: '123 Sunset Blvd, Los Angeles, CA'
      });
    }, 500);
  });
}

// Example: Standalone Module Upsell Banner Usage
import { ModuleUpsellBanner } from './ModuleUpsellBanner';

export const StandaloneUpsellExample: React.FC = () => {
  return (
    <div className="p-6">
      <ModuleUpsellBanner
        moduleName="Financial Modeling Pro"
        price="$29"
        benefits={[
          'Professional component builder',
          'Sensitivity analysis',
          'Monte Carlo simulation',
          'Export to Excel/PDF'
        ]}
        bundleInfo={{
          name: 'Developer Bundle',
          price: '$149',
          savings: '30%'
        }}
        onAddModule={() => console.log('Add module')}
        onUpgradeBundle={() => console.log('Upgrade to bundle')}
        onLearnMore={() => console.log('Learn more')}
      />
    </div>
  );
};

// Example: Integration with Router
import { Routes, Route } from 'react-router-dom';
import { PropertiesSection } from './PropertiesSection';
import { MarketAnalysisSection } from './MarketAnalysisSection';

export const DealRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/deals/:dealId">
        <Route path="overview" element={<div>Overview</div>} />
        <Route path="properties" element={<DealPropertiesPage dealId="deal-123" />} />
        <Route path="market" element={<DealMarketPage dealId="deal-123" />} />
        <Route path="financial" element={<DealFinancialPage dealId="deal-123" />} />
        <Route path="strategy" element={<div>Strategy</div>} />
      </Route>
    </Routes>
  );
};

// Example: Properties Section Integration
export const DealPropertiesPage: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user has Property Intelligence module
  const hasPropertyIntelligence = false; // checkModule(userId, 'property-intelligence');

  React.useEffect(() => {
    fetchDeal(dealId).then(data => {
      setDeal(data);
      setLoading(false);
    });
  }, [dealId]);

  const handleModuleActivation = async () => {
    console.log('Activating Property Intelligence module...');
    alert('Module activation coming soon! This would open the payment modal.');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (!deal) {
    return <div className="text-center text-gray-600">Deal not found</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Properties</h1>
      <PropertiesSection
        deal={deal}
        enhanced={hasPropertyIntelligence}
        onToggleModule={handleModuleActivation}
      />
    </div>
  );
};

// Example: Market Analysis Section Integration
export const DealMarketPage: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user has Market Signals module
  const hasMarketSignals = false; // checkModule(userId, 'market-signals');

  React.useEffect(() => {
    fetchDeal(dealId).then(data => {
      setDeal(data);
      setLoading(false);
    });
  }, [dealId]);

  const handleModuleActivation = async () => {
    console.log('Activating Market Signals module...');
    alert('Module activation coming soon! This would open the payment modal.');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (!deal) {
    return <div className="text-center text-gray-600">Deal not found</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Market Analysis</h1>
      <MarketAnalysisSection
        deal={deal}
        enhanced={hasMarketSignals}
        onToggleModule={handleModuleActivation}
      />
    </div>
  );
};
