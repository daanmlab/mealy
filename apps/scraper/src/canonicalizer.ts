import OpenAI from 'openai';
import { z } from 'zod';
import { NormalizedIngredient } from './normalizer';

const MappingSchema = z.object({
  mappings: z.array(
    z.object({
      originalName: z.string(),
      originalUnit: z.string(),
      canonicalName: z.string(),
      canonicalUnit: z.string(),
    }),
  ),
});

/**
 * Uses the LLM to remap each ingredient's name and unit symbol to the closest
 * known canonical form from the live DB inventory.
 *
 * This prevents fragmentation (e.g. "garlic clove"/"garlic cloves"/"garlic" or
 * "clove"/"cloves" becoming separate DB rows) by reusing existing entries where
 * a close match exists.
 *
 * Falls back to the original values if the LLM is unavailable or fails.
 */
export async function canonicalizeIngredients(
  ingredients: NormalizedIngredient[],
  knownUnits: string[],
  knownIngredients: string[],
  model = 'gpt-4o-mini',
): Promise<NormalizedIngredient[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || ingredients.length === 0) return ingredients;

  const client = new OpenAI({ apiKey });

  const prompt = `You are a recipe database canonicalization assistant. Your job is to map incoming ingredient names and unit symbols to the closest known canonical form already in the database.

Known unit symbols (use EXACT strings from this list when there is a clear match):
${knownUnits.join(', ')}

Known ingredient names (use EXACT strings from this list when there is a clear match):
${knownIngredients.join(', ')}

Rules:
- If the incoming name/unit closely matches a known entry (same thing, minor variation), return the EXACT known string.
- If the incoming name/unit is genuinely new and has no close match, return the original value as-is.
- Preserve specificity: "chicken breast" should NOT collapse to "chicken".
- Singular/plural units are the same: "clove" → "cloves", "cup" → match whichever is in the known list.
- Ingredient name variants are the same: "garlic clove", "garlic cloves" → "garlic" (if "garlic" is in the known list).
- Do NOT invent names or units that are in neither the known list nor the incoming data.

Return a JSON object with a "mappings" array. Each element must have:
- "originalName": the exact incoming ingredient name
- "originalUnit": the exact incoming unit symbol
- "canonicalName": the canonical name to use (from known list, or original if no match)
- "canonicalUnit": the canonical unit to use (from known list, or original if no match)

Incoming ingredients:
${JSON.stringify(
  ingredients.map((i) => ({ name: i.name, unit: i.unitSymbol })),
  null,
  2,
)}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed: unknown = JSON.parse(content);
    const result = MappingSchema.safeParse(parsed);

    if (!result.success) {
      console.warn('[canonicalize] Response failed schema validation:', result.error.message);
      return ingredients;
    }

    // Build a lookup by originalName+originalUnit
    const lookup = new Map(
      result.data.mappings.map((m) => [`${m.originalName}::${m.originalUnit}`, m]),
    );

    return ingredients.map((ing) => {
      const key = `${ing.name}::${ing.unitSymbol}`;
      const mapping = lookup.get(key);
      if (!mapping) return ing;
      return {
        ...ing,
        name: mapping.canonicalName,
        unitSymbol: mapping.canonicalUnit,
      };
    });
  } catch (err) {
    console.warn(
      '[canonicalize] Canonicalization failed:',
      err instanceof Error ? err.message : err,
    );
    return ingredients;
  }
}
