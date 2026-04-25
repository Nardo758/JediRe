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
