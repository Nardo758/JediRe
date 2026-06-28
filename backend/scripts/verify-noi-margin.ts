import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function run() {
  const rows = await db.execute(sql`
    SELECT periodic_seed
    FROM deal_assumptions
    WHERE deal_id = 'eaabeb9f-830e-44f9-a923-56679ad0329d'
      AND periodic_seed IS NOT NULL
    LIMIT 1
  `);
  const seed = (rows.rows[0] as any).periodic_seed;

  const noiP: any[] = seed.fields?.noi?.periods ?? [];
  const egiP: any[] = seed.fields?.egi?.periods ?? [];

  const noi2025 = noiP.filter((p: any) => p.month >= '2025-01' && p.month <= '2025-12');
  const egi2025 = egiP.filter((p: any) => p.month >= '2025-01' && p.month <= '2025-12');

  const annualNoi = noi2025.reduce((s: number, p: any) => s + (p.resolved ?? 0), 0);
  const egiMonth  = egi2025[0]?.resolved ?? 0;   // The stored per-slot value
  const egiSum12x = egi2025.reduce((s: number, p: any) => s + (p.resolved ?? 0), 0);

  console.log('\n=== V1 TRUTH (from DB, independent of computeCorrectAnnualSeries) ===');
  console.log(`annual_noi  = Σ(12 monthly NOI)        = $${annualNoi.toFixed(2)}`);
  console.log(`egi_per_slot = stored monthly value      = $${egiMonth.toFixed(2)}  (annual figure stored 12×)`);
  console.log(`egi_sum_12x  = Σ(12 monthly EGI slots)  = $${egiSum12x.toFixed(2)}`);
  console.log('');
  console.log(`V1 TRUTH  annual_noi / egi_per_slot = ${(annualNoi / egiMonth * 100).toFixed(4)}%`);
  console.log(`CODE GIVES annual_noi / egi_sum_12x = ${(annualNoi / egiSum12x * 100).toFixed(4)}%`);
  console.log(`SUM-OF-RATIOS (the "trap")           = ${noi2025.reduce((s: number, p: any) => s + (p.resolved / egiMonth), 0) * 100 .toFixed(4)}%`);
  console.log('');
  const codeResult = annualNoi / egiSum12x * 100;
  const truth      = annualNoi / egiMonth  * 100;
  console.log(`VERDICT: code gives ${codeResult.toFixed(2)}% vs truth ${truth.toFixed(2)}% → ${Math.abs(codeResult - truth) > 1 ? 'FAIL ✗' : 'PASS ✓'}`);

  process.exit(0);
}
run().catch((e: any) => { console.error(e.message); process.exit(1); });
