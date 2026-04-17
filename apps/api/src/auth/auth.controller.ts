import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  ValidateCredentialsDto,
  UpsertOAuthUserDto,
  ConvertGuestDto,
  MergeGuestDto,
} from './auth.dto';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { UserInfo } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async register(@Body() dto: RegisterDto): Promise<UserInfo> {
    return this.authService.register(dto);
  }

  @Post('validate-credentials')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async validateCredentials(
    @Body() dto: ValidateCredentialsDto,
  ): Promise<UserInfo> {
    return this.authService.validateCredentials(dto.email, dto.password);
  }

  @Post('upsert-oauth-user')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  async upsertOAuthUser(@Body() dto: UpsertOAuthUserDto): Promise<UserInfo> {
    return this.authService.upsertOAuthUser(dto.email, dto.name, dto.avatarUrl);
  }

  @Post('create-guest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  async createGuest(): Promise<UserInfo> {
    return this.authService.createGuest();
  }

  @Post('convert-guest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async convertGuest(
    @CurrentUser() user: User,
    @Body() dto: ConvertGuestDto,
  ): Promise<UserInfo> {
    return this.authService.convertGuest(
      user.id,
      dto.email,
      dto.password,
      dto.name,
    );
  }

  @Post('merge-guest')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async mergeGuest(
    @CurrentUser() user: User,
    @Body() dto: MergeGuestDto,
  ): Promise<void> {
    await this.authService.mergeGuest(user.id, dto.guestId, dto.mergeToken);
  }
}
