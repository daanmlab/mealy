import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './auth.dto';

export interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isGuest: boolean;
  guestMergeToken?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
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

  async createGuest(): Promise<UserInfo> {
    const user = await this.prisma.user.create({
      data: {
        email: `guest_${randomUUID()}@guest.mealy`,
        isGuest: true,
        guestMergeToken: randomUUID(),
      },
    });
    return this.toUserInfo(user);
  }

  async convertGuest(
    guestId: string,
    email: string,
    password: string,
    name?: string,
  ): Promise<UserInfo> {
    const guest = await this.users.findById(guestId);
    if (!guest || !guest.isGuest) {
      throw new BadRequestException('Not a guest account');
    }

    const existing = await this.users.findByEmail(email);
    if (existing && existing.id !== guestId) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await this.prisma.user.update({
      where: { id: guestId },
      data: {
        email,
        name: name ?? guest.name,
        password: passwordHash,
        isGuest: false,
      },
    });
    return this.toUserInfo(updated);
  }

  async mergeGuest(
    currentUserId: string,
    guestId: string,
    mergeToken?: string,
  ): Promise<void> {
    const guest = await this.users.findById(guestId);
    if (!guest || !guest.isGuest) return; // already converted or invalid — no-op

    if (guest.guestMergeToken && guest.guestMergeToken !== mergeToken) {
      throw new UnauthorizedException('Invalid merge token');
    }

    // Migrate favorites (skip conflicts — user may already have the same recipe saved).
    const guestFavorites = await this.prisma.favoriteRecipe.findMany({
      where: { userId: guestId },
    });
    for (const fav of guestFavorites) {
      await this.prisma.favoriteRecipe.upsert({
        where: {
          userId_recipeId: { userId: currentUserId, recipeId: fav.recipeId },
        },
        create: {
          userId: currentUserId,
          recipeId: fav.recipeId,
          savedAt: fav.savedAt,
        },
        update: {},
      });
    }

    // Migrate weekly plans (skip weeks where the current user already has a plan).
    const guestPlans = await this.prisma.weeklyPlan.findMany({
      where: { userId: guestId },
      include: {
        meals: true,
        groceryList: { include: { items: { include: { sources: true } } } },
      },
    });
    for (const plan of guestPlans) {
      const conflict = await this.prisma.weeklyPlan.findFirst({
        where: { userId: currentUserId, weekStartDate: plan.weekStartDate },
      });
      if (!conflict) {
        await this.prisma.weeklyPlan.update({
          where: { id: plan.id },
          data: { userId: currentUserId },
        });
      }
    }

    await this.prisma.user.delete({ where: { id: guestId } });
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
    isGuest: boolean;
    guestMergeToken?: string | null;
  }): UserInfo {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      isGuest: user.isGuest,
      guestMergeToken: user.guestMergeToken,
    };
  }
}
