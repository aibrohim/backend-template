import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

import { ApiBadRequestException, ApiNotFoundException } from '@common/exceptions';
import { PrismaService } from '@infra/prisma';

@Injectable()
export class PasskeyService {
  private readonly rpName: string;
  private readonly rpID: string;
  private readonly expectedOrigins: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.rpName = this.configService.get<string>('PASSKEY_RP_NAME', 'My App');
    this.rpID = this.configService.get<string>('PASSKEY_RP_ID', 'localhost');

    const origin = this.configService.get<string>('PASSKEY_ORIGIN', 'http://localhost:3000');
    this.expectedOrigins = [origin];

    const androidKeyHashes = this.configService.get<string>('PASSKEY_ANDROID_KEY_HASHES');
    if (androidKeyHashes) {
      const hashes = androidKeyHashes
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      for (const hash of hashes) {
        this.expectedOrigins.push(`android:apk-key-hash:${hash}`);
      }
    }
  }

  async generateRegistrationOptions(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new ApiNotFoundException('User not found');
    }

    await this.prisma.passkeyChallenge.deleteMany({
      where: { userId, type: 'registration' },
    });

    const existingPasskeys = await this.prisma.passkey.findMany({
      where: { userId },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: new TextEncoder().encode(userId),
      userName: user.email,
      userDisplayName: user.fullName || user.email,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await this.prisma.passkeyChallenge.create({
      data: {
        userId,
        challenge: options.challenge,
        type: 'registration',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return options;
  }

  async verifyRegistration(userId: string, credential: RegistrationResponseJSON, name?: string) {
    const challenge = await this.prisma.passkeyChallenge.findFirst({
      where: {
        userId,
        type: 'registration',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new ApiBadRequestException('Registration challenge not found or expired');
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.expectedOrigins,
      expectedRPID: this.rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new ApiBadRequestException('Registration verification failed');
    }

    const {
      credential: verifiedCredential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    const credentialId = Buffer.from(verifiedCredential.id).toString('base64url');

    const existingPasskey = await this.prisma.passkey.findUnique({
      where: { credentialId },
    });

    if (existingPasskey) {
      throw new ApiBadRequestException('This passkey is already registered');
    }

    const passkey = await this.prisma.passkey.create({
      data: {
        userId,
        credentialId,
        publicKey: Buffer.from(verifiedCredential.publicKey).toString('base64'),
        counter: verifiedCredential.counter,
        transports: credential.response.transports || [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name: name || 'Passkey',
      },
    });

    await this.prisma.passkeyChallenge.delete({ where: { id: challenge.id } });

    return passkey;
  }

  async generateAuthenticationOptions(email?: string) {
    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];
    let userId: string | undefined;

    if (email) {
      const user = await this.prisma.user.findFirst({
        where: { email, deletedAt: null },
      });

      if (!user) {
        throw new ApiNotFoundException('User not found');
      }

      userId = user.id;

      const passkeys = await this.prisma.passkey.findMany({
        where: { userId },
      });

      if (passkeys.length === 0) {
        throw new ApiNotFoundException('No passkeys found for this user');
      }

      await this.prisma.passkeyChallenge.deleteMany({
        where: { userId, type: 'authentication' },
      });

      allowCredentials = passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred',
    });

    await this.prisma.passkeyChallenge.create({
      data: {
        userId: userId || null,
        challenge: options.challenge,
        type: 'authentication',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return options;
  }

  async verifyAuthentication(credential: AuthenticationResponseJSON): Promise<string> {
    const credentialId = Buffer.from(credential.id).toString('base64url');

    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId },
    });

    if (!passkey) {
      throw new ApiNotFoundException('Passkey not found');
    }

    const challenge = await this.prisma.passkeyChallenge.findFirst({
      where: {
        OR: [
          { userId: passkey.userId, type: 'authentication' },
          { userId: null, type: 'authentication' },
        ],
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new ApiBadRequestException('Authentication challenge not found or expired');
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.expectedOrigins,
      expectedRPID: this.rpID,
      credential: {
        id: credential.id,
        publicKey: Buffer.from(passkey.publicKey, 'base64'),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new ApiBadRequestException('Authentication verification failed');
    }

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    await this.prisma.passkeyChallenge.delete({ where: { id: challenge.id } });

    return passkey.userId;
  }

  async getUserPasskeys(userId: string) {
    return this.prisma.passkey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletePasskey(userId: string, passkeyId: string) {
    const passkey = await this.prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    });

    if (!passkey) {
      throw new ApiNotFoundException('Passkey not found');
    }

    await this.prisma.passkey.delete({ where: { id: passkeyId } });
  }
}
