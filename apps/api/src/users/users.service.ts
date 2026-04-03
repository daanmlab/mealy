import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findOrCreate(email: string, name?: string, avatarUrl?: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;
    return this.prisma.user.create({ data: { email, name, avatarUrl } });
  }
}
