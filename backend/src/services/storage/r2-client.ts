import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../../utils/logger';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET_NAME!;

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  logger.info(`R2 upload: ${key}`);
}

export async function getSignedViewUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteFile(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  logger.info(`R2 delete: ${key}`);
}

export async function testR2Connectivity(): Promise<boolean> {
  try {
    const testKey = `_r2_connectivity_test_${Date.now()}.txt`;
    await uploadFile(testKey, Buffer.from('connectivity ok'), 'text/plain');
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: testKey }));
    return true;
  } catch (err) {
    logger.error('R2 connectivity test failed', err);
    return false;
  }
}
