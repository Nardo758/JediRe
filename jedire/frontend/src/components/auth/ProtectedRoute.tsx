import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: 'owner' | 'partner' | 'agent' | 'viewer';
  requireTier?: 'basic' | 'pro' | 'enterprise';
}

export function ProtectedRoute({ children, requireRole, requireTier }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, hasTier } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRole && !hasRole(requireRole)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (requireTier && !hasTier(requireTier)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">⬆️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Upgrade Required</h2>
          <p className="text-gray-600 mb-4">
            This feature requires a {requireTier} subscription or higher.
          </p>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Upgrade Now
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
