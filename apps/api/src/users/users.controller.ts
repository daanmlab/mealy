import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import {
  UpdatePreferencesDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './users.dto';
import { PrismaService } from '../prisma/prisma.service';

type SafeUser = Omit<User, 'password'>;

function stripPassword(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...safe } = user;
  return safe;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: User): SafeUser {
    return stripPassword(user);
  }

  @Patch('me/profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    return stripPassword(await this.users.updateProfile(user, dto));
  }

  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<SafeUser> {
    return stripPassword(
      await this.prisma.user.update({ where: { id: user.id }, data: dto }),
    );
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.users.changePassword(user, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.deleteUser(user.id);
    res.clearCookie('refresh_token');
  }
}
