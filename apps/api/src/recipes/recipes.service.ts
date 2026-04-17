import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Recipe } from '@prisma/client';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateRecipeDto, RecipeQueryDto } from './recipes.dto';

@Injectable()
export class RecipesService {
  private readonly logger = new Logger(RecipesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

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

  async findDuplicates(
    resolvedIngredientIds: string[],
    title: string,
  ): Promise<{ recipe: Recipe; similarity: number } | null> {
    const uniqueIngredientIds = [...new Set(resolvedIngredientIds)];

    if (uniqueIngredientIds.length < 3) {
      return null;
    }

    const candidates = await this.prisma.recipe.findMany({
      where: {
        ingredients: {
          some: {
            ingredientId: { in: uniqueIngredientIds },
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        cookTimeMinutes: true,
        servings: true,
        imageUrl: true,
        sourceUrl: true,
        steps: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        ingredients: {
          select: {
            ingredientId: true,
            ingredient: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (candidates.length === 0) {
      return null;
    }

    let bestMatch:
      | {
          recipe: Recipe;
          similarity: number;
          ingredientNames: string[];
        }
      | undefined;

    for (const candidate of candidates) {
      const candidateIngredientIds = [
        ...new Set(
          candidate.ingredients.map((ingredient) => ingredient.ingredientId),
        ),
      ];
      const candidateIngredientIdSet = new Set(candidateIngredientIds);
      const intersectionSize = uniqueIngredientIds.filter((ingredientId) =>
        candidateIngredientIdSet.has(ingredientId),
      ).length;
      const unionSize = new Set([
        ...uniqueIngredientIds,
        ...candidateIngredientIds,
      ]).size;

      if (unionSize === 0) {
        continue;
      }

      const similarity = intersectionSize / unionSize;

      if (similarity < 0.6) {
        continue;
      }

      if (!bestMatch || similarity > bestMatch.similarity) {
        const { ingredients, ...recipe } = candidate;
        bestMatch = {
          recipe,
          similarity,
          ingredientNames: ingredients.map(({ ingredient }) => ingredient.name),
        };
      }
    }

    if (!bestMatch) {
      return null;
    }

    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      return null;
    }

    try {
      const incomingIngredients = await this.prisma.ingredient.findMany({
        where: { id: { in: uniqueIngredientIds } },
        select: { name: true },
        orderBy: { name: 'asc' },
      });

      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You determine whether two recipe records represent the same concrete dish. Return JSON exactly as { "isDuplicate": boolean, "reason": string }. Set isDuplicate to true only when the recipes are effectively the same dish from a different source or phrasing. If the ingredient overlap score is 1.00, you MUST classify the recipes as duplicates. For lower scores, use titles only as context, and base the decision primarily on whether the ingredient lists point to the same concrete dish rather than a broad category. Keep reason short.',
          },
          {
            role: 'user',
            content: `Incoming recipe title: "${title}"
Incoming ingredient names: ${incomingIngredients.map((ingredient) => ingredient.name).join(', ')}

Existing recipe title: "${bestMatch.recipe.title}"
Existing ingredient names: ${bestMatch.ingredientNames.join(', ')}

The ingredient overlap score is ${bestMatch.similarity.toFixed(2)}.

If the overlap score is 1.00, respond with isDuplicate=true. Otherwise, keep the same concrete-dish judgment described above.`,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed: unknown = JSON.parse(content);

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'isDuplicate' in parsed &&
        typeof (parsed as Record<string, unknown>)['isDuplicate'] ===
          'boolean' &&
        (!('reason' in parsed) ||
          typeof (parsed as Record<string, unknown>)['reason'] === 'string')
      ) {
        return (parsed as { isDuplicate: boolean; reason?: string }).isDuplicate
          ? { recipe: bestMatch.recipe, similarity: bestMatch.similarity }
          : null;
      }

      return null;
    } catch (err) {
      this.logger.warn(
        `LLM duplicate recipe check failed for "${title}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async create(dto: CreateRecipeDto, isActive = true, force = false) {
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

    if (!force) {
      const resolvedIngredientIds = resolvedIngredients.map(
        ({ resolvedIngredient }) => resolvedIngredient.id,
      );
      const duplicate = await this.findDuplicates(
        resolvedIngredientIds,
        dto.title,
      );

      if (duplicate) {
        throw new ConflictException({
          message: 'A similar recipe already exists',
          existingRecipe: {
            id: duplicate.recipe.id,
            title: duplicate.recipe.title,
          },
          similarity: duplicate.similarity,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
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
      await tx.recipeIngredient.createMany({
        data: uniqueIngredients.map((ing) => ({
          recipeId: recipe.id,
          ingredientId: ing.ingredientId,
          unitId: unitBySymbol[ing.unitSymbol]?.id ?? null,
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
