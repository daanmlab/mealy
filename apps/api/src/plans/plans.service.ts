import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipesService } from '../recipes/recipes.service';
import type { User } from '@prisma/client';
import { DayOfWeek, PlanStatus } from '@prisma/client';

const WEEKDAYS: DayOfWeek[] = [
  DayOfWeek.monday,
  DayOfWeek.tuesday,
  DayOfWeek.wednesday,
  DayOfWeek.thursday,
  DayOfWeek.friday,
];

const PLAN_INCLUDE = {
  meals: {
    include: {
      recipe: {
        include: {
          ingredients: { include: { ingredient: true, unit: true } },
          tags: { include: { tag: true } },
        },
      },
    },
    orderBy: { day: 'asc' as const },
  },
};

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipesService,
  ) {}

  async createPlan(user: User, weekStartOverride?: Date) {
    const weekStart = weekStartOverride ?? this.getWeekStart();

    const existing = await this.prisma.weeklyPlan.findFirst({
      where: {
        userId: user.id,
        weekStartDate: weekStart,
        status: PlanStatus.draft,
      },
      include: PLAN_INCLUDE,
    });
    if (existing) return existing;

    // Get recently used recipe IDs (last 2 weeks) to avoid repetition
    const twoWeeksAgo = new Date(weekStart);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const recentPlans = await this.prisma.weeklyPlan.findMany({
      where: { userId: user.id, weekStartDate: { gte: twoWeeksAgo } },
      include: { meals: { select: { recipeId: true } } },
    });
    const recentIds = recentPlans.flatMap((p) =>
      p.meals.map((m) => m.recipeId),
    );

    // Build tag preferences from user goal
    const goalTags = this.goalToTags(user.goal);

    // Suggest meals — cascade through 3 fallbacks
    const suggestions = await this.recipes.findSuggestions(
      recentIds,
      goalTags,
      user.mealsPerWeek * 3,
    );

    if (suggestions.length < user.mealsPerWeek) {
      // Fallback 1: drop recent exclusions, keep goal tags
      const f1 = await this.recipes.findSuggestions(
        [],
        goalTags,
        user.mealsPerWeek * 2,
      );
      suggestions.push(
        ...f1.filter((r) => !suggestions.some((s) => s.id === r.id)),
      );
    }

    if (suggestions.length < user.mealsPerWeek) {
      // Fallback 2: drop tags too — any active recipe
      const f2 = await this.recipes.findSuggestions(
        [],
        [],
        user.mealsPerWeek * 2,
      );
      suggestions.push(
        ...f2.filter((r) => !suggestions.some((s) => s.id === r.id)),
      );
    }

    const selected = this.pickVariedMeals(suggestions, user.mealsPerWeek);
    if (selected.length < user.mealsPerWeek) {
      throw new BadRequestException(
        'Not enough recipes available to create a plan',
      );
    }
    const days = WEEKDAYS.slice(0, user.mealsPerWeek);

    const plan = await this.prisma.weeklyPlan.create({
      data: {
        userId: user.id,
        weekStartDate: weekStart,
        status: PlanStatus.draft,
        meals: {
          create: days.map((day, i) => ({
            day,
            recipeId: selected[i].id,
          })),
        },
      },
      include: PLAN_INCLUDE,
    });

    return plan;
  }

  async getCurrentPlan(userId: string, weekStartOverride?: Date) {
    const weekStart = weekStartOverride ?? this.getWeekStart();
    return this.prisma.weeklyPlan.findFirst({
      where: { userId, weekStartDate: weekStart },
      include: PLAN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlanById(id: string, userId: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id },
      include: PLAN_INCLUDE,
    });
    if (!plan || plan.userId !== userId)
      throw new NotFoundException('Plan not found');
    return plan;
  }

  async swapMeal(
    planId: string,
    mealId: string,
    userId: string,
    newRecipeId?: string,
  ) {
    const plan = await this.getPlanById(planId, userId);
    const meal = plan.meals.find((m) => m.id === mealId);
    if (!meal) throw new NotFoundException('Meal not found');
    if (meal.isLocked) throw new BadRequestException('Meal is locked');

    let recipeId = newRecipeId;
    if (!recipeId) {
      const currentIds = plan.meals.map((m) => m.recipeId);
      const [alternative] = await this.recipes.findSuggestions(
        currentIds,
        [],
        1,
      );
      if (!alternative)
        throw new BadRequestException('No alternative recipes available');
      recipeId = alternative.id;
    }

    return this.prisma.weeklyPlanMeal.update({
      where: { id: mealId },
      data: { recipeId },
      include: PLAN_INCLUDE.meals.include,
    });
  }

  async toggleLock(planId: string, mealId: string, userId: string) {
    const plan = await this.getPlanById(planId, userId);
    const meal = plan.meals.find((m) => m.id === mealId);
    if (!meal) throw new NotFoundException('Meal not found');

    return this.prisma.weeklyPlanMeal.update({
      where: { id: mealId },
      data: { isLocked: !meal.isLocked },
    });
  }

  async unlockPlan(planId: string, userId: string) {
    const plan = await this.getPlanById(planId, userId);
    if (plan.status === PlanStatus.draft) return plan;

    return this.prisma.weeklyPlan.update({
      where: { id: planId },
      data: { status: PlanStatus.draft },
      include: PLAN_INCLUDE,
    });
  }

  async regeneratePlan(planId: string, userId: string) {
    const plan = await this.getPlanById(planId, userId);
    if (plan.status === PlanStatus.confirmed)
      throw new BadRequestException('Cannot regenerate a confirmed plan');

    const lockedMeals = plan.meals.filter((m) => m.isLocked);
    const unlockedMeals = plan.meals.filter((m) => !m.isLocked);
    const unlockedCount = unlockedMeals.length;

    if (unlockedCount === 0) return plan;

    // Exclude all currently-in-plan recipe IDs (locked + unlocked) from suggestions
    const excludeIds = plan.meals.map((m) => m.recipeId);
    const goalTags = this.goalToTags(
      (await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .goal,
    );

    const suggestions = await this.recipes.findSuggestions(
      excludeIds,
      goalTags,
      unlockedCount * 3,
    );

    if (suggestions.length < unlockedCount) {
      const f1 = await this.recipes.findSuggestions(
        lockedMeals.map((m) => m.recipeId),
        goalTags,
        unlockedCount * 2,
      );
      suggestions.push(
        ...f1.filter((r) => !suggestions.some((s) => s.id === r.id)),
      );
    }

    if (suggestions.length < unlockedCount) {
      const f2 = await this.recipes.findSuggestions(
        lockedMeals.map((m) => m.recipeId),
        [],
        unlockedCount * 2,
      );
      suggestions.push(
        ...f2.filter((r) => !suggestions.some((s) => s.id === r.id)),
      );
    }

    const selected = this.pickVariedMeals(suggestions, unlockedCount);
    if (selected.length < unlockedCount)
      throw new BadRequestException(
        'Not enough recipes available to regenerate',
      );

    await Promise.all(
      unlockedMeals.map((meal, i) =>
        this.prisma.weeklyPlanMeal.update({
          where: { id: meal.id },
          data: { recipeId: selected[i].id },
        }),
      ),
    );

    return this.prisma.weeklyPlan.findUniqueOrThrow({
      where: { id: planId },
      include: PLAN_INCLUDE,
    });
  }

  async confirmPlan(planId: string, userId: string) {
    const plan = await this.getPlanById(planId, userId);
    if (plan.status === PlanStatus.confirmed) return plan;

    return this.prisma.weeklyPlan.update({
      where: { id: planId },
      data: { status: PlanStatus.confirmed },
      include: PLAN_INCLUDE,
    });
  }

  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private goalToTags(goal: User['goal']): string[] {
    const map: Record<string, string[]> = {
      healthy: ['healthy', 'vegetarian'],
      high_protein: ['high_protein'],
      cheap: ['cheap', 'vegetarian'],
      easy: ['quick'],
    };
    return map[goal] ?? [];
  }

  private pickVariedMeals<
    T extends { id: string; tags: { tag: { slug: string } }[] },
  >(recipes: T[], count: number): T[] {
    if (recipes.length === 0) return [];
    const picked: T[] = [];
    const usedTags = new Set<string>();

    // First pass: prefer tag variety
    for (const recipe of recipes) {
      if (picked.length >= count) break;
      const newTags = recipe.tags.filter((rt) => !usedTags.has(rt.tag.slug));
      if (newTags.length > 0) {
        picked.push(recipe);
        recipe.tags.forEach((rt) => usedTags.add(rt.tag.slug));
      }
    }

    // Second pass: fill remaining slots — duplicates allowed
    let i = 0;
    while (picked.length < count && recipes.length > 0) {
      picked.push(recipes[i % recipes.length]);
      i++;
    }

    return picked.slice(0, count);
  }
}
