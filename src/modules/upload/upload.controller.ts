import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  GetPresignedDownloadUrlDto,
  GetPresignedUploadUrlDto,
  PresignedUrlResponseDto,
  UploadResponseDto,
} from './dto';
import { UploadService } from './upload.service';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file directly' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: 'Optional folder to store the file in',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: UploadResponseDto })
  async uploadFile(
    @UploadedFile() file: MulterFile,
    @Body('folder') folder?: string,
  ): Promise<UploadResponseDto> {
    return this.uploadService.uploadFile(file, folder);
  }

  @Post('presigned/upload')
  @ApiOperation({ summary: 'Get a presigned URL for client-side upload' })
  @ApiResponse({ status: HttpStatus.OK, type: PresignedUrlResponseDto })
  async getPresignedUploadUrl(
    @Body() dto: GetPresignedUploadUrlDto,
  ): Promise<PresignedUrlResponseDto> {
    return this.uploadService.getPresignedUploadUrl(dto);
  }

  @Post('presigned/download')
  @ApiOperation({ summary: 'Get a presigned URL for file download' })
  @ApiResponse({ status: HttpStatus.OK, type: PresignedUrlResponseDto })
  async getPresignedDownloadUrl(
    @Body() dto: GetPresignedDownloadUrlDto,
  ): Promise<PresignedUrlResponseDto> {
    return this.uploadService.getPresignedDownloadUrl(dto);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file by its storage key' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async deleteFile(@Param('key') key: string): Promise<void> {
    await this.uploadService.deleteFile(decodeURIComponent(key));
  }
}
