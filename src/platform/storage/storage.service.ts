import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storageConfig } from '../../config/storage.config';

export const UPLOAD_URL_TTL_SECONDS = 300;
const DOWNLOAD_URL_TTL_SECONDS = 60;

@Injectable()
export class StorageService {
  private readonly client = new S3Client({
    region: storageConfig.region,
    forcePathStyle: Boolean(storageConfig.endpoint),
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
    },
    ...(storageConfig.endpoint ? { endpoint: storageConfig.endpoint } : {}),
  });

  async createPrivateUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: storageConfig.privateBucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: 'aws:kms',
    });
    return getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  async createPrivateDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: storageConfig.privateBucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  }

  // Public bucket: no SSE-KMS (nothing confidential) and no signed GET — public media is served
  // straight from CDN per 02-TRD.md ("CloudFront | Public media delivery"), only the upload side
  // needs a presigned PUT.
  async createPublicUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: storageConfig.publicBucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  // The public URL's scheme is configurable rather than hardcoded: production serves media over
  // HTTPS through a CDN, but a local MinIO endpoint is plain HTTP, and a hardcoded `https://` made
  // every local public URL unreachable. Default is https; set PUBLIC_MEDIA_SCHEME=http locally.
  getPublicUrl(key: string): string {
    return `${storageConfig.publicUrlScheme}://${storageConfig.cdnDomain}/${key}`;
  }

  // Object cleanup: detaching a product image or removing a seller document must also remove the
  // stored object, or the public bucket keeps serving an orphaned image forever. S3 treats a
  // delete of a missing key as success (204), so a double-delete or a key that was never uploaded
  // is not an error.
  async deletePublicObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: storageConfig.publicBucket, Key: key }),
    );
  }

  async deletePrivateObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: storageConfig.privateBucket, Key: key }),
    );
  }
}
