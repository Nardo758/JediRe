/**
 * Neural Network Services
 * 
 * The Data Matrix pulls from the Data Library and enriches with all external sources.
 * Agents consume the Data Matrix to make decisions.
 * 
 * Architecture:
 * 
 * DATA LIBRARY (Source of Truth)
 *       │
 *       ▼
 * DATA MATRIX (Enrichment Layer)
 *       │
 *       ├─── Property Info (Municipal APIs)
 *       ├─── Rent Data (Apartment Locator)
 *       ├─── Sales Comps (County Records)
 *       ├─── Proximity (Transit, Grocery, Schools)
 *       ├─── Events (Supply Pipeline, Employers)
 *       ├─── Backtest (Historical Validation)
 *       ├─── Benchmarks (Archive Deals)
 *       ├─── Macro (Economic Indicators)
 *       └─── Market Trends (Correlation Engine)
 *       │
 *       ▼
 * AGENTS (Strategy, CFO, Acquisitions, Research, etc.)
 */

// Data Matrix - pulls from all data sources
export {
  DataMatrixService,
  getDataMatrixService,
  DataLibraryDeal,
  DataMatrixContext
} from './data-matrix.service';

// Knowledge Graph - relationship tracking & impact analysis
export {
  KnowledgeGraphService,
  getKnowledgeGraphService,
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
  GraphQuery,
  ImpactAnalysis,
  CommunityCluster
} from './knowledge-graph.service';

// Context Awareness - thinks like a real estate analyst
export {
  ContextAwarenessService,
  getContextAwarenessService,
  UserFocus,
  UIContext,
  DataGap,
  ContextAnalysis
} from './context-awareness.service';

// Graph Ingestion Listener - auto-ingest entities to graph
export {
  GraphIngestionListener,
  getGraphIngestionListener,
  EntityEvent,
  EntityEventType
} from './graph-ingestion-listener';

// Scheduled Refresh - staleness checking & refresh queuing
export {
  ScheduledRefreshService,
  getScheduledRefreshService,
  RefreshTask,
  RefreshStats
} from './scheduled-refresh';

// Embeddings - vector embeddings for semantic search
export {
  EmbeddingsService,
  getEmbeddingsService,
  EmbeddingResult,
  SimilarityResult
} from './embeddings.service';
