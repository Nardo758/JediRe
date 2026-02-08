import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { MapPage } from './pages/MapPage';
import { Dashboard } from './pages/Dashboard';
import { PropertiesPage } from './pages/PropertiesPage';
import { DealsPage } from './pages/DealsPage';
import { DealView } from './pages/DealView';
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
          <Route path="/dashboard/email" element={<EmailPage />} />
          <Route path="/dashboard/email/sent" element={<EmailPage view="sent" />} />
          <Route path="/dashboard/email/drafts" element={<EmailPage view="drafts" />} />
          <Route path="/dashboard/email/flagged" element={<EmailPage view="flagged" />} />
          <Route path="/dashboard/news" element={<NewsIntelligencePage view="feed" />} />
          <Route path="/dashboard/news/dashboard" element={<NewsIntelligencePage view="dashboard" />} />
          <Route path="/dashboard/news/network" element={<NewsIntelligencePage view="network" />} />
          <Route path="/dashboard/news/alerts" element={<NewsIntelligencePage view="alerts" />} />
          <Route path="/market-data" element={<MarketDataPage />} />
          <Route path="/market-data/comparables" element={<MarketDataPage view="comparables" />} />
          <Route path="/market-data/demographics" element={<MarketDataPage view="demographics" />} />
          <Route path="/market-data/supply-demand" element={<MarketDataPage view="supply-demand" />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/assets-owned" element={<AssetsOwnedPage />} />
          <Route path="/assets-owned/performance" element={<AssetsOwnedPage view="performance" />} />
          <Route path="/assets-owned/documents" element={<AssetsOwnedPage view="documents" />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/grid" element={<DealsPage view="grid" />} />
          <Route path="/deals/active" element={<DealsPage view="active" />} />
          <Route path="/deals/closed" element={<DealsPage view="closed" />} />
          <Route path="/deals/:id" element={<DealView />} />
          <Route path="/deals/:id/:module" element={<DealView />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/architecture" element={<SystemArchitecturePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/modules" element={<ModuleMarketplacePage />} />
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
