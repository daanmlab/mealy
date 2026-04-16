import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import axios from 'axios';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

// ── Types ────────────────────────────────────────────────────────────────────

type MacroResult = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

type UsdaNutrient = {
  nutrientName?: string;
  value?: number;
  unitName?: string;
};

type UsdaFoodCandidate = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  dataType?: string;
  servingSize?: number;
  foodNutrients?: UsdaNutrient[];
};

type UsdaSearchResponse = {
  foods?: UsdaFoodCandidate[];
};

// ── Constants ────────────────────────────────────────────────────────────────

const NUTRIENT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const USDA_REQUEST_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT_USDA_CALLS = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractNutrient(
  nutrients: UsdaNutrient[],
  name: string,
  preferredUnit?: string,
): UsdaNutrient | undefined {
  const lowerName = name.toLowerCase();
  const lowerUnit = preferredUnit?.toLowerCase();

  if (lowerUnit) {
    const preferred = nutrients.find((n) => {
      const nutrientName = (n.nutrientName ?? '').toLowerCase();
      const unitName = (n.unitName ?? '').toLowerCase();
      return nutrientName.includes(lowerName) && unitName.includes(lowerUnit);
    });
    if (preferred) return preferred;
  }

  return nutrients.find((n) =>
    (n.nutrientName ?? '').toLowerCase().includes(lowerName),
  );
}

