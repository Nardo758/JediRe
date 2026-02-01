import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useIsMobile } from './hooks/useIsMobile';
import AuthPage from './pages/AuthPage';
import MainPage from './pages/MainPage';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import FeaturesPage from './pages/FeaturesPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import BlogPage from './pages/BlogPage';
import CaseStudiesPage from './pages/CaseStudiesPage';
import HelpCenterPage from './pages/HelpCenterPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import SecurityPage from './pages/SecurityPage';
import CareersPage from './pages/CareersPage';
import ApiDocsPage from './pages/ApiDocsPage';
import StatusPage from './pages/StatusPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PaymentResultPage from './pages/PaymentResultPage';
import PropertyComparisonPage from './pages/PropertyComparisonPage';
import DealPipelinePage from './pages/DealPipelinePage';
import CalculatorsPage from './pages/CalculatorsPage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';
import AlertsPage from './pages/AlertsPage';
import TeamManagementPage from './pages/TeamManagementPage';
import BillingPage from './pages/BillingPage';
import IntegrationsPage from './pages/IntegrationsPage';
import ReferralPage from './pages/ReferralPage';
import PartnerPortalPage from './pages/PartnerPortalPage';
import MarketReportsPage from './pages/MarketReportsPage';
import AcademyPage from './pages/AcademyPage';
import CommunityPage from './pages/CommunityPage';
import WebinarsPage from './pages/WebinarsPage';
import SuccessStoriesPage from './pages/SuccessStoriesPage';
import PressPage from './pages/PressPage';
import PartnerDirectoryPage from './pages/PartnerDirectoryPage';
import IntegrationsMarketplacePage from './pages/IntegrationsMarketplacePage';
import InvestorProfilePage from './pages/InvestorProfilePage';
import ReviewsPage from './pages/ReviewsPage';
import ChangelogPage from './pages/ChangelogPage';
import SitemapPage from './pages/SitemapPage';
import CookiesPage from './pages/CookiesPage';
import AccessibilityPage from './pages/AccessibilityPage';
import DmcaPage from './pages/DmcaPage';
import UnsubscribePage from './pages/UnsubscribePage';
import { MobileLayout } from './components/mobile';
import { Loader } from 'lucide-react';

function SettingsPageWrapper() {
  const navigate = useNavigate();
  return <SettingsPage onClose={() => navigate('/app')} />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-purple-50">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 text-primary-600 animate-spin" />
          <p className="text-gray-600 font-medium">Loading JediRe...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return isMobile ? <MobileLayout /> : <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/case-studies" element={<CaseStudiesPage />} />
      <Route path="/help" element={<HelpCenterPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/docs" element={<ApiDocsPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/auth" element={<AuthPage />} />
      
      {/* Utility Pages */}
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/payment" element={<PaymentResultPage />} />
      
      {/* Public Pages */}
      <Route path="/compare" element={<PropertyComparisonPage />} />
      <Route path="/pipeline" element={<DealPipelinePage />} />
      <Route path="/calculators" element={<CalculatorsPage />} />
      <Route path="/analytics" element={<AnalyticsDashboardPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/team" element={<TeamManagementPage />} />
      <Route path="/billing" element={<BillingPage />} />
      <Route path="/integrations" element={<IntegrationsPage />} />
      <Route path="/referral" element={<ReferralPage />} />
      <Route path="/partner-portal" element={<PartnerPortalPage />} />
      <Route path="/market-reports" element={<MarketReportsPage />} />
      <Route path="/academy" element={<AcademyPage />} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/webinars" element={<WebinarsPage />} />
      <Route path="/success-stories" element={<SuccessStoriesPage />} />
      <Route path="/press" element={<PressPage />} />
      <Route path="/partner-directory" element={<PartnerDirectoryPage />} />
      <Route path="/integrations-marketplace" element={<IntegrationsMarketplacePage />} />
      <Route path="/investor-profile" element={<InvestorProfilePage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/sitemap" element={<SitemapPage />} />
      <Route path="/cookies" element={<CookiesPage />} />
      <Route path="/accessibility" element={<AccessibilityPage />} />
      <Route path="/dmca" element={<DmcaPage />} />
      <Route path="/unsubscribe" element={<UnsubscribePage />} />
      
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <MainPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPageWrapper />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
