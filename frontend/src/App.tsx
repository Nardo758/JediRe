import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorFallback } from './components/fallbacks/ErrorFallback';
import { PageLoadingFallback } from './components/fallbacks/PageLoadingFallback';
import { Dashboard } from './pages/Dashboard';
import { PropertiesPage } from './pages/PropertiesPage';
import { DealsPage } from './pages/DealsPage';
import { DealView } from './pages/DealView';
import { DealPage } from './pages/DealPage';
import { DealPageEnhanced } from './pages/DealPageEnhanced';
import { CreateDealPage } from './pages/CreateDealPage';
import { EmailPage } from './pages/EmailPage';
import { NewsPage } from './pages/NewsPage';
import { NewsIntelligencePage } from './pages/NewsIntelligencePage';
import { TasksPage } from './pages/TasksPage';
import { ReportsPage } from './pages/ReportsPage';
import { TeamPage } from './pages/TeamPage';
import { SystemArchitecturePage } from './pages/SystemArchitecturePage';
import { SettingsPage } from './pages/SettingsPage';
import { ModuleMarketplacePage } from './pages/ModuleMarketplacePage';

// Lazy-load map-heavy components to reduce initial bundle size
const MapPage = lazy(() => import('./pages/MapPage').then(m => ({ default: m.MapPage })));
const Design3DPage = lazy(() => import('./pages/Design3DPage.updated').then(m => ({ default: m.Design3DPage })));
const AssetsOwnedPage = lazy(() => import('./pages/AssetsOwnedPage').then(m => ({ default: m.AssetsOwnedPage })));
import { ModulesPage } from './pages/settings/ModulesPage';
import { ModuleLibrariesPage } from './pages/settings/ModuleLibrariesPage';
import { ModuleLibraryDetailPage } from './pages/settings/ModuleLibraryDetailPage';
import { EmailSettings } from './pages/settings/EmailSettings';
import { DashboardContentsPage } from './pages/DashboardContentsPage';
import AuthPage from './pages/AuthPage';
import { ShowcaseLandingPage } from './pages/ShowcaseLandingPage';
import { DealShowcasePage } from './pages/DealShowcasePage';
import { ModuleShowcasePage } from './pages/ModuleShowcasePage';
import { ArchitectureProvider, useArchitecture } from './contexts/ArchitectureContext';
import { ArchitectureOverlay } from './components/ArchitectureOverlay';
import { MapLayersProvider } from './contexts/MapLayersContext';
import { PropertyCoveragePage } from './pages/admin/PropertyCoveragePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { DataTrackerPage } from './pages/admin/DataTrackerPage';
import { CommandCenterPage } from './pages/admin/CommandCenterPage';
import DealDetailPage from './pages/DealDetailPage';
import DealCapsulesPage from './pages/DealCapsulesPage';
import CapsuleDetailPage from './pages/CapsuleDetailPage';
import { LeasingForecastPage } from './pages/LeasingForecastPage';
import DealFlywheelDashboard from './pages/deal/DealFlywheelDashboard';
import PortfolioPropertyPage from './pages/PortfolioPropertyPage';
import { M28WidgetsDemo } from './pages/demo/M28WidgetsDemo';
import PropertyDetailsPage from './pages/PropertyDetailsPage';
import {
  MarketIntelligencePage,
  MyMarketsDashboard,
  CompareMarketsPage,
  ActiveOwnersPage,
  FutureSupplyPage,
  TrafficIntelligencePage,
  CompetitivePositionPage,
} from './pages/MarketIntelligence';
import {
  CompetitiveIntelligencePage,
  PerformanceRankingsPage,
  AcquisitionIntelPage,
  CompAnalysisPage,
  OpportunityAlertsPage,
} from './pages/CompetitiveIntelligence';
import { StrategyBuilderPage } from './pages/StrategyBuilderPage';


