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

import {
  AdminUpdateUserDto,
  ChangePasswordDto,
  CreateUserDto,
  GetUsersQueryDto,
  UpdateUserDto,
  UserResponse,
} from './dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private userCache: UserCacheService,
  ) {}

  async findAll(query: GetUsersQueryDto) {
    const { page = 1, limit = 10, search, role } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(role && { role }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
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

  async create(dto: CreateUserDto, currentUser: CurrentUserPayload): Promise<UserResponse> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Only superadmin can assign superadmin role
    if (dto.role === Role.superadmin && currentUser.role !== Role.superadmin) {
      throw new ForbiddenException('Only superadmin can assign superadmin role');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
        role: dto.role || Role.user,
        emailVerified: true, // Admin-created users are pre-verified
      },
    });

    return UserResponse.fromEntity(user);
  }

  async findById(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return UserResponse.fromEntity(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    await this.userCache.invalidate(id);

    return UserResponse.fromEntity(updated);
  }

  async adminUpdate(
    id: string,
    dto: AdminUpdateUserDto,
    currentUser: CurrentUserPayload,
  ): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id === currentUser.id && dto.role) {
      throw new ForbiddenException('Cannot modify your own role');
    }

    if (user.role === Role.superadmin && currentUser.role !== Role.superadmin) {
      throw new ForbiddenException('Cannot modify superadmin users');
    }

    if (dto.role === Role.superadmin && currentUser.role !== Role.superadmin) {
      throw new ForbiddenException('Only superadmin can assign superadmin role');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    await this.userCache.invalidate(id);

    return UserResponse.fromEntity(updated);
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
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
      where: { id },
      data: { password: hashedPassword },
    });

    await this.userCache.invalidate(id);
  }

  async delete(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.userCache.invalidate(id);
  }
}
