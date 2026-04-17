export interface IngestResult {
  countiesProcessed: number;
  rowsInserted: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

export async function ingestBLSQCEW(_apiKey: string): Promise<IngestResult> {
  throw new Error('BLS QCEW ingestion service not yet implemented');
}
