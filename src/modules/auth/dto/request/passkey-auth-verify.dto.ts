import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class PasskeyAuthVerifyDto {
  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  credential: Record<string, unknown>;
}
