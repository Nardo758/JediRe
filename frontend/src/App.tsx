import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useIsMobile } from './hooks/useIsMobile';
import AuthPage from './pages/AuthPage';
import MainPage from './pages/MainPage';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import SettingsPage from './pages/SettingsPage';
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
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/auth" element={<AuthPage />} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
