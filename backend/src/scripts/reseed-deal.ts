import { Pool } from 'pg';
import { seedProFormaYear1 } from '../services/proforma-seeder.service';

const dealId = process.argv[2];
if (!dealId) { console.error('Usage: ts-node reseed-deal.ts <dealId>'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const result = await seedProFormaYear1(pool, dealId);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
