/**
 * A curated starter set of recipe URLs, spread across the two
 * supported sites (recipetineats.com, bbcgoodfood.com).
 * These are used when `--urls` is not provided on the CLI.
 *
 * Note: allrecipes.com is excluded — it returns HTTP 402 for all programmatic
 * requests. food.com is excluded — it redirects bot requests to random recipes.
 */
export const DEFAULT_URLS: string[] = [
  // ── RecipeTin Eats ────────────────────────────────────────────────────────
  'https://recipetineats.com/spaghetti-bolognese/',
  'https://recipetineats.com/chicken-stir-fry/',
  'https://recipetineats.com/butter-chicken/',
  'https://recipetineats.com/beef-stew/',
  'https://recipetineats.com/lasagna/',
  'https://recipetineats.com/minestrone-soup/',
  'https://recipetineats.com/garlic-prawns-shrimp/',
  'https://recipetineats.com/chicken-and-rice-soup/',
  'https://recipetineats.com/carbonara/',
  'https://recipetineats.com/teriyaki-chicken/',
  'https://www.recipetineats.com/nasi-goreng-indonesian-fried-rice/',
  'https://www.recipetineats.com/canned-tuna-pasta/',
  'https://recipetineats.com/greek-salad/',
  'https://recipetineats.com/pork-tenderloin/',
  'https://recipetineats.com/tuna-pasta-bake/',

  // ── BBC Good Food ─────────────────────────────────────────────────────────
  'https://www.bbcgoodfood.com/recipes/spaghetti-bolognese',
  'https://www.bbcgoodfood.com/recipes/shakshuka',
  'https://www.bbcgoodfood.com/recipes/easy-chicken-curry',
  'https://www.bbcgoodfood.com/recipes/mushroom-risotto',
  'https://www.bbcgoodfood.com/recipes/chicken-noodle-soup',
  'https://www.bbcgoodfood.com/recipes/halloumi-fajitas',
  'https://www.bbcgoodfood.com/recipes/slow-cooker-beef-stew',
  'https://www.bbcgoodfood.com/recipes/creamy-salmon-pasta',
  'https://www.bbcgoodfood.com/recipes/pea-risotto',
  'https://www.bbcgoodfood.com/recipes/chicken-tikka-masala',
  'https://www.bbcgoodfood.com/recipes/roast-chicken',
  'https://www.bbcgoodfood.com/recipes/tomato-soup',
  'https://www.bbcgoodfood.com/recipes/lasagne',
  'https://www.bbcgoodfood.com/recipes/baked-salmon',
  'https://www.bbcgoodfood.com/recipes/moroccan-chickpea-soup',
  'https://www.bbcgoodfood.com/recipes/greek-salad',
];
