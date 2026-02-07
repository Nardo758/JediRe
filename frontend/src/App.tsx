import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { MapPage } from './pages/MapPage';
import { Dashboard } from './pages/Dashboard';
import { PropertiesPage } from './pages/PropertiesPage';
import { DealsPage } from './pages/DealsPage';
import { DealView } from './pages/DealView';
import { EmailPage } from './pages/EmailPage';
import { ReportsPage } from './pages/ReportsPage';
import { TeamPage } from './pages/TeamPage';
import { SystemArchitecturePage } from './pages/SystemArchitecturePage';
import { SettingsPage } from './pages/SettingsPage';
import AuthPage from './pages/AuthPage';
import { ArchitectureProvider, useArchitecture } from './contexts/ArchitectureContext';
import { ArchitectureOverlay } from './components/ArchitectureOverlay';

function AppContent() {
  const { isOpen, currentInfo, closeArchitecture } = useArchitecture();

  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/*" element={
          <MainLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/properties" element={<PropertiesPage />} />
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/deals/:id" element={<DealView />} />
              <Route path="/deals/:id/:module" element={<DealView />} />
              <Route path="/email" element={<EmailPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/architecture" element={<SystemArchitecturePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </MainLayout>
        } />
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
      <AppContent />
    </ArchitectureProvider>
  );
}

export default App;
