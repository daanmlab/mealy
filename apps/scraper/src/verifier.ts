import OpenAI from 'openai';
import { z } from 'zod';
import { RawRecipe, RawIngredient } from './types';

const VerifyResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.string()),
});

const FixedRecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  cookTimeMinutes: z.number(),
  servings: z.number(),
  imageUrl: z.string().optional(),
  keywords: z.array(z.string()),
  steps: z.array(z.string()),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
      unit: z.string(),
    }),
  ),
});

export interface VerifyResult {
  valid: boolean;
  issues: string[];
}

export interface VerifyAndFixResult {
  recipe: RawRecipe;
  wasFixed: boolean;
  issues: string[];
}

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Verify a parsed recipe using a small model.
 * Checks ingredient names, units, steps coherence, and cook time plausibility.
 */
export async function verifyRecipe(raw: RawRecipe): Promise<VerifyResult> {
  const client = getClient();
  if (!client) return { valid: true, issues: [] };

  const prompt = `You are a recipe data quality checker. Examine the following parsed recipe JSON and identify any data quality issues.

Check for:
- Ingredient names that look like parsing artifacts (e.g. "oz spaghetti", "14 oz", bare numbers)
- Units that are not real units (e.g. "large", "garlic", "egg" used as units instead of ingredient names)
- Ingredient amounts that are 0, negative, or implausibly large (>100 for most things)
- Ingredient names that contain preparation or cooking instructions that belong in the recipe steps, not the grocery list (e.g. "carrots halved and cut into chunks" should be "carrots", "onion chopped" should be "onion", "celery sticks finely chopped" should be "celery sticks", "garlic clove sliced" should be "garlic clove"). The name should be the canonical grocery-list name only.
- References to missing page elements that do not make sense without the original web page:
  - Video references in descriptions or steps (e.g. "Recipe video above", "Watch the video", "As shown in the video")
  - Note references that are not included in the data (e.g. "See Note 5", "(Note 1)", "check the notes below")
  - Steps that consist entirely of a cross-reference or caption rather than a cooking instruction (e.g. "The dish is pictured with flatbread and papadums (Note 5).")
- Steps that are not cooking instructions (e.g. navigation text, ad copy, SEO boilerplate)
- Cook time that is implausible (< 2 minutes or > 600 minutes for a single recipe)
- A title that clearly does not match the ingredients/steps (e.g. sign of a bot redirect)

Return ONLY a valid JSON object with this structure (no markdown, no explanation):
{ "valid": true/false, "issues": ["issue 1", "issue 2", ...] }

If everything looks correct, return { "valid": true, "issues": [] }.

Recipe to check:
${JSON.stringify(raw, null, 2)}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { valid: true, issues: [] };

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    const result = VerifyResultSchema.safeParse(parsed);
    if (!result.success) return { valid: true, issues: [] };

    return result.data;
  } catch (err) {
    console.warn('[verify] Verification failed:', err instanceof Error ? err.message : err);
    return { valid: true, issues: [] };
  }
}

/**
 * Verify then fix a parsed recipe.
 * Uses gpt-4o-mini to verify; uses `cleanModel` (default gpt-4o-mini) to fix if issues found.
 * Returns the fixed recipe (or original if valid) along with the issues list.
 */
export async function verifyAndFix(
  raw: RawRecipe,
  cleanModel = 'gpt-4o-mini',
): Promise<VerifyAndFixResult> {
  const { valid, issues } = await verifyRecipe(raw);

  if (valid || issues.length === 0) {
    return { recipe: raw, wasFixed: false, issues };
  }

  const client = getClient();
  if (!client) return { recipe: raw, wasFixed: false, issues };

  const prompt = `You are a recipe data fixer. The following recipe was parsed from a web page and has quality issues.

Issues identified:
${issues.map((i) => `- ${i}`).join('\n')}

Fix the recipe by correcting only the fields affected by these issues. Keep all other data exactly as-is.

When fixing ingredient names:
- Strip any preparation or cooking instructions from the name (e.g. "carrots halved and cut into chunks" → "carrots", "onion chopped" → "onion", "garlic clove sliced" → "garlic clove")
- The name should be the canonical grocery-list name that a shopper would look for in a store
- Qualifiers that describe the ingredient type are fine to keep (e.g. "red onion", "cherry tomatoes", "braising beef")

When fixing references to missing page elements:
- Remove sentences from the description that reference videos (e.g. "Recipe video above." → delete that sentence)
- Remove inline note references from descriptions and steps (e.g. "(Note 5)" → remove the parenthetical)
- Remove steps that are entirely a cross-reference or caption rather than a cooking instruction (e.g. "The dish is pictured with flatbread (Note 5)." → delete the step entirely)
- Keep steps that contain both a real cooking instruction AND a note reference, but strip just the note part

Return ONLY a valid JSON object matching the original structure:
{
  "title": "string",
  "description": "string",
  "cookTimeMinutes": number,
  "servings": number,
  "imageUrl": "string or omit",
  "keywords": ["string", ...],
  "steps": ["step text", ...],
  "ingredients": [{ "name": "...", "amount": number, "unit": "..." }, ...]
}

Original recipe (may contain errors):
${JSON.stringify(raw, null, 2)}`;

  try {
    const response = await client.chat.completions.create({
      model: cleanModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '';
    const parsed: unknown = JSON.parse(content);
    const result = FixedRecipeSchema.safeParse(parsed);

    if (!result.success) {
      console.warn('[verify] Fix response failed schema validation:', result.error.message);
      return { recipe: raw, wasFixed: false, issues };
    }

    return {
      recipe: {
        ...result.data,
        imageUrl: result.data.imageUrl ?? raw.imageUrl,
      },
      wasFixed: true,
      issues,
    };
  } catch (err) {
    console.warn('[verify] Cleanup failed:', err instanceof Error ? err.message : err);
    return { recipe: raw, wasFixed: false, issues };
  }
}

const GroupAssignmentSchema = z.object({
  assignments: z.array(
    z.object({
      name: z.string(),
      groupName: z.string().optional(),
    }),
  ),
});

/**
 * Identify ingredient groups implied by the recipe steps.
 * E.g. "Combine the Marinade ingredients" → marks yoghurt, lemon juice, etc. as group "Marinade".
 * Returns a map of ingredient name → group name (only for grouped ingredients).
 */
export async function groupIngredients(
  ingredients: RawIngredient[],
  steps: string[],
  model = 'gpt-4o-mini',
): Promise<Map<string, string>> {
  const client = getClient();
  if (!client) return new Map();

  const stepsText = steps.join('\n');
  if (!/\b\w+\s+ingredients?\b/i.test(stepsText)) return new Map();

  const prompt = `You are a recipe ingredient organizer. Given a list of ingredients and the recipe steps, identify which ingredients belong to named groups implied by the steps (e.g. "Marinade", "Sauce", "Dressing", "Batter", "Topping").

A named group is implied when steps say things like "Combine the Marinade ingredients" or "Mix together the Sauce ingredients". Only assign groups where the steps clearly imply it — do not invent groups that aren't mentioned.

Return a JSON object with an "assignments" array. Each element has:
- "name": the ingredient name (exactly as given in the list below)
- "groupName": the group name if this ingredient belongs to a named group (omit if ungrouped)

Ingredients:
${ingredients.map((i) => `- ${i.name}`).join('\n')}

Steps:
${stepsText}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed: unknown = JSON.parse(content);
    const result = GroupAssignmentSchema.safeParse(parsed);
    if (!result.success) return new Map();

    const groupMap = new Map<string, string>();
    for (const item of result.data.assignments) {
      if (item.groupName) groupMap.set(item.name, item.groupName);
    }
    return groupMap;
  } catch (err) {
    console.warn('[verify] Grouping failed:', err instanceof Error ? err.message : err);
    return new Map();
  }
}
