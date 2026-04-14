import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateRecipeDto, RecipeQueryDto } from './recipes.dto';
import { getNutrients } from '../macros/nutrients';

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  private readonly include = {
    groups: { orderBy: { sortOrder: 'asc' as const } },
    tags: { include: { tag: true } },
    ingredients: {
      include: {
        ingredient: {
          include: {
            category: true,
            nutrientLinks: {
              include: { nutrient: true },
              orderBy: { createdAt: 'desc' as const },
              take: 1,
            },
          },
        },
        unit: true,
        group: true,
      },
      orderBy: { ingredient: { name: 'asc' as const } },
    },
  };

  async findAll(query: RecipeQueryDto) {
    const recipes = await this.prisma.recipe.findMany({
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

    return this.ensureRecipesNutrients(recipes);
  }

  async findById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: this.include,
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    await this.ensureRecipeNutrients(recipe);
    return this.prisma.recipe.findUniqueOrThrow({
      where: { id },
      include: this.include,
    });
  }

  async findByTagSlugs(
    tagSlugs: string[],
    excludeIds: string[] = [],
    limit = 20,
  ) {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        isActive: true,
        tags: { some: { tag: { slug: { in: tagSlugs } } } },
        id: { notIn: excludeIds },
      },
      include: this.include,
      take: limit,
    });

    return this.ensureRecipesNutrients(recipes);
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

    const hydratedResults = await this.ensureRecipesNutrients(results);

    // Fisher-Yates shuffle for varied suggestions across calls
    for (let i = hydratedResults.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [hydratedResults[i], hydratedResults[j]] = [
        hydratedResults[j],
        hydratedResults[i],
      ];
    }

    return hydratedResults.slice(0, limit);
  }

  async create(dto: CreateRecipeDto, isActive = true) {
    const UNIT_FALLBACK = 'unit'; // treated as null — means "countable, no real unit"

    // ── Pre-transaction: resolve ingredient names + infer missing units via LLM ─
    // Both happen OUTSIDE the transaction so LLM calls don't hold DB locks.
    const resolvedIngredients = await Promise.all(
      dto.ingredients.map(async (ing) => {
        const resolvedIngredient = await this.catalog.resolveIngredient(
          ing.name,
        );

        // For countable ingredients (no real unit), try to infer one via LLM
        let unitSymbol = ing.unitSymbol;
        let amount = ing.amount;
        if (unitSymbol === UNIT_FALLBACK || !unitSymbol) {
          const inferred = await this.catalog.inferUnit(
            ing.name,
            ing.amount,
            dto.title,
          );
          if (inferred) {
            unitSymbol = inferred.unitSymbol;
            amount = inferred.amount;
          } else {
            unitSymbol = UNIT_FALLBACK; // stay as null-unit
          }
        }

        return { ...ing, unitSymbol, amount, resolvedIngredient };
      }),
    );

    const nutrientIngredientNames = [
      ...new Set(resolvedIngredients.map((i) => i.resolvedIngredient.name)),
    ];

    const recipe = await this.prisma.$transaction(async (tx) => {
      // 1. Upsert Unit records for all unique non-"unit" symbols
      // Use resolvedIngredients (post-LLM) so inferred unit symbols are included
      const uniqueUnitSymbols = [
        ...new Set(
          resolvedIngredients
            .map((i) => i.unitSymbol)
            .filter((s) => s !== UNIT_FALLBACK),
        ),
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

      // 4. Deduplicate by (resolvedIngredientId, groupName), summing amounts for dupes
      const deduped = new Map<
        string,
        {
          ingredientId: string;
          amount: number;
          unitSymbol: string;
          categorySlug: string;
          groupName?: string;
        }
      >();
      for (const ing of resolvedIngredients) {
        const key = `${ing.resolvedIngredient.id}::${ing.groupName ?? ''}`;
        const existing = deduped.get(key);
        if (existing) {
          existing.amount += ing.amount;
        } else {
          deduped.set(key, {
            ingredientId: ing.resolvedIngredient.id,
            amount: ing.amount,
            unitSymbol: ing.unitSymbol,
            categorySlug: ing.categorySlug,
            groupName: ing.groupName,
          });
        }
      }
      const uniqueIngredients = [...deduped.values()];

      // 5. Update categoryId on resolved ingredients if we now know it
      await Promise.all(
        uniqueIngredients
          .filter((ing) => ing.categorySlug)
          .map((ing) => {
            const categoryId = categoryBySlug[ing.categorySlug]?.id;
            if (!categoryId) return Promise.resolve();
            return tx.ingredient.update({
              where: { id: ing.ingredientId },
              data: { categoryId },
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
          isActive,
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

      // 8. Create RecipeIngredient rows (unitId is null for countable/unit-less items)
      await Promise.all(
        uniqueIngredients.map((ing) =>
          tx.recipeIngredient.create({
            data: {
              recipeId: recipe.id,
              ingredientId: ing.ingredientId,
              unitId: unitBySymbol[ing.unitSymbol]?.id ?? null,
              groupId: ing.groupName
                ? (groupByName[ing.groupName]?.id ?? null)
                : null,
              amount: ing.amount,
            },
          }),
        ),
      );

      return tx.recipe.findUniqueOrThrow({
        where: { id: recipe.id },
        include: this.include,
      });
    });

    await this.catchIngredientNutrients(nutrientIngredientNames);

    return this.prisma.recipe.findUniqueOrThrow({
      where: { id: recipe.id },
      include: this.include,
    });
  }

  private async ensureRecipeNutrients(recipe: {
    ingredients: { ingredient: { name: string; nutrientLinks?: unknown[] } }[];
  }) {
    const missingIngredientNames = recipe.ingredients
      .filter((ingredient) => !ingredient.ingredient.nutrientLinks?.length)
      .map((ingredient) => ingredient.ingredient.name);

    if (missingIngredientNames.length === 0) return;

    await this.catchIngredientNutrients(missingIngredientNames);
  }

  private async ensureRecipesNutrients<
    T extends {
      id: string;
      ingredients: {
        ingredient: { name: string; nutrientLinks?: unknown[] };
      }[];
    },
  >(recipes: T[]): Promise<T[]> {
    if (recipes.length === 0) return recipes;

    const missingIngredientNames = [
      ...new Set(
        recipes
          .flatMap((recipe) => recipe.ingredients)
          .filter((ingredient) => !ingredient.ingredient.nutrientLinks?.length)
          .map((ingredient) => ingredient.ingredient.name),
      ),
    ];

    if (missingIngredientNames.length === 0) return recipes;

    await this.catchIngredientNutrients(missingIngredientNames);

    const refreshedRecipes = await this.prisma.recipe.findMany({
      where: { id: { in: recipes.map((recipe) => recipe.id) } },
      include: this.include,
    });

    const refreshedById = new Map(
      refreshedRecipes.map((recipe) => [recipe.id, recipe]),
    );

    return recipes.map(
      (recipe) => (refreshedById.get(recipe.id) as T | undefined) ?? recipe,
    );
  }

  private async catchIngredientNutrients(names: string[]) {
    await Promise.all(names.map((name) => getNutrients(name)));
  }
}
