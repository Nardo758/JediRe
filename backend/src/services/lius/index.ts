/**
 * LIUS — Barrel exports
 */
export { LIUSSchema } from './types';
export type {
  LIUSchema,
  Evidence,
  EvidenceSource,
  HardRule,
  CrossCheck,
  CollisionReport,
  ConfidenceScore,
  TrajectoryEvent,
  SchemaCatalog,
  SchemaCatalogEntry,
  Archetype,
  DealType,
  LifecyclePhase,
  Tier,
  Liuid,
  SourceResolverContext,
  SourceResolverResult,
  LIUSEngineContext,
  LIUSEngineResult,
} from './types';

export { loadSchemaCatalog, getSchema, getSectionSchemas, getSchemasByArchetype } from './schema-catalog';
export { resolveLineItem } from './source-resolver';
export { runLIUSEngine, runLIUSForLine } from './engine';
