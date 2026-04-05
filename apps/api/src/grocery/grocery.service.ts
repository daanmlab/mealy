import { Injectable, NotFoundException } from '@nestjs/common';
import type { Unit, User } from '@prisma/client';
import { PlanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { ConversionService } from '../catalog/conversion.service';

@Injectable()
export class GroceryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly conversion: ConversionService,
  ) {}

  async generateList(planId: string, user: User) {
    const plan = await this.plans.getPlanById(planId, user.id);
    if (plan.status !== PlanStatus.confirmed) {
      throw new NotFoundException(
        'Plan must be confirmed before generating a grocery list',
      );
    }

    // Delete existing list if regenerating
    await this.prisma.groceryList.deleteMany({
      where: { weeklyPlanId: planId },
    });

    // Aggregate ingredients across all meals, counting each meal occurrence
    // separately (same recipe on two days = 2× the ingredients).
    const aggregated = new Map<
      string,
      {
        ingredientId: string;
        totalAmount: number;
        unitId: string | null;
        unit: Unit | null;
      }
    >();

    // Track which recipe+day contributed to each ingredient (keyed by ingredientId)
    // Each entry records the scaled amount and unit for that specific recipe contribution.
    const sourcesMap = new Map<
      string,
      Array<{
        recipeId: string;
        day: string;
        amount: number;
        unitId: string | null;
      }>
    >();

    const recipeIds = plan.meals.map((m) => m.recipeId);
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      include: { ingredients: { include: { ingredient: true, unit: true } } },
    });
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));

    for (const meal of plan.meals) {
      const recipe = recipeMap.get(meal.recipeId);
      if (!recipe) continue;

      // Scale amounts to the user's household size
      const scale = user.peopleCount / (recipe.servings || 1);

      for (const ri of recipe.ingredients) {
        // null unitId means countable — group separately per ingredient
        const key = `${ri.ingredientId}:${ri.unitId ?? 'null'}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.totalAmount += ri.amount * scale;
        } else {
          aggregated.set(key, {
            ingredientId: ri.ingredientId,
            totalAmount: ri.amount * scale,
            unitId: ri.unitId,
            unit: ri.unit ?? null,
          });
        }

        // Record source: accumulate amount per recipe+day+unit combination
        const sources = sourcesMap.get(ri.ingredientId) ?? [];
        const unitId = ri.unitId ?? null;
        const existing_src = sources.find(
          (s) =>
            s.recipeId === meal.recipeId &&
            s.day === meal.day &&
            s.unitId === unitId,
        );
        if (existing_src) {
          existing_src.amount += ri.amount * scale;
        } else {
          sources.push({
            recipeId: meal.recipeId,
            day: meal.day,
            amount: ri.amount * scale,
            unitId,
          });
        }
        sourcesMap.set(ri.ingredientId, sources);
      }
    }

    // Merge entries with the same ingredient but different convertible units
    const merged = await this.mergeConvertibleUnits(aggregated);

    // Strip unitId when null — passing explicit null triggers Prisma v7 FK validation
    // which calls unit.findUnique({ where: { id: null } }) and throws. Omitting the
    // field lets the DB default the column to NULL without validation.
    const itemsToCreate = Array.from(merged.values()).map(
      ({ unitId, ...rest }) => ({
        ...rest,
        ...(unitId !== null ? { unitId } : {}),
      }),
    );

    const list = await this.prisma.groceryList.create({
      data: {
        weeklyPlanId: planId,
        items: { create: itemsToCreate },
      },
      include: {
        items: { include: { ingredient: true, unit: true } },
      },
    });

    // Attach sources to each created item
    const sourceRecords = list.items.flatMap((item) =>
      (sourcesMap.get(item.ingredientId) ?? []).map((s) => ({
        groceryListItemId: item.id,
        recipeId: s.recipeId,
        day: s.day as import('@prisma/client').DayOfWeek,
        amount: s.amount,
        ...(s.unitId !== null ? { unitId: s.unitId } : {}),
      })),
    );
    if (sourceRecords.length > 0) {
      await this.prisma.groceryListItemSource.createMany({
        data: sourceRecords,
      });
    }

    return list;
  }

  /**
   * Groups entries by ingredientId. For each ingredient with multiple unit entries,
   * tries to convert all amounts into the dominant unit (highest total amount in
   * base SI/common unit). Triggers progressive LLM fill for any unknown unit pairs.
   * Null-unit (countable) entries are kept as-is without conversion.
   */
  private async mergeConvertibleUnits(
    aggregated: Map<
      string,
      {
        ingredientId: string;
        totalAmount: number;
        unitId: string | null;
        unit: Unit | null;
      }
    >,
  ): Promise<
    Map<
      string,
      { ingredientId: string; totalAmount: number; unitId: string | null }
    >
  > {
    // Group by ingredientId
    const byIngredient = new Map<
      string,
      Array<{
        key: string;
        ingredientId: string;
        totalAmount: number;
        unitId: string | null;
        unit: Unit | null;
      }>
    >();

    for (const [key, entry] of aggregated) {
      const group = byIngredient.get(entry.ingredientId) ?? [];
      group.push({ key, ...entry });
      byIngredient.set(entry.ingredientId, group);
    }

    const result = new Map<
      string,
      { ingredientId: string; totalAmount: number; unitId: string | null }
    >();

    for (const entries of byIngredient.values()) {
      // Separate null-unit (countable) entries — they can only be summed, not converted
      const nullUnitEntries = entries.filter((e) => e.unitId === null);
      const realUnitEntries = entries.filter(
        (e): e is typeof e & { unitId: string; unit: Unit } =>
          e.unitId !== null && e.unit !== null,
      );

      // Sum all null-unit entries for this ingredient into one row
      if (nullUnitEntries.length > 0) {
        const total = nullUnitEntries.reduce(
          (sum, e) => sum + e.totalAmount,
          0,
        );
        result.set(`${nullUnitEntries[0].ingredientId}:null`, {
          ingredientId: nullUnitEntries[0].ingredientId,
          totalAmount: total,
          unitId: null,
        });
      }

      if (realUnitEntries.length === 0) continue;

      if (realUnitEntries.length === 1) {
        const e = realUnitEntries[0];
        result.set(e.key, {
          ingredientId: e.ingredientId,
          totalAmount: e.totalAmount,
          unitId: e.unitId,
        });
        continue;
      }

      // Ensure we have conversion data for all pairs (progressive fill)
      for (let i = 0; i < realUnitEntries.length; i++) {
        for (let j = i + 1; j < realUnitEntries.length; j++) {
          await this.conversion.ensureConversion(
            realUnitEntries[i].unit,
            realUnitEntries[j].unit,
          );
        }
      }

      // Pick dominant unit: the entry with highest total amount after converting to
      // the first unit as a common base (to compare apples-to-apples)
      const baseEntry = realUnitEntries[0];
      const converted: Array<{
        entry: (typeof realUnitEntries)[0];
        inBase: number;
      }> = [];

      for (const entry of realUnitEntries) {
        if (entry.unitId === baseEntry.unitId) {
          converted.push({ entry, inBase: entry.totalAmount });
          continue;
        }
        const inBase = await this.conversion.convert(
          entry.totalAmount,
          entry.unitId,
          baseEntry.unitId,
        );
        converted.push({ entry, inBase: inBase ?? entry.totalAmount });
      }

      // Choose dominant unit (highest amount in base)
      const dominant = converted.reduce((a, b) =>
        a.inBase >= b.inBase ? a : b,
      ).entry;

      // Merge all convertible entries into dominant unit; keep incompatible ones separate
      let mergedAmount = 0;
      const unmerged: typeof realUnitEntries = [];

      for (const { entry } of converted) {
        const convertedAmount = await this.conversion.convert(
          entry.totalAmount,
          entry.unitId,
          dominant.unitId,
        );
        if (convertedAmount !== null) {
          mergedAmount += convertedAmount;
        } else {
          unmerged.push(entry);
        }
      }

      // Save merged entry under dominant unit
      result.set(`${dominant.ingredientId}:${dominant.unitId}`, {
        ingredientId: dominant.ingredientId,
        totalAmount: mergedAmount,
        unitId: dominant.unitId,
      });

      // Keep incompatible entries as-is
      for (const entry of unmerged) {
        result.set(entry.key, {
          ingredientId: entry.ingredientId,
          totalAmount: entry.totalAmount,
          unitId: entry.unitId,
        });
      }
    }

    return result;
  }

  async getList(planId: string, userId: string) {
    // Verify user owns the plan
    await this.plans.getPlanById(planId, userId);

    const list = await this.prisma.groceryList.findUnique({
      where: { weeklyPlanId: planId },
      include: {
        items: {
          include: {
            ingredient: { include: { category: true } },
            unit: true,
            sources: {
              include: {
                recipe: { select: { id: true, title: true } },
                unit: true,
              },
            },
          },
          orderBy: [
            { ingredient: { category: { name: 'asc' } } },
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
      include: { ingredient: true, unit: true },
    });
  }
}
