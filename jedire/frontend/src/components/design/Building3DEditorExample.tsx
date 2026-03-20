/**
 * Building3DEditor - Example Usage
 * Demonstrates how to integrate the 3D editor into a deal page
 */

import React, { useEffect, useState } from 'react';
import { Building3DEditor } from './Building3DEditor';
import { useDesign3DStore } from '@/stores/design/design3d.store';
import type { ParcelBoundary, ZoningEnvelope, BuildingMetrics } from '@/types/design/design3d.types';

// ============================================================================
// Example 1: Basic Integration
// ============================================================================

export const BasicExample: React.FC = () => {
  return (
    <div className="w-full h-screen">
      <Building3DEditor
        dealId="deal-123"
        onMetricsChange={(metrics) => {
          console.log('Metrics updated:', metrics);
        }}
        onSave={() => {
          console.log('Design saved!');
        }}
      />
    </div>
  );
};

// ============================================================================
// Example 2: With Deal Data Integration
// ============================================================================

interface DealData {
  id: string;
  name: string;
  parcel: {
    id: string;
    coordinates: Array<{ lat: number; lng: number }>;
    area: number; // square feet
  };
  zoning: {
    maxHeight: number;
    setbacks: { front: number; rear: number; side: number };
    far: number;
  };
}

export const DealIntegrationExample: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [dealData, setDealData] = useState<DealData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const setParcelBoundary = useDesign3DStore((state) => state.setParcelBoundary);
  const setZoningEnvelope = useDesign3DStore((state) => state.setZoningEnvelope);
  
  // Load deal data from API
  useEffect(() => {
    const loadDeal = async () => {
      try {
        const response = await fetch(`/api/deals/${dealId}`);
        const data = await response.json();
        setDealData(data);
        
        // Set parcel boundary in 3D store
        const parcel: ParcelBoundary = {
          id: data.parcel.id,
          coordinates: data.parcel.coordinates,
          area: data.parcel.area,
          extrusionHeight: 2,
          color: '#10b981',
          opacity: 0.3,
        };
        setParcelBoundary(parcel);
        
        // Set zoning envelope
        const envelope: ZoningEnvelope = {
          id: `zoning-${data.id}`,
          maxHeight: data.zoning.maxHeight,
          setbacks: data.zoning.setbacks,
          floorAreaRatio: data.zoning.far,
          buildableArea: data.parcel.area * (1 - 0.2), // Simplified: 20% setback reduction
          wireframe: true,
          color: '#3b82f6',
        };
        setZoningEnvelope(envelope);
        
      } catch (error) {
        console.error('Failed to load deal:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadDeal();
  }, [dealId, setParcelBoundary, setZoningEnvelope]);
  
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading 3D Editor...</p>
        </div>
      </div>
    );
  }
  
  if (!dealData) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Failed to load deal data</p>
      </div>
    );
  }
  
  return (
    <div className="w-full h-screen">
      <Building3DEditor
        dealId={dealData.id}
        onMetricsChange={(metrics) => {
          console.log('Metrics for', dealData.name, ':', metrics);
        }}
        onSave={async () => {
          // Save design to backend
          const state = useDesign3DStore.getState().exportState();
          await fetch(`/api/deals/${dealData.id}/design`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
          });
        }}
      />
    </div>
  );
};

// ============================================================================
// Example 3: Split View with Metrics Sidebar
// ============================================================================

