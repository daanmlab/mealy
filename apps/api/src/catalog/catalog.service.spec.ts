import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  unit: { findMany: jest.fn() },
  ingredient: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
  ingredientAlias: {
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  },
};

const makeIngredient = (id: string, name: string) => ({
  id,
  name,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(CatalogService);
  });

  describe('getCatalog', () => {
    it('returns units and ingredients', async () => {
      mockPrisma.unit.findMany.mockResolvedValue([
        { symbol: 'g' },
        { symbol: 'ml' },
      ]);
      mockPrisma.ingredient.findMany.mockResolvedValue([
        { name: 'butter' },
        { name: 'flour' },
      ]);

      const result = await service.getCatalog();

      expect(result).toEqual({
        units: ['g', 'ml'],
        ingredients: ['butter', 'flour'],
      });
    });
  });

  describe('resolveIngredient', () => {
    it('returns the ingredient when an alias match is found (path 1)', async () => {
      const ingredient = makeIngredient('1', 'garlic');
      mockPrisma.ingredientAlias.findUnique.mockResolvedValue({ ingredient });

      const result = await service.resolveIngredient('Garlic');

      expect(result).toBe(ingredient);
      expect(mockPrisma.ingredient.findFirst).not.toHaveBeenCalled();
    });

    it('returns the ingredient and seeds an alias on exact name match (path 2)', async () => {
      const ingredient = makeIngredient('2', 'butter');
      mockPrisma.ingredientAlias.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.findFirst.mockResolvedValue(ingredient);
      mockPrisma.ingredientAlias.create.mockResolvedValue({});

      const result = await service.resolveIngredient('Butter');

      expect(result).toBe(ingredient);
      expect(mockPrisma.ingredientAlias.create).toHaveBeenCalledWith({
        data: { alias: 'butter', ingredientId: '2' },
      });
    });

    it('seeds alias silently when alias already exists on exact match (path 2)', async () => {
      const ingredient = makeIngredient('2', 'butter');
      mockPrisma.ingredientAlias.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.findFirst.mockResolvedValue(ingredient);
      mockPrisma.ingredientAlias.create.mockRejectedValue(
        new Error('duplicate'),
      );

      // Should not throw
      await expect(service.resolveIngredient('butter')).resolves.toBe(
        ingredient,
      );
    });

    it('creates a new ingredient when no alias or match exists (path 4, no LLM)', async () => {
      const newIngredient = makeIngredient('3', 'saffron');
      mockPrisma.ingredientAlias.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      mockPrisma.ingredient.upsert.mockResolvedValue(newIngredient);
      mockPrisma.ingredientAlias.createMany.mockResolvedValue({ count: 1 });

      const result = await service.resolveIngredient('Saffron');

      expect(result).toBe(newIngredient);
      expect(mockPrisma.ingredient.upsert).toHaveBeenCalledWith({
        where: { name: 'saffron' },
        create: { name: 'saffron' },
        update: {},
      });
    });

    it('recovers from a P2002 race condition on upsert and returns the existing row (path 4)', async () => {
      const existing = makeIngredient('4', 'saffron');

      mockPrisma.ingredientAlias.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.findFirst.mockResolvedValueOnce(null); // exact-match check
      mockPrisma.ingredient.upsert.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );
      mockPrisma.ingredient.findFirst.mockResolvedValueOnce(existing); // recovery lookup
      mockPrisma.ingredientAlias.createMany.mockResolvedValue({ count: 0 });

      const result = await service.resolveIngredient('Saffron');

      expect(result).toBe(existing);
      expect(mockPrisma.ingredient.findFirst).toHaveBeenCalledTimes(2);
    });

    it('re-throws the error when P2002 recovery findFirst returns null', async () => {
      const p2002 = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });

      mockPrisma.ingredientAlias.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      mockPrisma.ingredient.upsert.mockRejectedValue(p2002);

      await expect(service.resolveIngredient('ghost')).rejects.toThrow(p2002);
    });

    it('re-throws non-P2002 errors from upsert', async () => {
      const dbError = new Error('Connection lost');

      mockPrisma.ingredientAlias.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      mockPrisma.ingredient.upsert.mockRejectedValue(dbError);

      await expect(service.resolveIngredient('anything')).rejects.toThrow(
        dbError,
      );
    });

    it('seeds both canonical and normalized aliases when they differ (path 4)', async () => {
      const ingredient = makeIngredient('5', 'chicken breast');
      mockPrisma.ingredientAlias.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      mockPrisma.ingredient.upsert.mockResolvedValue(ingredient);
      mockPrisma.ingredientAlias.createMany.mockResolvedValue({ count: 2 });

      await service.resolveIngredient('chicken breast');

      // normalized === canonicalName, so only one alias entry
      expect(mockPrisma.ingredientAlias.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ alias: 'chicken breast', ingredientId: '5' }],
          skipDuplicates: true,
        }),
      );
    });
  });
});
