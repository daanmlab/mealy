import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: { create: jest.fn() },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockUsers = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
};

const mockJwt = { sign: jest.fn().mockReturnValue('access-token') };
const mockConfig = { get: jest.fn().mockReturnValue('secret') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsers },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isAdmin: false,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'a@b.com',
        password: 'pw',
        name: 'A',
      });

      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(result).toMatchObject({ accessToken: 'access-token' });
      expect(typeof result.refreshToken).toBe('string');
    });

    it('throws ConflictException if email already exists', async () => {
      mockUsers.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      await expect(
        service.register({ email: 'a@b.com', password: 'pw' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockUsers.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hash,
        isAdmin: false,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'a@b.com',
        password: 'correct',
      });
      expect(result.accessToken).toBe('access-token');
    });

    it('throws UnauthorizedException for unknown user', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@y.com', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockUsers.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hash,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for OAuth user (no password)', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: null,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('returns new tokens for a valid refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockUsers.findById.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isAdmin: false,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('raw-token');
      expect(result.accessToken).toBe('access-token');
    });

    it('throws UnauthorizedException for a revoked token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revoked: true,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.refresh('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for an expired token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for an unknown token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes all refresh tokens for the user', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
      await service.logout('u1');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revoked: false },
        data: { revoked: true },
      });
    });
  });
});
