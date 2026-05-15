import * as cheerio from 'cheerio';
import { RawIngredient, RawRecipe } from '../types';

interface SchemaOrgRecipe {
  '@type': string | string[];
  name?: string;
  description?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | string[];
  keywords?: string | string[];
  recipeInstructions?: unknown[];
  recipeIngredient?: string[];
  '@graph'?: SchemaOrgObject[];
}

interface SchemaOrgObject {
  '@type'?: string | string[];
  '@graph'?: SchemaOrgObject[];
  [key: string]: unknown;
}

// Common HTML entities that appear in scraped content
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&#8216;': '\u2018',
  '&#8217;': '\u2019',
  '&#8220;': '\u201C',
  '&#8221;': '\u201D',
  '&#8211;': '\u2013',
  '&#8212;': '\u2014',
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&[a-zA-Z]+;|&#\d+;/g, (match) => HTML_ENTITIES[match] ?? match).trim();
}

// Units the parser recognises. Anything else is treated as part of the name.
const KNOWN_UNITS = new Set([
  'g',
  'kg',
  'oz',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'cup',
  'cups',
  'c',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tbs',
  'tb',
  'tsp',
  'teaspoon',
  'teaspoons',
  'ts',
  'ml',
  'milliliter',
  'millilitre',
  'l',
  'liter',
  'litre',
  'clove',
  'cloves',
  'slice',
  'slices',
  'bunch',
  'bunches',
  'pinch',
  'dash',
  'handful',
  'can',
  'cans',
  'piece',
  'pieces',
  'package',
  'pkg',
  'sprig',
  'sprigs',
  'stalk',
  'stalks',
  'head',
  'heads',
  'sheet',
  'sheets',
  'stick',
  'sticks',
]);

function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  return hours * 60 + minutes;
}

function evalFraction(raw: string): number {
  const fractionMap: Record<string, number> = {
    '½': 0.5,
    '¼': 0.25,
    '¾': 0.75,
    '⅓': 0.333,
    '⅔': 0.667,
    '⅛': 0.125,
  };

  let cleaned = raw;
  for (const [sym, val] of Object.entries(fractionMap)) {
    cleaned = cleaned.replace(sym, String(val));
  }

  // Handle "1 1/2" → 1.5
  const parts = cleaned.trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (part.includes('/')) {
      const [num, den] = part.split('/').map(Number);
      if (den) total += num / den;
    } else {
      total += parseFloat(part) || 0;
    }
  }
  return total;
}

function cleanIngredientText(raw: string): string {
  return (
    decodeHtmlEntities(raw)
      // Remove parenthetical content — notes, alternatives, clarifications
      .replace(/\([^)]*\)/g, '')
      // Remove bracketed content
      .replace(/\[[^\]]*\]/g, '')
      // Strip everything after the first comma (preparation notes)
      .replace(/,.*$/, '')
      // Strip any stray unmatched parens/brackets left after the above passes
      .replace(/[()[\]]/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function parseIngredientText(raw: string): RawIngredient {
  const text = cleanIngredientText(raw);
  if (!text) return { name: decodeHtmlEntities(raw).trim(), amount: 1, unit: 'unit' };

  // Metric with imperial slash: "100g/3.5 oz ingredient" — check BEFORE bare metric
  // Consumes the imperial equivalent (e.g. "/14 oz" or "/3.5 oz") then captures the name
  const metricSlash = text.match(
    /^([\d.]+)\s*(g|kg|ml)\s*\/\s*[\d./]+\s*(?:oz|lb|lbs|pound|pounds)?\s+(.*)?$/i,
  );
  if (metricSlash) {
    const amount = parseFloat(metricSlash[1]) || 1;
    const unit = metricSlash[2].toLowerCase();
    const name = metricSlash[3]?.trim() || text;
    return { name, amount, unit };
  }

  // Metric attached to number, no slash: "100g", "250ml", "1.5kg"
  const attachedMetric = text.match(/^([\d.]+)\s*(g|kg|ml|l)\b(?!\/)\s*(.*)?$/i);
  if (attachedMetric) {
    const amount = parseFloat(attachedMetric[1]) || 1;
    const unit = attachedMetric[2].toLowerCase();
    const name = attachedMetric[3]?.trim() || text;
    return { name, amount, unit };
  }

  // Standard: [quantity] [unit?] name
  const parts = text.split(/\s+/);
  const qty = evalFraction(parts[0] ?? '');

  if (qty > 0 && parts.length >= 2) {
    const potentialUnit = parts[1].toLowerCase();
    if (KNOWN_UNITS.has(potentialUnit) && parts.length >= 3) {
      return {
        name: parts.slice(2).join(' '),
        amount: qty,
        unit: potentialUnit,
      };
    }
    // No recognised unit — quantity + rest is the name
    return {
      name: parts.slice(1).join(' '),
      amount: qty,
      unit: 'unit',
    };
  }

  return { name: text, amount: 1, unit: 'unit' };
}

function extractStepText(step: unknown): string {
  if (typeof step === 'string') return decodeHtmlEntities(step);
  if (typeof step === 'object' && step !== null) {
    const s = step as Record<string, unknown>;
    if (typeof s.text === 'string') return decodeHtmlEntities(s.text);
    if (typeof s.name === 'string') return decodeHtmlEntities(s.name);
  }
  return '';
}

function findRecipeSchema(data: unknown): SchemaOrgRecipe | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeSchema(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as SchemaOrgObject;
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : [type ?? ''];
  if (types.some((t) => String(t).toLowerCase() === 'recipe')) {
    return obj as SchemaOrgRecipe;
  }

  if (Array.isArray(obj['@graph'])) {
    return findRecipeSchema(obj['@graph']);
  }

  return null;
}

export function extractFromJsonLd(html: string): RawRecipe | null {
  const $ = cheerio.load(html);
  const blocks: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    blocks.push($(el).html() ?? '');
  });

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }

    const schema = findRecipeSchema(parsed);
    if (!schema) continue;

    const title = decodeHtmlEntities(schema.name ?? '');
    const description = decodeHtmlEntities(schema.description ?? '');

    const cookTimeRaw: string = schema.cookTime ?? schema.totalTime ?? '';
    const cookTimeMinutes = cookTimeRaw ? parseIsoDuration(cookTimeRaw) : 30;

    const servingsRaw = schema.recipeYield;
    const servingsStr = Array.isArray(servingsRaw)
      ? String(servingsRaw[0])
      : String(servingsRaw ?? '2');
    const servings = parseInt(servingsStr, 10) || 2;

    const keywordsRaw = schema.keywords;
    const keywords: string[] =
      typeof keywordsRaw === 'string'
        ? keywordsRaw.split(',').map((k: string) => k.trim())
        : Array.isArray(keywordsRaw)
          ? keywordsRaw
          : [];

    const rawSteps: unknown[] = Array.isArray(schema.recipeInstructions)
      ? schema.recipeInstructions
      : [];
    const steps = rawSteps.map(extractStepText).filter(Boolean);

    const rawIngredients = Array.isArray(schema.recipeIngredient) ? schema.recipeIngredient : [];
    const ingredients: RawIngredient[] = rawIngredients
      .map((s) => parseIngredientText(s))
      .filter((i) => i.name.length > 0);

    if (!title || steps.length === 0 || ingredients.length === 0) continue;

    return {
      title,
      description,
      cookTimeMinutes: cookTimeMinutes || 30,
      servings,
      keywords,
      steps,
      ingredients,
    };
  }

  return null;
}
