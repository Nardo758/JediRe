import React, { useState } from 'react';

export function SystemArchitecturePage() {
  const [selectedDiagram, setSelectedDiagram] = useState('overview');

  const diagrams = [
    { id: 'overview', name: 'System Overview', icon: '🏗️' },
    { id: 'data-model', name: 'Data Model', icon: '🗄️' },
    { id: 'modules', name: 'Module Architecture', icon: '🧩' },
    { id: 'auth', name: 'Authentication Flow', icon: '🔐' },
    { id: 'map', name: 'Map & Boundaries', icon: '🗺️' },
    { id: 'email', name: 'Email Integration', icon: '📧' },
    { id: 'websocket', name: 'Real-Time (WebSocket)', icon: '⚡' },
    { id: 'agents', name: 'AI Agent Orchestration', icon: '🤖' },
    { id: 'property-search', name: 'Property Search Flow', icon: '🔍' },
    { id: 'analysis', name: 'Analysis Flow', icon: '📊' },
    { id: 'deployment', name: 'Deployment', icon: '🚀' },
    { id: 'tiers', name: 'Subscription Tiers', icon: '💳' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Architecture</h1>
        <p className="text-gray-600">Critical systems diagrams and data flows</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Diagram List (Left Sidebar) */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Diagrams</h2>
            <div className="space-y-1">
              {diagrams.map((diagram) => (
                <button
                  key={diagram.id}
                  onClick={() => setSelectedDiagram(diagram.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    selectedDiagram === diagram.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{diagram.icon}</span>
                  <span>{diagram.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-t border-gray-200">
            <button className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
              📥 Export All Diagrams
            </button>
            <button className="w-full px-4 py-2 mt-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              📖 View Full Documentation
            </button>
          </div>
        </div>

        {/* Diagram Viewer (Main Area) */}
        <div className="flex-1 overflow-auto p-6">
          {selectedDiagram === 'overview' && <SystemOverviewDiagram />}
          {selectedDiagram === 'data-model' && <DataModelDiagram />}
          {selectedDiagram === 'modules' && <ModuleArchitectureDiagram />}
          {selectedDiagram === 'auth' && <AuthenticationFlowDiagram />}
          {selectedDiagram === 'map' && <MapBoundariesDiagram />}
          {selectedDiagram === 'email' && <EmailIntegrationDiagram />}
          {selectedDiagram === 'websocket' && <WebSocketDiagram />}
          {selectedDiagram === 'agents' && <AIAgentDiagram />}
          {selectedDiagram === 'property-search' && <PropertySearchDiagram />}
          {selectedDiagram === 'analysis' && <AnalysisFlowDiagram />}
          {selectedDiagram === 'deployment' && <DeploymentDiagram />}
          {selectedDiagram === 'tiers' && <SubscriptionTiersDiagram />}
        </div>
      </div>
    </div>
  );
}

// Diagram Components
function SystemOverviewDiagram() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🏗️ System Overview</h2>
      
      <div className="space-y-6">
        {/* Frontend Layer */}
        <div className="border-2 border-blue-500 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-4 text-lg">Frontend Layer</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
              <div className="text-3xl mb-2">⚛️</div>
              <div className="font-medium">React 18</div>
              <div className="text-xs text-gray-600">+ TypeScript</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
              <div className="text-3xl mb-2">🗺️</div>
              <div className="font-medium">Mapbox GL JS</div>
              <div className="text-xs text-gray-600">Map Rendering</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-4 text-center">
              <div className="text-3xl mb-2">⚡</div>
              <div className="font-medium">Socket.io</div>
              <div className="text-xs text-gray-600">Real-time</div>
            </div>
          </div>
          <div className="mt-4 bg-blue-100 border border-blue-200 rounded p-3 text-center">
            <div className="font-medium">State Management</div>
            <div className="text-sm text-gray-700">Zustand + TanStack Query</div>
          </div>
        </div>

        {/* API Gateway */}
        <div className="flex justify-center">
          <div className="bg-purple-100 border-2 border-purple-500 rounded-lg px-8 py-4">
            <div className="text-center">
              <div className="text-3xl mb-2">🌐</div>
              <div className="font-semibold">API Gateway</div>
              <div className="text-xs text-gray-600">Nginx / CloudFlare</div>
            </div>
          </div>
        </div>

        {/* Backend Layer */}
        <div className="border-2 border-green-500 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-4 text-lg">Backend Layer</h3>
          <div className="mb-4 bg-green-100 border border-green-200 rounded p-4 text-center">
            <div className="text-3xl mb-2">🦅</div>
            <div className="font-medium text-lg">NestJS Application Server</div>
            <div className="text-sm text-gray-600">Modular Monolith</div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {['Auth', 'Deals', 'Map', 'Email', 'AI'].map((module) => (
              <div key={module} className="bg-green-50 border border-green-200 rounded p-3 text-center">
                <div className="font-medium text-sm">{module}</div>
                <div className="text-xs text-gray-600">Module</div>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-yellow-100 border border-yellow-300 rounded p-3 text-center">
            <div className="font-medium">🐍 Python Services</div>
            <div className="text-xs text-gray-600">Analysis Engines (Capacity, Signal, Imbalance)</div>
          </div>
        </div>

        {/* Data Layer */}
        <div className="border-2 border-red-500 rounded-lg p-6">
          <h3 className="font-semibold text-red-900 mb-4 text-lg">Data Layer</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded p-4 text-center">
              <div className="text-3xl mb-2">🐘</div>
              <div className="font-medium">PostgreSQL 15</div>
              <div className="text-xs text-gray-600">+ PostGIS</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-4 text-center">
              <div className="text-3xl mb-2">🔥</div>
              <div className="font-medium">Redis</div>
              <div className="text-xs text-gray-600">Cache + Queue</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-4 text-center">
              <div className="text-3xl mb-2">☁️</div>
              <div className="font-medium">S3 Storage</div>
              <div className="text-xs text-gray-600">Files + Photos</div>
            </div>
          </div>
        </div>

        {/* External Integrations */}
        <div className="border border-gray-300 rounded-lg p-6 bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-4 text-lg">External Integrations</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { name: 'Mapbox', icon: '🗺️' },
              { name: 'Gmail/Outlook', icon: '📧' },
              { name: 'OpenAI', icon: '🤖' },
              { name: 'CoStar', icon: '📊' },
              { name: 'ApartmentIQ', icon: '🏢' },
              { name: 'Stripe', icon: '💳' },
              { name: 'SendGrid', icon: '📬' },
              { name: 'Twilio', icon: '📱' },
            ].map((service) => (
              <div key={service.name} className="bg-white border border-gray-200 rounded p-2 text-center">
                <div className="text-2xl mb-1">{service.icon}</div>
                <div className="text-xs font-medium">{service.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataModelDiagram() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🗄️ Deal-Centric Data Model</h2>
      
      <div className="space-y-8">
        {/* Core Entity */}
        <div className="flex flex-col items-center">
          <div className="bg-blue-100 border-2 border-blue-500 rounded-lg p-6 w-64 text-center">
            <div className="text-3xl mb-2">👤</div>
            <div className="font-bold text-lg">USERS</div>
            <div className="text-xs text-gray-600 mt-2 text-left">
              • id<br/>
              • email<br/>
              • name<br/>
              • team_id<br/>
              • role<br/>
              • tier
            </div>
          </div>

          <div className="my-4 text-2xl">↓ 1:N</div>

          {/* Deals (Central Hub) */}
          <div className="bg-purple-100 border-4 border-purple-500 rounded-lg p-6 w-80 text-center">
            <div className="text-4xl mb-2">💼</div>
            <div className="font-bold text-2xl">DEALS</div>
            <div className="text-sm text-purple-900 font-semibold mb-2">(Central Hub)</div>
            <div className="text-xs text-gray-700 mt-2 text-left">
              • id<br/>
              • user_id<br/>
              • name<br/>
              • boundary (GEOMETRY) 🗺️<br/>
              • intent<br/>
              • tier (subscription)<br/>
              • budget<br/>
              • status
            </div>
          </div>

          <div className="my-4 text-2xl">↓ 1:N</div>

          {/* Related Tables */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { name: 'DEAL_MODULES', icon: '🧩', fields: ['deal_id', 'name', 'enabled', 'settings'] },
              { name: 'DEAL_PROPERTIES', icon: '🏠', fields: ['deal_id', 'property_id', 'type', 'notes'] },
              { name: 'DEAL_EMAILS', icon: '📧', fields: ['deal_id', 'email_id', 'confidence'] },
              { name: 'DEAL_PIPELINE', icon: '📊', fields: ['deal_id', 'stage', 'days'] },
              { name: 'DEAL_TASKS', icon: '✓', fields: ['deal_id', 'title', 'status', 'due_date'] },
            ].map((table) => (
              <div key={table.name} className="bg-green-50 border border-green-300 rounded p-4">
                <div className="text-2xl mb-2 text-center">{table.icon}</div>
                <div className="font-semibold text-sm mb-2">{table.name}</div>
                <div className="text-xs text-gray-600">
                  {table.fields.map((field) => (
                    <div key={field}>• {field}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Supporting Tables */}
          <div className="my-6 grid grid-cols-2 gap-4">
            <div className="bg-orange-50 border border-orange-300 rounded p-4">
              <div className="text-2xl mb-2">🏢</div>
              <div className="font-semibold">PROPERTIES</div>
              <div className="text-xs text-gray-600">
                • id<br/>
                • address<br/>
                • lat/lng<br/>
                • rent<br/>
                • class<br/>
                • units
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-300 rounded p-4">
              <div className="text-2xl mb-2">📬</div>
              <div className="font-semibold">EMAILS</div>
              <div className="text-xs text-gray-600">
                • id<br/>
                • subject<br/>
                • from<br/>
                • body<br/>
                • entities (JSONB)<br/>
                • parsed_at
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="font-semibold text-blue-900 mb-2">Key Concept:</div>
        <p className="text-sm text-gray-700">
          Everything revolves around <span className="font-bold">DEALS</span>. Each deal has a boundary (polygon) 
          and links to properties, emails, modules, pipeline stages, and tasks. This enables spatial queries 
          (PostGIS) to find properties within deal boundaries automatically.
        </p>
      </div>
    </div>
  );
}

// Placeholder diagrams - we'll build these if needed
function ModuleArchitectureDiagram() {
  return <DiagramPlaceholder title="Module Architecture" icon="🧩" />;
}

function AuthenticationFlowDiagram() {
  return <DiagramPlaceholder title="Authentication Flow" icon="🔐" />;
}

function MapBoundariesDiagram() {
  return <DiagramPlaceholder title="Map & Boundaries System" icon="🗺️" />;
}

function EmailIntegrationDiagram() {
  return <DiagramPlaceholder title="Email Integration & AI Linking" icon="📧" />;
}

function WebSocketDiagram() {
  return <DiagramPlaceholder title="Real-Time Communication (WebSocket)" icon="⚡" />;
}

function AIAgentDiagram() {
  return <DiagramPlaceholder title="AI Agent Orchestration" icon="🤖" />;
}

function PropertySearchDiagram() {
  return <DiagramPlaceholder title="Property Search Data Flow" icon="🔍" />;
}

function AnalysisFlowDiagram() {
  return <DiagramPlaceholder title="Strategy Analysis Flow" icon="📊" />;
}

function DeploymentDiagram() {
  return <DiagramPlaceholder title="Deployment Architecture" icon="🚀" />;
}

function SubscriptionTiersDiagram() {
  return <DiagramPlaceholder title="Subscription Tier Enforcement" icon="💳" />;
}

function DiagramPlaceholder({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{icon} {title}</h2>
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <p className="text-gray-600 mb-4">Diagram coming soon</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          View in Documentation
        </button>
      </div>
    </div>
  );
}
