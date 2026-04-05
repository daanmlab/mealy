/**
 * E2E-style integration test for grocery unit conversion.
 *
 * Wires the real GroceryService + real ConversionService together,
 * mocking only PrismaService and PlansService at the edge.
 *
 * Reproduces the real-world case that triggered this feature:
 *   soy sauce: 1.5 tbsp (recipe 1) + 2 tsp (recipe 2)
 *   → should merge to ≈ 2.167 tbsp in the generated grocery list
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CookTimePreference, FoodGoal, PlanStatus } from '@prisma/client';
import type { User } from '@prisma/client';
import { GroceryService } from '../src/grocery/grocery.service';
import { ConversionService } from '../src/catalog/conversion.service';
import { PlansService } from '../src/plans/plans.service';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── fixtures ────────────────────────────────────────────────────────────────

const TBSP = {
  id: 'tbsp',
  symbol: 'tbsp',
  name: 'tablespoon',
  type: 'volume' as const,
};
const TSP = {
  id: 'tsp',
  symbol: 'tsp',
  name: 'teaspoon',
  type: 'volume' as const,
};

const SOY_SAUCE_ID = 'ingredient-soy-sauce';

const RECIPE_1 = {
  id: 'r1',
  servings: 2,
  ingredients: [
    {
      ingredientId: SOY_SAUCE_ID,
      unitId: TBSP.id,
      amount: 1.5,
      ingredient: { id: SOY_SAUCE_ID, name: 'soy sauce' },
      unit: TBSP,
    },
  ],
};

const RECIPE_2 = {
  id: 'r2',
  servings: 2,
  ingredients: [
    {
      ingredientId: SOY_SAUCE_ID,
      unitId: TSP.id,
      amount: 2,
      ingredient: { id: SOY_SAUCE_ID, name: 'soy sauce' },
      unit: TSP,
    },
  ],
};

const CONFIRMED_PLAN = {
  id: 'plan-1',
  status: PlanStatus.confirmed,
  meals: [{ recipeId: 'r1' }, { recipeId: 'r2' }],
};

/** User cooks for 2 people; both recipes serve 2 → scale factor = 1 */
const USER: User = {
  id: 'u1',
  email: 'test@example.com',
  name: null,
  avatarUrl: null,
  password: null,
  peopleCount: 2,
  mealsPerWeek: 5,
  cookTime: CookTimePreference.any,
  goal: FoodGoal.healthy,
  dislikes: [],
  onboardingDone: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── test ─────────────────────────────────────────────────────────────────────

describe('GroceryService + ConversionService (unit conversion integration)', () => {
  let groceryService: GroceryService;

  // Prisma mock: unit conversions table contains tsp → tbsp (1/3) and tbsp → tsp (3)
  const mockPrisma = {
    groceryList: {
      deleteMany: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
    },
    recipe: {
      findMany: jest.fn().mockResolvedValue([RECIPE_1, RECIPE_2]),
    },
    unit: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === 'tbsp') return Promise.resolve(TBSP);
          if (where.id === 'tsp') return Promise.resolve(TSP);
          return Promise.resolve(null);
        }),
    },
    unitConversion: {
      findUnique: jest.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            fromUnitId_toUnitId: { fromUnitId: string; toUnitId: string };
          };
        }) => {
          const { fromUnitId, toUnitId } = where.fromUnitId_toUnitId;
          if (fromUnitId === 'tsp' && toUnitId === 'tbsp')
            return Promise.resolve({ factor: 1 / 3 });
          if (fromUnitId === 'tbsp' && toUnitId === 'tbsp')
            return Promise.resolve({ factor: 1 });
          if (fromUnitId === 'tbsp' && toUnitId === 'tsp')
            return Promise.resolve({ factor: 3 });
          return Promise.resolve(null);
        },
      ),
      createMany: jest.fn().mockResolvedValue({}),
    },
    groceryListItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPlans = {
    getPlanById: jest.fn().mockResolvedValue(CONFIRMED_PLAN),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Restore mocks to initial implementations after clearAllMocks
    mockPrisma.groceryList.deleteMany.mockResolvedValue({});
    mockPrisma.recipe.findMany.mockResolvedValue([RECIPE_1, RECIPE_2]);
    mockPlans.getPlanById.mockResolvedValue(CONFIRMED_PLAN);
    mockPrisma.groceryList.create.mockImplementation(
      (args: { data: { items: { create: unknown[] } } }) =>
        Promise.resolve({ id: 'gl1', items: args.data.items.create }),
    );
    mockPrisma.unit.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 'tbsp') return Promise.resolve(TBSP);
        if (where.id === 'tsp') return Promise.resolve(TSP);
        return Promise.resolve(null);
      },
    );
    mockPrisma.unitConversion.findUnique.mockImplementation(
      ({
        where,
      }: {
        where: {
          fromUnitId_toUnitId: { fromUnitId: string; toUnitId: string };
        };
      }) => {
        const { fromUnitId, toUnitId } = where.fromUnitId_toUnitId;
        if (fromUnitId === 'tsp' && toUnitId === 'tbsp')
          return Promise.resolve({ factor: 1 / 3 });
        if (fromUnitId === 'tbsp' && toUnitId === 'tbsp')
          return Promise.resolve({ factor: 1 });
        if (fromUnitId === 'tbsp' && toUnitId === 'tsp')
          return Promise.resolve({ factor: 3 });
        return Promise.resolve(null);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroceryService,
        ConversionService, // ← real ConversionService, not a mock
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlansService, useValue: mockPlans },
      ],
    }).compile();

    groceryService = module.get(GroceryService);
  });

  it('merges soy sauce (1.5 tbsp + 2 tsp) into a single grocery item of ≈ 2.167 tbsp', async () => {
    const list = await groceryService.generateList('plan-1', USER);

    const items = list.items as Array<{
      ingredientId: string;
      totalAmount: number;
      unitId: string;
    }>;

    // Must produce exactly one item for soy sauce (merged, not duplicated)
    const soySauceItems = items.filter((i) => i.ingredientId === SOY_SAUCE_ID);
    expect(soySauceItems).toHaveLength(1);

    const merged = soySauceItems[0];

    // 1.5 tbsp + (2 tsp × 1/3) = 1.5 + 0.6667 = 2.1667 tbsp
    expect(merged.totalAmount).toBeCloseTo(1.5 + 2 / 3, 4);
    expect(merged.unitId).toBe('tbsp');
  });

  it('produces no duplicate entries when the plan has no convertible-unit conflicts', async () => {
    // Two recipes, different ingredients, same unit
    const r3 = {
      id: 'r3',
      servings: 2,
      ingredients: [
        {
          ingredientId: 'chicken',
          unitId: 'g',
          amount: 300,
          ingredient: { id: 'chicken', name: 'chicken breast' },
          unit: { id: 'g', symbol: 'g', name: 'gram', type: 'weight' as const },
        },
      ],
    };
    const r4 = {
      id: 'r4',
      servings: 2,
      ingredients: [
        {
          ingredientId: 'onion',
          unitId: 'g',
          amount: 100,
          ingredient: { id: 'onion', name: 'onion' },
          unit: { id: 'g', symbol: 'g', name: 'gram', type: 'weight' as const },
        },
      ],
    };

    mockPrisma.recipe.findMany.mockResolvedValue([r3, r4]);
    mockPlans.getPlanById.mockResolvedValue({
      ...CONFIRMED_PLAN,
      meals: [{ recipeId: 'r3' }, { recipeId: 'r4' }],
    });
    mockPrisma.unit.findUnique.mockResolvedValue({
      id: 'g',
      symbol: 'g',
      name: 'gram',
      type: 'weight' as const,
    });
    // No conversions needed for same-unit entries
    mockPrisma.unitConversion.findUnique.mockResolvedValue(null);

    const list = await groceryService.generateList('plan-1', USER);
    const items = list.items as Array<{
      ingredientId: string;
      totalAmount: number;
    }>;

    expect(items).toHaveLength(2);
    const chicken = items.find((i) => i.ingredientId === 'chicken');
    const onion = items.find((i) => i.ingredientId === 'onion');
    expect(chicken?.totalAmount).toBe(300); // scale = 2/2 = 1
    expect(onion?.totalAmount).toBe(100);
  });

  it('keeps incompatible units as separate entries (e.g. garlic: cloves vs grams)', async () => {
    const r5 = {
      id: 'r5',
      servings: 2,
      ingredients: [
        {
          ingredientId: 'garlic',
          unitId: 'cloves',
          amount: 3,
          ingredient: { id: 'garlic', name: 'garlic' },
          unit: {
            id: 'cloves',
            symbol: 'cloves',
            name: 'cloves',
            type: 'other' as const,
          },
        },
      ],
    };
    const r6 = {
      id: 'r6',
      servings: 2,
      ingredients: [
        {
          ingredientId: 'garlic',
          unitId: 'g',
          amount: 10,
          ingredient: { id: 'garlic', name: 'garlic' },
          unit: { id: 'g', symbol: 'g', name: 'gram', type: 'weight' as const },
        },
      ],
    };

    mockPrisma.recipe.findMany.mockResolvedValue([r5, r6]);
    mockPlans.getPlanById.mockResolvedValue({
      ...CONFIRMED_PLAN,
      meals: [{ recipeId: 'r5' }, { recipeId: 'r6' }],
    });
    mockPrisma.unit.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 'cloves')
          return Promise.resolve({
            id: 'cloves',
            symbol: 'cloves',
            name: 'cloves',
            type: 'other' as const,
          });
        if (where.id === 'g')
          return Promise.resolve({
            id: 'g',
            symbol: 'g',
            name: 'gram',
            type: 'weight' as const,
          });
        return Promise.resolve(null);
      },
    );
    // No conversion between cloves and grams (density-dependent)
    mockPrisma.unitConversion.findUnique.mockResolvedValue(null);

    const list = await groceryService.generateList('plan-1', USER);
    const items = list.items as Array<{
      ingredientId: string;
      totalAmount: number;
      unitId: string;
    }>;

    // garlic appears in two entries — different units, no conversion → kept separate
    const garlicItems = items.filter((i) => i.ingredientId === 'garlic');
    expect(garlicItems).toHaveLength(2);

    const inCloves = garlicItems.find((i) => i.unitId === 'cloves');
    const inGrams = garlicItems.find((i) => i.unitId === 'g');
    expect(inCloves?.totalAmount).toBe(3);
    expect(inGrams?.totalAmount).toBe(10);
  });
});
