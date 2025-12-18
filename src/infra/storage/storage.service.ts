import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface PresignedUrlOptions {
  expiresIn?: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private configService: ConfigService) {
    const useLocalStack = this.configService.get<string>('USE_LOCALSTACK', 'false') === 'true';

    if (useLocalStack) {
      this.client = new S3Client({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
        endpoint: this.configService.get<string>('LOCALSTACK_ENDPOINT', 'http://localhost:4566'),
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
        },
        forcePathStyle: true,
      });
      this.bucket = this.configService.get<string>('R2_BUCKET_NAME', 'local-uploads');
      this.publicUrl = `${this.configService.get<string>('LOCALSTACK_ENDPOINT', 'http://localhost:4566')}/${this.bucket}`;
    } else {
      const accountId = this.configService.get<string>('R2_ACCOUNT_ID', '');
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.configService.get<string>('R2_ACCESS_KEY_ID', ''),
          secretAccessKey: this.configService.get<string>('R2_SECRET_ACCESS_KEY', ''),
        },
      });
      this.bucket = this.configService.get<string>('R2_BUCKET_NAME', '');
      this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL', '');
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    try {
      await this.client.send(command);
      this.logger.log(`File uploaded: ${key}`);

      return {
        key,
        url: this.getPublicUrl(key),
        size: body.length,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}: ${error.message}`);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
      this.logger.log(`File deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}: ${error.message}`);
      throw error;
    }
  }

  async getPresignedDownloadUrl(key: string, options: PresignedUrlOptions = {}): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const expiresIn = options.expiresIn ?? 3600;

    try {
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${key}: ${error.message}`);
      throw error;
    }
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    options: PresignedUrlOptions = {},
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const expiresIn = options.expiresIn ?? 3600;

    try {
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      this.logger.error(`Failed to generate presigned upload URL for ${key}: ${error.message}`);
      throw error;
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  generateKey(folder: string, filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${folder}/${timestamp}-${sanitizedFilename}`;
  }
}
