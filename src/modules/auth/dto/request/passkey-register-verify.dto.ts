import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class PasskeyRegisterVerifyDto {
  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  credential: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}
