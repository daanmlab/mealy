import { RawRecipe } from './types';

export interface NormalizedIngredient {
  name: string;
  amount: number;
  unitSymbol: string;
  categorySlug: string;
  groupName?: string;
}

export interface NormalizedRecipe {
  title: string;
  description: string;
  cookTimeMinutes: number;
  servings: number;
  imageUrl?: string;
  sourceUrl?: string;
  tagSlugs: string[];
  steps: { order: number; text: string }[];
  ingredients: NormalizedIngredient[];
}

// ─── Tag inference ────────────────────────────────────────────────────────────

type TagSlug =
  | 'pasta'
  | 'rice'
  | 'bowl'
  | 'stir_fry'
  | 'salad'
  | 'soup'
  | 'sheet_pan'
  | 'quick'
  | 'healthy'
  | 'cheap'
  | 'high_protein'
  | 'vegetarian'
  | 'vegan';

const TAG_KEYWORDS: Record<TagSlug, string[]> = {
  pasta: ['pasta', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'noodle', 'lasagna', 'mac'],
  rice: ['rice', 'risotto', 'fried rice', 'pilaf', 'paella'],
  bowl: ['bowl', 'grain bowl', 'burrito bowl', 'buddha bowl', 'poke'],
  stir_fry: ['stir fry', 'stir-fry', 'wok', 'sauté'],
  salad: ['salad', 'slaw', 'coleslaw'],
  soup: ['soup', 'stew', 'chowder', 'bisque', 'broth', 'chili', 'minestrone'],
  sheet_pan: ['sheet pan', 'sheet-pan', 'one pan', 'tray bake', 'roasted'],
  quick: ['quick', 'fast', '15 min', '20 min', '30 min', 'easy', 'weeknight'],
  healthy: ['healthy', 'light', 'low calorie', 'low-fat', 'nutritious', 'clean'],
  cheap: ['cheap', 'budget', 'affordable', 'frugal', 'economical'],
  high_protein: ['high protein', 'protein-packed', 'muscle', 'chicken breast', 'lean'],
  vegetarian: ['vegetarian', 'veggie', 'meatless', 'no meat'],
  vegan: ['vegan', 'plant-based', 'dairy-free', 'egg-free'],
};

function inferTags(raw: RawRecipe): TagSlug[] {
  const haystack = [
    raw.title,
    raw.description,
    ...raw.keywords,
    ...raw.ingredients.map((i) => i.name),
  ]
    .join(' ')
    .toLowerCase();

  const tags: TagSlug[] = [];

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS) as [TagSlug, string[]][]) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      tags.push(tag);
    }
  }

  // Infer "quick" from cook time
  if (raw.cookTimeMinutes <= 20 && !tags.includes('quick')) {
    tags.push('quick');
  }

  return [...new Set(tags)];
}

// ─── Ingredient category inference ───────────────────────────────────────────

type CategorySlug =
  | 'produce'
  | 'meat'
  | 'seafood'
  | 'dairy'
  | 'grains'
  | 'canned'
  | 'condiments'
  | 'spices'
  | 'frozen'
  | 'other';

const CATEGORY_KEYWORDS: Record<CategorySlug, string[]> = {
  produce: [
    'onion',
    'garlic',
    'tomato',
    'potato',
    'carrot',
    'broccoli',
    'spinach',
    'kale',
    'pepper',
    'cucumber',
    'zucchini',
    'mushroom',
    'lemon',
    'lime',
    'orange',
    'apple',
    'banana',
    'avocado',
    'celery',
    'lettuce',
    'cabbage',
    'corn',
    'pea',
    'bean',
    'asparagus',
    'eggplant',
    'leek',
    'shallot',
    'ginger',
    'beet',
    'radish',
    'herb',
    'basil',
    'cilantro',
    'parsley',
    'thyme',
    'rosemary',
    'mint',
    'chive',
  ],
  meat: [
    'chicken',
    'beef',
    'pork',
    'lamb',
    'turkey',
    'sausage',
    'bacon',
    'ham',
    'steak',
    'ground beef',
    'ground turkey',
    'chorizo',
    'prosciutto',
    'pancetta',
    'duck',
    'veal',
    'bison',
    'venison',
  ],
  seafood: [
    'salmon',
    'tuna',
    'shrimp',
    'cod',
    'tilapia',
    'crab',
    'lobster',
    'scallop',
    'clam',
    'mussel',
    'oyster',
    'anchovy',
    'halibut',
    'sardine',
    'fish',
  ],
  dairy: [
    'milk',
    'cream',
    'butter',
    'cheese',
    'yogurt',
    'sour cream',
    'ricotta',
    'mozzarella',
    'parmesan',
    'cheddar',
    'feta',
    'brie',
    'cream cheese',
    'heavy cream',
    'half and half',
    'buttermilk',
    'egg',
    'eggs',
  ],
  grains: [
    'flour',
    'bread',
    'rice',
    'pasta',
    'oat',
    'barley',
    'quinoa',
    'couscous',
    'tortilla',
    'noodle',
    'panko',
    'breadcrumb',
    'cornmeal',
    'polenta',
  ],
  canned: [
    'canned',
    'tomato paste',
    'tomato sauce',
    'coconut milk',
    'broth',
    'stock',
    'chickpea',
    'lentil',
    'kidney bean',
    'black bean',
    'diced tomato',
  ],
  condiments: [
    'oil',
    'vinegar',
    'soy sauce',
    'mustard',
    'ketchup',
    'mayo',
    'mayonnaise',
    'hot sauce',
    'worcestershire',
    'tahini',
    'miso',
    'oyster sauce',
    'fish sauce',
    'honey',
    'maple syrup',
    'sugar',
  ],
  spices: [
    'salt',
    'pepper',
    'cumin',
    'paprika',
    'turmeric',
    'cinnamon',
    'oregano',
    'chili',
    'curry',
    'coriander',
    'nutmeg',
    'cardamom',
    'clove',
    'bay leaf',
    'cayenne',
    'red pepper flakes',
    'dried',
    'spice',
    'seasoning',
    'powder',
  ],
  frozen: ['frozen', 'ice cream', 'frozen pea', 'frozen corn'],
  other: [],
};

function inferCategory(ingredientName: string): CategorySlug {
  const name = ingredientName.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    CategorySlug,
    string[],
  ][]) {
    if (category === 'other') continue;
    if (keywords.some((kw) => name.includes(kw))) {
      return category;
    }
  }

  return 'other';
}

// ─── Main normalize function ──────────────────────────────────────────────────

export function normalize(raw: RawRecipe): NormalizedRecipe {
  return {
    title: raw.title.trim(),
    description: raw.description.trim(),
    cookTimeMinutes: Math.max(1, Math.min(600, raw.cookTimeMinutes)),
    servings: Math.max(1, Math.min(50, raw.servings)),
    imageUrl: raw.imageUrl,
    sourceUrl: raw.sourceUrl,
    tagSlugs: inferTags(raw),
    steps: raw.steps.map((text, i) => ({ order: i + 1, text: text.trim() })),
    ingredients: raw.ingredients.map((ing) => ({
      name: ing.name.trim().toLowerCase(),
      amount: Math.max(0.001, ing.amount),
      unitSymbol: ing.unit.trim() || 'unit',
      categorySlug: inferCategory(ing.name),
      groupName: ing.groupName,
    })),
  };
}
