import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PlanStatus,
  DayOfWeek,
  FoodGoal,
  CookTimePreference,
} from '@prisma/client';
import { PlansService } from './plans.service';
import { RecipesService } from '../recipes/recipes.service';
import { PrismaService } from '../prisma/prisma.service';

import type { User } from '@prisma/client';

// Minimal recipe stub with tags required by pickVariedMeals
const makeRecipe = (id: string, tags: string[] = []) => ({
  id,
  title: `Recipe ${id}`,
  tags: tags.map((slug) => ({ tag: { slug } })),
  ingredients: [],
  groups: [],
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'test@example.com',
  name: 'Test',
  avatarUrl: null,
  password: null,
  peopleCount: 2,
  mealsPerWeek: 3,
  cookTime: CookTimePreference.any,
  goal: FoodGoal.healthy,
  dislikes: [],
  onboardingDone: true,
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeMeal = (
  id: string,
  day: DayOfWeek,
  recipeId: string,
  locked = false,
) => ({
  id,
  day,
  recipeId,
  isLocked: locked,
  recipe: makeRecipe(recipeId),
});

const mockPrisma = {
  weeklyPlan: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  weeklyPlanMeal: {
    update: jest.fn(),
  },
  user: { findUniqueOrThrow: jest.fn() },
};

const mockRecipes = {
  findSuggestions: jest.fn(),
};

describe('PlansService', () => {
  let service: PlansService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RecipesService, useValue: mockRecipes },
      ],
    }).compile();
    service = module.get(PlansService);
  });

  // ─── createPlan ──────────────────────────────────────────────────────────────

  describe('createPlan', () => {
    it('returns an existing draft if one already exists for the week', async () => {
      const existing = { id: 'plan1', meals: [] };
      mockPrisma.weeklyPlan.findFirst.mockResolvedValue(existing);

      const result = await service.createPlan(makeUser());
      expect(result).toBe(existing);
      expect(mockPrisma.weeklyPlan.create).not.toHaveBeenCalled();
    });

    it('creates a new plan with the correct number of meals', async () => {
      mockPrisma.weeklyPlan.findFirst.mockResolvedValue(null);
      mockPrisma.weeklyPlan.findMany.mockResolvedValue([]);
      const recipes = [
        makeRecipe('r1', ['healthy']),
        makeRecipe('r2', ['quick']),
        makeRecipe('r3', ['pasta']),
      ];
      mockRecipes.findSuggestions.mockResolvedValue(recipes);
      const created = {
        id: 'plan2',
        meals: recipes.map((r, i) => makeMeal(`m${i}`, DayOfWeek.monday, r.id)),
      };
      mockPrisma.weeklyPlan.create.mockResolvedValue(created);

      const result = await service.createPlan(makeUser({ mealsPerWeek: 3 }));
      expect(mockPrisma.weeklyPlan.create).toHaveBeenCalled();
      expect(result).toBe(created);
    });

    it('throws BadRequestException when not enough recipes are available', async () => {
      mockPrisma.weeklyPlan.findFirst.mockResolvedValue(null);
      mockPrisma.weeklyPlan.findMany.mockResolvedValue([]);
      mockRecipes.findSuggestions.mockResolvedValue([]);

      await expect(
        service.createPlan(makeUser({ mealsPerWeek: 3 })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── swapMeal ─────────────────────────────────────────────────────────────────

  describe('swapMeal', () => {
    it('updates the meal recipe when a recipeId is provided', async () => {
      const meals = [makeMeal('m1', DayOfWeek.monday, 'r1')];
      mockPrisma.weeklyPlan.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        meals,
      });
      const updated = { ...meals[0], recipeId: 'r2', recipe: makeRecipe('r2') };
      mockPrisma.weeklyPlanMeal.update.mockResolvedValue(updated);

      const result = await service.swapMeal('p1', 'm1', 'u1', 'r2');
      expect(result.recipeId).toBe('r2');
    });

    it('throws NotFoundException if meal does not exist in plan', async () => {
      mockPrisma.weeklyPlan.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        meals: [],
      });
      await expect(
        service.swapMeal('p1', 'bad-meal', 'u1', 'r2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if meal is locked', async () => {
      const meals = [makeMeal('m1', DayOfWeek.monday, 'r1', true)];
      mockPrisma.weeklyPlan.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        meals,
      });
      await expect(service.swapMeal('p1', 'm1', 'u1', 'r2')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── regeneratePlan ───────────────────────────────────────────────────────────

  describe('regeneratePlan', () => {
    it('throws BadRequestException for a confirmed plan', async () => {
      mockPrisma.weeklyPlan.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        status: PlanStatus.confirmed,
        meals: [],
      });
      await expect(service.regeneratePlan('p1', makeUser())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns the plan unchanged when all meals are locked', async () => {
      const meals = [makeMeal('m1', DayOfWeek.monday, 'r1', true)];
      const plan = { id: 'p1', userId: 'u1', status: PlanStatus.draft, meals };
      mockPrisma.weeklyPlan.findUnique.mockResolvedValue(plan);

      const result = await service.regeneratePlan('p1', makeUser());
      expect(result).toBe(plan);
      expect(mockPrisma.weeklyPlanMeal.update).not.toHaveBeenCalled();
    });

    it('updates unlocked meals with new recipes', async () => {
      const meals = [
        makeMeal('m1', DayOfWeek.monday, 'r1', true),
        makeMeal('m2', DayOfWeek.tuesday, 'r2', false),
      ];
      mockPrisma.weeklyPlan.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        status: PlanStatus.draft,
        meals,
      });
      mockRecipes.findSuggestions.mockResolvedValue([
        makeRecipe('r3', ['healthy']),
      ]);
      mockPrisma.weeklyPlanMeal.update.mockResolvedValue({});
      mockPrisma.weeklyPlan.findUniqueOrThrow.mockResolvedValue({
        id: 'p1',
        meals,
      });

      await service.regeneratePlan('p1', makeUser());
      expect(mockPrisma.weeklyPlanMeal.update).toHaveBeenCalledTimes(1);
    });
  });

  // ─── confirmPlan ─────────────────────────────────────────────────────────────

  describe('confirmPlan', () => {
    it('returns the plan unchanged if already confirmed', async () => {
      const plan = {
        id: 'p1',
        userId: 'u1',
        status: PlanStatus.confirmed,
        meals: [],
      };
      mockPrisma.weeklyPlan.findUnique.mockResolvedValue(plan);

      const result = await service.confirmPlan('p1', 'u1');
      expect(result).toBe(plan);
      expect(mockPrisma.weeklyPlan.update).not.toHaveBeenCalled();
    });

    it('sets status to confirmed for a draft plan', async () => {
      const plan = {
        id: 'p1',
        userId: 'u1',
        status: PlanStatus.draft,
        meals: [],
      };
      mockPrisma.weeklyPlan.findUnique.mockResolvedValue(plan);
      const confirmed = { ...plan, status: PlanStatus.confirmed };
      mockPrisma.weeklyPlan.update.mockResolvedValue(confirmed);

      const result = await service.confirmPlan('p1', 'u1');
      expect(result.status).toBe(PlanStatus.confirmed);
    });
  });
});
