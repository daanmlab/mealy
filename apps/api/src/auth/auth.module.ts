import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PassportModule, UsersModule],
  providers: [AuthService, JwtStrategy, InternalApiKeyGuard],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
