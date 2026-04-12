import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('AUTH_SECRET'),
        signOptions: { algorithm: 'HS256', expiresIn: '7d' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, InternalApiKeyGuard],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
