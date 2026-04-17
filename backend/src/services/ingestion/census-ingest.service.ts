export interface IngestResult {
  countiesProcessed: number;
  rowsInserted: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

export async function ingestCensusACS(_apiKey: string): Promise<IngestResult> {
  throw new Error('Census ACS ingestion service not yet implemented');
}
