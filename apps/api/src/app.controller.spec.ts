import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

const mockPrismaService = {
  $queryRaw: jest.fn(),
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('returns ok when database is reachable', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([]);
      await expect(appController.health()).resolves.toEqual({ status: 'ok' });
    });

    it('throws ServiceUnavailableException when database is unreachable', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(
        new Error('connection refused'),
      );
      await expect(appController.health()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
