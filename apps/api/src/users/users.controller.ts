import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdatePreferencesDto } from './users.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return user;
  }

  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: dto,
    });
  }
}
