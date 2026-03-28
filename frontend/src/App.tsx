import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorFallback } from './components/fallbacks/ErrorFallback';
import { PageLoadingFallback } from './components/fallbacks/PageLoadingFallback';
import { PropertiesPage } from './pages/PropertiesPage';
import { DealsPage } from './pages/DealsPage';
import { CreateDealPage } from './pages/CreateDealPage';
import { NewsPage } from './pages/NewsPage';
import { SystemArchitecturePage } from './pages/SystemArchitecturePage';

const Design3DPage = lazy(() => import('./pages/Design3DPage').then(m => ({ default: m.Design3DPage })));
import AuthPage from './pages/AuthPage';
import { ShowcaseLandingPage } from './pages/ShowcaseLandingPage';
import { DealShowcasePage } from './pages/DealShowcasePage';
import { ModuleShowcasePage } from './pages/ModuleShowcasePage';
import { ArchitectureProvider, useArchitecture } from './contexts/ArchitectureContext';
import { ArchitectureOverlay } from './components/ArchitectureOverlay';
import { MapLayersProvider } from './contexts/MapLayersContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PropertyCoveragePage } from './pages/admin/PropertyCoveragePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { DataTrackerPage } from './pages/admin/DataTrackerPage';
import { CommandCenterPage } from './pages/admin/CommandCenterPage';
import AdminToolsPage from './pages/admin/AdminToolsPage';
import DealDetailPage from './pages/DealDetailPage';
import DealCapsulesPage from './pages/DealCapsulesPage';
import CapsuleDetailPage from './pages/CapsuleDetailPage';
import { LeasingForecastPage } from './pages/LeasingForecastPage';
import DealFlywheelDashboard from './pages/deal/DealFlywheelDashboard';
import PortfolioPropertyPage from './pages/PortfolioPropertyPage';
import { M28WidgetsDemo } from './pages/demo/M28WidgetsDemo';
import PropertyDetailsPage from './pages/PropertyDetailsPage';
import { BloombergMarketDetail } from './pages/MarketIntelligence';
import WatchlistPage from './pages/MarketIntelligence/WatchlistPage';
import TerminalPage from './pages/TerminalPage';
const F4CommentarySpecPage = lazy(() => import('./pages/docs/F4CommentarySpecPage'));
const PropertyCardPage = lazy(() => import('./pages/PropertyCardPage'));

/**
 * Redirect legacy /deals/:id/:module routes to /deals/:id/detail?tab=:module
 * Maps old module names to tab equivalents for backward compatibility
 */
const RedirectDealViewToTab: React.FC = () => {
  const { id, module } = useParams<{ id: string; module: string }>();
  if (!id || !module) return <Navigate to="/deals" replace />;

  // Map old module names to tab names (if needed)
  const tabMap: Record<string, string> = {
    'map': 'map',
    'overview': 'overview',
    'property': 'property',
    'market': 'market',
    'supply': 'supply',
    'strategy': 'strategy',
    'proforma': 'proforma',
    'capital': 'capital',
    'risk': 'risk',
    'comps': 'comps',
    'traffic': 'traffic',
    'documents': 'documents',
  };

  const tab = tabMap[module] || module;
  return <Navigate to={`/deals/${id}/detail?tab=${tab}`} replace />;
};

function DealIdRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/deals/${id}/detail`} replace />;
}

function DealIdRedirectByDealId() {
  const { dealId } = useParams<{ dealId: string }>();
  return <Navigate to={`/deals/${dealId}/detail`} replace />;
}

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

        {/* Root — redirect to terminal */}
        <Route path="/" element={<Navigate to="/terminal/dashboard" replace />} />

        {/* Terminal — full-page Bloomberg layout */}
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/terminal/:section" element={<TerminalPage />} />

        <Route path="/docs/f4-commentary-spec" element={<Suspense fallback={<PageLoadingFallback />}><F4CommentarySpecPage /></Suspense>} />

        {/* Bloomberg Market Intelligence */}
        <Route path="/market-intelligence" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-intelligence/markets/:marketId" element={<BloombergMarketDetail />} />
        <Route path="/market-intelligence/watchlist" element={<WatchlistPage />} />

        {/* ═══ Standalone pages — unique content, no layout chrome ═══ */}
        <Route path="/news" element={<NewsPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:id" element={<PropertyDetailsPage />} />
        <Route path="/market-intelligence/property/:id" element={<PropertyDetailsPage />} />
        <Route path="/capsules" element={<DealCapsulesPage />} />
        <Route path="/capsules/:id" element={<CapsuleDetailPage />} />
        <Route path="/leasing-forecast/:propertyId" element={<LeasingForecastPage />} />
        <Route path="/assets-owned/:dealId/property" element={<PortfolioPropertyPage />} />
        <Route path="/property-card" element={<Suspense fallback={<PageLoadingFallback />}><PropertyCardPage /></Suspense>} />
        <Route path="/property-card/:id" element={<Suspense fallback={<PageLoadingFallback />}><PropertyCardPage /></Suspense>} />

        {/* ═══ Deal workflow pages — own internal nav, no layout chrome ═══ */}
        <Route path="/deals/create" element={<CreateDealPage />} />
        <Route path="/deals/:dealId/detail" element={<DealDetailPage />} />
        <Route path="/deals/:dealId/flywheel" element={<DealFlywheelDashboard />} />
        <Route path="/deals/:dealId/design" element={
          <Suspense fallback={<PageLoadingFallback />}>
            <Design3DPage />
          </Suspense>
        } />

        {/* ═══ Redirects — legacy routes → terminal ═══ */}
        <Route path="/dashboard" element={<Navigate to="/terminal/dashboard" replace />} />
        <Route path="/dashboard/contents" element={<Navigate to="/terminal/dashboard" replace />} />
        <Route path="/dashboard/email" element={<Navigate to="/terminal/dashboard" replace />} />
        <Route path="/dashboard/email/sent" element={<Navigate to="/terminal/dashboard" replace />} />
        <Route path="/dashboard/email/drafts" element={<Navigate to="/terminal/dashboard" replace />} />
        <Route path="/dashboard/email/flagged" element={<Navigate to="/terminal/dashboard" replace />} />
        <Route path="/map" element={<Navigate to="/terminal/dashboard" replace />} />
        <Route path="/strategy-builder" element={<Navigate to="/terminal/strategies" replace />} />
        <Route path="/strategy-builder/:id" element={<Navigate to="/terminal/strategies" replace />} />
        <Route path="/news-intel" element={<Navigate to="/terminal/news" replace />} />
        <Route path="/news-intel/dashboard" element={<Navigate to="/terminal/news" replace />} />
        <Route path="/news-intel/network" element={<Navigate to="/terminal/news" replace />} />
        <Route path="/news-intel/alerts" element={<Navigate to="/terminal/news" replace />} />
        <Route path="/market-data" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-data/comparables" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-data/demographics" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-data/supply-demand" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/assets-owned" element={<Navigate to="/terminal/portfolio" replace />} />
        <Route path="/assets-owned/performance" element={<Navigate to="/terminal/portfolio" replace />} />
        <Route path="/assets-owned/documents" element={<Navigate to="/terminal/portfolio" replace />} />
        <Route path="/assets-owned/grid" element={<Navigate to="/terminal/portfolio" replace />} />
        <Route path="/market-research" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-research/active-owners" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-research/future-supply" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-intelligence/compare" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-intelligence/owners" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-intelligence/supply" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-intelligence/traffic-intelligence" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/market-intelligence/competitive-position" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/competitive-intelligence" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/competitive-intelligence/performance" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/competitive-intelligence/acquisition" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/competitive-intelligence/comps" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/competitive-intelligence/alerts" element={<Navigate to="/terminal/markets" replace />} />
        <Route path="/settings" element={<Navigate to="/terminal/settings" replace />} />
        <Route path="/settings/modules" element={<Navigate to="/terminal/settings" replace />} />
        <Route path="/settings/module-libraries" element={<Navigate to="/terminal/settings" replace />} />
        <Route path="/settings/module-libraries/:module" element={<Navigate to="/terminal/settings" replace />} />
        <Route path="/settings/email" element={<Navigate to="/terminal/settings" replace />} />
        <Route path="/settings/marketplace" element={<Navigate to="/terminal/settings" replace />} />
        <Route path="/settings/strategies" element={<Navigate to="/terminal/settings" replace />} />
        <Route path="/settings/agents" element={<Navigate to="/terminal/settings?tab=agents" replace />} />
        <Route path="/strategies" element={<Navigate to="/terminal/strategies" replace />} />
        <Route path="/strategies/:id" element={<Navigate to="/terminal/strategies" replace />} />
        <Route path="/opportunities" element={<Navigate to="/terminal/strategies" replace />} />
        <Route path="/tasks" element={<Navigate to="/terminal/reports" replace />} />
        <Route path="/reports" element={<Navigate to="/terminal/reports" replace />} />
        <Route path="/team" element={<Navigate to="/terminal/settings" replace />} />

        {/* Deal sub-route redirects */}
        <Route path="/deals/kanban" element={<Navigate to="/deals" replace />} />
        <Route path="/deals/grid" element={<Navigate to="/deals" replace />} />
        <Route path="/deals/active" element={<Navigate to="/deals" replace />} />
        <Route path="/deals/closed" element={<Navigate to="/deals" replace />} />
        <Route path="/deals/:dealId/view" element={<DealIdRedirectByDealId />} />
        <Route path="/deals/:dealId/enhanced" element={<DealIdRedirectByDealId />} />
        <Route path="/deals/:id" element={<DealIdRedirect />} />
        <Route path="/deals/:id/:module" element={<RedirectDealViewToTab />} />

        {/* ═══ Admin Tools — standalone (has own layout chrome) ═══ */}
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
        <Route path="/admin/*" element={<AdminToolsPage />} />

        {/* ═══ Dev/demo pages — keep in MainLayout ═══ */}
        <Route element={<MainLayout />}>
          <Route path="/architecture" element={<SystemArchitecturePage />} />
          <Route path="/demo/m28-widgets" element={<M28WidgetsDemo />} />
          <Route path="/demo/flywheel" element={<DealFlywheelDashboard />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/terminal/dashboard" replace />} />
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
      <ThemeProvider>
        <ArchitectureProvider>
          <MapLayersProvider>
            <AppContent />
          </MapLayersProvider>
        </ArchitectureProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
