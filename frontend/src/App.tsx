import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { MapPage } from './pages/MapPage';
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
import { AssetsOwnedPage } from './pages/AssetsOwnedPage';
import { ModuleMarketplacePage } from './pages/ModuleMarketplacePage';
import { ModulesPage } from './pages/settings/ModulesPage';
import { ModuleLibrariesPage } from './pages/settings/ModuleLibrariesPage';
import { ModuleLibraryDetailPage } from './pages/settings/ModuleLibraryDetailPage';
import { EmailSettings } from './pages/settings/EmailSettings';
import { DashboardContentsPage } from './pages/DashboardContentsPage';
import AuthPage from './pages/AuthPage';
import { ArchitectureProvider, useArchitecture } from './contexts/ArchitectureContext';
import { ArchitectureOverlay } from './components/ArchitectureOverlay';
import { MapLayersProvider } from './contexts/MapLayersContext';
import { ShowcaseLandingPage } from './pages/ShowcaseLandingPage';
import { DealShowcasePage } from './pages/DealShowcasePage';
import { ModuleShowcasePage } from './pages/ModuleShowcasePage';
import { PropertyCoveragePage } from './pages/admin/PropertyCoveragePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import DealCapsulesPage from './pages/DealCapsulesPage';
import CapsuleDetailPage from './pages/CapsuleDetailPage';
import { LeasingForecastPage } from './pages/LeasingForecastPage';
import ActiveOwnersPage from './pages/ActiveOwnersPage';
import FutureSupplyPage from './pages/FutureSupplyPage';
import { MyMarketsOverview, MarketComparison, MarketDeepDive } from './pages/MarketIntelligence';
import { Design3DPageEnhanced } from './pages/Design3DPage.enhanced';


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
          <Route path="/map" element={<MapPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/contents" element={<DashboardContentsPage />} />
          <Route path="/dashboard/email" element={<EmailPage />} />
          <Route path="/dashboard/email/sent" element={<EmailPage />} />
          <Route path="/dashboard/email/drafts" element={<EmailPage />} />
          <Route path="/dashboard/email/flagged" element={<EmailPage />} />
          <Route path="/news-intel" element={<NewsIntelligencePage />} />
          <Route path="/news-intel/dashboard" element={<Navigate to="/news-intel" replace />} />
          <Route path="/news-intel/network" element={<Navigate to="/news-intel" replace />} />
          <Route path="/news-intel/alerts" element={<Navigate to="/news-intel" replace />} />
          <Route path="/market-data" element={<Navigate to="/markets" replace />} />
          <Route path="/market-data/comparables" element={<Navigate to="/markets" replace />} />
          <Route path="/market-data/demographics" element={<Navigate to="/markets" replace />} />
          <Route path="/market-data/supply-demand" element={<Navigate to="/markets" replace />} />
          <Route path="/market-research" element={<Navigate to="/markets" replace />} />
          <Route path="/market-research/active-owners" element={<ActiveOwnersPage />} />
          <Route path="/market-research/active-owners/:name" element={<ActiveOwnersPage />} />
          <Route path="/market-research/future-supply" element={<FutureSupplyPage />} />
          <Route path="/markets" element={<MyMarketsOverview />} />
          <Route path="/markets/compare" element={<MarketComparison />} />
          <Route path="/markets/:marketId" element={<MarketDeepDive />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/assets-owned" element={<AssetsOwnedPage />} />
          <Route path="/assets-owned/performance" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/assets-owned/documents" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/assets-owned/grid" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/property-coverage" element={<PropertyCoveragePage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/create" element={<CreateDealPage />} />
          <Route path="/deals/kanban" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/grid" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/active" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/closed" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/:dealId/view" element={<DealPage />} />
          <Route path="/deals/:dealId/enhanced" element={<DealPageEnhanced />} />
          <Route path="/deals/:dealId/design" element={<Design3DPageEnhanced />} />
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
    <ArchitectureProvider>
      <MapLayersProvider>
        <AppContent />
      </MapLayersProvider>
    </ArchitectureProvider>
  );
}

export default App;
