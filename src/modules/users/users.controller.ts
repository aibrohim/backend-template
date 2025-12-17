import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PaginationQueryDto } from '@common/dto';
import { CurrentUserPayload } from '@common/types';
import { CurrentUser, Roles } from '@core/decorators';
import { RolesGuard } from '@core/guards';

import { Role } from '@prisma/client';

import { AdminUpdateUserDto, ChangePasswordDto, UpdateUserDto, UserResponse } from './dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.superadmin, Role.admin)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns paginated users' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query.page, query.limit);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserResponse })
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findByUid(user.uid);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: UserResponse })
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.uid, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: 204, description: 'Password changed successfully' })
  changePassword(@CurrentUser() user: CurrentUserPayload, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.uid, dto);
  }

  @Get(':uid')
  @UseGuards(RolesGuard)
  @Roles(Role.superadmin, Role.admin)
  @ApiOperation({ summary: 'Get user by UID (Admin only)' })
  @ApiResponse({ status: 200, type: UserResponse })
  findOne(@Param('uid') uid: string) {
    return this.usersService.findByUid(uid);
  }

  @Patch(':uid')
  @UseGuards(RolesGuard)
  @Roles(Role.superadmin, Role.admin)
  @ApiOperation({ summary: 'Update user (Admin only)' })
  @ApiResponse({ status: 200, type: UserResponse })
  update(
    @Param('uid') uid: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.usersService.adminUpdate(uid, dto, currentUser);
  }

  @Delete(':uid')
  @UseGuards(RolesGuard)
  @Roles(Role.superadmin, Role.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  delete(@Param('uid') uid: string) {
    return this.usersService.delete(uid);
  }
}
