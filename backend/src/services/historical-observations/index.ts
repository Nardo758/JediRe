/**
 * Historical Observations — Service Index
 *
 * Re-exports everything consuming modules and routes need.
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md
 */

export {
  type HistoricalObservationRow,
  type PartialHistoricalObservationRow,
  type CorpusQuery,
  type CorpusSummary,
  type CoverageReport,
  type GeographyLevel,
  type ObservationWindow,
  type RealizationWindow,
  realizedFieldFor,
} from './types';

export { CorpusQueryService, corpusQueryService } from './query.service';

export { RealizedOutputsService, realizedOutputsService } from './realized-outputs.service';

export {
  ingestPropertyPerformance,
  type IngestionResult,
  type ParsedPropertyDocument,
} from './property-performance-ingestor';
