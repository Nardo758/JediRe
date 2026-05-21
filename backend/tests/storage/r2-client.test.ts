import { describe, it, expect, beforeAll } from 'vitest';
import { testR2Connectivity, uploadFile, getSignedViewUrl, deleteFile } from '../../src/services/storage/r2-client';

const REQUIRED_VARS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const missingVars = REQUIRED_VARS.filter(v => !process.env[v]);
const skip = missingVars.length > 0;

describe.skipIf(skip)('R2 client', () => {
  if (skip) {
    it('skipped — missing env vars: ' + missingVars.join(', '), () => {
      console.warn(`R2 tests skipped. Set: ${missingVars.join(', ')}`);
    });
    return;
  }

  const testKey = `_test_${Date.now()}_vitest.txt`;
  const testBuffer = Buffer.from('vitest r2 probe');

  beforeAll(async () => {
    // clean up any leftover from a prior run
    try { await deleteFile(testKey); } catch { /* ignore */ }
  });

  it('testR2Connectivity() returns true', async () => {
    const ok = await testR2Connectivity();
    expect(ok).toBe(true);
  });

  it('uploads a buffer and generates a signed URL', async () => {
    await expect(uploadFile(testKey, testBuffer, 'text/plain')).resolves.not.toThrow();
    const url = await getSignedViewUrl(testKey, 60);
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain(testKey);
  });

  it('deletes the uploaded test object', async () => {
    await expect(deleteFile(testKey)).resolves.not.toThrow();
  });
});
