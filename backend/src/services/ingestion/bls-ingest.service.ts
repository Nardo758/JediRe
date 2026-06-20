import { ingestBLSQCEW as _ingestBLSQCEW } from './bls-qcew-ingest.service';
export { ingestBLSQCEW } from './bls-qcew-ingest.service';

export interface IngestResult {
  countiesProcessed: number;
  rowsInserted: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}
