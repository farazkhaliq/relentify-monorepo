import type { StorageProvider } from './index';

export class R2StorageProvider implements StorageProvider {
  private getClient() {
    // webpackIgnore: true prevents webpack from trying to bundle this optional dep
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client } = require(/* webpackIgnore: true */ '@aws-sdk/client-s3');
    return new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  private get bucket(): string {
    return process.env.R2_BUCKET_NAME!;
  }

  async upload(attachmentId: string, buffer: Buffer, mimeType: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PutObjectCommand } = require(/* webpackIgnore: true */ '@aws-sdk/client-s3');
    const fileKey = `attachments/${attachmentId}`;
    await this.getClient().send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }));
    return fileKey;
  }

  async download(_fileKey: string): Promise<null> {
    // R2 serves via presigned URL, not through this app
    return null;
  }

  async delete(fileKey: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DeleteObjectCommand } = require(/* webpackIgnore: true */ '@aws-sdk/client-s3');
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: fileKey }));
  }

  async getUrl(fileKey: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GetObjectCommand } = require(/* webpackIgnore: true */ '@aws-sdk/client-s3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedUrl } = require(/* webpackIgnore: true */ '@aws-sdk/s3-request-presigner');
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }),
      { expiresIn: 3600 }
    );
  }
}
