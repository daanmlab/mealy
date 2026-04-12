import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockUsers = {
  findByEmail: jest.fn(),
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('token'),
};

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
      ],
    }).compile();
    service = module.get(AuthService);
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a user and returns user info', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        avatarUrl: null,
        isAdmin: false,
      });

      const result = await service.register({
        email: 'a@b.com',
        password: 'password123',
        name: 'A',
      });

      expect(result).toEqual({
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        avatarUrl: null,
        isAdmin: false,
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ email: 'a@b.com' }),
        }),
      );
    });

    it('throws ConflictException if email is already in use', async () => {
      mockUsers.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      await expect(
        service.register({ email: 'a@b.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── validateCredentials ─────────────────────────────────────────────────────

  describe('validateCredentials', () => {
    it('returns user info for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 12);
      mockUsers.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        avatarUrl: null,
        isAdmin: false,
        password: hash,
      });

      const result = await service.validateCredentials(
        'a@b.com',
        'password123',
      );

      expect(result).toEqual({
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        avatarUrl: null,
        isAdmin: false,
      });
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 12);
      mockUsers.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hash,
      });
      await expect(
        service.validateCredentials('a@b.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if user not found', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      await expect(
        service.validateCredentials('noone@b.com', 'pw'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for OAuth-only accounts (no password)', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: null,
      });
      await expect(
        service.validateCredentials('a@b.com', 'pw'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── upsertOAuthUser ─────────────────────────────────────────────────────────

  describe('upsertOAuthUser', () => {
    it('creates a new user if none exists', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u2',
        email: 'g@google.com',
        name: 'Google User',
        avatarUrl: 'https://example.com/avatar.png',
        isAdmin: false,
      });

      const result = await service.upsertOAuthUser(
        'g@google.com',
        'Google User',
        'https://example.com/avatar.png',
      );

      expect(result.id).toBe('u2');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('returns existing user without update if data matches', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'g@google.com',
        name: 'Same Name',
        avatarUrl: null,
        isAdmin: false,
      });

      const result = await service.upsertOAuthUser('g@google.com', 'Same Name');

      expect(result.id).toBe('u1');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('updates existing user when name changes', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'g@google.com',
        name: 'Old Name',
        avatarUrl: null,
        isAdmin: false,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'g@google.com',
        name: 'New Name',
        avatarUrl: null,
        isAdmin: false,
      });

      const result = await service.upsertOAuthUser('g@google.com', 'New Name');

      expect(result.name).toBe('New Name');
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });
});
