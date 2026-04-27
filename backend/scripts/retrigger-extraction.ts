import { processDealDocuments } from '../src/services/document-extraction/extraction-pipeline';
import { getPool } from '../src/database/connection';

async function main() {
  const dealId = process.argv[2];
  if (!dealId) { console.error('usage: tsx retrigger-extraction.ts <dealId>'); process.exit(1); }
  const pool = getPool();
  const owner = await pool.query('SELECT user_id FROM deals WHERE id = $1', [dealId]);
  if (owner.rows.length === 0) { console.error('Deal not found'); process.exit(1); }
  const userId = owner.rows[0].user_id;
  console.log(`Reprocessing deal ${dealId} (uploadedBy=${userId})...`);
  const result = await processDealDocuments(dealId, userId);
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
