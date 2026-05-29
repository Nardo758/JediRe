/**
 * Georgia Metro Data Ingestion
 * Cobb, Gwinnett, DeKalb, Fulton, Clayton County property data pipelines.
 * Inner-ring counties (Cherokee, Forsyth, Henry, Douglas, Fayette, Paulding, Rockdale)
 * are wired into the promote/enrich pipeline but lack ArcGIS ingestion services.
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

// Clayton County
export {
  ClaytonIngestionService,
  getClaytonIngestionService,
} from './clayton-ingestion.service';

// Orchestrator for running all counties
export { 
  GeorgiaIngestionOrchestrator, 
  getGeorgiaIngestionOrchestrator 
} from './georgia-orchestrator';
