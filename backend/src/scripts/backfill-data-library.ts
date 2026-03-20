/**
 * Data Library Backfill Script
 * Migrates existing data_library_files into unified_documents
 */

import { Pool } from 'pg';
import { IntelligenceContextService } from '../services/intelligence-context.service';
import { logger } from '../utils/logger';

interface DataLibraryFile {
  id: number;
  user_id: string | null;
  file_name: string;
  file_path: string;
  city: string | null;
  zip_code: string | null;
  property_type: string | null;
  property_height: string | null;
  year_built: string | null;
  unit_count: number | null;
  source_type: string;
  tags: string[];
  parsed_data: any;
  parsing_status: string;
  uploaded_at: Date;
}

async function backfillDataLibrary() {
  console.log('🔄 Data Library → Unified Documents Backfill\n');

  // Connect to database
  const poolConfig: any = {};
  
  if (process.env.DATABASE_URL) {
    poolConfig.connectionString = process.env.DATABASE_URL;
  } else {
    poolConfig.host = process.env.DB_HOST || 'localhost';
    poolConfig.port = parseInt(process.env.DB_PORT || '5432');
    poolConfig.database = process.env.DB_NAME || 'jedire';
    poolConfig.user = process.env.DB_USER || 'postgres';
    poolConfig.password = process.env.DB_PASSWORD;
  }

  const pool = new Pool(poolConfig);
  const intelligenceService = new IntelligenceContextService(pool);

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected\n');

    // Check if unified_documents table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'unified_documents'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ unified_documents table does not exist. Run migrations first.');
      process.exit(1);
    }

    // Get all data library files
    const result = await pool.query<DataLibraryFile>(`
      SELECT * FROM data_library_files
      WHERE parsing_status = 'complete'
      ORDER BY uploaded_at ASC
    `);

    const files = result.rows;
    console.log(`📊 Found ${files.length} data library files to backfill\n`);

    if (files.length === 0) {
      console.log('✨ No files to backfill');
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        // Check if already indexed
        const existing = await pool.query(
          'SELECT id FROM unified_documents WHERE source_system = $1 AND source_id = $2',
          ['data_library', file.id.toString()]
        );

        if (existing.rows.length > 0) {
          console.log(`⏭️  Skipping ${file.file_name} (already indexed)`);
          skipCount++;
          continue;
        }

        console.log(`🔄 Processing ${file.file_name}...`);

        // Determine document type from tags and filename
        const documentType = inferDocumentType(file);

        // Extract content text from parsed_data
        const contentText = extractContentText(file);

        // Extract structured data
        const structuredData = extractStructuredData(file);

        // Calculate confidence score
        const confidenceScore = calculateConfidence(file);

        // Detect data quality flags
        const dataQualityFlags = detectQualityFlags(file, structuredData);

        // Index document (without embedding for now - will be added in next step)
        await intelligenceService.indexDocument({
          sourceSystem: 'data_library',
          sourceId: file.id.toString(),
          externalUrl: file.file_path,
          documentType,
          title: file.file_name,
          contentText,
          propertyAddress: null, // Not captured in data_library_files
          propertyCity: file.city || undefined,
          propertyState: null, // Not captured in data_library_files
          propertyZip: file.zip_code || undefined,
          propertyType: file.property_type || undefined,
          unitCount: file.unit_count || undefined,
          lotSizeSf: null,
          yearBuilt: file.year_built ? parseInt(file.year_built) : undefined,
          dealCapsuleId: undefined,
          structuredData,
          confidenceScore,
          validationStatus: 'validated', // Assume existing data is validated
          dataQualityFlags,
          createdByAgent: 'data_library_backfill',
          userId: file.user_id || undefined,
        });

        console.log(`✅ Indexed ${file.file_name}`);
        successCount++;

      } catch (error: any) {
        console.error(`❌ Failed to process ${file.file_name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Backfill Summary:');
    console.log(`  ✅ Successfully indexed: ${successCount}`);
    console.log(`  ⏭️  Skipped (already indexed): ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📁 Total processed: ${files.length}`);

    if (successCount > 0) {
      console.log('\n⚠️  Note: Embeddings not generated yet. Run embedding generation script next.');
    }

  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Infer document type from tags and filename
 */
function inferDocumentType(file: DataLibraryFile): string {
  const tags = Array.isArray(file.tags) 
    ? file.tags.map(t => String(t).toLowerCase())
    : [];
  const filename = file.file_name.toLowerCase();

  // Check tags first (more reliable)
  if (tags.includes('impact_fees') || tags.includes('fees')) return 'impact_fee_schedule';
  if (tags.includes('construction') || tags.includes('costs')) return 'construction_cost_data';
  if (tags.includes('rent') || tags.includes('rental') || tags.includes('market')) return 'rent_comp_data';
  if (tags.includes('permit') || tags.includes('timeline')) return 'permit_timeline';
  if (tags.includes('zoning')) return 'zoning_code';
  if (tags.includes('comp') || tags.includes('comparable')) return 'comp_sheet';

  // Check filename patterns
  if (filename.includes('impact') || filename.includes('fee')) return 'impact_fee_schedule';
  if (filename.includes('construction') || filename.includes('cost')) return 'construction_cost_data';
  if (filename.includes('rent') || filename.includes('market')) return 'rent_comp_data';
  if (filename.includes('permit')) return 'permit_timeline';
  if (filename.includes('zoning')) return 'zoning_code';
  if (filename.includes('comp')) return 'comp_sheet';
  if (filename.includes('survey')) return 'market_report';

  // Default based on source_type
  if (file.source_type === 'market_data') return 'market_report';
  
  return 'data_library_csv'; // Generic type
}

/**
 * Extract content text from parsed_data
 */
function extractContentText(file: DataLibraryFile): string {
  if (!file.parsed_data || !file.parsed_data.preview) {
    return '';
  }

  const { headers, preview } = file.parsed_data;

  if (!Array.isArray(preview) || !Array.isArray(headers)) {
    return '';
  }

  // Create text representation: "header1: value1, header2: value2, ..."
  const rows = preview.slice(0, 50).map((row: any) => {
    return headers
      .map((header: string) => `${header}: ${row[header] || ''}`)
      .join(', ');
  });

  return `File: ${file.file_name}\nCity: ${file.city || 'Unknown'}\nType: ${file.property_type || 'Unknown'}\n\nData:\n${rows.join('\n')}`;
}

/**
 * Extract structured data from parsed_data
 */
function extractStructuredData(file: DataLibraryFile): Record<string, any> {
  const structured: Record<string, any> = {};

  if (file.parsed_data && file.parsed_data.preview && Array.isArray(file.parsed_data.preview)) {
    // Store preview data for reference
    structured.csvPreview = file.parsed_data.preview.slice(0, 10);
    structured.csvHeaders = file.parsed_data.headers;
    structured.totalRows = file.parsed_data.totalRows;
  }

  // Add metadata
  if (file.city) structured.city = file.city;
  if (file.zip_code) structured.zipCode = file.zip_code;
  if (file.property_type) structured.propertyType = file.property_type;
  if (file.property_height) structured.propertyHeight = file.property_height;
  if (file.year_built) structured.yearBuilt = file.year_built;
  if (file.unit_count) structured.unitCount = file.unit_count;
  if (file.tags) structured.tags = file.tags;

  return structured;
}

/**
 * Calculate confidence score based on data completeness
 */
function calculateConfidence(file: DataLibraryFile): number {
  let score = 0.5; // Base score for CSV data

  // Increase confidence if we have metadata
  if (file.city) score += 0.1;
  if (file.property_type) score += 0.1;
  if (file.tags && file.tags.length > 0) score += 0.1;
  
  // Increase confidence if parsing was successful and has data
  if (file.parsed_data && file.parsed_data.preview && file.parsed_data.preview.length > 0) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
}

/**
 * Detect data quality flags
 */
function detectQualityFlags(
  file: DataLibraryFile,
  structuredData: Record<string, any>
): Array<{ field: string; issue: string; severity: string }> {
  const flags: Array<{ field: string; issue: string; severity: string }> = [];

  // Check for missing metadata
  if (!file.city) {
    flags.push({
      field: 'property_city',
      issue: 'City not specified',
      severity: 'medium',
    });
  }

  if (!file.property_type) {
    flags.push({
      field: 'property_type',
      issue: 'Property type not specified',
      severity: 'low',
    });
  }

  // Check for empty or small datasets
  if (structuredData.totalRows && structuredData.totalRows < 5) {
    flags.push({
      field: 'data_completeness',
      issue: `Only ${structuredData.totalRows} rows of data`,
      severity: 'medium',
    });
  }

  return flags;
}

// Run if called directly
if (require.main === module) {
  backfillDataLibrary().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { backfillDataLibrary };
