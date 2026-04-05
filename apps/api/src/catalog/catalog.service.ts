import { Injectable, Logger } from '@nestjs/common';
import { Ingredient } from '@prisma/client';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

export interface Catalog {
  units: string[];
  ingredients: string[];
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(): Promise<Catalog> {
    const [units, ingredients] = await Promise.all([
      this.prisma.unit.findMany({
        select: { symbol: true },
        orderBy: { symbol: 'asc' },
      }),
      this.prisma.ingredient.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      units: units.map((u) => u.symbol),
      ingredients: ingredients.map((i) => i.name),
    };
  }

  /**
   * Resolves an ingredient name to a canonical Ingredient row, creating one if
   * genuinely new. Resolution order:
   *   1. Alias table lookup (fast, DB)
   *   2. Exact name match → seed alias
   *   3. LLM resolve (if OPENAI_API_KEY set) → create alias
   *   4. Fallback: create new ingredient + alias
   *
   * Alias writes happen OUTSIDE any caller transaction.
   */
  async resolveIngredient(rawName: string): Promise<Ingredient> {
    const normalized = rawName.toLowerCase().trim();

    // 1. Alias lookup
    const aliasRow = await this.prisma.ingredientAlias.findUnique({
      where: { alias: normalized },
      include: { ingredient: true },
    });
    if (aliasRow) return aliasRow.ingredient;

    // 2. Exact name match
    const exact = await this.prisma.ingredient.findFirst({
      where: { name: { equals: normalized, mode: 'insensitive' } },
    });
    if (exact) {
      await this.prisma.ingredientAlias
        .create({ data: { alias: normalized, ingredientId: exact.id } })
        .catch(() => {
          /* alias may already exist — race condition is fine */
        });
      return exact;
    }

    // 3. LLM resolve
    const llmResult = await this.resolveWithLLM(normalized);
    if (llmResult && !llmResult.isNew) {
      const canonical = await this.prisma.ingredient.findFirst({
        where: {
          name: { equals: llmResult.canonicalName, mode: 'insensitive' },
        },
      });
      if (canonical) {
        await this.prisma.ingredientAlias
          .create({ data: { alias: normalized, ingredientId: canonical.id } })
          .catch(() => {});
        return canonical;
      }
    }

    // 4. Fallback: create new ingredient + seed its own alias
    const canonicalName = llmResult?.canonicalName ?? normalized;
    const ingredient = await this.prisma.ingredient.upsert({
      where: { name: canonicalName },
      create: { name: canonicalName },
      update: {},
    });
    await this.prisma.ingredientAlias
      .createMany({
        data: [
          {
            alias: canonicalName.toLowerCase().trim(),
            ingredientId: ingredient.id,
          },
          ...(normalized !== canonicalName.toLowerCase().trim()
            ? [{ alias: normalized, ingredientId: ingredient.id }]
            : []),
        ],
        skipDuplicates: true,
      })
      .catch(() => {});
    return ingredient;
  }

  /**
   * Uses the LLM to infer a real cooking unit for a countable ingredient
   * (one that was scraped without a unit, e.g. "2 chicken breasts").
   * Returns { amount, unitSymbol } on success, or null if the LLM cannot
   * make a confident estimate.
   *
   * Call this OUTSIDE any Prisma transaction to avoid holding DB locks.
   */
  async inferUnit(
    ingredientName: string,
    amount: number,
    recipeName: string,
  ): Promise<{ amount: number; unitSymbol: string } | null> {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) return null;

    try {
      const client = new OpenAI({ apiKey });
      const prompt = `You are a cooking assistant. In a recipe called "${recipeName}", the ingredient "${ingredientName}" has an amount of ${amount} with no unit (meaning ${amount} piece(s)/item(s)).

Estimate the most appropriate cooking unit and the total amount for shopping purposes.
Use common cooking units: g, kg, ml, l, tbsp, tsp, cup.

For example:
- 2 chicken breasts → { "amount": 400, "unit": "g" }
- 3 garlic cloves → { "amount": 3, "unit": "cloves" } (keep as cloves, a meaningful unit)
- 1 onion → { "amount": 150, "unit": "g" }
- 1 lemon → { "amount": 1, "unit": "lemon" } (keep if no weight equivalent makes sense)

Return JSON: { "amount": number, "unit": string }
If you cannot make a confident estimate, return: null`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content ?? 'null';
      // LLM might return "null" as a string or a JSON object
      if (!content || content.trim() === 'null') return null;

      const parsed: unknown = JSON.parse(content);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'amount' in parsed &&
        'unit' in parsed &&
        typeof (parsed as Record<string, unknown>)['amount'] === 'number' &&
        typeof (parsed as Record<string, unknown>)['unit'] === 'string'
      ) {
        const result = parsed as { amount: number; unit: string };
        return { amount: result.amount, unitSymbol: result.unit };
      }
      return null;
    } catch (err) {
      this.logger.warn(
        `LLM unit inference failed for "${ingredientName}" in "${recipeName}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async resolveWithLLM(
    normalizedName: string,
  ): Promise<{ canonicalName: string; isNew: boolean } | null> {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) return null;

    try {
      const knownIngredients = await this.prisma.ingredient.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      if (knownIngredients.length === 0) return null;

      const client = new OpenAI({ apiKey });
      const knownList = knownIngredients.map((i) => i.name).join(', ');

      const prompt = `You are a recipe ingredient canonicalization assistant.

Known ingredients in the database:
${knownList}

Incoming ingredient name: "${normalizedName}"

Decide:
- If this is clearly the same thing as a known ingredient (singular/plural variant, descriptor added, minor spelling difference), return its exact canonical name and isNew: false.
- If this is a genuinely different ingredient not in the known list, return the best clean name for it and isNew: true.

Rules:
- "chicken breasts finely sliced" → "chicken breast" (isNew: false, if "chicken breast" is known)
- "garlic cloves crushed" → "garlic" (isNew: false, if "garlic" is known)  
- "unsalted butter" → "butter" (isNew: false, if "butter" is known)
- "mango chutney" → genuinely new if not in known list (isNew: true, canonicalName: "mango chutney")
- Preserve ingredient specificity: "chicken thigh" should NOT collapse to "chicken"

Return JSON: { "canonicalName": string, "isNew": boolean }`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed: unknown = JSON.parse(content);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'canonicalName' in parsed &&
        'isNew' in parsed &&
        typeof (parsed as Record<string, unknown>)['canonicalName'] ===
          'string' &&
        typeof (parsed as Record<string, unknown>)['isNew'] === 'boolean'
      ) {
        return parsed as { canonicalName: string; isNew: boolean };
      }
      return null;
    } catch (err) {
      this.logger.warn(
        `LLM ingredient resolution failed for "${normalizedName}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
