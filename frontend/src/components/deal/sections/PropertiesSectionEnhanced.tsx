/**
 * Properties Section Enhanced - Deal Page
 * Property details with 3D building visualization
 */

import React, { useState, lazy, Suspense } from 'react';
import type { Building3DModel, Unit3D } from '../../property/BuildingDiagram3D';

const BuildingDiagram3D = lazy(() => 
  import('../../property/BuildingDiagram3D').then(mod => ({ default: mod.BuildingDiagram3D }))
);

interface PropertiesSectionEnhancedProps {
  deal: any;
}

// Mock 3D building data for demonstration
const mockBuildingData: Building3DModel = {
  floors: 5,
  units: [
    // Floor 1
    { unitNumber: '101', floor: 1, position: { x: -5, y: 0.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1200, tenant: 'John Smith', leaseExpiry: '2024-12-31' },
    { unitNumber: '102', floor: 1, position: { x: 0, y: 0.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'vacant', rent: 1250 },
    { unitNumber: '103', floor: 1, position: { x: 5, y: 0.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1200, tenant: 'Jane Doe', leaseExpiry: '2025-03-15' },
    
    // Floor 2
    { unitNumber: '201', floor: 2, position: { x: -5, y: 3.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'notice', rent: 1300, tenant: 'Bob Wilson', leaseExpiry: '2024-04-30' },
    { unitNumber: '202', floor: 2, position: { x: 0, y: 3.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1350, tenant: 'Alice Brown', leaseExpiry: '2025-06-01' },
    { unitNumber: '203', floor: 2, position: { x: 5, y: 3.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1300, tenant: 'Charlie Davis', leaseExpiry: '2024-11-20' },
    
    // Floor 3
    { unitNumber: '301', floor: 3, position: { x: -5, y: 6.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1400, tenant: 'David Lee', leaseExpiry: '2025-01-10' },
    { unitNumber: '302', floor: 3, position: { x: 0, y: 6.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'vacant', rent: 1450 },
    { unitNumber: '303', floor: 3, position: { x: 5, y: 6.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'notice', rent: 1400, tenant: 'Eva Martinez', leaseExpiry: '2024-03-31' },
    
    // Floor 4
    { unitNumber: '401', floor: 4, position: { x: -5, y: 9.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1500, tenant: 'Frank Garcia', leaseExpiry: '2024-08-15' },
    { unitNumber: '402', floor: 4, position: { x: 0, y: 9.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1550, tenant: 'Grace Taylor', leaseExpiry: '2025-02-28' },
    { unitNumber: '403', floor: 4, position: { x: 5, y: 9.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'vacant', rent: 1500 },
    
    // Floor 5 (penthouse)
    { unitNumber: '501', floor: 5, position: { x: -5, y: 12.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1800, tenant: 'Henry Anderson', leaseExpiry: '2025-07-01' },
    { unitNumber: '502', floor: 5, position: { x: 0, y: 12.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'occupied', rent: 1850, tenant: 'Ivy Thomas', leaseExpiry: '2024-10-15' },
    { unitNumber: '503', floor: 5, position: { x: 5, y: 12.5, z: -3 }, size: { width: 3, length: 2, height: 2.5 }, status: 'vacant', rent: 1800 },
  ],
  amenities: [
    { name: 'Parking', position: { x: -10, y: 0, z: 5 } },
    { name: 'Pool', position: { x: 10, y: 0, z: 5 } },
  ],
};

export const PropertiesSectionEnhanced: React.FC<PropertiesSectionEnhancedProps> = ({ deal }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'unit-mix' | '3d-view' | 'rent-roll'>('3d-view');
  const [selectedUnit, setSelectedUnit] = useState<Unit3D | null>(null);

  const tabs = [
    { id: 'list', label: 'Property List', icon: '📋' },
    { id: 'unit-mix', label: 'Unit Mix', icon: '🏠' },
    { id: '3d-view', label: '3D View', icon: '🏢' },
    { id: 'rent-roll', label: 'Rent Roll', icon: '💰' },
  ];

  const handleUnitClick = (unit: Unit3D) => {
    setSelectedUnit(unit);
    console.log('Unit clicked:', unit);
  };

  return (
    <div className="properties-section-enhanced">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Properties</h2>
        <p className="text-gray-600 mt-1">
          Detailed property information with interactive 3D visualization
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === '3d-view' && (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Interactive 3D Building Model</h3>
              <p className="text-sm text-gray-600 mt-1">
                Click on units to see details. Use mouse to rotate, zoom, and pan.
              </p>
            </div>
            <Suspense fallback={<div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border"><div className="text-gray-500">Loading 3D view...</div></div>}>
              <BuildingDiagram3D
                buildingData={mockBuildingData}
                onUnitClick={handleUnitClick}
              />
            </Suspense>
            
            {/* Statistics */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">
                  {mockBuildingData.units.length}
                </div>
                <div className="text-sm text-gray-600">Total Units</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-green-600">
                  {mockBuildingData.units.filter(u => u.status === 'occupied').length}
                </div>
                <div className="text-sm text-gray-600">Occupied</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-red-600">
                  {mockBuildingData.units.filter(u => u.status === 'vacant').length}
                </div>
                <div className="text-sm text-gray-600">Vacant</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-yellow-600">
                  {mockBuildingData.units.filter(u => u.status === 'notice').length}
                </div>
                <div className="text-sm text-gray-600">Notice Given</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600">Property list view - To be implemented</p>
          </div>
        )}

        {activeTab === 'unit-mix' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600">Unit mix breakdown - To be implemented</p>
          </div>
        )}

        {activeTab === 'rent-roll' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600">Rent roll details - To be implemented</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesSectionEnhanced;
