import 'dotenv/config';
import { PrismaClient, RecipeTag, IngredientCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Ingredients ────────────────────────────────────────────────────────────
  const ingredients = await Promise.all([
    // Produce
    prisma.ingredient.upsert({ where: { name: 'onion' }, update: {}, create: { name: 'onion', category: IngredientCategory.produce } }),
    prisma.ingredient.upsert({ where: { name: 'garlic' }, update: {}, create: { name: 'garlic', category: IngredientCategory.produce } }),
    prisma.ingredient.upsert({ where: { name: 'cherry tomatoes' }, update: {}, create: { name: 'cherry tomatoes', category: IngredientCategory.produce } }),
    prisma.ingredient.upsert({ where: { name: 'bell pepper' }, update: {}, create: { name: 'bell pepper', category: IngredientCategory.produce } }),
    prisma.ingredient.upsert({ where: { name: 'broccoli' }, update: {}, create: { name: 'broccoli', category: IngredientCategory.produce } }),
    prisma.ingredient.upsert({ where: { name: 'spinach' }, update: {}, create: { name: 'spinach', category: IngredientCategory.produce } }),
    prisma.ingredient.upsert({ where: { name: 'zucchini' }, update: {}, create: { name: 'zucchini', category: IngredientCategory.produce } }),
    prisma.ingredient.upsert({ where: { name: 'lemon' }, update: {}, create: { name: 'lemon', category: IngredientCategory.produce } }),
    // Grains / pasta
    prisma.ingredient.upsert({ where: { name: 'spaghetti' }, update: {}, create: { name: 'spaghetti', category: IngredientCategory.grains } }),
    prisma.ingredient.upsert({ where: { name: 'penne' }, update: {}, create: { name: 'penne', category: IngredientCategory.grains } }),
    prisma.ingredient.upsert({ where: { name: 'basmati rice' }, update: {}, create: { name: 'basmati rice', category: IngredientCategory.grains } }),
    // Meat
    prisma.ingredient.upsert({ where: { name: 'chicken breast' }, update: {}, create: { name: 'chicken breast', category: IngredientCategory.meat } }),
    prisma.ingredient.upsert({ where: { name: 'ground beef' }, update: {}, create: { name: 'ground beef', category: IngredientCategory.meat } }),
    prisma.ingredient.upsert({ where: { name: 'salmon fillet' }, update: {}, create: { name: 'salmon fillet', category: IngredientCategory.seafood } }),
    // Dairy
    prisma.ingredient.upsert({ where: { name: 'parmesan' }, update: {}, create: { name: 'parmesan', category: IngredientCategory.dairy } }),
    prisma.ingredient.upsert({ where: { name: 'feta cheese' }, update: {}, create: { name: 'feta cheese', category: IngredientCategory.dairy } }),
    // Canned / pantry
    prisma.ingredient.upsert({ where: { name: 'canned tomatoes' }, update: {}, create: { name: 'canned tomatoes', category: IngredientCategory.canned } }),
    prisma.ingredient.upsert({ where: { name: 'canned chickpeas' }, update: {}, create: { name: 'canned chickpeas', category: IngredientCategory.canned } }),
    // Condiments / spices
    prisma.ingredient.upsert({ where: { name: 'olive oil' }, update: {}, create: { name: 'olive oil', category: IngredientCategory.condiments } }),
    prisma.ingredient.upsert({ where: { name: 'soy sauce' }, update: {}, create: { name: 'soy sauce', category: IngredientCategory.condiments } }),
    prisma.ingredient.upsert({ where: { name: 'salt' }, update: {}, create: { name: 'salt', category: IngredientCategory.spices } }),
    prisma.ingredient.upsert({ where: { name: 'black pepper' }, update: {}, create: { name: 'black pepper', category: IngredientCategory.spices } }),
    prisma.ingredient.upsert({ where: { name: 'cumin' }, update: {}, create: { name: 'cumin', category: IngredientCategory.spices } }),
    prisma.ingredient.upsert({ where: { name: 'smoked paprika' }, update: {}, create: { name: 'smoked paprika', category: IngredientCategory.spices } }),
  ]);

  const byName = Object.fromEntries(ingredients.map((i) => [i.name, i]));

  // ─── Recipes ────────────────────────────────────────────────────────────────
  const spaghetti = await prisma.recipe.upsert({
    where: { id: 'recipe-aglio-olio' },
    update: {},
    create: {
      id: 'recipe-aglio-olio',
      title: 'Spaghetti Aglio e Olio',
      description: 'Classic Italian pasta with garlic, olive oil, and parmesan. Ready in 20 minutes.',
      cookTimeMinutes: 20,
      servings: 2,
      tags: [RecipeTag.pasta, RecipeTag.quick, RecipeTag.vegetarian],
      steps: [
        { order: 1, text: 'Cook spaghetti in salted boiling water until al dente.' },
        { order: 2, text: 'Thinly slice garlic and sauté in olive oil over low heat until golden.' },
        { order: 3, text: 'Toss drained pasta with the garlic oil. Season generously.' },
        { order: 4, text: 'Serve with grated parmesan.' },
      ],
      ingredients: {
        create: [
          { ingredientId: byName['spaghetti'].id, amount: 200, unit: 'g' },
          { ingredientId: byName['garlic'].id, amount: 4, unit: 'cloves' },
          { ingredientId: byName['olive oil'].id, amount: 4, unit: 'tbsp' },
          { ingredientId: byName['parmesan'].id, amount: 40, unit: 'g' },
          { ingredientId: byName['salt'].id, amount: 1, unit: 'tsp' },
          { ingredientId: byName['black pepper'].id, amount: 0.5, unit: 'tsp' },
        ],
      },
    },
  });

  const chickenStirFry = await prisma.recipe.upsert({
    where: { id: 'recipe-chicken-stir-fry' },
    update: {},
    create: {
      id: 'recipe-chicken-stir-fry',
      title: 'Chicken & Broccoli Stir-Fry',
      description: 'Quick and healthy stir-fry with tender chicken and crisp broccoli over rice.',
      cookTimeMinutes: 25,
      servings: 2,
      tags: [RecipeTag.stir_fry, RecipeTag.healthy, RecipeTag.high_protein, RecipeTag.quick],
      steps: [
        { order: 1, text: 'Cook rice according to package instructions.' },
        { order: 2, text: 'Slice chicken into thin strips and season with salt and pepper.' },
        { order: 3, text: 'Stir-fry chicken in a hot pan with oil until cooked through, set aside.' },
        { order: 4, text: 'Stir-fry broccoli and garlic for 3 minutes. Add soy sauce and the chicken back in.' },
        { order: 5, text: 'Serve over rice.' },
      ],
      ingredients: {
        create: [
          { ingredientId: byName['chicken breast'].id, amount: 300, unit: 'g' },
          { ingredientId: byName['broccoli'].id, amount: 300, unit: 'g' },
          { ingredientId: byName['basmati rice'].id, amount: 160, unit: 'g' },
          { ingredientId: byName['garlic'].id, amount: 2, unit: 'cloves' },
          { ingredientId: byName['soy sauce'].id, amount: 3, unit: 'tbsp' },
          { ingredientId: byName['olive oil'].id, amount: 2, unit: 'tbsp' },
        ],
      },
    },
  });

  const salmonSheet = await prisma.recipe.upsert({
    where: { id: 'recipe-salmon-sheet-pan' },
    update: {},
    create: {
      id: 'recipe-salmon-sheet-pan',
      title: 'Sheet-Pan Salmon with Veggies',
      description: 'Lemon-herb salmon roasted on one pan with zucchini and cherry tomatoes.',
      cookTimeMinutes: 30,
      servings: 2,
      tags: [RecipeTag.sheet_pan, RecipeTag.healthy, RecipeTag.high_protein],
      steps: [
        { order: 1, text: 'Preheat oven to 200°C. Line a sheet pan with parchment.' },
        { order: 2, text: 'Slice zucchini, halve tomatoes. Toss with olive oil, salt, and pepper on the pan.' },
        { order: 3, text: 'Place salmon fillets on the pan. Squeeze lemon over everything.' },
        { order: 4, text: 'Roast for 18–20 minutes until salmon flakes easily.' },
      ],
      ingredients: {
        create: [
          { ingredientId: byName['salmon fillet'].id, amount: 300, unit: 'g' },
          { ingredientId: byName['zucchini'].id, amount: 2, unit: 'pieces' },
          { ingredientId: byName['cherry tomatoes'].id, amount: 200, unit: 'g' },
          { ingredientId: byName['lemon'].id, amount: 1, unit: 'piece' },
          { ingredientId: byName['olive oil'].id, amount: 2, unit: 'tbsp' },
          { ingredientId: byName['salt'].id, amount: 1, unit: 'tsp' },
          { ingredientId: byName['black pepper'].id, amount: 0.5, unit: 'tsp' },
        ],
      },
    },
  });

  const chickpeaBowl = await prisma.recipe.upsert({
    where: { id: 'recipe-chickpea-bowl' },
    update: {},
    create: {
      id: 'recipe-chickpea-bowl',
      title: 'Spiced Chickpea & Spinach Bowl',
      description: 'Hearty plant-based bowl with smoky chickpeas, wilted spinach, and feta.',
      cookTimeMinutes: 20,
      servings: 2,
      tags: [RecipeTag.bowl, RecipeTag.vegetarian, RecipeTag.healthy, RecipeTag.quick, RecipeTag.cheap],
      steps: [
        { order: 1, text: 'Drain and rinse chickpeas. Toss with cumin, smoked paprika, salt, and olive oil.' },
        { order: 2, text: 'Pan-fry chickpeas for 5–7 minutes until crispy.' },
        { order: 3, text: 'Add spinach and garlic to the pan, cook until wilted.' },
        { order: 4, text: 'Serve in bowls topped with crumbled feta and a squeeze of lemon.' },
      ],
      ingredients: {
        create: [
          { ingredientId: byName['canned chickpeas'].id, amount: 400, unit: 'g' },
          { ingredientId: byName['spinach'].id, amount: 150, unit: 'g' },
          { ingredientId: byName['feta cheese'].id, amount: 80, unit: 'g' },
          { ingredientId: byName['garlic'].id, amount: 2, unit: 'cloves' },
          { ingredientId: byName['cumin'].id, amount: 1, unit: 'tsp' },
          { ingredientId: byName['smoked paprika'].id, amount: 1, unit: 'tsp' },
          { ingredientId: byName['olive oil'].id, amount: 2, unit: 'tbsp' },
          { ingredientId: byName['lemon'].id, amount: 0.5, unit: 'piece' },
        ],
      },
    },
  });

  const bolognese = await prisma.recipe.upsert({
    where: { id: 'recipe-bolognese' },
    update: {},
    create: {
      id: 'recipe-bolognese',
      title: 'Quick Penne Bolognese',
      description: 'A weeknight-friendly meat sauce with penne. Comfort food in 35 minutes.',
      cookTimeMinutes: 35,
      servings: 2,
      tags: [RecipeTag.pasta, RecipeTag.high_protein],
      steps: [
        { order: 1, text: 'Cook penne in salted boiling water until al dente.' },
        { order: 2, text: 'Brown ground beef with diced onion and garlic in a pan over medium-high heat.' },
        { order: 3, text: 'Add canned tomatoes, season with salt and pepper. Simmer 15 minutes.' },
        { order: 4, text: 'Toss pasta with the sauce and serve with parmesan.' },
      ],
      ingredients: {
        create: [
          { ingredientId: byName['penne'].id, amount: 200, unit: 'g' },
          { ingredientId: byName['ground beef'].id, amount: 250, unit: 'g' },
          { ingredientId: byName['canned tomatoes'].id, amount: 400, unit: 'g' },
          { ingredientId: byName['onion'].id, amount: 1, unit: 'piece' },
          { ingredientId: byName['garlic'].id, amount: 2, unit: 'cloves' },
          { ingredientId: byName['parmesan'].id, amount: 30, unit: 'g' },
          { ingredientId: byName['olive oil'].id, amount: 1, unit: 'tbsp' },
        ],
      },
    },
  });

  console.log('✅ Seeded recipes:', [spaghetti, chickenStirFry, salmonSheet, chickpeaBowl, bolognese].map((r) => r.title).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
