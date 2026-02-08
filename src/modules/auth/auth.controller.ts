import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUserPayload } from '@common/types';
import { CurrentUser, Public } from '@core/decorators';

import { AuthService } from './auth.service';
import {
  AuthResponse,
  ForgotPasswordDto,
  MessageResponse,
  PasskeyAuthOptionsDto,
  PasskeyAuthVerifyDto,
  PasskeyRegisterVerifyDto,
  PasskeyResponse,
  RefreshTokenDto,
  ResetPasswordDto,
  SigninDto,
  SignupDto,
  VerifyEmailDto,
} from './dto';
import { PasskeyService } from './services';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passkeyService: PasskeyService,
  ) {}

  @Public()
  @Post('signup')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponse })
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('signin')
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({ status: 200, type: AuthResponse })
  signin(@Body() dto: SigninDto): Promise<AuthResponse> {
    return this.authService.signin(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current user' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  logout(@CurrentUser() user: CurrentUserPayload): Promise<void> {
    return this.authService.logout(user.id);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, type: AuthResponse })
  refreshTokens(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refreshTokens(dto);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, type: MessageResponse })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponse> {
    await this.authService.forgotPassword(dto);
    return { message: 'If an account with that email exists, a password reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, type: MessageResponse })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponse> {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successfully' };
  }

  @Public()
  @Post('verify-email')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, type: MessageResponse })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponse> {
    await this.authService.verifyEmail(dto);
    return { message: 'Email verified successfully' };
  }

  @Public()
  @Post('resend-verification')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, type: MessageResponse })
  async resendVerification(@Query('email') email: string): Promise<MessageResponse> {
    await this.authService.resendVerificationEmail(email);
    return {
      message:
        'If an account with that email exists and is not verified, a verification email has been sent',
    };
  }

  @Public()
  @Post('passkey/auth/options')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate passkey authentication options' })
  async passkeyAuthOptions(@Body() dto: PasskeyAuthOptionsDto) {
    return this.passkeyService.generateAuthenticationOptions(dto.email);
  }

  @Public()
  @Post('passkey/auth/verify')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify passkey authentication' })
  @ApiResponse({ status: 200, type: AuthResponse })
  async passkeyAuthVerify(@Body() dto: PasskeyAuthVerifyDto): Promise<AuthResponse> {
    const userId = await this.passkeyService.verifyAuthentication(dto.credential as any);
    return this.authService.signinWithPasskey(userId);
  }

  @Post('passkey/register/options')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate passkey registration options' })
  async passkeyRegisterOptions(@CurrentUser() user: CurrentUserPayload) {
    return this.passkeyService.generateRegistrationOptions(user.id);
  }

  @Post('passkey/register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify passkey registration' })
  @ApiResponse({ status: 200, type: PasskeyResponse })
  async passkeyRegisterVerify(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PasskeyRegisterVerifyDto,
  ): Promise<PasskeyResponse> {
    const passkey = await this.passkeyService.verifyRegistration(
      user.id,
      dto.credential as any,
      dto.name,
    );
    return PasskeyResponse.fromEntity(passkey);
  }

  @Get('passkeys')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List current user passkeys' })
  @ApiResponse({ status: 200, type: [PasskeyResponse] })
  async listPasskeys(@CurrentUser() user: CurrentUserPayload): Promise<PasskeyResponse[]> {
    const passkeys = await this.passkeyService.getUserPasskeys(user.id);
    return passkeys.map(PasskeyResponse.fromEntity);
  }

  @Delete('passkeys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a passkey' })
  @ApiResponse({ status: 204, description: 'Passkey deleted successfully' })
  async deletePasskey(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.passkeyService.deletePasskey(user.id, id);
  }
}
