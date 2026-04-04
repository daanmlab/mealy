import 'dotenv/config';
import { PrismaClient, UnitType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database…');

  // ─── Units ────────────────────────────────────────────────────────────────
  const unitDefs = [
    { symbol: 'g',      name: 'gram',        type: UnitType.weight },
    { symbol: 'kg',     name: 'kilogram',    type: UnitType.weight },
    { symbol: 'oz',     name: 'ounce',       type: UnitType.weight },
    { symbol: 'lb',     name: 'pound',       type: UnitType.weight },
    { symbol: 'ml',     name: 'millilitre',  type: UnitType.volume },
    { symbol: 'l',      name: 'litre',       type: UnitType.volume },
    { symbol: 'cup',    name: 'cup',         type: UnitType.volume },
    { symbol: 'tbsp',   name: 'tablespoon',  type: UnitType.volume },
    { symbol: 'tsp',    name: 'teaspoon',    type: UnitType.volume },
    { symbol: 'cloves', name: 'cloves',      type: UnitType.count  },
    { symbol: 'pieces', name: 'pieces',      type: UnitType.count  },
    { symbol: 'slice',  name: 'slice',       type: UnitType.count  },
    { symbol: 'bunch',  name: 'bunch',       type: UnitType.count  },
    { symbol: 'pinch',  name: 'pinch',       type: UnitType.other  },
    { symbol: 'unit',   name: 'unit',        type: UnitType.other  },
  ];

  const units = await Promise.all(
    unitDefs.map((u) =>
      prisma.unit.upsert({ where: { symbol: u.symbol }, create: u, update: {} }),
    ),
  );
  const unitBySymbol = Object.fromEntries(units.map((u) => [u.symbol, u]));
  console.log(`  ✓ ${units.length} units`);

  // ─── Unit conversions ─────────────────────────────────────────────────────
  const conversionDefs = [
    { from: 'g',    to: 'kg',   factor: 0.001   },
    { from: 'kg',   to: 'g',    factor: 1000     },
    { from: 'oz',   to: 'g',    factor: 28.3495  },
    { from: 'g',    to: 'oz',   factor: 0.035274 },
    { from: 'lb',   to: 'g',    factor: 453.592  },
    { from: 'g',    to: 'lb',   factor: 0.002205 },
    { from: 'ml',   to: 'l',    factor: 0.001    },
    { from: 'l',    to: 'ml',   factor: 1000     },
    { from: 'tsp',  to: 'ml',   factor: 4.92892  },
    { from: 'tbsp', to: 'ml',   factor: 14.7868  },
    { from: 'cup',  to: 'ml',   factor: 236.588  },
  ];

  await Promise.all(
    conversionDefs.map(({ from, to, factor }) =>
      prisma.unitConversion.upsert({
        where: {
          fromUnitId_toUnitId: {
            fromUnitId: unitBySymbol[from].id,
            toUnitId: unitBySymbol[to].id,
          },
        },
        create: {
          fromUnitId: unitBySymbol[from].id,
          toUnitId: unitBySymbol[to].id,
          factor,
        },
        update: { factor },
      }),
    ),
  );
  console.log(`  ✓ ${conversionDefs.length} unit conversions`);

  // ─── Ingredient categories ─────────────────────────────────────────────────
  const categoryDefs = [
    { slug: 'produce',    name: 'Produce'    },
    { slug: 'meat',       name: 'Meat'       },
    { slug: 'seafood',    name: 'Seafood'    },
    { slug: 'dairy',      name: 'Dairy'      },
    { slug: 'grains',     name: 'Grains'     },
    { slug: 'canned',     name: 'Canned'     },
    { slug: 'condiments', name: 'Condiments' },
    { slug: 'spices',     name: 'Spices'     },
    { slug: 'frozen',     name: 'Frozen'     },
    { slug: 'other',      name: 'Other'      },
  ];

  const categories = await Promise.all(
    categoryDefs.map((c) =>
      prisma.ingredientCategory.upsert({ where: { slug: c.slug }, create: c, update: {} }),
    ),
  );
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  console.log(`  ✓ ${categories.length} ingredient categories`);

  // ─── Tags ─────────────────────────────────────────────────────────────────
  const tagDefs = [
    { slug: 'pasta',       name: 'Pasta'       },
    { slug: 'rice',        name: 'Rice'        },
    { slug: 'bowl',        name: 'Bowl'        },
    { slug: 'stir_fry',    name: 'Stir Fry'    },
    { slug: 'salad',       name: 'Salad'       },
    { slug: 'soup',        name: 'Soup'        },
    { slug: 'sheet_pan',   name: 'Sheet Pan'   },
    { slug: 'quick',       name: 'Quick'       },
    { slug: 'healthy',     name: 'Healthy'     },
    { slug: 'cheap',       name: 'Cheap'       },
    { slug: 'high_protein',name: 'High Protein'},
    { slug: 'vegetarian',  name: 'Vegetarian'  },
    { slug: 'vegan',       name: 'Vegan'       },
    { slug: 'meal_prep',   name: 'Meal Prep'   },
  ];

  const tags = await Promise.all(
    tagDefs.map((t) =>
      prisma.tag.upsert({ where: { slug: t.slug }, create: t, update: {} }),
    ),
  );
  const tagBySlug = Object.fromEntries(tags.map((t) => [t.slug, t]));
  console.log(`  ✓ ${tags.length} tags`);

  // ─── Helper to upsert an ingredient ───────────────────────────────────────
  const ing = (name: string, catSlug: string) =>
    prisma.ingredient.upsert({
      where: { name },
      create: { name, categoryId: catBySlug[catSlug].id },
      update: {},
    });

  // ─── Ingredients ──────────────────────────────────────────────────────────
  const ingredients = await Promise.all([
    ing('onion',           'produce'),
    ing('garlic',          'produce'),
    ing('cherry tomatoes', 'produce'),
    ing('bell pepper',     'produce'),
    ing('broccoli',        'produce'),
    ing('spinach',         'produce'),
    ing('zucchini',        'produce'),
    ing('lemon',           'produce'),
    ing('spaghetti',       'grains'),
    ing('penne',           'grains'),
    ing('basmati rice',    'grains'),
    ing('chicken breast',  'meat'),
    ing('ground beef',     'meat'),
    ing('salmon fillet',   'seafood'),
    ing('parmesan',        'dairy'),
    ing('feta cheese',     'dairy'),
    ing('canned tomatoes', 'canned'),
    ing('canned chickpeas','canned'),
    ing('olive oil',       'condiments'),
    ing('soy sauce',       'condiments'),
    ing('salt',            'spices'),
    ing('black pepper',    'spices'),
    ing('cumin',           'spices'),
    ing('smoked paprika',  'spices'),
  ]);
  const byName = Object.fromEntries(ingredients.map((i) => [i.name, i]));
  console.log(`  ✓ ${ingredients.length} ingredients`);

  // ─── Helper to create a recipe ────────────────────────────────────────────
  type IngRow = { name: string; amount: number; unitSymbol: string };
  async function upsertRecipe(
    id: string,
    data: {
      title: string;
      description: string;
      cookTimeMinutes: number;
      servings: number;
      tagSlugs: string[];
      steps: string[];
      ings: IngRow[];
    },
  ) {
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (existing) return existing;

    // Ensure units exist
    const unitSymbols = [...new Set(data.ings.map((i) => i.unitSymbol))];
    await Promise.all(
      unitSymbols.map((symbol) =>
        prisma.unit.upsert({
          where: { symbol },
          create: { symbol, name: symbol, type: UnitType.other },
          update: {},
        }),
      ),
    );
    const unitRows = await prisma.unit.findMany({ where: { symbol: { in: unitSymbols } } });
    const unitMap = Object.fromEntries(unitRows.map((u) => [u.symbol, u]));

    const recipe = await prisma.recipe.create({
      data: {
        id,
        title: data.title,
        description: data.description,
        cookTimeMinutes: data.cookTimeMinutes,
        servings: data.servings,
        steps: data.steps.map((text, i) => ({ order: i + 1, text })),
        tags: {
          create: data.tagSlugs.map((slug) => ({ tagId: tagBySlug[slug].id })),
        },
        ingredients: {
          create: data.ings.map((i) => ({
            ingredientId: byName[i.name].id,
            unitId: unitMap[i.unitSymbol].id,
            amount: i.amount,
          })),
        },
      },
    });
    return recipe;
  }

  // ─── Seed recipes ─────────────────────────────────────────────────────────
  const seeded = await Promise.all([
    upsertRecipe('recipe-aglio-olio', {
      title: 'Spaghetti Aglio e Olio',
      description: 'Classic Italian pasta with garlic, olive oil, and parmesan. Ready in 20 minutes.',
      cookTimeMinutes: 20,
      servings: 2,
      tagSlugs: ['pasta', 'quick', 'vegetarian'],
      steps: [
        'Cook spaghetti in salted boiling water until al dente.',
        'Thinly slice garlic and sauté in olive oil over low heat until golden.',
        'Toss drained pasta with the garlic oil. Season generously.',
        'Serve with grated parmesan.',
      ],
      ings: [
        { name: 'spaghetti',   amount: 200, unitSymbol: 'g'      },
        { name: 'garlic',      amount: 4,   unitSymbol: 'cloves' },
        { name: 'olive oil',   amount: 4,   unitSymbol: 'tbsp'   },
        { name: 'parmesan',    amount: 40,  unitSymbol: 'g'      },
        { name: 'salt',        amount: 1,   unitSymbol: 'tsp'    },
        { name: 'black pepper',amount: 0.5, unitSymbol: 'tsp'    },
      ],
    }),
    upsertRecipe('recipe-chicken-stir-fry', {
      title: 'Chicken & Broccoli Stir-Fry',
      description: 'Quick and healthy stir-fry with tender chicken and crisp broccoli over rice.',
      cookTimeMinutes: 25,
      servings: 2,
      tagSlugs: ['stir_fry', 'healthy', 'high_protein', 'quick'],
      steps: [
        'Cook rice according to package instructions.',
        'Slice chicken into thin strips and season with salt and pepper.',
        'Stir-fry chicken in a hot pan with oil until cooked through, set aside.',
        'Stir-fry broccoli and garlic for 3 minutes. Add soy sauce and the chicken back in.',
        'Serve over rice.',
      ],
      ings: [
        { name: 'chicken breast', amount: 300, unitSymbol: 'g'      },
        { name: 'broccoli',       amount: 300, unitSymbol: 'g'      },
        { name: 'basmati rice',   amount: 160, unitSymbol: 'g'      },
        { name: 'garlic',         amount: 2,   unitSymbol: 'cloves' },
        { name: 'soy sauce',      amount: 3,   unitSymbol: 'tbsp'   },
        { name: 'olive oil',      amount: 2,   unitSymbol: 'tbsp'   },
      ],
    }),
    upsertRecipe('recipe-salmon-sheet-pan', {
      title: 'Sheet-Pan Salmon with Veggies',
      description: 'Lemon-herb salmon roasted on one pan with zucchini and cherry tomatoes.',
      cookTimeMinutes: 30,
      servings: 2,
      tagSlugs: ['sheet_pan', 'healthy', 'high_protein'],
      steps: [
        'Preheat oven to 200°C. Line a sheet pan with parchment.',
        'Slice zucchini, halve tomatoes. Toss with olive oil, salt, and pepper on the pan.',
        'Place salmon fillets on the pan. Squeeze lemon over everything.',
        'Roast for 18–20 minutes until salmon flakes easily.',
      ],
      ings: [
        { name: 'salmon fillet',   amount: 300, unitSymbol: 'g'      },
        { name: 'zucchini',        amount: 2,   unitSymbol: 'pieces' },
        { name: 'cherry tomatoes', amount: 200, unitSymbol: 'g'      },
        { name: 'lemon',           amount: 1,   unitSymbol: 'pieces' },
        { name: 'olive oil',       amount: 2,   unitSymbol: 'tbsp'   },
        { name: 'salt',            amount: 1,   unitSymbol: 'tsp'    },
        { name: 'black pepper',    amount: 0.5, unitSymbol: 'tsp'    },
      ],
    }),
    upsertRecipe('recipe-chickpea-bowl', {
      title: 'Spiced Chickpea & Spinach Bowl',
      description: 'Hearty plant-based bowl with smoky chickpeas, wilted spinach, and feta.',
      cookTimeMinutes: 20,
      servings: 2,
      tagSlugs: ['bowl', 'vegetarian', 'healthy', 'quick', 'cheap'],
      steps: [
        'Drain and rinse chickpeas. Toss with cumin, smoked paprika, salt, and olive oil.',
        'Pan-fry chickpeas for 5–7 minutes until crispy.',
        'Add spinach and garlic to the pan, cook until wilted.',
        'Serve in bowls topped with crumbled feta and a squeeze of lemon.',
      ],
      ings: [
        { name: 'canned chickpeas', amount: 400, unitSymbol: 'g'      },
        { name: 'spinach',          amount: 150, unitSymbol: 'g'      },
        { name: 'feta cheese',      amount: 80,  unitSymbol: 'g'      },
        { name: 'garlic',           amount: 2,   unitSymbol: 'cloves' },
        { name: 'cumin',            amount: 1,   unitSymbol: 'tsp'    },
        { name: 'smoked paprika',   amount: 1,   unitSymbol: 'tsp'    },
        { name: 'olive oil',        amount: 2,   unitSymbol: 'tbsp'   },
        { name: 'lemon',            amount: 0.5, unitSymbol: 'pieces' },
      ],
    }),
    upsertRecipe('recipe-bolognese', {
      title: 'Quick Penne Bolognese',
      description: 'A weeknight-friendly meat sauce with penne. Comfort food in 35 minutes.',
      cookTimeMinutes: 35,
      servings: 2,
      tagSlugs: ['pasta', 'high_protein'],
      steps: [
        'Cook penne in salted boiling water until al dente.',
        'Brown ground beef with diced onion and garlic in a pan over medium-high heat.',
        'Add canned tomatoes, season with salt and pepper. Simmer 15 minutes.',
        'Toss pasta with the sauce and serve with parmesan.',
      ],
      ings: [
        { name: 'penne',          amount: 200, unitSymbol: 'g'      },
        { name: 'ground beef',    amount: 250, unitSymbol: 'g'      },
        { name: 'canned tomatoes',amount: 400, unitSymbol: 'g'      },
        { name: 'onion',          amount: 1,   unitSymbol: 'pieces' },
        { name: 'garlic',         amount: 2,   unitSymbol: 'cloves' },
        { name: 'parmesan',       amount: 30,  unitSymbol: 'g'      },
        { name: 'olive oil',      amount: 1,   unitSymbol: 'tbsp'   },
      ],
    }),
  ]);

  console.log(`  ✓ ${seeded.length} seed recipes: ${seeded.map((r) => r.title).join(', ')}`);
  console.log('✅ Done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
