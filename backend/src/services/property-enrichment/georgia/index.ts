/**
 * Georgia Metro Data Ingestion
 * Cobb, Gwinnett, DeKalb, Fulton County property data pipelines
 */

// Types
export * from './types';

// ArcGIS Client
export { ArcGISClient, ArcGISQueryOptions, ArcGISQueryResult } from './arcgis-client';

// Cobb County
export { 
  CobbIngestionService, 
  getCobbIngestionService 
} from './cobb-ingestion.service';

// Gwinnett County
export { 
  GwinnettIngestionService, 
  getGwinnettIngestionService 
} from './gwinnett-ingestion.service';

// DeKalb County
export { 
  DeKalbIngestionService, 
  getDeKalbIngestionService 
} from './dekalb-ingestion.service';

// Fulton County
export { 
  FultonIngestionService, 
  getFultonIngestionService 
} from './fulton-ingestion.service';

// Orchestrator for running all counties
export { 
  GeorgiaIngestionOrchestrator, 
  getGeorgiaIngestionOrchestrator 
} from './georgia-orchestrator';