function AppContent() {
  const { isOpen, currentInfo, closeArchitecture } = useArchitecture();

  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        
        {/* Showcase Routes (No Layout) */}
        <Route path="/showcase" element={<ShowcaseLandingPage />} />
        <Route path="/showcase/deal/:dealId" element={<DealShowcasePage />} />
        <Route path="/showcase/modules" element={<ModuleShowcasePage />} />
        <Route path="/showcase/modules/:moduleId" element={<ModuleShowcasePage />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/map" element={
            <Suspense fallback={<PageLoadingFallback />}>
              <MapPage />
            </Suspense>
          } />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/contents" element={<DashboardContentsPage />} />
          <Route path="/dashboard/email" element={<EmailPage />} />
          <Route path="/dashboard/email/sent" element={<EmailPage />} />
          <Route path="/dashboard/email/drafts" element={<EmailPage />} />
          <Route path="/dashboard/email/flagged" element={<EmailPage />} />
          <Route path="/strategy-builder" element={<StrategyBuilderPage />} />
          <Route path="/strategy-builder/:id" element={<StrategyBuilderPage />} />
          <Route path="/news-intel" element={<NewsIntelligencePage />} />
          <Route path="/news-intel/dashboard" element={<Navigate to="/news-intel" replace />} />
          <Route path="/news-intel/network" element={<Navigate to="/news-intel" replace />} />
          <Route path="/news-intel/alerts" element={<Navigate to="/news-intel" replace />} />
          <Route path="/market-data" element={<Navigate to="/market-intelligence" replace />} />
          <Route path="/market-data/comparables" element={<Navigate to="/market-intelligence" replace />} />
          <Route path="/market-data/demographics" element={<Navigate to="/market-intelligence" replace />} />
          <Route path="/market-data/supply-demand" element={<Navigate to="/market-intelligence" replace />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/assets-owned" element={
            <Suspense fallback={<PageLoadingFallback />}>
              <AssetsOwnedPage />
            </Suspense>
          } />
          <Route path="/assets-owned/:dealId/property" element={<PortfolioPropertyPage />} />
          <Route path="/assets-owned/performance" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/assets-owned/documents" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/assets-owned/grid" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/:id" element={<PropertyDetailsPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/command-center" element={<CommandCenterPage />} />
          <Route path="/admin/property-coverage" element={<PropertyCoveragePage />} />
          <Route path="/admin/data-tracker" element={<DataTrackerPage />} />
          <Route path="/admin/intelligence" element={
            <Suspense fallback={<PageLoadingFallback />}>
              {React.createElement(
                React.lazy(() => import('./pages/admin/IntelligenceDashboard').then(m => ({ default: m.IntelligenceDashboard })))
              )}
            </Suspense>
          } />
          
          {/* Market Research Redirects */}
          <Route path="/market-research" element={<Navigate to="/market-intelligence" replace />} />
          <Route path="/market-research/active-owners" element={<Navigate to="/market-intelligence/owners" replace />} />
          <Route path="/market-research/future-supply" element={<Navigate to="/market-intelligence/supply" replace />} />
          
          {/* Market Intelligence */}
          <Route path="/market-intelligence" element={<MarketIntelligencePage />} />
          <Route path="/market-intelligence/markets/:marketId" element={<MyMarketsDashboard />} />
          <Route path="/market-intelligence/property/:id" element={<PropertyDetailsPage />} />
          <Route path="/market-intelligence/compare" element={<CompareMarketsPage />} />
          <Route path="/market-intelligence/owners" element={<ActiveOwnersPage />} />
          <Route path="/market-intelligence/supply" element={<FutureSupplyPage />} />
          <Route path="/market-intelligence/traffic-intelligence" element={<TrafficIntelligencePage />} />
          <Route path="/market-intelligence/competitive-position" element={<CompetitivePositionPage />} />

          {/* Competitive Intelligence */}
          <Route path="/competitive-intelligence" element={<Navigate to="/competitive-intelligence/performance" replace />} />
          <Route path="/competitive-intelligence/performance" element={<PerformanceRankingsPage />} />
          <Route path="/competitive-intelligence/acquisition" element={<AcquisitionIntelPage />} />
          <Route path="/competitive-intelligence/comps" element={<CompAnalysisPage />} />
          <Route path="/competitive-intelligence/alerts" element={<OpportunityAlertsPage />} />
          
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/create" element={<CreateDealPage />} />
          <Route path="/deals/:dealId/design" element={
            <Suspense fallback={<PageLoadingFallback />}>
              <Design3DPage />
            </Suspense>
          } />
          <Route path="/deals/kanban" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/grid" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/active" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/closed" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/:dealId/detail" element={<DealDetailPage />} />
          <Route path="/deals/:dealId/view" element={<DealPage />} />
          <Route path="/deals/:dealId/enhanced" element={<DealPageEnhanced />} />
          <Route path="/deals/:dealId/flywheel" element={<DealFlywheelDashboard />} />
          <Route path="/deals/:id" element={<DealView />} />
          <Route path="/deals/:id/:module" element={<DealView />} />
          <Route path="/capsules" element={<DealCapsulesPage />} />
          <Route path="/capsules/:id" element={<CapsuleDetailPage />} />
          <Route path="/leasing-forecast/:propertyId" element={<LeasingForecastPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/architecture" element={<SystemArchitecturePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/modules" element={<ModulesPage />} />
          <Route path="/settings/module-libraries" element={<ModuleLibrariesPage />} />
          <Route path="/settings/module-libraries/:module" element={<ModuleLibraryDetailPage />} />
          <Route path="/settings/email" element={<EmailSettings />} />
          <Route path="/settings/marketplace" element={<ModuleMarketplacePage />} />

          {/* Strategy Builder */}
          <Route path="/strategies" element={<StrategyBuilderPage />} />
          <Route path="/strategies/:id" element={<StrategyBuilderPage />} />

          {/* Demo Routes */}
          <Route path="/demo/m28-widgets" element={<M28WidgetsDemo />} />
          <Route path="/demo/flywheel" element={<DealFlywheelDashboard />} />
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      
      {currentInfo && (
        <ArchitectureOverlay
          isOpen={isOpen}
          onClose={closeArchitecture}
          info={currentInfo}
        />
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ArchitectureProvider>
        <MapLayersProvider>
          <AppContent />
        </MapLayersProvider>
      </ArchitectureProvider>
    </ErrorBoundary>
  );
}

export default App;
