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
import { PipelineGridPage } from './pages/PipelineGridPage';
import { AssetsOwnedGridPage } from './pages/AssetsOwnedGridPage';
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
          <Route path="/dashboard/email/sent" element={<EmailPage />} />
          <Route path="/dashboard/email/drafts" element={<EmailPage />} />
          <Route path="/dashboard/email/flagged" element={<EmailPage />} />
          <Route path="/dashboard/news" element={<NewsIntelligencePage />} />
          <Route path="/dashboard/news/dashboard" element={<NewsIntelligencePage />} />
          <Route path="/dashboard/news/network" element={<NewsIntelligencePage />} />
          <Route path="/dashboard/news/alerts" element={<NewsIntelligencePage />} />
          <Route path="/market-data" element={<MarketDataPage />} />
          <Route path="/market-data/comparables" element={<MarketDataPage />} />
          <Route path="/market-data/demographics" element={<MarketDataPage />} />
          <Route path="/market-data/supply-demand" element={<MarketDataPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/assets-owned" element={<AssetsOwnedPage />} />
          <Route path="/assets-owned/performance" element={<AssetsOwnedPage />} />
          <Route path="/assets-owned/documents" element={<AssetsOwnedPage />} />
          <Route path="/assets-owned/grid" element={<AssetsOwnedGridPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/grid" element={<PipelineGridPage />} />
          <Route path="/deals/active" element={<DealsPage />} />
          <Route path="/deals/closed" element={<DealsPage />} />
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
