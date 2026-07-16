import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.client = new Client({
      endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
      port: config.getOrThrow<number>('MINIO_PORT'),
      useSSL: config.getOrThrow<boolean>('MINIO_USE_SSL'),
      accessKey: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
    });
    this.bucket = config.getOrThrow<string>('MINIO_BUCKET');
    this.publicUrl = config
      .getOrThrow<string>('MINIO_PUBLIC_URL')
      .replace(/\/$/, '');
  }

  async onModuleInit(): Promise<void> {
    const exists = await this.client
      .bucketExists(this.bucket)
      .catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      // Product images are served directly to buyers/officials browsing the
      // catalogue — public-read is intentional, not a leak (no PII in this bucket).
      await this.client.setBucketPolicy(
        this.bucket,
        JSON.stringify(publicReadPolicy(this.bucket)),
      );
      this.logger.log(
        `Created bucket "${this.bucket}" with public-read policy`,
      );
    }
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return `${this.publicUrl}/${key}`;
  }

  async remove(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}

function publicReadPolicy(bucket: string) {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  };
}
