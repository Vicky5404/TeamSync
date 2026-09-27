import { Readable } from 'node:stream';

import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.js';

export interface ObjectHead {
  size: number;
  contentType: string | undefined;
}

/** RFC 6266 / 5987 Content-Disposition that is safe for any file name. */
export function contentDisposition(
  fileName: string,
  disposition: 'attachment' | 'inline' = 'attachment',
) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * S3-compatible object storage. File bytes never touch PostgreSQL — only their
 * keys and metadata. Buckets are private; browsers receive short-lived
 * presigned URLs.
 */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  /** Signs URLs with the browser-reachable endpoint (may differ inside Docker). */
  private readonly signer: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: AppConfig) {
    const { storage } = config;
    const base: S3ClientConfig = {
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      // The SDK otherwise signs a CRC32 of an empty body into presigned PUT URLs,
      // which breaks browser uploads (and some S3-compatible stores).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      ...(storage.accessKeyId && storage.secretAccessKey
        ? {
            credentials: {
              accessKeyId: storage.accessKeyId,
              secretAccessKey: storage.secretAccessKey,
            },
          }
        : {}),
    };
    this.bucket = storage.bucket;
    this.client = new S3Client({
      ...base,
      ...(storage.endpoint ? { endpoint: storage.endpoint } : {}),
    });
    const publicEndpoint = storage.publicEndpoint ?? storage.endpoint;
    this.signer =
      publicEndpoint === storage.endpoint
        ? this.client
        : new S3Client({ ...base, ...(publicEndpoint ? { endpoint: publicEndpoint } : {}) });
  }

  /**
   * Outside production, create the bucket on startup if it's missing so local
   * S3-compatible stores work without extra setup. Production buckets are
   * provisioned (with lifecycle/encryption policies) by infrastructure code.
   */
  async onModuleInit(): Promise<void> {
    if (this.config.isProduction || this.config.isTest) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status !== 404) {
        this.logger.warn(
          `Object storage not reachable (${error instanceof Error ? error.message : String(error)})`,
        );
        return;
      }
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created bucket "${this.bucket}"`);
      } catch (createError) {
        this.logger.warn(
          `Could not create bucket "${this.bucket}": ${createError instanceof Error ? createError.message : String(createError)}`,
        );
      }
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
    if (this.signer !== this.client) this.signer.destroy();
  }

  async putObject(
    key: string,
    body: Buffer,
    options: { contentType: string; fileName?: string; cacheControl?: string },
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        ContentLength: body.length,
        ...(options.fileName ? { ContentDisposition: contentDisposition(options.fileName) } : {}),
        ...(options.cacheControl ? { CacheControl: options.cacheControl } : {}),
      }),
    );
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: head.ContentLength ?? 0, contentType: head.ContentType };
    } catch (error) {
      if (error instanceof NotFound || (error as { name?: string }).name === 'NotFound')
        return null;
      throw error;
    }
  }

  /** First `length` bytes of an object (content sniffing after direct uploads). */
  async readRange(key: string, length: number): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${length - 1}` }),
    );
    const body = response.Body;
    if (!(body instanceof Readable)) return Buffer.alloc(0);
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks);
  }

  /** Presigned GET that forces a download with the original file name. */
  async presignDownload(
    key: string,
    options: { fileName: string; inline?: boolean; expiresIn?: number },
  ): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(
          options.fileName,
          options.inline ? 'inline' : 'attachment',
        ),
      }),
      { expiresIn: options.expiresIn ?? this.config.storage.signedUrlTtlSeconds },
    );
  }

  /**
   * Presigned PUT for direct browser uploads. Content type and length are part
   * of the signature, so the client cannot upload something else.
   */
  async presignUpload(
    key: string,
    options: { contentType: string; contentLength: number; expiresIn?: number },
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const url = await getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: options.contentType,
        ContentLength: options.contentLength,
      }),
      {
        expiresIn: options.expiresIn ?? this.config.storage.signedUrlTtlSeconds,
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );
    return {
      url,
      headers: {
        'Content-Type': options.contentType,
        'Content-Length': String(options.contentLength),
      },
    };
  }

  async deleteObjects(keys: string[]): Promise<void> {
    for (let index = 0; index < keys.length; index += 1000) {
      const batch = keys.slice(index, index + 1000);
      const result = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      if (result.Errors?.length) {
        throw new Error(
          `Failed to delete ${result.Errors.length} object(s): ${result.Errors[0]?.Message ?? ''}`,
        );
      }
    }
  }

  /** Delete every object under a prefix (e.g. all files of a deleted organization). */
  async deletePrefix(prefix: string): Promise<number> {
    if (!prefix.endsWith('/'))
      throw new Error('Refusing to purge a prefix without a trailing slash');
    let deleted = 0;
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      const keys = (page.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => !!key);
      if (keys.length > 0) await this.deleteObjects(keys);
      deleted += keys.length;
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    this.logger.log(`Purged ${deleted} object(s) under ${prefix}`);
    return deleted;
  }
}
