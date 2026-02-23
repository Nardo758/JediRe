/**
 * Example Route Configuration for Development Module
 * 
 * Add these routes to your main routing configuration
 * (typically in App.tsx or routes.tsx)
 */

import { Route } from 'react-router-dom';
import { ProjectTimelinePage } from './ProjectTimelinePage';

// Example 1: Basic route with deal ID parameter
export const developmentRoutes = (
  <>
    <Route 
      path="/development/:dealId/timeline" 
      element={<ProjectTimelinePage />} 
    />
    
    {/* Future routes for development module */}
    <Route 
      path="/development/:dealId/overview" 
      element={<DevelopmentOverviewPage />} 
    />
    <Route 
      path="/development/:dealId/diligence" 
      element={<DueDiligencePage />} 
    />
    <Route 
      path="/development/:dealId/construction" 
      element={<ConstructionProgressPage />} 
    />
  </>
);

// Example 2: With protected route wrapper
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export const protectedDevelopmentRoutes = (
  <Route element={<ProtectedRoute requiredRole="developer" />}>
    <Route 
      path="/development/:dealId/timeline" 
      element={<ProjectTimelinePage />} 
    />
  </Route>
);

// Example 3: Integration with existing deal routes
export const dealRoutesExtended = (
  <>
    {/* Existing deal routes */}
    <Route path="/deals/:dealId" element={<DealDetailPage />} />
    <Route path="/deals/:dealId/financial" element={<FinancialPage />} />
    
    {/* Add development routes */}
    <Route 
      path="/deals/:dealId/development/timeline" 
      element={<ProjectTimelinePage />} 
    />
  </>
);

// Example 4: Navigation helper
export const navigateToTimeline = (dealId: string, navigate: any) => {
  navigate(`/development/${dealId}/timeline`);
};

// Example 5: Breadcrumb configuration
export const timelineBreadcrumbs = [
  { label: 'Deals', path: '/deals' },
  { label: 'Deal Detail', path: '/deals/:dealId' },
  { label: 'Development Timeline', path: '/deals/:dealId/development/timeline' },
];

// Example 6: Tab navigation in DealDetailPage
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@/components/ui/Tabs';

export const DealDetailWithDevelopmentTab = ({ dealId }: { dealId: string }) => {
  return (
    <Tabs>
      <TabList>
        <Tab>Overview</Tab>
        <Tab>Financial</Tab>
        <Tab>Timeline</Tab> {/* New tab */}
        <Tab>Documents</Tab>
      </TabList>
      
      <TabPanels>
        <TabPanel>{/* Overview content */}</TabPanel>
        <TabPanel>{/* Financial content */}</TabPanel>
        <TabPanel>
          <ProjectTimelinePage />
        </TabPanel>
        <TabPanel>{/* Documents content */}</TabPanel>
      </TabPanels>
    </Tabs>
  );
};

// Example 7: Link from DealDetailPage
import { Link } from 'react-router-dom';

export const DealDetailActions = ({ dealId }: { dealId: string }) => {
  return (
    <div className="flex gap-3">
      <Link
        to={`/development/${dealId}/timeline`}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        📊 View Development Timeline
      </Link>
    </div>
  );
};

// Example 8: Menu item in navigation
export const developmentMenuItem = {
  id: 'development',
  label: 'Development',
  icon: '🏗️',
  path: '/development',
  children: [
    {
      id: 'timeline',
      label: 'Project Timeline',
      path: '/development/:dealId/timeline',
    },
    {
      id: 'diligence',
      label: 'Due Diligence',
      path: '/development/:dealId/diligence',
    },
    {
      id: 'construction',
      label: 'Construction Progress',
      path: '/development/:dealId/construction',
    },
  ],
};

// Example 9: Context provider for development data
import React, { createContext, useContext, useState, useEffect } from 'react';

interface DevelopmentContextType {
  timeline: any;
  milestones: any[];
  team: any[];
  loading: boolean;
  refetch: () => void;
}

const DevelopmentContext = createContext<DevelopmentContextType | undefined>(undefined);

export const DevelopmentProvider: React.FC<{ dealId: string; children: React.ReactNode }> = ({ 
  dealId, 
  children 
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDevelopmentData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/deals/${dealId}/development/timeline`);
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error('Failed to fetch development data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevelopmentData();
  }, [dealId]);

  return (
    <DevelopmentContext.Provider 
      value={{
        timeline: data?.timeline,
        milestones: data?.milestones || [],
        team: data?.team || [],
        loading,
        refetch: fetchDevelopmentData,
      }}
    >
      {children}
    </DevelopmentContext.Provider>
  );
};

export const useDevelopment = () => {
  const context = useContext(DevelopmentContext);
  if (!context) {
    throw new Error('useDevelopment must be used within DevelopmentProvider');
  }
  return context;
};

// Example 10: Usage with context
export const ProjectTimelinePageWithContext = () => {
  const { dealId } = useParams();
  
  return (
    <DevelopmentProvider dealId={dealId!}>
      <ProjectTimelinePage />
    </DevelopmentProvider>
  );
};
