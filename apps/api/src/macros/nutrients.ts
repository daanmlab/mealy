import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  }),
});
const redis = process.env['REDIS_URL']
  ? new Redis(process.env['REDIS_URL'], {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
  : null;
const NUTRIENT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const db = prisma as unknown as {
  ingredientNutrientLink: {
    findFirst: (args: unknown) => Promise<
      | {
          nutrient?: {
            calories?: number | null;
            protein?: number | null;
            total_fats?: number | null;
            carbs?: number | null;
          };
        }
      | null
    >;
  };
  ingredientNutrients: {
    create: (args: unknown) => Promise<unknown>;
  };
};

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

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractNutrient(nutrients: UsdaNutrient[], name: string, preferredUnit?: string,): UsdaNutrient | undefined {
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

  return nutrients.find((n) => (n.nutrientName ?? '').toLowerCase().includes(lowerName));
}

function nutrientCacheKey(ingredientName: string) {
  return `nutrients:${ingredientName.trim().toLowerCase()}`;
}

  // checks if nutrients are already cached
async function getCachedNutrients(ingredientName: string,): Promise<MacroResult | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(nutrientCacheKey(ingredientName));
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

// sets nutrients in cache for fast access
async function setCachedNutrients(
  ingredientName: string,
  macros: MacroResult,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(
      nutrientCacheKey(ingredientName),
      JSON.stringify(macros),
      'EX',
      NUTRIENT_CACHE_TTL_SECONDS,
    );
  } catch {
    // no-op: cache failures should not block nutrient persistence
  }
}

function chooseUsdaFoodCandidate(ingredientName: string,foods: UsdaFoodCandidate[],): { candidate: UsdaFoodCandidate; candidateIndex: number } {
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

  // Prefer non-branded, plain generic foods that overlap ingredient tokens.
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

export async function getNutrients(ingredientName: string) {
  try {
    const normalizedName = ingredientName.trim();
    if (!normalizedName) return null;

    // 0. Redis lookup
    const cached = await getCachedNutrients(normalizedName);
    if (cached) return cached;

    // 1. DB lookup
    const ingredient = await prisma.ingredient.findUnique({
      where: { name: normalizedName },
    });
    let ingredientId = ingredient?.id;

    if (ingredient) {
      const existingLink = await db.ingredientNutrientLink.findFirst({
        where: { ingredientId: ingredient.id },
        include: { nutrient: true },
        orderBy: { createdAt: 'desc' },
      });
      const n = existingLink?.nutrient;

      if (n) {
        const dbMacros: MacroResult = {
          calories: n.calories ?? 0,
          protein: n.protein ?? 0,
          fat: n.total_fats ?? 0,
          carbs: n.carbs ?? 0,
        };
        await setCachedNutrients(normalizedName, dbMacros);
        return dbMacros;
      }
      // Ingredient exists but has no nutrients yet; continue to USDA fetch and insert.
    }

    // 2. USDA fetch
    const apiKey = process.env['USDA_API_KEY'];
    if (!apiKey) return null;

    const searchTerms = [normalizedName];

    let food: UsdaFoodCandidate | null = null;
    const pendingQueries = [...searchTerms];

    while (pendingQueries.length > 0) {
      const query = pendingQueries.shift()!.trim();
      if (!query) continue;
      const { data } = await axios.get(
        'https://api.nal.usda.gov/fdc/v1/foods/search',
        {
          params: {
            query,
            api_key: apiKey,
          },
        },
      );
      const candidates = (data.foods ?? []).slice(0, 15) as UsdaFoodCandidate[];
      if (candidates.length === 0) continue;

      const selection = chooseUsdaFoodCandidate(normalizedName, candidates);
      const candidate = selection.candidate;
      // console.log('[nutrients] USDA candidate selected', {
      //   ingredientName: normalizedName,
      //   query,
      //   candidateIndex: selection.candidateIndex,
      //   description: candidate.description ?? null,
      //   brandOwner: candidate.brandOwner ?? null,
      //   dataType: candidate.dataType ?? null,
      //   fdcId: candidate.fdcId ?? null,
      // });
      food = candidate;
      break;
    }

    if (!food) {
      // console.log('[nutrients] no USDA result found', {
      //   ingredientName: normalizedName,
      // });
      return null;
    }

    const nutrients: UsdaNutrient[] = Array.isArray(food.foodNutrients)
      ? food.foodNutrients
      : [];

    const extract = (name: string) =>
      extractNutrient(nutrients, name)?.value ?? 0;

    const energyNutrient =
      extractNutrient(nutrients, 'energy', 'kcal') ??
      extractNutrient(nutrients, 'energy', 'kj') ??
      extractNutrient(nutrients, 'energy');
    // check the energy nutrient output for debugging
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

    // 3. store
    if (!ingredientId) {
      const ing = await prisma.ingredient.create({
        data: { name: normalizedName },
      });
      ingredientId = ing.id;
    }

    await db.ingredientNutrients.create({
      data: {
        ingredientName: normalizedName,
        fdcId: food.fdcId,
        calories: macros.calories,
        protein: macros.protein,
        total_fats: macros.fat,
        sat_fats: satFats,
        trans_fats: transFats,
        carbs: macros.carbs,
        cholesterol,
        Fiber: fiber,
        Sugar: sugar,
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

    await setCachedNutrients(normalizedName, macros);

    return macros;
  } catch (err) {
    console.error(err);
    return null;
  }
}