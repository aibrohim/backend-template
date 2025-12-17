import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ description: 'Storage key for the uploaded file' })
  key: string;

  @ApiProperty({ description: 'Public URL of the uploaded file' })
  url: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ description: 'MIME type of the uploaded file' })
  contentType: string;
}

export class PresignedUrlResponseDto {
  @ApiProperty({ description: 'Presigned URL for upload/download' })
  url: string;

  @ApiProperty({ description: 'Storage key for the file' })
  key: string;

  @ApiProperty({ description: 'URL expiration time in seconds' })
  expiresIn: number;
}
