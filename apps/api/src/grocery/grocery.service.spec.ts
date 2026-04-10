import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CookTimePreference, FoodGoal, PlanStatus } from '@prisma/client';
import type { Unit, User } from '@prisma/client';
import { GroceryService } from './grocery.service';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversionService } from '../catalog/conversion.service';

const mockPrisma = {
  groceryList: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  recipe: { findMany: jest.fn() },
  groceryListItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  groceryListItemSource: {
    createMany: jest.fn(),
  },
};

const mockPlans = {
  getPlanById: jest.fn(),
};

const mockConversion = {
  convert: jest.fn().mockResolvedValue(null),
  ensureConversion: jest.fn().mockResolvedValue(undefined),
};

const makeIngredient = (id: string, name: string) => ({
  id,
  name,
  category: { id: 'cat1', name: 'Produce', slug: 'produce' },
});

const makeUnit = (id: string, symbol: string): Unit => ({
  id,
  symbol,
  name: symbol,
  type: 'other' as const,
});

const makeRecipeIngredient = (
  ingredientId: string,
  unitId: string | null,
  amount: number,
) => ({
  ingredientId,
  unitId,
  amount,
  ingredient: makeIngredient(ingredientId, `ing-${ingredientId}`),
  unit: unitId ? makeUnit(unitId, unitId) : null,
});

