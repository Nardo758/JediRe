import 'dotenv/config';
import path from 'path';
import { processDocument } from '../src/services/document-extraction/extraction-pipeline';
import { query } from '../src/database/connection';
import { getPool } from '../src/database/connection';

const FILE_ID = process.argv[2] || '648b72eb-3ae2-40f5-9568-b9955e16eab4';
const DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';
const USER_ID = '6253ba3f-d40d-4597-86ab-270c8397a857';

async function main() {
  console.log(`\nRe-extracting OM file ${FILE_ID} for deal ${DEAL_ID}…\n`);

  const pool = getPool();

  const fileRow = await pool.query(
    `SELECT file_path, original_filename, mime_type FROM deal_files WHERE id = $1`,
    [FILE_ID],
  );
  if (fileRow.rows.length === 0) {
    console.error('File row not found in deal_files');
    process.exit(1);
  }

  const { file_path, original_filename, mime_type } = fileRow.rows[0] as {
    file_path: string;
    original_filename: string;
    mime_type: string | null;
  };

  const absolutePath = path.resolve(__dirname, '..', file_path);
  console.log(`File path: ${absolutePath}`);
  console.log(`Filename:  ${original_filename}`);
  console.log(`MIME:      ${mime_type}\n`);

  await pool.query(
    `UPDATE deal_files SET extraction_status = 'running', extraction_error = NULL, extraction_started_at = NOW() WHERE id = $1`,
    [FILE_ID],
  );

  const t0 = Date.now();
  const result = await processDocument(
    absolutePath,
    original_filename,
    DEAL_ID,
    USER_ID,
    FILE_ID,
    mime_type ?? undefined,
  );
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\nDone in ${dt}s:`);
  console.log(JSON.stringify(result, null, 2));

  const status = result.success ? 'done' : 'failed';
  await pool.query(
    `UPDATE deal_files
        SET extraction_status = $2,
            extraction_result = $3,
            extraction_error = $4,
            extraction_completed_at = NOW()
      WHERE id = $1`,
    [FILE_ID, status, JSON.stringify(result), result.error ?? null],
  );

  const check = await pool.query(
    `SELECT extraction_status, extraction_error FROM deal_files WHERE id = $1`,
    [FILE_ID],
  );
  console.log('\ndeal_files row after update:', check.rows[0]);

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exitCode = 1; });
