import { Pool } from 'pg';
import { BenchmarkEnrichmentService } from '../services/benchmark-enrichment.service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const svc = new BenchmarkEnrichmentService(pool);

async function run() {
  const county = process.argv[2] || undefined;
  console.log(`Starting enrichment${county ? ` for ${county}` : ' (all counties)'}...`);
  console.time('enrichment');
  const result = await svc.enrichBenchmarkProjects(county);
  console.timeEnd('enrichment');
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
