import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { CurrentUserPayload } from '@common/types';
import { PrismaService } from '@infra/prisma';
import { UserCacheService } from '@infra/redis';

interface JwtPayload {
  sub: number;
  uid: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private userCache: UserCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    let cachedUser = await this.userCache.get(payload.sub);

    if (!cachedUser) {
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          deletedAt: null,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      await this.userCache.set(user);
      cachedUser = {
        id: user.id,
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        refreshToken: user.refreshToken,
        deletedAt: user.deletedAt,
      };
    }

    if (cachedUser.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    if (!cachedUser.refreshToken) {
      throw new UnauthorizedException('Session expired');
    }

    return {
      id: cachedUser.id,
      uid: cachedUser.uid,
      email: cachedUser.email,
      fullName: cachedUser.fullName,
      role: cachedUser.role as CurrentUserPayload['role'],
    };
  }
}
