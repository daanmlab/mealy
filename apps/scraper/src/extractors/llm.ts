import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { RawIngredient, RawRecipe } from '../types';

const RawIngredientSchema = z.object({
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
});

const RawRecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  cookTimeMinutes: z.number(),
  servings: z.number(),
  imageUrl: z.string().optional(),
  keywords: z.array(z.string()),
  steps: z.array(z.string()),
  ingredients: z.array(RawIngredientSchema),
});

function trimHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove script/style/nav/footer/header/aside tags to reduce token count
  $('script, style, nav, footer, header, aside, [class*="ad"], [id*="ad"]').remove();

  // Extract just the body text — enough for an LLM to parse a recipe
  const body = $('main, article, [class*="recipe"], body').first().html() ?? '';

  // Strip all HTML tags, collapse whitespace
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit to ~8000 chars to stay within token budget
  return text.slice(0, 8000);
}

export async function extractWithLlm(html: string): Promise<RawRecipe | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[llm] OPENAI_API_KEY not set, skipping LLM extraction');
    return null;
  }

  const client = new OpenAI({ apiKey });
  const pageText = trimHtml(html);

  const prompt = `Extract the recipe from the following web page text and return ONLY a valid JSON object with this exact structure (no markdown, no explanation):

{
  "title": "string",
  "description": "string (1-2 sentences)",
  "cookTimeMinutes": number,
  "servings": number,
  "imageUrl": "string or omit",
  "keywords": ["string", ...],
  "steps": ["step text", ...],
  "ingredients": [
    { "name": "ingredient name", "amount": number, "unit": "string" },
    ...
  ]
}

Rules:
- cookTimeMinutes must be total active + passive cook time as a number
- servings must be a number
- Each ingredient must have a numeric amount (use 1 if unclear) and a unit (use "unit" if none)
- steps must be plain text, one step per array element
- keywords are tags/categories describing the recipe

Page text:
${pageText}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed: unknown = JSON.parse(jsonMatch[0]) as unknown;
    const result = RawRecipeSchema.safeParse(parsed);

    if (!result.success) {
      console.warn('[llm] Schema validation failed:', result.error.message);
      return null;
    }

    return {
      ...result.data,
      ingredients: result.data.ingredients as RawIngredient[],
    };
  } catch (err) {
    console.error('[llm] Extraction failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
