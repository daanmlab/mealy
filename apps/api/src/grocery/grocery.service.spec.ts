import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlanStatus } from '@prisma/client';
import { GroceryService } from './grocery.service';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  groceryList: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  recipe: { findMany: jest.fn() },
  groceryListItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockPlans = {
  getPlanById: jest.fn(),
};

const makeIngredient = (id: string, name: string) => ({
  id,
  name,
  category: { id: 'cat1', name: 'Produce', slug: 'produce' },
});

const makeUnit = (id: string, symbol: string) => ({
  id,
  symbol,
  name: symbol,
  type: 'other' as const,
});

const makeRecipeIngredient = (
  ingredientId: string,
  unitId: string,
  amount: number,
) => ({
  ingredientId,
  unitId,
  amount,
  ingredient: makeIngredient(ingredientId, `ing-${ingredientId}`),
  unit: makeUnit(unitId, 'g'),
});

describe('GroceryService', () => {
  let service: GroceryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlansService, useValue: mockPlans },
      ],
    }).compile();
    service = module.get(GroceryService);
  });

  // ─── generateList ─────────────────────────────────────────────────────────────

  describe('generateList', () => {
    it('throws NotFoundException if the plan is not confirmed', async () => {
      mockPlans.getPlanById.mockResolvedValue({
        status: PlanStatus.draft,
        meals: [],
      });

      await expect(service.generateList('p1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('aggregates ingredients from all meals into a single grocery list', async () => {
      const meals = [{ recipeId: 'r1' }, { recipeId: 'r2' }];
      mockPlans.getPlanById.mockResolvedValue({
        id: 'p1',
        status: PlanStatus.confirmed,
        meals,
      });
      mockPrisma.groceryList.deleteMany.mockResolvedValue({});

      // Both recipes share ingredient i1; r2 also has i2
      mockPrisma.recipe.findMany.mockResolvedValue([
        {
          id: 'r1',
          ingredients: [makeRecipeIngredient('i1', 'unit1', 100)],
        },
        {
          id: 'r2',
          ingredients: [
            makeRecipeIngredient('i1', 'unit1', 50),
            makeRecipeIngredient('i2', 'unit1', 200),
          ],
        },
      ]);

      const createdList = { id: 'gl1', items: [] };
      mockPrisma.groceryList.create.mockResolvedValue(createdList);

      const result = await service.generateList('p1', 'u1');
      expect(result).toBe(createdList);

      // Verify i1 amounts were summed (100 + 50 = 150)

      const createCall = (
        mockPrisma.groceryList.create.mock.calls as any[][]
      )[0]?.[0] as {
        data: {
          items: { create: { ingredientId: string; totalAmount: number }[] };
        };
      };
      const i1Item = createCall.data.items.create.find(
        (x) => x.ingredientId === 'i1',
      );
      expect(i1Item?.totalAmount).toBe(150);
    });
  });

  // ─── getList ─────────────────────────────────────────────────────────────────

  describe('getList', () => {
    it('throws NotFoundException if the list does not exist', async () => {
      mockPlans.getPlanById.mockResolvedValue({ id: 'p1' });
      mockPrisma.groceryList.findUnique.mockResolvedValue(null);

      await expect(service.getList('p1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the list when it exists', async () => {
      const list = { id: 'gl1', items: [] };
      mockPlans.getPlanById.mockResolvedValue({ id: 'p1' });
      mockPrisma.groceryList.findUnique.mockResolvedValue(list);

      const result = await service.getList('p1', 'u1');
      expect(result).toBe(list);
    });
  });

  // ─── toggleItem ───────────────────────────────────────────────────────────────

  describe('toggleItem', () => {
    it('throws NotFoundException for an unknown item', async () => {
      mockPlans.getPlanById.mockResolvedValue({ id: 'p1' });
      mockPrisma.groceryListItem.findUnique.mockResolvedValue(null);

      await expect(service.toggleItem('p1', 'bad-item', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('toggles isChecked from false to true', async () => {
      mockPlans.getPlanById.mockResolvedValue({ id: 'p1' });
      mockPrisma.groceryListItem.findUnique.mockResolvedValue({
        id: 'item1',
        isChecked: false,
      });
      const updated = { id: 'item1', isChecked: true };
      mockPrisma.groceryListItem.update.mockResolvedValue(updated);

      const result = await service.toggleItem('p1', 'item1', 'u1');
      expect(result.isChecked).toBe(true);
      expect(mockPrisma.groceryListItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isChecked: true } }),
      );
    });

    it('toggles isChecked from true to false', async () => {
      mockPlans.getPlanById.mockResolvedValue({ id: 'p1' });
      mockPrisma.groceryListItem.findUnique.mockResolvedValue({
        id: 'item1',
        isChecked: true,
      });
      const updated = { id: 'item1', isChecked: false };
      mockPrisma.groceryListItem.update.mockResolvedValue(updated);

      const result = await service.toggleItem('p1', 'item1', 'u1');
      expect(result.isChecked).toBe(false);
    });
  });
});
