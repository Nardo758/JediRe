import sys

# Fix bulk-upload.routes.ts
path = 'backend/src/api/rest/bulk-upload.routes.ts'
with open(path, 'r') as f:
    content = f.read()

# Add provenance import after logger
old = "import { logger } from '../../utils/logger';"
new = old + "\nimport { stampProvenance } from '../../utils/provenance-stamp';"
content = content.replace(old, new)

# In processUploadJob, add stamp before ingestArchiveDeals call
old = """    const result = await ingestArchiveDeals(job.uploadPath, {
      skipExisting: false,
      rootLabel,
      existingAssetId: job.assetId || undefined,
      createdBy: job.userId || undefined,
      fileClassifications: job.fileClassificationMap,
    });"""
new = """    const stamp = stampProvenance({ ingestionSource: 'archive_import', userId: job.userId || null, jobId: job.id });
    const result = await ingestArchiveDeals(job.uploadPath, {
      skipExisting: false,
      rootLabel,
      existingAssetId: job.assetId || undefined,
      createdBy: job.userId || undefined,
      fileClassifications: job.fileClassificationMap,
      provenance: stamp,
    });"""
content = content.replace(old, new)

# In processZipUpload, add stamp before ingestArchiveDeals call
old = """    // Run archive ingestion (ZIP uploads don't carry per-file classifications from frontend)
    const result = await ingestArchiveDeals(job.uploadPath, {
      skipExisting: false,
      rootLabel,
      existingAssetId: job.assetId || undefined,
      createdBy: job.userId || undefined,
    });"""
new = """    const stamp = stampProvenance({ ingestionSource: 'archive_import', userId: job.userId || null, jobId: job.id });
    // Run archive ingestion (ZIP uploads don't carry per-file classifications from frontend)
    const result = await ingestArchiveDeals(job.uploadPath, {
      skipExisting: false,
      rootLabel,
      existingAssetId: job.assetId || undefined,
      createdBy: job.userId || undefined,
      provenance: stamp,
    });"""
content = content.replace(old, new)

with open(path, 'w') as f:
    f.write(content)
print('bulk-upload.routes.ts done')

# Fix archive-ingestion.service.ts
path2 = 'backend/src/services/archive-ingestion.service.ts'
with open(path2, 'r') as f:
    content = f.read()

# Add provenance import
old2 = "import { logger } from '../utils/logger';"
new2 = old2 + "\nimport { type ProvenanceStamp } from '../utils/provenance-stamp';"
content2 = content.replace(old2, new2)

# Update options interface to include provenance
old3 = """  options: {
    limit?: number;
    skipExisting?: boolean;
    rootLabel?: string;
    existingAssetId?: string;
    createdBy?: string;
    /** Per-file overrides keyed by sanitized disk filename (basename only).
     *  `docType` overrides the auto-detected type from classifyFile().
     *  `obsDate` (YYYY-MM) overrides the observation period used when building corpus rows. */
    fileClassifications?: Record<string, { docType: ArchiveFile['type']; obsDate?: string }>;
  }"""
new3 = """  options: {
    limit?: number;
    skipExisting?: boolean;
    rootLabel?: string;
    existingAssetId?: string;
    createdBy?: string;
    /** Per-file overrides keyed by sanitized disk filename (basename only).
     *  `docType` overrides the auto-detected type from classifyFile().
     *  `obsDate` (YYYY-MM) overrides the observation period used when building corpus rows. */
    fileClassifications?: Record<string, { docType: ArchiveFile['type']; obsDate?: string }>;
    provenance?: ProvenanceStamp;
  }"""
content2 = content2.replace(old3, new3)

# In upsertArchiveDeal, merge provenance into extraction_data if present
# We need to update the function signature and the mergedExtraction block
old4 = "async function upsertArchiveDeal(pool: Pool, deal: ParsedArchiveDeal, existingAssetId?: string, createdBy?: string): Promise<string> {"
new4 = "async function upsertArchiveDeal(pool: Pool, deal: ParsedArchiveDeal, existingAssetId?: string, createdBy?: string, provenance?: ProvenanceStamp): Promise<string> {"
content2 = content2.replace(old4, new4)

old5 = """  const mergedExtraction = {
    ...deal.extractionData,
    brokerClaims: deal.brokerClaims,
    sourceFiles: deal.sourceFiles.map(f => ({ name: f.name, type: f.type })),
    parseWarnings: deal.parseWarnings,
  };"""
new5 = """  const mergedExtraction = {
    ...deal.extractionData,
    brokerClaims: deal.brokerClaims,
    sourceFiles: deal.sourceFiles.map(f => ({ name: f.name, type: f.type })),
    parseWarnings: deal.parseWarnings,
    ...(provenance && { _provenance: provenance }),
  };"""
content2 = content2.replace(old5, new5)

# Update the ingestArchiveDeals call to pass provenance
old6 = "      const assetId = await upsertArchiveDeal(pool, parsed, options.existingAssetId, options.createdBy);"
new6 = "      const assetId = await upsertArchiveDeal(pool, parsed, options.existingAssetId, options.createdBy, options.provenance);"
content2 = content2.replace(old6, new6)

with open(path2, 'w') as f:
    f.write(content2)
print('archive-ingestion.service.ts done')
