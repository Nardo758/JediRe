export interface IngestResult {
  countiesProcessed: number;
  rowsInserted: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

export async function ingestBuildingPermits(_apiKey: string): Promise<IngestResult> {
  throw new Error('Census building permits ingestion service not yet implemented');
}
