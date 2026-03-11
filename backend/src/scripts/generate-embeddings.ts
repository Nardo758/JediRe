/**
 * Embedding Generation Script
 * Generates vector embeddings for documents using OpenAI API
 */

import { Pool } from 'pg';
import OpenAI from 'openai';

const BATCH_SIZE = 100;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

interface Document {
  id: string;
  title: string;
  contentText: string | null;
  documentType: string;
  structuredData: any;
}

async function generateEmbeddings(options: { dryRun?: boolean; limit?: number } = {}) {
  console.log('🧠 OpenAI Embedding Generation\n');

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable not set');
    process.exit(1);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

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

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
    console.log('✅ OpenAI API key configured\n');

    // Get documents without embeddings
    let query = `
      SELECT id, title, content_text, document_type, structured_data
      FROM unified_documents
      WHERE content_embedding IS NULL
      ORDER BY created_at DESC
    `;

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await pool.query<Document>(query);
    const documents = result.rows;

    console.log(`📊 Found ${documents.length} documents without embeddings\n`);

    if (documents.length === 0) {
      console.log('✨ All documents already have embeddings!');
      return;
    }

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No embeddings will be generated\n');
      
      // Show sample
      console.log('Sample documents to process:');
      documents.slice(0, 5).forEach((doc, i) => {
        console.log(`  ${i + 1}. [${doc.documentType}] ${doc.title}`);
        console.log(`     Text length: ${doc.contentText?.length || 0} chars`);
      });
      
      const estimatedCost = calculateEstimatedCost(documents);
      console.log(`\n💰 Estimated cost: $${estimatedCost.toFixed(4)}`);
      console.log(`   (${documents.length} docs × ~$0.00002 per doc)`);
      
      return;
    }

    let processedCount = 0;
    let errorCount = 0;
    let totalTokens = 0;

    // Process in batches
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);
      console.log(`   Documents ${i + 1}-${Math.min(i + BATCH_SIZE, documents.length)} of ${documents.length}`);

      for (const doc of batch) {
        try {
          // Prepare text for embedding
          const embeddingText = prepareEmbeddingText(doc);

          if (!embeddingText || embeddingText.trim().length === 0) {
            console.log(`⏭️  Skipping ${doc.title} (no text content)`);
            continue;
          }

          // Truncate if too long (OpenAI limit: ~8191 tokens, ~32k chars)
          const truncatedText = embeddingText.slice(0, 30000);

          // Generate embedding
          const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: truncatedText,
            dimensions: EMBEDDING_DIMENSIONS,
          });

          const embedding = response.data[0].embedding;
          totalTokens += response.usage.total_tokens;

          // Update database
          await pool.query(
            'UPDATE unified_documents SET content_embedding = $1 WHERE id = $2',
            [`[${embedding.join(',')}]`, doc.id]
          );

          console.log(`✅ Generated embedding for: ${doc.title.slice(0, 60)}...`);
          processedCount++;

          // Rate limiting: small delay between requests
          await sleep(100);

        } catch (error: any) {
          console.error(`❌ Failed to generate embedding for ${doc.title}:`, error.message);
          errorCount++;
        }
      }
    }

    const estimatedCost = (totalTokens / 1000000) * 0.02; // $0.02 per 1M tokens

    console.log('\n📊 Embedding Generation Summary:');
    console.log(`  ✅ Successfully generated: ${processedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📁 Total documents: ${documents.length}`);
    console.log(`  🔢 Total tokens: ${totalTokens.toLocaleString()}`);
    console.log(`  💰 Estimated cost: $${estimatedCost.toFixed(4)}`);

  } catch (error: any) {
    console.error('\n❌ Embedding generation failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Prepare text for embedding generation
 */
function prepareEmbeddingText(doc: Document): string {
  const parts: string[] = [];

  // Add title
  parts.push(`Document: ${doc.title}`);
  parts.push(`Type: ${doc.documentType}`);

  // Add content text if available
  if (doc.contentText && doc.contentText.trim().length > 0) {
    parts.push(`\nContent:\n${doc.contentText}`);
  }

  // Add structured data summary
  if (doc.structuredData && Object.keys(doc.structuredData).length > 0) {
    const summary = Object.entries(doc.structuredData)
      .filter(([key, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
    
    if (summary) {
      parts.push(`\nStructured Data:\n${summary}`);
    }
  }

  return parts.join('\n');
}

/**
 * Calculate estimated cost
 */
function calculateEstimatedCost(documents: Document[]): number {
  // Rough estimate: ~500 tokens per document on average
  const estimatedTokens = documents.length * 500;
  return (estimatedTokens / 1000000) * 0.02; // $0.02 per 1M tokens
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: { dryRun?: boolean; limit?: number } = {};

if (args.includes('--dry-run')) {
  options.dryRun = true;
}

const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  options.limit = parseInt(args[limitIndex + 1]);
}

// Run if called directly
if (require.main === module) {
  generateEmbeddings(options).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generateEmbeddings };
