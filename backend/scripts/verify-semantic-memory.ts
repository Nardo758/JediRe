import { Pool } from 'pg';
import { getEmbeddingsService } from '../src/services/neural-network/embeddings.service';
import { getKnowledgeGraphService } from '../src/services/neural-network/knowledge-graph.service';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const svc = getEmbeddingsService(pool);
  const graph = getKnowledgeGraphService(pool);

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

  // ----------------------------------------------------------------------
  // Hybrid search assertion: a meaning-based query that pure keyword
  // search cannot satisfy. None of the seeded node names or descriptions
  // contain the literal words in this query; only the semantic branch
  // can surface relevant Markets here.
  // ----------------------------------------------------------------------
  const meaningQuery = 'Lone Star State apartment market';
  console.log(`\n— hybridSearch (meaning-only): "${meaningQuery}"`);

  // 1) Pure keyword baseline: temporarily run BM25 only by stripping the
  //    OPENAI key off the env *would* require restart — instead we just
  //    inspect the keyword path by counting BM25 matches via raw SQL.
  const bm25 = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM knowledge_graph_nodes
      WHERE to_tsvector('english', name || ' ' || COALESCE(properties->>'description', ''))
            @@ plainto_tsquery('english', $1)`,
    [meaningQuery]
  );
  console.log(`   BM25-only baseline: ${bm25.rows[0].n} matches`);

  // 2) Hybrid (auto-embed kicks in because no embedding arg passed)
  const hybrid = await graph.hybridSearch(meaningQuery, undefined, ['Market'], 5);
  console.log(`   Hybrid results: ${hybrid.length}`);
  for (const h of hybrid) {
    console.log(`     ${h.score.toFixed(5)}  [${h.matchType.padEnd(8)}]  ${h.node.name}`);
  }

  if (hybrid.length === 0) {
    throw new Error('hybridSearch returned 0 results for a query that should match semantically');
  }
  const top = hybrid[0];
  if (top.matchType !== 'semantic' && top.matchType !== 'hybrid') {
    throw new Error(
      `Expected top hybridSearch hit to come from semantic/hybrid path, got matchType="${top.matchType}". ` +
      `Auto-embedding inside hybridSearch is not wired correctly.`
    );
  }
  // Texas markets should dominate the top hits (Austin/Houston/Dallas).
  const topName = top.node.name.toLowerCase();
  if (!topName.includes('tx')) {
    console.warn(
      `   WARN: top hit "${top.node.name}" is not a Texas market — semantic ranking may be weak, ` +
      `but auto-embed wiring still works (matchType=${top.matchType}).`
    );
  } else {
    console.log(`   PASS: top hit is a Texas market (${top.node.name}) via ${top.matchType}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('VERIFY FAILED:', err);
  process.exit(1);
});
