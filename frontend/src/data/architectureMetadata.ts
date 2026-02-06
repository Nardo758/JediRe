import { ArchitectureInfo } from '../components/ArchitectureOverlay';

export const architectureMetadata: Record<string, ArchitectureInfo> = {
  dashboard: {
    page: 'Dashboard',
    frontend: {
      component: 'Dashboard.tsx',
      state: 'Zustand (dealStore)',
      apis: ['GET /api/v1/deals', 'GET /api/v1/properties/summary'],
    },
    backend: {
      service: 'DealsService + PropertiesService',
      database: ['deals table', 'properties table', 'deal_properties junction'],
      features: ['Map rendering with Mapbox', 'Real-time deal updates', 'Property clustering'],
    },
  },
  
  properties: {
    page: 'Properties Search',
    frontend: {
      component: 'PropertiesPage.tsx',
      state: 'Zustand (propertyStore)',
      apis: ['GET /api/v1/properties', 'GET /api/v1/properties/:id'],
    },
    backend: {
      service: 'PropertiesService',
      database: ['properties table', 'PostGIS spatial index'],
      features: ['PostGIS boundary queries', 'Advanced filtering', 'Geospatial search'],
    },
  },
  
  createDeal: {
    page: 'Create Deal',
    frontend: {
      component: 'CreateDealModal.tsx + MapBuilder.tsx',
      state: 'Zustand (dealStore)',
      apis: ['POST /api/v1/deals', 'GET /api/v1/properties/within-boundary'],
    },
    backend: {
      service: 'DealsService',
      database: ['deals table', 'deal_properties table', 'properties table'],
      features: ['Polygon drawing validation', 'Property boundary intersection', 'Area calculation'],
    },
  },
  
  dealView: {
    page: 'Deal View',
    frontend: {
      component: 'DealView.tsx + DealSidebar + DealMapView',
      state: 'Zustand (dealStore)',
      apis: [
        'GET /api/v1/deals/:id',
        'GET /api/v1/deals/:id/properties',
        'POST /api/v1/deals/:id/analysis/trigger',
      ],
    },
    backend: {
      service: 'DealsService + DealAnalysisService',
      database: ['deals table', 'properties table', 'analysis_results table'],
      features: [
        'JEDI Score calculation',
        'Python engine orchestration',
        'Development capacity analysis',
        'Market intelligence aggregation',
      ],
    },
  },
  
  pipeline: {
    page: 'Deal Pipeline',
    frontend: {
      component: 'DealPipeline.tsx',
      state: 'Zustand (dealStore)',
      apis: ['GET /api/v1/deals/pipeline', 'PATCH /api/v1/deals/:id/stage'],
    },
    backend: {
      service: 'DealsService',
      database: ['deals table', 'deal_pipeline table', 'deal_tasks table'],
      features: ['6-stage pipeline tracking', 'Drag-and-drop stage updates', 'Activity logging'],
    },
  },
  
  agents: {
    page: 'AI Agents',
    frontend: {
      component: 'AgentsPage.tsx',
      state: 'WebSocket connection',
      apis: ['WS /api/v1/agents/connect', 'POST /api/v1/agents/message'],
    },
    backend: {
      service: 'AgentsService + WebSocket Gateway',
      database: ['agent_conversations table', 'agent_tasks table'],
      features: [
        '4 specialist agents (Orchestrator, Supply, Zoning, Cashflow)',
        'Real-time chat via WebSocket',
        'Task orchestration',
      ],
    },
  },
  
  analysis: {
    page: 'Analysis Results',
    frontend: {
      component: 'AnalysisResults.tsx',
      state: 'Zustand (dealStore)',
      apis: ['GET /api/v1/deals/:id/analysis'],
    },
    backend: {
      service: 'DealAnalysisService',
      database: ['analysis_results table', 'properties table'],
      features: [
        'Python capacity_analyzer.py',
        'JEDI Score (0-100 scale)',
        '5-level verdict system',
        'Automated recommendations',
      ],
    },
  },
  
  systemArchitecture: {
    page: 'System Architecture',
    frontend: {
      component: 'SystemArchitecture.tsx',
      state: 'Local state (diagram viewer)',
      apis: ['None (static content)'],
    },
    backend: {
      service: 'Static documentation',
      database: ['None'],
      features: ['Interactive system diagrams', 'Architecture documentation', 'Module navigation'],
    },
  },
};
