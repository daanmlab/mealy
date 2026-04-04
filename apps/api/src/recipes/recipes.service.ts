import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto, RecipeQueryDto } from './recipes.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    groups: { orderBy: { sortOrder: 'asc' as const } },
    tags: { include: { tag: true } },
    ingredients: {
      include: {
        ingredient: { include: { category: true } },
        unit: true,
        group: true,
      },
      orderBy: { ingredient: { name: 'asc' as const } },
    },
  };

  async findAll(query: RecipeQueryDto) {
    return this.prisma.recipe.findMany({
      where: {
        isActive: true,
        ...(query.maxCookTime && {
          cookTimeMinutes: { lte: query.maxCookTime },
        }),
        ...(query.tags?.length && {
          tags: { some: { tag: { slug: { in: query.tags } } } },
        }),
      },
      include: this.include,
      take: query.limit ?? 50,
      orderBy: { title: 'asc' },
    });
  }

  async findById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: this.include,
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    return recipe;
  }

  async findByTagSlugs(
    tagSlugs: string[],
    excludeIds: string[] = [],
    limit = 20,
  ) {
    return this.prisma.recipe.findMany({
      where: {
        isActive: true,
        tags: { some: { tag: { slug: { in: tagSlugs } } } },
        id: { notIn: excludeIds },
      },
      include: this.include,
      take: limit,
    });
  }

  async findSuggestions(
    excludeIds: string[] = [],
    tagSlugs: string[] = [],
    limit = 10,
    maxCookTime?: number,
    dislikedIngredients: string[] = [],
  ) {
    const results = await this.prisma.recipe.findMany({
      where: {
        isActive: true,
        id: { notIn: excludeIds },
        ...(tagSlugs.length && {
          tags: { some: { tag: { slug: { in: tagSlugs } } } },
        }),
        ...(maxCookTime && { cookTimeMinutes: { lte: maxCookTime } }),
        ...(dislikedIngredients.length && {
          ingredients: {
            none: {
              ingredient: { name: { in: dislikedIngredients } },
            },
          },
        }),
      },
      include: this.include,
      take: limit * 3, // fetch extra so shuffle has variety
      orderBy: { id: 'asc' },
    });

    // Fisher-Yates shuffle for varied suggestions across calls
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }

    return results.slice(0, limit);
  }

  async create(dto: CreateRecipeDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Upsert Unit records for all unique unit symbols
      const uniqueUnitSymbols = [
        ...new Set(dto.ingredients.map((i) => i.unitSymbol)),
      ];
      const unitRecords = await Promise.all(
        uniqueUnitSymbols.map((symbol) =>
          tx.unit.upsert({
            where: { symbol },
            create: { symbol, name: symbol, type: 'other' },
            update: {},
          }),
        ),
      );
      const unitBySymbol = Object.fromEntries(
        unitRecords.map((u, i) => [uniqueUnitSymbols[i], u]),
      );

      // 2. Upsert IngredientCategory records
      const uniqueCategorySlugs = [
        ...new Set(dto.ingredients.map((i) => i.categorySlug).filter(Boolean)),
      ];
      const categoryRecords = await Promise.all(
        uniqueCategorySlugs.map((slug) =>
          tx.ingredientCategory.upsert({
            where: { slug },
            create: {
              slug,
              name:
                slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' '),
            },
            update: {},
          }),
        ),
      );
      const categoryBySlug = Object.fromEntries(
        categoryRecords.map((c, i) => [uniqueCategorySlugs[i], c]),
      );

      // 3. Upsert Tag records
      const uniqueTagSlugs = [...new Set(dto.tagSlugs)];
      const tagRecords = await Promise.all(
        uniqueTagSlugs.map((slug) =>
          tx.tag.upsert({
            where: { slug },
            create: { slug, name: slug.replace(/_/g, ' ') },
            update: {},
          }),
        ),
      );
      const tagBySlug = Object.fromEntries(
        tagRecords.map((t, i) => [uniqueTagSlugs[i], t]),
      );

      // 4. Deduplicate ingredients by (name, groupName), summing amounts for dupes
      const deduped = new Map<
        string,
        {
          name: string;
          amount: number;
          unitSymbol: string;
          categorySlug: string;
          groupName?: string;
        }
      >();
      for (const ing of dto.ingredients) {
        const key = `${ing.name}::${ing.groupName ?? ''}`;
        const existing = deduped.get(key);
        if (existing) {
          existing.amount += ing.amount;
        } else {
          deduped.set(key, { ...ing });
        }
      }
      const uniqueIngredients = [...deduped.values()];

      // 5. Upsert Ingredient records (update categoryId if we now know it)
      const ingredientRecords = await Promise.all(
        uniqueIngredients.map((ing) => {
          const categoryId = categoryBySlug[ing.categorySlug]?.id ?? null;
          return tx.ingredient.upsert({
            where: { name: ing.name },
            create: { name: ing.name, categoryId },
            update: { ...(categoryId && { categoryId }) },
          });
        }),
      );

      // 6. Create the Recipe with RecipeTag join rows
      const recipe = await tx.recipe.create({
        data: {
          title: dto.title,
          description: dto.description,
          cookTimeMinutes: dto.cookTimeMinutes,
          servings: dto.servings,
          imageUrl: dto.imageUrl ?? null,
          sourceUrl: dto.sourceUrl ?? null,
          steps: dto.steps,
          tags: {
            create: uniqueTagSlugs.map((slug) => ({
              tagId: tagBySlug[slug].id,
            })),
          },
        },
      });

      // 7. Create IngredientGroup records for named groups
      const groupNames = [
        ...new Set(
          uniqueIngredients
            .map((i) => i.groupName)
            .filter((g): g is string => !!g),
        ),
      ];
      const groupRecords = await Promise.all(
        groupNames.map((name, idx) =>
          tx.ingredientGroup.create({
            data: { recipeId: recipe.id, name, sortOrder: idx },
          }),
        ),
      );
      const groupByName = Object.fromEntries(
        groupRecords.map((g) => [g.name, g]),
      );

      // 8. Create RecipeIngredient rows
      await tx.recipeIngredient.createMany({
        data: uniqueIngredients.map((ing, i) => ({
          recipeId: recipe.id,
          ingredientId: ingredientRecords[i].id,
          unitId: unitBySymbol[ing.unitSymbol].id,
          groupId: ing.groupName
            ? (groupByName[ing.groupName]?.id ?? null)
            : null,
          amount: ing.amount,
        })),
      });

      return tx.recipe.findUniqueOrThrow({
        where: { id: recipe.id },
        include: this.include,
      });
    });
  }
}
