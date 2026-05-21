import { testR2Connectivity } from '../services/storage/r2-client';

const REQUIRED_VARS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];

async function main() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`SKIP — missing env vars: ${missing.join(', ')}`);
    console.error('Add them as Replit secrets, then re-run.');
    process.exit(1);
  }

  console.log('Testing R2 connectivity...');
  const ok = await testR2Connectivity();
  if (ok) {
    console.log('PASS — R2 bucket reachable, write + delete confirmed.');
    process.exit(0);
  } else {
    console.error('FAIL — R2 connectivity test failed. Check credentials and bucket name.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
