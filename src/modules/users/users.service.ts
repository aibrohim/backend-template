import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { CurrentUserPayload } from '@common/types';
import { PrismaService } from '@infra/prisma';
import { UserCacheService } from '@infra/redis';

import { Role } from '@prisma/client';

import { AdminUpdateUserDto, ChangePasswordDto, UpdateUserDto, UserResponse } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private userCache: UserCacheService,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: users.map(UserResponse.fromEntity),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findByUid(uid: string): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { uid, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return UserResponse.fromEntity(user);
  }

  async update(uid: string, dto: UpdateUserDto): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { uid, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: dto,
    });

    await this.userCache.invalidate(user.id);

    return UserResponse.fromEntity(updated);
  }

  async adminUpdate(
    uid: string,
    dto: AdminUpdateUserDto,
    currentUser: CurrentUserPayload,
  ): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { uid, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.uid === currentUser.uid && dto.role) {
      throw new ForbiddenException('Cannot modify your own role');
    }

    if (user.role === Role.superadmin && currentUser.role !== Role.superadmin) {
      throw new ForbiddenException('Cannot modify superadmin users');
    }

    if (dto.role === Role.superadmin && currentUser.role !== Role.superadmin) {
      throw new ForbiddenException('Only superadmin can assign superadmin role');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: dto,
    });

    await this.userCache.invalidate(user.id);

    return UserResponse.fromEntity(updated);
  }

  async changePassword(uid: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { uid, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValidPassword = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValidPassword) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.userCache.invalidate(user.id);
  }

  async delete(uid: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { uid, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    await this.userCache.invalidate(user.id);
  }
}
