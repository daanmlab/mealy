import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { PlanStatus } from '@prisma/client';

@Injectable()
export class GroceryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async generateList(planId: string, userId: string) {
    const plan = await this.plans.getPlanById(planId, userId);
    if (plan.status !== PlanStatus.confirmed) {
      throw new NotFoundException(
        'Plan must be confirmed before generating a grocery list',
      );
    }

    // Delete existing list if regenerating
    await this.prisma.groceryList.deleteMany({
      where: { weeklyPlanId: planId },
    });

    // Aggregate ingredients across all meals
    const aggregated = new Map<
      string,
      { ingredientId: string; totalAmount: number; unit: string }
    >();

    for (const meal of plan.meals) {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: meal.recipeId },
        include: { ingredients: { include: { ingredient: true } } },
      });
      if (!recipe) continue;

      for (const ri of recipe.ingredients) {
        const key = `${ri.ingredientId}:${ri.unit}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.totalAmount += ri.amount;
        } else {
          aggregated.set(key, {
            ingredientId: ri.ingredientId,
            totalAmount: ri.amount,
            unit: ri.unit,
          });
        }
      }
    }

    const list = await this.prisma.groceryList.create({
      data: {
        weeklyPlanId: planId,
        items: {
          create: Array.from(aggregated.values()),
        },
      },
      include: {
        items: { include: { ingredient: true } },
      },
    });

    return list;
  }

  async getList(planId: string, userId: string) {
    // Verify user owns the plan
    await this.plans.getPlanById(planId, userId);

    const list = await this.prisma.groceryList.findUnique({
      where: { weeklyPlanId: planId },
      include: {
        items: {
          include: { ingredient: true },
          orderBy: [
            { ingredient: { category: 'asc' } },
            { ingredient: { name: 'asc' } },
          ],
        },
      },
    });

    if (!list)
      throw new NotFoundException('Grocery list not found. Generate it first.');
    return list;
  }

  async toggleItem(planId: string, itemId: string, userId: string) {
    await this.plans.getPlanById(planId, userId);

    const item = await this.prisma.groceryListItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Item not found');

    return this.prisma.groceryListItem.update({
      where: { id: itemId },
      data: { isChecked: !item.isChecked },
      include: { ingredient: true },
    });
  }
}
