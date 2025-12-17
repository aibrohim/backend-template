import { SetMetadata } from '@nestjs/common';

import { Role } from '@prisma/client';

import { ROLES_KEY } from '@core/guards/roles.guard';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
