import { Pool } from 'pg';
import { getEmbeddingsService } from '../src/services/neural-network/embeddings.service';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const svc = getEmbeddingsService(pool);

  console.log('— hasKey:', svc.hasKey(), 'modelInfo:', svc.modelInfo());
  console.log('— before:', await svc.countEmbedded());

  console.log('— backfilling all missing…');
  const stats = await svc.embedAllMissing({ batchSize: 64, max: 500 });
  console.log('— stats:', stats);

  console.log('— after:', await svc.countEmbedded());

  for (const q of [
    'austin multifamily rent growth',
    'class A property near transit',
    'recent sale comp downtown',
  ]) {
    const hits = await svc.similaritySearch(q, 5);
    console.log(`\n— search "${q}" → ${hits.length} hits`);
    for (const h of hits) {
      console.log(`   ${h.similarity.toFixed(4)}  ${h.type.padEnd(10)} ${h.name}`);
    }
  }

  // Re-embed sanity: second backfill should hit cache, generate 0.
  const stats2 = await svc.embedAllMissing({ batchSize: 64, max: 500 });
  console.log('\n— second backfill (should embed 0):', stats2);

  await pool.end();
}

main().catch(err => {
  console.error('VERIFY FAILED:', err);
  process.exit(1);
});