const makeUser = (peopleCount: number): User => ({
  id: 'u1',
  email: 'test@example.com',
  name: null,
  avatarUrl: null,
  password: null,
  peopleCount,
  mealsPerWeek: 5,
  cookTime: CookTimePreference.any,
  goal: FoodGoal.healthy,
  dislikes: [],
  onboardingDone: false,
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeRecipe = (
  id: string,
  servings: number,
  ingredients: ReturnType<typeof makeRecipeIngredient>[],
) => ({ id, servings, ingredients });

type CreateArg = {
  data: {
    items: {
      create: {
        ingredientId: string;
        totalAmount: number;
        unitId?: string | null;
      }[];
    };
  };
};

describe('GroceryService', () => {
  let service: GroceryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConversion.convert.mockResolvedValue(null);
    mockPrisma.groceryListItemSource.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.groceryList.findUniqueOrThrow.mockResolvedValue({
      id: 'gl1',
      items: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlansService, useValue: mockPlans },
        { provide: ConversionService, useValue: mockConversion },
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

      await expect(service.generateList('p1', makeUser(2))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('aggregates and scales ingredients across all meals', async () => {
      // user cooks for 4, recipes are designed for 2 → scale factor = 2
      const user = makeUser(4);
      const meals = [{ recipeId: 'r1' }, { recipeId: 'r2' }];
      mockPlans.getPlanById.mockResolvedValue({
        id: 'p1',
        status: PlanStatus.confirmed,
        meals,
      });
      mockPrisma.groceryList.deleteMany.mockResolvedValue({});

      // Both recipes share ingredient i1; r2 also has i2; both have servings=2
      mockPrisma.recipe.findMany.mockResolvedValue([
        makeRecipe('r1', 2, [makeRecipeIngredient('i1', 'unit1', 100)]),
        makeRecipe('r2', 2, [
          makeRecipeIngredient('i1', 'unit1', 50),
          makeRecipeIngredient('i2', 'unit1', 200),
        ]),
      ]);

      const createdList = { id: 'gl1', items: [] };
      mockPrisma.groceryList.create.mockResolvedValue(createdList);
      const enrichedList = {
        id: 'gl1',
        items: [],
        weeklyPlanId: 'p1',
        generatedAt: new Date(),
      };
      mockPrisma.groceryList.findUniqueOrThrow.mockResolvedValue(enrichedList);

      const result = await service.generateList('p1', user);
      expect(result).toBe(enrichedList);

      const createCall = (
        mockPrisma.groceryList.create.mock.calls as [CreateArg][]
      )[0]?.[0];

      // i1: (100 + 50) * scale(4/2) = 150 * 2 = 300
      const i1 = createCall?.data.items.create.find(
        (x) => x.ingredientId === 'i1',
      );
      expect(i1?.totalAmount).toBe(300);

      // i2: 200 * 2 = 400
      const i2 = createCall?.data.items.create.find(
        (x) => x.ingredientId === 'i2',
      );
      expect(i2?.totalAmount).toBe(400);
    });

    it('counts the same recipe multiple times when it appears in several meals', async () => {
      // spaghetti on Monday and Wednesday → ingredients × 2 meals
      const user = makeUser(2);
      // Two meals both pointing at the same recipe
      const meals = [{ recipeId: 'r1' }, { recipeId: 'r1' }];
      mockPlans.getPlanById.mockResolvedValue({
        id: 'p1',
        status: PlanStatus.confirmed,
        meals,
      });
      mockPrisma.groceryList.deleteMany.mockResolvedValue({});

      // findMany returns the recipe only once (deduplication by DB)
      mockPrisma.recipe.findMany.mockResolvedValue([
        makeRecipe('r1', 2, [makeRecipeIngredient('i1', 'unit1', 100)]),
      ]);

      const createdList = { id: 'gl1', items: [] };
      mockPrisma.groceryList.create.mockResolvedValue(createdList);

      await service.generateList('p1', user);

      const createCall = (
        mockPrisma.groceryList.create.mock.calls as [CreateArg][]
      )[0]?.[0];

      // 100 per meal × 2 meals × scale(2/2=1) = 200
      const i1 = createCall?.data.items.create.find(
        (x) => x.ingredientId === 'i1',
      );
      expect(i1?.totalAmount).toBe(200);
    });

    it('merges same-ingredient entries when a unit conversion exists', async () => {
      // soy sauce: 1.5 tbsp (from recipe 1) + 2 tsp (from recipe 2)
      // 2 tsp × (1 tbsp / 3 tsp) = 0.667 tbsp → total = 1.5 + 0.667 ≈ 2.167 tbsp
      const user = makeUser(2); // scale = 1 (2 people / 2 servings)
      mockPlans.getPlanById.mockResolvedValue({
        id: 'p1',
        status: PlanStatus.confirmed,
        meals: [{ recipeId: 'r1' }, { recipeId: 'r2' }],
      });
      mockPrisma.groceryList.deleteMany.mockResolvedValue({});

      mockPrisma.recipe.findMany.mockResolvedValue([
        makeRecipe('r1', 2, [makeRecipeIngredient('soy-sauce', 'tbsp', 1.5)]),
        makeRecipe('r2', 2, [makeRecipeIngredient('soy-sauce', 'tsp', 2)]),
      ]);

      // Conversion: tsp → tbsp returns 1/3
      mockConversion.convert.mockImplementation(
        (amount: number, fromId: string, toId: string) => {
          if (fromId === 'tsp' && toId === 'tbsp')
            return Promise.resolve(amount / 3);
          if (fromId === 'tbsp' && toId === 'tbsp')
            return Promise.resolve(amount);
          return Promise.resolve(null);
        },
      );

      const createdList = { id: 'gl1', items: [] };
      mockPrisma.groceryList.create.mockResolvedValue(createdList);

      await service.generateList('p1', user);

      const createCall = (
        mockPrisma.groceryList.create.mock.calls as [CreateArg][]
      )[0]?.[0];

      // Should have exactly 1 item for soy-sauce (merged)
      const soySauceItems = createCall?.data.items.create.filter(
        (x) => x.ingredientId === 'soy-sauce',
      );
      expect(soySauceItems).toHaveLength(1);

      // 1.5 tbsp + (2 tsp → 0.667 tbsp) = 2.167 tbsp
      expect(soySauceItems?.[0]?.totalAmount).toBeCloseTo(2.167, 2);
    });
    it('sums null-unit (countable) entries for the same ingredient', async () => {
      // eggs: 2 from recipe 1 + 3 from recipe 2, no unit → should sum to 5
      const user = makeUser(2);
      mockPlans.getPlanById.mockResolvedValue({
        id: 'p1',
        status: PlanStatus.confirmed,
        meals: [{ recipeId: 'r1' }, { recipeId: 'r2' }],
      });
      mockPrisma.groceryList.deleteMany.mockResolvedValue({});

      mockPrisma.recipe.findMany.mockResolvedValue([
        makeRecipe('r1', 2, [makeRecipeIngredient('eggs', null, 2)]),
        makeRecipe('r2', 2, [makeRecipeIngredient('eggs', null, 3)]),
      ]);

      const createdList = { id: 'gl1', items: [] };
      mockPrisma.groceryList.create.mockResolvedValue(createdList);

      await service.generateList('p1', user);

      const createCall = (
        mockPrisma.groceryList.create.mock.calls as [CreateArg][]
      )[0]?.[0];

      const eggsItems = createCall?.data.items.create.filter(
        (x) => x.ingredientId === 'eggs',
      );
      // Must appear exactly once (summed, not duplicated)
      expect(eggsItems).toHaveLength(1);
      // 2 + 3 = 5, scale = 1 (2 people / 2 servings)
      expect(eggsItems?.[0]?.totalAmount).toBe(5);
    });

    it('keeps both null-unit and real-unit entries for the same ingredient (LLM fallback)', async () => {
      // chicken breast: one recipe uses 250g, another uses 1 piece (null unit, LLM failed)
      // → both entries should survive for frontend grouping
      const user = makeUser(2);
      mockPlans.getPlanById.mockResolvedValue({
        id: 'p1',
        status: PlanStatus.confirmed,
        meals: [{ recipeId: 'r1' }, { recipeId: 'r2' }],
      });
      mockPrisma.groceryList.deleteMany.mockResolvedValue({});

      mockPrisma.recipe.findMany.mockResolvedValue([
        makeRecipe('r1', 2, [makeRecipeIngredient('chicken', 'g', 250)]),
        makeRecipe('r2', 2, [makeRecipeIngredient('chicken', null, 1)]),
      ]);

      const createdList = { id: 'gl1', items: [] };
      mockPrisma.groceryList.create.mockResolvedValue(createdList);

      await service.generateList('p1', user);

      const createCall = (
        mockPrisma.groceryList.create.mock.calls as [CreateArg][]
      )[0]?.[0];

      const chickenItems = createCall?.data.items.create.filter(
        (x) => x.ingredientId === 'chicken',
      );
      // Both entries are kept: the 250g entry and the null-unit count
      expect(chickenItems).toHaveLength(2);
      expect(chickenItems?.some((x) => x.unitId === 'g')).toBe(true);
      // null-unit items have unitId omitted (undefined) — use loose equality
      expect(chickenItems?.some((x) => x.unitId == null)).toBe(true);
    });
  });

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
