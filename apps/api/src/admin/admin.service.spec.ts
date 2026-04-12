/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecipesService } from '../recipes/recipes.service';
import { CatalogService } from '../catalog/catalog.service';

const mockPrisma = {
  recipe: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  ingredient: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  ingredientAlias: {
    findMany: jest.fn(),
  },
  recipeTag: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  tag: {
    upsert: jest.fn(),
  },
  recipeIngredient: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  ingredientGroup: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  unit: {
    upsert: jest.fn(),
  },
  ingredientCategory: {
    upsert: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRecipesService = {
  create: jest.fn(),
};

const mockCatalogService = {
  resolveIngredient: jest.fn(),
  inferUnit: jest.fn(),
};

const makeRecipe = (overrides = {}) => ({
  id: 'recipe-1',
  title: 'Test Recipe',
  description: 'A test recipe',
  cookTimeMinutes: 30,
  servings: 2,
  imageUrl: null,
  sourceUrl: null,
  steps: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RecipesService, useValue: mockRecipesService },
        { provide: CatalogService, useValue: mockCatalogService },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  // ─── searchIngredients ────────────────────────────────────────────────────────

  describe('searchIngredients', () => {
    const ingredientA = { id: 'ing-1', name: 'chicken breast', category: null };
    const ingredientB = { id: 'ing-2', name: 'chicken thigh', category: null };

    it('returns ingredients matching name query', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([
        ingredientA,
        ingredientB,
      ]);
      mockPrisma.ingredientAlias.findMany.mockResolvedValue([]);

      const result = await service.searchIngredients('chicken');

      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'chicken', mode: 'insensitive' } },
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'ing-1', name: 'chicken breast' });
    });

    it('deduplicates results from name and alias search', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([ingredientA]);
      mockPrisma.ingredientAlias.findMany.mockResolvedValue([
        { alias: 'chicken', ingredient: ingredientA }, // same ingredient as byName
        { alias: 'chicken leg', ingredient: ingredientB },
      ]);

      const result = await service.searchIngredients('chicken');

      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.id);
      expect(ids).toContain('ing-1');
      expect(ids).toContain('ing-2');
    });

    it('returns all ingredients when query is empty', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([ingredientA]);

      const result = await service.searchIngredients('');

      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, orderBy: { name: 'asc' } }),
      );
      expect(result).toHaveLength(1);
    });

    it('respects limit parameter', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([]);
      mockPrisma.ingredientAlias.findMany.mockResolvedValue([]);

      await service.searchIngredients('chicken', 5);

      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // ─── updateRecipe ─────────────────────────────────────────────────────────────

  describe('updateRecipe', () => {
    const fullRecipe = {
      ...makeRecipe(),
      groups: [],
      tags: [],
      ingredients: [],
    };

    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
          fn(mockPrisma),
      );
      mockPrisma.recipe.findUnique.mockResolvedValue(makeRecipe());
      mockPrisma.recipe.update.mockResolvedValue(makeRecipe());
      mockPrisma.recipe.findUniqueOrThrow.mockResolvedValue(fullRecipe);
      mockPrisma.auditLog.create.mockResolvedValue({});
    });

    it('throws NotFoundException when recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRecipe('missing', { title: 'New' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates scalar fields only when no tags/ingredients provided', async () => {
      await service.updateRecipe('recipe-1', { title: 'Updated' }, 'actor-1');

      expect(mockPrisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'recipe-1' },
          data: expect.objectContaining({ title: 'Updated' }),
        }),
      );
      expect(mockPrisma.recipeTag.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.recipeIngredient.deleteMany).not.toHaveBeenCalled();
    });

    it('replaces tags when tagSlugs is provided', async () => {
      mockPrisma.recipeTag.deleteMany.mockResolvedValue({});
      mockPrisma.tag.upsert.mockResolvedValue({ id: 'tag-1' });
      mockPrisma.recipeTag.createMany.mockResolvedValue({});

      await service.updateRecipe(
        'recipe-1',
        { tagSlugs: ['vegan', 'quick'] },
        'actor-1',
      );

      expect(mockPrisma.recipeTag.deleteMany).toHaveBeenCalledWith({
        where: { recipeId: 'recipe-1' },
      });
      expect(mockPrisma.tag.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.recipeTag.createMany).toHaveBeenCalled();
    });

    it('replaces ingredients when ingredients array is provided', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 'ing-1',
        name: 'butter',
      });
      mockCatalogService.inferUnit.mockResolvedValue(null);
      mockPrisma.recipeIngredient.deleteMany.mockResolvedValue({});
      mockPrisma.ingredientGroup.deleteMany.mockResolvedValue({});
      mockPrisma.unit.upsert.mockResolvedValue({ id: 'unit-1' });
      mockPrisma.ingredientCategory.upsert.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.ingredient.update.mockResolvedValue({});
      mockPrisma.recipeIngredient.createMany.mockResolvedValue({});

      await service.updateRecipe(
        'recipe-1',
        {
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'butter',
              amount: 100,
              unitSymbol: 'g',
              categorySlug: 'dairy',
            },
          ],
        },
        'actor-1',
      );

      expect(mockPrisma.recipeIngredient.deleteMany).toHaveBeenCalledWith({
        where: { recipeId: 'recipe-1' },
      });
      expect(mockPrisma.recipeIngredient.createMany).toHaveBeenCalled();
    });

    it('throws BadRequestException for unknown ingredientId', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRecipe(
          'recipe-1',
          {
            ingredients: [
              {
                ingredientId: 'nonexistent',
                name: 'ghost',
                amount: 1,
                unitSymbol: 'g',
                categorySlug: 'other',
              },
            ],
          },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('writes an audit log entry after successful update', async () => {
      await service.updateRecipe('recipe-1', { title: 'New Title' }, 'actor-1');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'recipe.update',
            entityType: 'recipe',
            entityId: 'recipe-1',
            actorId: 'actor-1',
          }),
        }),
      );
    });
  });

  // ─── deleteRecipe ─────────────────────────────────────────────────────────────

  describe('deleteRecipe', () => {
    it('throws NotFoundException when recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(service.deleteRecipe('missing', 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes recipe and writes audit log', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(makeRecipe());
      mockPrisma.recipe.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.deleteRecipe('recipe-1', 'actor-1');

      expect(mockPrisma.recipe.delete).toHaveBeenCalledWith({
        where: { id: 'recipe-1' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'recipe.delete',
            entityType: 'recipe',
            entityId: 'recipe-1',
            actorId: 'actor-1',
          }),
        }),
      );
    });
  });

  // ─── createRecipe ─────────────────────────────────────────────────────────────

  describe('createRecipe', () => {
    it('delegates to RecipesService and writes audit log', async () => {
      const created = makeRecipe({ id: 'recipe-new', title: 'New Recipe' });
      mockRecipesService.create.mockResolvedValue(created);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.createRecipe(
        {
          title: 'New Recipe',
          description: 'desc',
          cookTimeMinutes: 20,
          servings: 2,
          tagSlugs: [],
          steps: [],
          ingredients: [],
        },
        'actor-1',
      );

      expect(result).toBe(created);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'recipe.create',
            actorId: 'actor-1',
          }),
        }),
      );
    });
  });
});
