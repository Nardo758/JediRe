/**
 * EXAMPLE INTEGRATION FILE
 * 
 * This file demonstrates how to integrate the Asset Map Intelligence
 * components into a Deal view or module system.
 * 
 * Copy this pattern into your actual deal module structure.
 */

import { useState, useEffect } from 'react';
import { MapView } from '@/components/asset';
import type { Deal, NotePermission } from '@/types';

interface AssetMapModuleProps {
  dealId: string;
  // Optional: Pass deal directly if already loaded
  deal?: Deal;
  // Optional: Override permission
  permission?: NotePermission;
}

export default function AssetMapModule({ dealId, deal: initialDeal, permission: initialPermission }: AssetMapModuleProps) {
  const [deal, setDeal] = useState<Deal | null>(initialDeal || null);
  const [permission, setPermission] = useState<NotePermission>(initialPermission || 'view');
  const [loading, setLoading] = useState(!initialDeal);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDeal) {
      setDeal(initialDeal);
      setLoading(false);
      return;
    }

    // Fetch deal data if not provided
    const fetchDeal = async () => {
      try {
        setLoading(true);
        setError(null);

        // TODO: Replace with actual API endpoint
        const response = await fetch(`/api/deals/${dealId}`);
        if (!response.ok) throw new Error('Failed to load deal');

        const data = await response.json();
        setDeal(data.deal);

        // Fetch user permission for this deal
        const permResponse = await fetch(`/api/deals/${dealId}/permissions/me`);
        if (permResponse.ok) {
          const permData = await permResponse.json();
          setPermission(permData.permission || 'view');
        }
      } catch (err) {
        console.error('Error loading deal:', err);
        setError(err instanceof Error ? err.message : 'Failed to load deal');
      } finally {
        setLoading(false);
      }
    };

    fetchDeal();
  }, [dealId, initialDeal]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading asset map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-gray-600">Deal not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Optional: Add a header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{deal.name}</h1>
            <p className="text-sm text-gray-600">Asset Map Intelligence</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {permission === 'admin' ? '👑 Admin' : permission === 'edit' ? '✏️ Editor' : '👁️ Viewer'}
            </span>
          </div>
        </div>
      </div>

      {/* Map View - offset by header height */}
      <div className="h-full pt-16">
        <MapView deal={deal} permission={permission} />
      </div>

      {/* Optional: Add quick stats overlay */}
      <div className="absolute bottom-6 left-6 z-10 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Stats</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Property:</span>
            <span className="font-medium text-gray-900">{deal.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Acres:</span>
            <span className="font-medium text-gray-900">{deal.acres || 'N/A'}</span>
          </div>
          {deal.budget && (
            <div className="flex justify-between">
              <span className="text-gray-600">Budget:</span>
              <span className="font-medium text-gray-900">
                ${(deal.budget / 1000000).toFixed(1)}M
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * INTEGRATION EXAMPLES:
 * 
 * 1. In a Deal Module Router:
 * 
 * ```tsx
 * import AssetMapModule from '@/components/asset/AssetMapModule.example';
 * 
 * function DealView({ dealId }: { dealId: string }) {
 *   const [currentModule, setCurrentModule] = useState('overview');
 * 
 *   return (
 *     <div>
 *       <Sidebar onModuleChange={setCurrentModule} />
 *       {currentModule === 'map' && <AssetMapModule dealId={dealId} />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * 2. Direct Usage with Deal Data:
 * 
 * ```tsx
 * <AssetMapModule dealId={deal.id} deal={deal} permission="edit" />
 * ```
 * 
 * 3. In a Tab System:
 * 
 * ```tsx
 * <Tabs>
 *   <Tab label="Overview">...</Tab>
 *   <Tab label="Map Intelligence">
 *     <AssetMapModule dealId={dealId} />
 *   </Tab>
 * </Tabs>
 * ```
 */