function chooseUsdaFoodCandidate(
  ingredientName: string,
  foods: UsdaFoodCandidate[],
): { candidate: UsdaFoodCandidate; candidateIndex: number } {
  const normalizedIngredient = ingredientName.trim().toLowerCase();
  const ingredientTokens = normalizedIngredient
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const negativeHints = new Set([
    'mix',
    'meal',
    'frozen',
    'canned',
    'sauce',
    'seasoning',
    'powder',
    'supplement',
    'snack',
    'bar',
    'restaurant',
    'fast',
    'prepared',
    'cooked',
  ]);

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  foods.forEach((food, index) => {
    const description = (food.description ?? '').toLowerCase();
    const descriptionTokens = description
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const isBranded = food.dataType === 'Branded' || !!food.brandOwner;
    const overlapCount = ingredientTokens.filter((token) =>
      descriptionTokens.includes(token),
    ).length;
    const hasNegativeHint = descriptionTokens.some((token) =>
      negativeHints.has(token),
    );

    let score = 0;

    if (!isBranded) score += 8;
    if (description.includes(normalizedIngredient)) score += 5;
    if (description.startsWith(normalizedIngredient)) score += 3;
    score += overlapCount * 2;

    if (ingredientTokens.length > 0 && overlapCount === 0) score -= 10;
    if (hasNegativeHint) score -= 4;

    if (typeof food.servingSize === 'number' && food.servingSize > 0) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return { candidate: foods[bestIndex], candidateIndex: bestIndex };
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class NutrientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NutrientService.name);
  private redis: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const redisUrl = process.env['REDIS_URL'];
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetch nutrients for a batch of ingredient names with concurrency limiting.
   * Errors for individual ingredients are swallowed (logged) so the batch
   * never throws.
   */
  async fetchNutrientsForIngredients(names: string[]): Promise<void> {
    const unique = [...new Set(names)];
    if (unique.length === 0) return;

    // Simple concurrency limiter
    const running: Promise<void>[] = [];
    for (const name of unique) {
      const task: Promise<void> = this.getNutrients(name)
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Nutrient fetch failed for "${name}": ${msg}`);
        })
        .then(() => void running.splice(running.indexOf(task), 1));
      running.push(task);
      if (running.length >= MAX_CONCURRENT_USDA_CALLS) {
        await Promise.race(running);
      }
    }
    await Promise.all(running);
  }

  /**
   * Get macros for a single ingredient. Checks Redis cache, then DB, then
   * USDA. Persists to DB and cache on success.
   */
  async getNutrients(ingredientName: string): Promise<MacroResult | null> {
    try {
      const normalizedName = ingredientName.trim();
      if (!normalizedName) return null;

      // 0. Redis lookup
      const cached = await this.getCachedNutrients(normalizedName);
      if (cached) return cached;

      // 1. DB lookup
      const ingredient = await this.prisma.ingredient.findUnique({
        where: { name: normalizedName },
      });
      let ingredientId = ingredient?.id;

      if (ingredient) {
        const existingLink = await this.prisma.ingredientNutrientLink.findFirst(
          {
            where: { ingredientId: ingredient.id },
            include: { nutrient: true },
            orderBy: { createdAt: 'desc' },
          },
        );
        const n = existingLink?.nutrient;

        if (n) {
          const dbMacros: MacroResult = {
            calories: n.calories ?? 0,
            protein: n.protein ?? 0,
            fat: n.totalFats ?? 0,
            carbs: n.carbs ?? 0,
          };
          await this.setCachedNutrients(normalizedName, dbMacros);
          return dbMacros;
        }
      }

      // 2. USDA fetch
      const apiKey = process.env['USDA_API_KEY'];
      if (!apiKey) return null;

      const food = await this.fetchUsdaFood(normalizedName, apiKey);
      if (!food) return null;

      const nutrients: UsdaNutrient[] = Array.isArray(food.foodNutrients)
        ? food.foodNutrients
        : [];

      const extract = (name: string) =>
        extractNutrient(nutrients, name)?.value ?? 0;

      const energyNutrient =
        extractNutrient(nutrients, 'energy', 'kcal') ??
        extractNutrient(nutrients, 'energy', 'kj') ??
        extractNutrient(nutrients, 'energy');

      const calories = (() => {
        const energyValue = energyNutrient?.value ?? 0;
        const unitName = (energyNutrient?.unitName ?? '').toLowerCase();
        if (unitName.includes('kj')) return energyValue * 0.239005736;
        return energyValue;
      })();

      const serving = food.servingSize || 100;
      const scale = 100 / serving;

      const macros: MacroResult = {
        calories: roundToTwo(calories * scale),
        protein: roundToTwo(extract('protein') * scale),
        fat: roundToTwo(extract('fat') * scale),
        carbs: roundToTwo(extract('carbohydrate') * scale),
      };

      const satFats = roundToTwo(extract('saturated') * scale);
      const transFats = roundToTwo(extract('trans') * scale);
      const cholesterol = roundToTwo(extract('cholesterol') * scale);
      const fiber = roundToTwo(extract('fiber') * scale);
      const sugar = roundToTwo(extract('sugar') * scale);

      const microNutrients = nutrients
        .filter((n) => {
          const nutrientName = (n.nutrientName ?? '').toLowerCase();
          return ![
            'energy',
            'protein',
            'fat',
            'saturated',
            'trans',
            'carbohydrate',
            'cholesterol',
            'fiber',
            'sugar',
          ].some((k) => nutrientName.includes(k));
        })
        .map((n) => ({
          nutrientName: n.nutrientName ?? null,
          value: typeof n.value === 'number' ? roundToTwo(n.value) : null,
          unitName: n.unitName ?? null,
        }));

      // 3. Persist
      if (!ingredientId) {
        const ing = await this.prisma.ingredient.create({
          data: { name: normalizedName },
        });
        ingredientId = ing.id;
      }

      if (typeof food.fdcId !== 'number') return null;

      await this.prisma.ingredientNutrients.create({
        data: {
          ingredientName: normalizedName,
          fdcId: food.fdcId,
          calories: macros.calories,
          protein: macros.protein,
          totalFats: macros.fat,
          satFats,
          transFats,
          carbs: macros.carbs,
          cholesterol,
          fiber,
          sugar,
          microNutrients,
          links: {
            create: {
              ingredientId,
              fdcId: typeof food.fdcId === 'number' ? food.fdcId : null,
              rawJson: {
                ...(food as Record<string, unknown>),
                ingredientName: normalizedName,
              },
            },
          },
        },
      });

      await this.setCachedNutrients(normalizedName, macros);
      return macros;
    } catch (err) {
      this.logger.error(
        `Nutrient resolution failed for "${ingredientName}"`,
        err instanceof Error ? err.stack : err,
      );
      return null;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async fetchUsdaFood(
    normalizedName: string,
    apiKey: string,
  ): Promise<UsdaFoodCandidate | null> {
    const response = await axios.get<UsdaSearchResponse>(
      'https://api.nal.usda.gov/fdc/v1/foods/search',
      {
        params: { query: normalizedName, api_key: apiKey },
        timeout: USDA_REQUEST_TIMEOUT_MS,
      },
    );

    const candidates = (response.data.foods ?? []).slice(0, 15);
    if (candidates.length === 0) return null;

    return chooseUsdaFoodCandidate(normalizedName, candidates).candidate;
  }

  private nutrientCacheKey(ingredientName: string) {
    return `nutrients:${ingredientName.trim().toLowerCase()}`;
  }

  private async getCachedNutrients(
    ingredientName: string,
  ): Promise<MacroResult | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.nutrientCacheKey(ingredientName));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<MacroResult>;
      if (
        typeof parsed.calories !== 'number' ||
        typeof parsed.protein !== 'number' ||
        typeof parsed.fat !== 'number' ||
        typeof parsed.carbs !== 'number'
      ) {
        return null;
      }
      return {
        calories: parsed.calories,
        protein: parsed.protein,
        fat: parsed.fat,
        carbs: parsed.carbs,
      };
    } catch {
      return null;
    }
  }

  private async setCachedNutrients(
    ingredientName: string,
    macros: MacroResult,
  ): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        this.nutrientCacheKey(ingredientName),
        JSON.stringify(macros),
        'EX',
        NUTRIENT_CACHE_TTL_SECONDS,
      );
    } catch {
      // Cache failures should not block nutrient persistence
    }
  }
}
