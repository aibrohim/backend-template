import { ApiProperty } from '@nestjs/swagger';

import { UserResponse } from '@/modules/users/dto';

export class AuthResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: UserResponse })
  user: UserResponse;
}

export class MessageResponse {
  @ApiProperty()
  message: string;
}