export const SplitViewExample: React.FC = () => {
  const metrics = useDesign3DStore((state) => state.metrics);
  const buildingSections = useDesign3DStore((state) => state.buildingSections);
  const selectedSectionId = useDesign3DStore((state) => state.selectedSectionId);
  
  const selectedSection = buildingSections.find(s => s.id === selectedSectionId);
  
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 text-white p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Building Design</h2>
        
        {/* Metrics */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Project Metrics</h3>
          <div className="space-y-2 text-sm">
            <MetricRow label="Units" value={metrics.unitCount} />
            <MetricRow label="Total SF" value={metrics.totalSF.toLocaleString()} />
            <MetricRow label="Residential SF" value={metrics.residentialSF.toLocaleString()} />
            <MetricRow label="Amenity SF" value={metrics.amenitySF.toLocaleString()} />
            <MetricRow label="Parking Spaces" value={metrics.parkingSpaces} />
            <MetricRow label="Height" value={`${metrics.height.feet}' (${metrics.height.stories} stories)`} />
            <MetricRow label="Coverage" value={`${metrics.coverage.percentage}%`} />
            <MetricRow label="FAR" value={metrics.far.toFixed(2)} />
            <MetricRow label="Efficiency" value={`${metrics.efficiency}%`} />
          </div>
        </div>
        
        {/* Building Sections */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Building Sections</h3>
          {buildingSections.length === 0 ? (
            <p className="text-gray-400 text-sm">No sections yet. Click "Add" to start.</p>
          ) : (
            <div className="space-y-2">
              {buildingSections.map(section => (
                <div
                  key={section.id}
                  className={`p-3 rounded ${
                    section.id === selectedSectionId ? 'bg-indigo-600' : 'bg-gray-700'
                  }`}
                >
                  <div className="font-medium">{section.name}</div>
                  <div className="text-xs text-gray-300 mt-1">
                    {section.geometry.floors} floors • {section.geometry.height}' height
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Selected Section Details */}
        {selectedSection && (
          <div className="mb-6 border-t border-gray-700 pt-4">
            <h3 className="text-lg font-semibold mb-3">Selected Section</h3>
            <div className="bg-gray-700 p-3 rounded">
              <div className="font-medium mb-2">{selectedSection.name}</div>
              <div className="text-sm space-y-1">
                <div>Floors: {selectedSection.geometry.floors}</div>
                <div>Height: {selectedSection.geometry.height}'</div>
                <div>Position: ({selectedSection.position.x.toFixed(1)}, {selectedSection.position.z.toFixed(1)})</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 3D Viewport */}
      <div className="flex-1">
        <Building3DEditor dealId="deal-123" />
      </div>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-gray-400">{label}:</span>
    <span className="font-semibold">{value}</span>
  </div>
);

// ============================================================================
// Example 4: Integration with Financial Model
// ============================================================================

export const FinancialIntegrationExample: React.FC = () => {
  const metrics = useDesign3DStore((state) => state.metrics);
  const [financialMetrics, setFinancialMetrics] = useState({
    hardCost: 0,
    softCost: 0,
    totalCost: 0,
    irr: 0,
    cashOnCash: 0,
  });
  
  // Recalculate financial metrics when building metrics change
  useEffect(() => {
    // Simplified financial model
    const hardCostPerSF = 300; // $300/SF
    const softCostPercentage = 0.15; // 15%
    
    const hardCost = metrics.totalSF * hardCostPerSF;
    const softCost = hardCost * softCostPercentage;
    const totalCost = hardCost + softCost;
    
    // Simple IRR calculation (placeholder)
    const avgRentPerUnit = 2000; // $2,000/mo
    const annualRevenue = metrics.unitCount * avgRentPerUnit * 12;
    const noi = annualRevenue * 0.55; // 55% NOI margin
    const irr = (noi / totalCost) * 100;
    
    setFinancialMetrics({
      hardCost,
      softCost,
      totalCost,
      irr,
      cashOnCash: irr * 0.5, // Simplified
    });
  }, [metrics]);
  
  return (
    <div className="flex flex-col h-screen">
      {/* Financial Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Live Financial Model</h2>
            <p className="text-sm opacity-90">Updates in real-time as you design</p>
          </div>
          <div className="flex gap-8">
            <div>
              <div className="text-xs opacity-75">Total Development Cost</div>
              <div className="text-2xl font-bold">${(financialMetrics.totalCost / 1_000_000).toFixed(1)}M</div>
            </div>
            <div>
              <div className="text-xs opacity-75">IRR</div>
              <div className="text-2xl font-bold">{financialMetrics.irr.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs opacity-75">Cash-on-Cash</div>
              <div className="text-2xl font-bold">{financialMetrics.cashOnCash.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 3D Editor */}
      <div className="flex-1">
        <Building3DEditor
          dealId="deal-123"
          onMetricsChange={(m) => {
            console.log('Building metrics changed:', m);
          }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Example 5: Collaborative Mode (WebSocket)
// ============================================================================

export const CollaborativeExample: React.FC<{ dealId: string; userId: string }> = ({
  dealId,
  userId,
}) => {
  const [collaborators, setCollaborators] = useState<Array<{ id: string; name: string }>>([]);
  
  useEffect(() => {
    // Connect to WebSocket for real-time collaboration
    const ws = new WebSocket(`wss://api.jedire.com/deals/${dealId}/design-collab`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', userId }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'collaborators':
          setCollaborators(data.users);
          break;
        case 'design-update':
          // Update local state with remote changes
          if (data.userId !== userId) {
            const store = useDesign3DStore.getState();
            store.loadDesign(data.changes);
          }
          break;
      }
    };
    
    // Subscribe to local changes and broadcast
    const unsubscribe = useDesign3DStore.subscribe(
      (state) => state.buildingSections,
      (sections) => {
        ws.send(JSON.stringify({
          type: 'design-update',
          userId,
          changes: { buildingSections: sections },
        }));
      }
    );
    
    return () => {
      ws.close();
      unsubscribe();
    };
  }, [dealId, userId]);
  
  return (
    <div className="relative w-full h-screen">
      <Building3DEditor dealId={dealId} />
      
      {/* Collaborators List */}
      <div className="absolute top-4 right-80 bg-gray-800 text-white p-3 rounded-lg shadow-lg">
        <h4 className="font-semibold mb-2 text-sm">Active Users ({collaborators.length})</h4>
        <div className="space-y-1">
          {collaborators.map(user => (
            <div key={user.id} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{user.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Export all examples
// ============================================================================

export default {
  BasicExample,
  DealIntegrationExample,
  SplitViewExample,
  FinancialIntegrationExample,
  CollaborativeExample,
};
