import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Passkey } from '@prisma/client';

export class PasskeyResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  credentialId: string;

  @ApiPropertyOptional()
  deviceType: string | null;

  @ApiProperty()
  backedUp: boolean;

  @ApiPropertyOptional()
  name: string | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(passkey: Passkey): PasskeyResponse {
    return {
      id: passkey.id,
      credentialId: passkey.credentialId,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
      name: passkey.name,
      createdAt: passkey.createdAt,
    };
  }
}
