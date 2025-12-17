import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageService, UploadResult } from '@infra/storage';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

import {
  GetPresignedDownloadUrlDto,
  GetPresignedUploadUrlDto,
  PresignedUrlResponseDto,
} from './dto';

@Injectable()
export class UploadService {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private storageService: StorageService,
    private configService: ConfigService,
  ) {
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 10 * 1024 * 1024);
    this.allowedMimeTypes = this.configService
      .get<string>(
        'ALLOWED_MIME_TYPES',
        'image/jpeg,image/png,image/gif,image/webp,application/pdf',
      )
      .split(',');
  }

  async uploadFile(file: MulterFile, folder: string = 'uploads'): Promise<UploadResult> {
    this.validateFile(file);

    const key = this.storageService.generateKey(folder, file.originalname);

    return this.storageService.upload(key, file.buffer, file.mimetype);
  }

  async getPresignedUploadUrl(dto: GetPresignedUploadUrlDto): Promise<PresignedUrlResponseDto> {
    if (!this.allowedMimeTypes.includes(dto.contentType)) {
      throw new BadRequestException(
        `Content type ${dto.contentType} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    const folder = dto.folder || 'uploads';
    const key = this.storageService.generateKey(folder, dto.filename);
    const expiresIn = dto.expiresIn || 3600;

    const url = await this.storageService.getPresignedUploadUrl(key, dto.contentType, {
      expiresIn,
    });

    return { url, key, expiresIn };
  }

  async getPresignedDownloadUrl(dto: GetPresignedDownloadUrlDto): Promise<PresignedUrlResponseDto> {
    const expiresIn = dto.expiresIn || 3600;

    const url = await this.storageService.getPresignedDownloadUrl(dto.key, { expiresIn });

    return { url, key: dto.key, expiresIn };
  }

  async deleteFile(key: string): Promise<void> {
    await this.storageService.delete(key);
  }

  private validateFile(file: MulterFile): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds the limit of ${this.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }
}
