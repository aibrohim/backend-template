import { Role } from '@prisma/client';

export interface CurrentUserPayload {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: Role;
}
