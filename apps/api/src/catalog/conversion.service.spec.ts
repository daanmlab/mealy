import { Test, TestingModule } from '@nestjs/testing';
import { ConversionService } from './conversion.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  unitConversion: {
    findUnique: jest.fn(),
    createMany: jest.fn(),
  },
  unit: {
    findUnique: jest.fn(),
  },
};

const makeUnit = (id: string, symbol: string) => ({
  id,
  symbol,
  name: symbol,
  type: 'other' as const,
});

describe('ConversionService', () => {
  let service: ConversionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ConversionService);
  });

  describe('convert', () => {
    it('returns the amount unchanged when from and to unit are the same', async () => {
      const result = await service.convert(100, 'g', 'g');
      expect(result).toBe(100);
      expect(mockPrisma.unitConversion.findUnique).not.toHaveBeenCalled();
    });

    it('returns null when no conversion exists', async () => {
      mockPrisma.unitConversion.findUnique.mockResolvedValue(null);
      const result = await service.convert(100, 'g', 'cup');
      expect(result).toBeNull();
    });

    it('applies the conversion factor correctly', async () => {
      // g → oz: factor = 0.035274
      mockPrisma.unitConversion.findUnique.mockResolvedValue({
        fromUnitId: 'g-id',
        toUnitId: 'oz-id',
        factor: 0.035274,
      });
      const result = await service.convert(100, 'g-id', 'oz-id');
      expect(result).toBeCloseTo(3.5274, 4);
    });

    it('applies the conversion factor for tsp → tbsp', async () => {
      mockPrisma.unitConversion.findUnique.mockResolvedValue({
        fromUnitId: 'tsp',
        toUnitId: 'tbsp',
        factor: 1 / 3,
      });
      const result = await service.convert(3, 'tsp', 'tbsp');
      expect(result).toBeCloseTo(1, 5);
    });
  });

  describe('ensureConversion', () => {
    it('does nothing when from and to unit are the same', async () => {
      const unit = makeUnit('g', 'g');
      await service.ensureConversion(unit, unit);
      expect(mockPrisma.unitConversion.findUnique).not.toHaveBeenCalled();
    });

    it('does nothing when conversion already exists', async () => {
      mockPrisma.unitConversion.findUnique.mockResolvedValue({ factor: 0.001 });
      const from = makeUnit('g', 'g');
      const to = makeUnit('kg', 'kg');
      await service.ensureConversion(from, to);
      expect(mockPrisma.unitConversion.createMany).not.toHaveBeenCalled();
    });

    it('does nothing when OPENAI_API_KEY is not set (no LLM call)', async () => {
      mockPrisma.unitConversion.findUnique.mockResolvedValue(null);
      const from = makeUnit('cloves', 'cloves');
      const to = makeUnit('g', 'g');
      // ConversionService.openai is null when key is missing (default in test env)
      await service.ensureConversion(from, to);
      expect(mockPrisma.unitConversion.createMany).not.toHaveBeenCalled();
    });
  });
});
