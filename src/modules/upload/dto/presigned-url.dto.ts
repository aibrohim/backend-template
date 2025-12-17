import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetPresignedUploadUrlDto {
  @ApiProperty({ description: 'Original filename' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiPropertyOptional({ description: 'Folder to store the file in', default: 'uploads' })
  @IsString()
  @IsOptional()
  folder?: string;

  @ApiPropertyOptional({ description: 'URL expiration time in seconds', default: 3600 })
  @IsNumber()
  @IsOptional()
  @Min(60)
  @Max(86400)
  expiresIn?: number;
}

export class GetPresignedDownloadUrlDto {
  @ApiProperty({ description: 'Storage key of the file' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiPropertyOptional({ description: 'URL expiration time in seconds', default: 3600 })
  @IsNumber()
  @IsOptional()
  @Min(60)
  @Max(86400)
  expiresIn?: number;
}
