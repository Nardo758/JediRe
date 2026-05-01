import { Pool } from 'pg';
import { composeDealFinancials } from './src/services/financials-composer.service';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r: any = await composeDealFinancials(pool, '3f32276f-aacd-4da3-b306-317c5109b403', '6253ba3f-d40d-4597-86ab-270c8397a857');
    const proforma = r.data.proforma;
    console.log('proforma keys:', Object.keys(proforma));
    const rows = proforma.year1 || proforma.osRows || proforma.rows || [];
    console.log(`Rows: ${rows.length}`);
    for (const row of rows) {
      const field = row.field ?? '?';
      const label = row.label ?? '';
      const resolved = row.resolved;
      const src = row.source ?? row.resolution ?? '';
      const t12 = row.t12;
      const platform = row.platform;
      const rr = row.rentRoll;
      console.log(`  ${field.padEnd(25)} ${label.padEnd(35)} resolved=${String(resolved).slice(0,18).padEnd(18)} src=${String(src).padEnd(10)} t12=${String(t12).slice(0,12).padEnd(12)} plat=${String(platform).slice(0,12).padEnd(12)} rr=${String(rr).slice(0,12)}`);
    }
  } catch (e) {
    console.error('ERROR:', (e as Error).message);
  } finally {
    await pool.end();
  }
})();
