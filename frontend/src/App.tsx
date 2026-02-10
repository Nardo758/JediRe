import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { MapPage } from './pages/MapPage';
import { Dashboard } from './pages/Dashboard';
import { PropertiesPage } from './pages/PropertiesPage';
import { DealsPage } from './pages/DealsPage';
import { DealView } from './pages/DealView';
import { DealPage } from './pages/DealPage';
import { CreateDealPage } from './pages/CreateDealPage';
import { EmailPage } from './pages/EmailPage';
import { NewsPage } from './pages/NewsPage';
import { NewsIntelligencePage } from './pages/NewsIntelligencePage';
import { TasksPage } from './pages/TasksPage';
import { ReportsPage } from './pages/ReportsPage';
import { TeamPage } from './pages/TeamPage';
import { SystemArchitecturePage } from './pages/SystemArchitecturePage';
import { SettingsPage } from './pages/SettingsPage';
import { MarketDataPage } from './pages/MarketDataPage';
import { AssetsOwnedPage } from './pages/AssetsOwnedPage';
import { ModuleMarketplacePage } from './pages/ModuleMarketplacePage';
import { ModulesPage } from './pages/settings/ModulesPage';
import { DashboardContentsPage } from './pages/DashboardContentsPage';
import AuthPage from './pages/AuthPage';
import { ArchitectureProvider, useArchitecture } from './contexts/ArchitectureContext';
import { ArchitectureOverlay } from './components/ArchitectureOverlay';
import { MapLayersProvider } from './contexts/MapLayersContext';


function AppContent() {
  const { isOpen, currentInfo, closeArchitecture } = useArchitecture();

  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
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
          <Route path="/market-data" element={<MarketDataPage />} />
          <Route path="/market-data/comparables" element={<Navigate to="/market-data" replace />} />
          <Route path="/market-data/demographics" element={<Navigate to="/market-data" replace />} />
          <Route path="/market-data/supply-demand" element={<Navigate to="/market-data" replace />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/assets-owned" element={<AssetsOwnedPage />} />
          <Route path="/assets-owned/performance" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/assets-owned/documents" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/assets-owned/grid" element={<Navigate to="/assets-owned" replace />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/create" element={<CreateDealPage />} />
          <Route path="/deals/kanban" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/grid" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/active" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/closed" element={<Navigate to="/deals" replace />} />
          <Route path="/deals/:dealId/view" element={<DealPage />} />
          <Route path="/deals/:id" element={<DealView />} />
          <Route path="/deals/:id/:module" element={<DealView />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/architecture" element={<SystemArchitecturePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/modules" element={<ModulesPage />} />
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
