import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './auth.dto';

export interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface LoginResult {
  accessToken: string;
  user: UserInfo;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<UserInfo> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, password: passwordHash },
    });

    return this.toUserInfo(user);
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<UserInfo> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.password)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.toUserInfo(user);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.validateCredentials(email, password);
    const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, user };
  }

  async upsertOAuthUser(
    email: string,
    name?: string,
    avatarUrl?: string,
  ): Promise<UserInfo> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      // Update profile fields that may have changed from the OAuth provider.
      const needsUpdate =
        (name && name !== existing.name) ||
        (avatarUrl && avatarUrl !== existing.avatarUrl);
      if (needsUpdate) {
        const updated = await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            name: name ?? existing.name,
            avatarUrl: avatarUrl ?? existing.avatarUrl,
          },
        });
        return this.toUserInfo(updated);
      }
      return this.toUserInfo(existing);
    }

    const user = await this.prisma.user.create({
      data: { email, name, avatarUrl },
    });
    return this.toUserInfo(user);
  }

  private toUserInfo(user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    isAdmin: boolean;
  }): UserInfo {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
    };
  }
}
