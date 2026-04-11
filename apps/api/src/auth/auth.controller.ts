import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  ValidateCredentialsDto,
  UpsertOAuthUserDto,
} from './auth.dto';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
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
}
